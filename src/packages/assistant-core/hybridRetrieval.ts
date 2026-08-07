import OpenAI from "openai";
import { Prisma, PrismaClient } from "@prisma/client";
import { GENERAL_KNOWLEDGE_SEED } from "./generalKnowledgeSeed";
import type { GeneralKnowledgeEntry, GovernedClaim, HairKnowledgeTopic, KnowledgeSystem, KnowledgeContentType, KnowledgeTaxonomyDomain } from "./knowledgeTypes";

export type RetrievalQuery = { text: string; rewrittenQueries?: string[]; domain: "HAIR"; entityId?: string; topics?: HairKnowledgeTopic[]; systems?: KnowledgeSystem[]; taxonomyDomains?: KnowledgeTaxonomyDomain[]; contentTypes?: KnowledgeContentType[]; audience?: "DOCTOR" | "PATIENT" | "INTERNAL"; productFamily?: string; variant?: string; sourceVersion?: string; language?: string; limit?: number };
export type KnowledgeHit = GeneralKnowledgeEntry & { lexicalScore: number; semanticScore: number; fusedScore: number; rerankScore: number };
export type Contradiction = { claimKey: string; values: string[]; sourceIds: string[] };
export type RetrievalResult = { hits: KnowledgeHit[]; contradictions: Contradiction[]; evidenceSufficient: boolean; insufficiencyReasons: string[]; strategy: "POSTGRES_HYBRID" | "STATIC_APPROVED_FALLBACK" };
export interface KnowledgeRetriever { search(query: RetrievalQuery): Promise<RetrievalResult>; }
export interface CrossEncoderReranker { score(query: string, candidates: Array<{ title: string; content: string }>): Promise<number[]>; }

export class HttpCrossEncoderReranker implements CrossEncoderReranker {
  constructor(private readonly endpoint: string, private readonly apiKey?: string, private readonly timeoutMs = 8_000) {}
  async score(query: string, candidates: Array<{ title: string; content: string }>): Promise<number[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(this.endpoint, { method: "POST", signal: controller.signal, headers: { "content-type": "application/json", ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}) }, body: JSON.stringify({ query, candidates }) });
      if (!response.ok) throw new Error(`Cross-encoder reranker failed with status ${response.status}`);
      const body = await response.json() as { scores?: unknown };
      if (!Array.isArray(body.scores) || body.scores.length !== candidates.length || body.scores.some((score) => typeof score !== "number" || !Number.isFinite(score))) throw new Error("Cross-encoder reranker returned an invalid score vector");
      return body.scores as number[];
    } finally { clearTimeout(timeout); }
  }
}
const words = (value: string) => new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2));
const isEffective = (entry: { effectiveFrom: string; effectiveUntil?: string }, now: Date) => new Date(entry.effectiveFrom) <= now && (!entry.effectiveUntil || new Date(entry.effectiveUntil) > now);

function metadataMatches(entry: GeneralKnowledgeEntry, query: RetrievalQuery): boolean {
  const metadata = entry.metadata;
  if (query.entityId && metadata?.canonicalEntity !== query.entityId) return false;
  if (query.taxonomyDomains?.length && (!metadata?.taxonomyDomain || !query.taxonomyDomains.includes(metadata.taxonomyDomain))) return false;
  if (query.contentTypes?.length && (!metadata?.contentType || !query.contentTypes.includes(metadata.contentType))) return false;
  if (query.audience && metadata?.audience?.length && !metadata.audience.includes(query.audience)) return false;
  if (query.productFamily && metadata?.productFamily !== query.productFamily) return false;
  if (query.variant && metadata?.variant !== query.variant) return false;
  if (query.sourceVersion && entry.sourceVersion !== query.sourceVersion) return false;
  return true;
}

function directlyRelevant(entry: GeneralKnowledgeEntry, query: RetrievalQuery, queryWords: Set<string>): boolean {
  if (query.entityId) return true;
  const hay = words(`${entry.title} ${entry.content} ${entry.keywords.join(" ")} ${entry.metadata?.aliases?.join(" ") ?? ""}`);
  return [...queryWords].some((word) => hay.has(word));
}
function contradictionsFor(hits: KnowledgeHit[]): Contradiction[] {
  const groups = new Map<string, { values: Set<string>; sourceIds: string[] }>();
  for (const hit of hits) for (const claim of hit.claims) {
    if (!claim.contradictionGroup) continue;
    const group = groups.get(claim.contradictionGroup) ?? { values: new Set<string>(), sourceIds: [] };
    group.values.add(claim.statement); group.sourceIds.push(claim.claimId); groups.set(claim.contradictionGroup, group);
  }
  return [...groups].filter(([, group]) => group.values.size > 1).map(([claimKey, group]) => ({ claimKey, values: [...group.values], sourceIds: group.sourceIds }));
}

function complete(hits: KnowledgeHit[], contradictions: Contradiction[], strategy: RetrievalResult["strategy"]): RetrievalResult {
  const reasons: string[] = [];
  if (!hits.length) reasons.push("NO_CURRENT_PATIENT_PUBLISHED_HAIR_SOURCE");
  if (hits.length && !hits.some((hit) => hit.claims.some((claim) => claim.approvalStatus === "PUBLISHED_PATIENT" && claim.evidenceStatus === "SUPPORTED"))) reasons.push("NO_SUPPORTED_PUBLISHED_CLAIM");
  if (contradictions.length) reasons.push("UNRESOLVED_CONTRADICTION");
  return { hits, contradictions, evidenceSufficient: reasons.length === 0, insufficiencyReasons: reasons, strategy };
}

export class StaticApprovedKnowledgeRetriever implements KnowledgeRetriever {
  async search(query: RetrievalQuery): Promise<RetrievalResult> {
    if (query.domain !== "HAIR") return complete([], [], "STATIC_APPROVED_FALLBACK");
    const queryWords = words((query.rewrittenQueries?.length ? query.rewrittenQueries : [query.text]).join(" ")); const now = new Date();
    const requiredEntity = ["pcos", "thyroid", "menopause", "greying", "grey hair", "onion juice"].find((term) => query.text.toLowerCase().includes(term));
    const hits = GENERAL_KNOWLEDGE_SEED
      .filter((entry) => entry.domain === "HAIR" && entry.sourceStatus === "ACTIVE" && entry.approvalStatus === "PUBLISHED_PATIENT" && isEffective(entry, now))
      .filter((entry) => metadataMatches(entry, query))
      .filter((entry) => !query.topics?.length || query.topics.includes(entry.topic))
      .filter((entry) => !query.systems?.length || query.systems.includes(entry.knowledgeSystem))
      .filter((entry) => !requiredEntity || `${entry.title} ${entry.content} ${entry.keywords.join(" ")}`.toLowerCase().includes(requiredEntity))
      .filter((entry) => directlyRelevant(entry, query, queryWords))
      .map((entry) => {
        const hay = words(`${entry.title} ${entry.content} ${entry.keywords.join(" ")}`);
        const overlap = [...queryWords].filter((word) => hay.has(word)).length;
        const lexicalScore = queryWords.size ? overlap / queryWords.size : 0;
        const fusedScore = lexicalScore * 0.85 + entry.authorityScore / 1000;
        return { ...entry, lexicalScore, semanticScore: 0, fusedScore, rerankScore: fusedScore };
      }).filter((entry) => query.entityId || entry.lexicalScore > 0).sort((a, b) => b.rerankScore - a.rerankScore).slice(0, query.limit ?? 5);
    return complete(hits, contradictionsFor(hits), "STATIC_APPROVED_FALLBACK");
  }
}

export class OpenAIEmbeddingProvider {
  private readonly client: OpenAI;
  constructor(apiKey: string, readonly modelName = process.env.ASSISTANT_EMBEDDING_MODEL ?? "text-embedding-3-small", readonly dimensions = 1536) { this.client = new OpenAI({ apiKey }); }
  async embedMany(texts: string[]): Promise<number[][]> {
    if (!texts.length) return [];
    const response = await this.client.embeddings.create({ model: this.modelName, input: texts, encoding_format: "float", ...(this.modelName.startsWith("text-embedding-3-") ? { dimensions: this.dimensions } : {}) });
    const vectors = [...response.data].sort((a, b) => a.index - b.index).map((item) => item.embedding);
    if (vectors.length !== texts.length || vectors.some((vector) => vector.length !== this.dimensions)) throw new Error(`Embedding model ${this.modelName} did not return ${this.dimensions}-dimension vectors`);
    return vectors;
  }
  async embed(text: string): Promise<number[]> { return (await this.embedMany([text]))[0]; }
}

type DbHit = { id: string; title: string | null; topic: string; knowledgeSystem: string; language: string; content: string; authorityScore: number; sourceType: string; metadata: Prisma.JsonValue; claims: Prisma.JsonValue; lexicalScore: number; semanticScore: number; fusedScore: number; sourceFile: string; version: number; effectiveFrom: Date | null; effectiveUntil: Date | null };

export class PrismaHybridKnowledgeRetriever implements KnowledgeRetriever {
  constructor(private readonly prisma: PrismaClient, private readonly embedding?: OpenAIEmbeddingProvider, private readonly fallback: KnowledgeRetriever = new StaticApprovedKnowledgeRetriever(), private readonly crossEncoder?: CrossEncoderReranker) {}

  async search(query: RetrievalQuery): Promise<RetrievalResult> {
    if (query.domain !== "HAIR") return complete([], [], "POSTGRES_HYBRID");
    try {
      const rewritten = query.rewrittenQueries?.length ? query.rewrittenQueries : [query.text];
      const searchText = rewritten.join(" ");
      const vector = this.embedding ? JSON.stringify(await this.embedding.embed(searchText)) : null;
      const topicFilter = query.topics?.length ? Prisma.sql`AND kc."topic" IN (${Prisma.join(query.topics)})` : Prisma.empty;
      const systemFilter = query.systems?.length ? Prisma.sql`AND kc."knowledgeSystem" IN (${Prisma.join(query.systems)})` : Prisma.empty;
      const entityFilter = query.entityId ? Prisma.sql`AND kc."entityId" = ${query.entityId}` : Prisma.empty;
      const contentTypeFilter = query.contentTypes?.length ? Prisma.sql`AND kc."metadata"->>'contentType' IN (${Prisma.join(query.contentTypes)})` : Prisma.empty;
      const taxonomyFilter = query.taxonomyDomains?.length ? Prisma.sql`AND kc."metadata"->>'taxonomyDomain' IN (${Prisma.join(query.taxonomyDomains)})` : Prisma.empty;
      const semantic = vector ? Prisma.sql`GREATEST(0, 1 - (kc."embedding"::vector(1536) <=> ${vector}::vector(1536)))` : Prisma.sql`0::double precision`;
      const candidateLimit = Math.max((query.limit ?? 8) * 4, 20);
      const candidates = await this.prisma.$queryRaw<DbHit[]>(Prisma.sql`
        WITH scored AS (
          SELECT kc."id", kd."title", kc."topic", kc."knowledgeSystem", kc."language", kc."content", kc."authorityScore", kd."sourceType", kc."metadata",
                 COALESCE((SELECT jsonb_agg(jsonb_build_object('claimId', c."claimId", 'claimType', c."claimType", 'statement', c."statement", 'evidenceStatus', c."evidenceStatus", 'approvalStatus', c."approvalStatus", 'audience', c."audience", 'effectiveFrom', c."effectiveFrom", 'effectiveUntil', c."effectiveUntil", 'contradictionGroup', c."contradictionGroup", 'supersededByClaimId', c."supersededByClaimId")) FROM "KnowledgeClaim" c WHERE c."chunkId" = kc."id" AND c."domain" = 'HAIR' AND c."approvalStatus" = 'PUBLISHED_PATIENT' AND (c."effectiveFrom" IS NULL OR c."effectiveFrom" <= CURRENT_TIMESTAMP) AND (c."effectiveUntil" IS NULL OR c."effectiveUntil" > CURRENT_TIMESTAMP)), '[]'::jsonb) AS claims,
                 ts_rank_cd(to_tsvector('simple', kc."content"), websearch_to_tsquery('simple', ${searchText}))::double precision AS "lexicalScore", ${semantic} AS "semanticScore",
                 kv."sourceFile", kv."version", kc."effectiveFrom", kc."effectiveUntil"
          FROM "KnowledgeChunk" kc JOIN "KnowledgeDocumentVersion" kv ON kv."id" = kc."documentVersionId" JOIN "KnowledgeDocument" kd ON kd."id" = kv."documentId"
          WHERE kc."clinicId" IS NULL AND kd."clinicId" IS NULL AND kc."domain" = 'HAIR' AND kd."domain" = 'HAIR'
            AND kd."sourceStatus" = 'ACTIVE' AND kv."sourceStatus" = 'ACTIVE'
            AND kc."approvalStatus" = 'PUBLISHED_PATIENT' AND kv."status" = 'PUBLISHED_PATIENT' AND kd."status" = 'PUBLISHED_PATIENT'
            AND (kc."effectiveFrom" IS NULL OR kc."effectiveFrom" <= CURRENT_TIMESTAMP) AND (kc."effectiveUntil" IS NULL OR kc."effectiveUntil" > CURRENT_TIMESTAMP)
            AND (kv."effectiveFrom" IS NULL OR kv."effectiveFrom" <= CURRENT_TIMESTAMP) AND (kv."effectiveUntil" IS NULL OR kv."effectiveUntil" > CURRENT_TIMESTAMP)
            AND kc."language" IN (${query.language ?? "en"}, 'en') ${entityFilter} ${topicFilter} ${systemFilter} ${contentTypeFilter} ${taxonomyFilter}
            AND EXISTS (SELECT 1 FROM "KnowledgeClaim" c WHERE c."chunkId" = kc."id" AND c."domain" = 'HAIR' AND c."approvalStatus" = 'PUBLISHED_PATIENT' AND c."evidenceStatus" = 'SUPPORTED' AND (c."effectiveFrom" IS NULL OR c."effectiveFrom" <= CURRENT_TIMESTAMP) AND (c."effectiveUntil" IS NULL OR c."effectiveUntil" > CURRENT_TIMESTAMP))
        ), ranked AS (
          SELECT *, row_number() OVER (ORDER BY "lexicalScore" DESC) "lexicalRank", row_number() OVER (ORDER BY "semanticScore" DESC) "semanticRank" FROM scored WHERE "lexicalScore" > 0 OR "semanticScore" > 0.35
        )
        SELECT *, (CASE WHEN "lexicalScore" > 0 THEN 1.0/(60+"lexicalRank") ELSE 0 END + CASE WHEN "semanticScore" > 0.35 THEN 1.0/(60+"semanticRank") ELSE 0 END + "authorityScore"/20000.0 + GREATEST(0, 0.003 - EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP-COALESCE("effectiveFrom",CURRENT_TIMESTAMP)))/315576000000.0))::double precision "fusedScore"
        FROM ranked ORDER BY "fusedScore" DESC LIMIT ${candidateLimit}
      `);
      if (!candidates.length) return this.fallback.search(query);
      const pairScores = this.crossEncoder ? await this.crossEncoder.score(searchText, candidates.map((row) => ({ title: row.title ?? row.topic, content: row.content }))) : [];
      const terms = [...words(searchText)];
      const rows = candidates.map((row, index) => {
        const heuristic = terms.filter((term) => `${row.title ?? ""} ${row.content}`.toLowerCase().includes(term)).length / Math.max(terms.length, 1);
        return { ...row, rerankScore: Number(row.fusedScore) * 0.7 + (pairScores[index] ?? heuristic) * 0.3 };
      }).sort((a, b) => b.rerankScore - a.rerankScore).slice(0, query.limit ?? 8);
      const hits: KnowledgeHit[] = rows.map((row) => {
        const metadata = (row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? row.metadata : {}) as Record<string, unknown>;
        const claims = Array.isArray(row.claims) ? row.claims as unknown as GovernedClaim[] : [];
        return { id: row.id, title: row.title ?? row.topic, domain: "HAIR", topic: row.topic as HairKnowledgeTopic, knowledgeSystem: row.knowledgeSystem as KnowledgeSystem, language: "en", content: row.content, keywords: [], approvalStatus: "PUBLISHED_PATIENT", authorityScore: row.authorityScore, sourceType: row.sourceType as GeneralKnowledgeEntry["sourceType"], sourceStatus: "ACTIVE", sourceLabel: typeof metadata.sourceLabel === "string" ? metadata.sourceLabel : row.sourceFile, sourceUrl: typeof metadata.sourceUrl === "string" ? metadata.sourceUrl : "", sourceVersion: String(row.version), effectiveFrom: row.effectiveFrom?.toISOString() ?? "", effectiveUntil: row.effectiveUntil?.toISOString(), metadata: metadata as GeneralKnowledgeEntry["metadata"], claims, lexicalScore: Number(row.lexicalScore), semanticScore: Number(row.semanticScore), fusedScore: Number(row.fusedScore), rerankScore: row.rerankScore };
      });
      return complete(hits, contradictionsFor(hits), "POSTGRES_HYBRID");
    } catch { return this.fallback.search(query); }
  }
}
