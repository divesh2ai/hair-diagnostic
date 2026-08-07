# Dr. FACT General Hair Assistant — Advanced RAG Handoff

Date: 2026-07-20
Status: implementation complete; staging validation only; not deployed

## Outcome

Dr. FACT now has two server-enforced modes:

- `GENERAL_KNOWLEDGE`: anonymous, global-only hair education and exact catalogue lookup. It does not create a clinical thread or read patient, assessment, consultation, rule-trace, or doctor-modification records.
- `PERSONAL_PLAN`: explicit mode on the existing authenticated endpoint. Existing clinic, patient, assessment, release-mode, ownership, RLS, trace, and escalation controls remain in place.

The deterministic clinical engine was not modified. General mode never selects, prioritises, suppresses, or sequences a kit for a patient.

## Reused HairOS components

| Area | Reused components |
|---|---|
| Chat | Existing assistant page/component, personal chat route, message/citation/tool-call records, feedback, release-mode trace |
| AI | Assistant safety/action types; HairOS condition, ingredient, topical, nutrition and lifestyle knowledge; existing OpenAI SDK |
| Supabase | Existing authenticated `getClinicContext` path for personal mode; no Supabase/clinic prerequisite added to general mode |
| Prisma | Product, alias, price/version, ingredient, kit/version/component/schedule, knowledge document/version/chunk, ingestion-run and assistant trace models |
| Clinical authority | Existing `PrismaClinicalAuthority`, approved-plan lookup and deterministic rule trace; unchanged and reachable only through personal mode |

## Advanced RAG pipeline

1. English, Hindi and Hinglish normalisation, common typo correction, aliases and bounded follow-up context.
2. Intent and safety routing before retrieval.
3. Exact facts use structured catalogue tools, never RAG.
4. Explanatory retrieval enforces global scope, `PUBLISHED_PATIENT`, document/version/chunk publication, language/domain/knowledge-system metadata and effective dates.
5. PostgreSQL full-text and pgvector cosine candidates.
6. Reciprocal-rank fusion, source-authority contribution and a deterministic lexical/title reranking pass.
7. Metadata claim-key/value contradiction detection.
8. Citation-bearing answer rendering with a separate Ayurveda knowledge-system label.
9. A governed embedding job embeds only already-published, global, currently effective chunks and is idempotent. It never publishes a chunk.

## Catalogue ingestion

Source: `Dashboard/Kits & Product.xlsx`

- 35 kits
- 41 products
- 274 kit-product composition rows
- stable canonical IDs and aliases
- Sheet2 composition used as primary; additional kits from the other workbook ranges are additive only
- MRP, schedules, ingredients and exact formulation fields are absent in this workbook and remain null
- no price, schedule or ingredient records are fabricated by the importer
- importer fails closed if a canonical ID is already tenant-owned

The importer is implemented at `scripts/import-full-catalogue.ts`. It was not run against the configured remote database because this handoff is staging-validation-only and no environment marker identified that database as a safe staging target. Automated double-run tests prove convergence without duplicates.

## Database changes

A new additive migration creates:

- a partial global/patient-published metadata filter index
- a partial `simple` PostgreSQL FTS GIN index
- a partial 1536-dimension pgvector HNSW cosine expression index

No RLS policy is removed or weakened. The migration has not been applied.

## Architecture conflicts resolved

| Prior assumption | Resolution |
|---|---|
| Assistant page required clinic authentication | Page is public; personal mode remains authenticated |
| One chat endpoint mixed general and personal concerns | Separate anonymous general endpoint; explicit `PERSONAL_PLAN` guard on the existing endpoint |
| Stage 1 covered five kits | Full workbook catalogue added; original five-kit governed records remain intact |
| RAG could answer exact catalogue facts | Price, composition and formulation facts are routed to structured tools only |
| Ayurveda was deferred | Added only as a distinctly labelled knowledge system; never merged with dermatology claims |
| Globally unique canonical IDs could overwrite tenant rows | Importer rejects tenant-owned collisions instead of changing ownership |

## Validation

| Check | Result |
|---|---|
| Complete assistant suite | PASS — 9 files, 206 tests |
| Supplied Stage 1 golden fixture | PASS — all 50 supplied questions (within 60 Stage 1 tests) |
| Full catalogue entity coverage | PASS — every 35 kit and 41 product name resolves |
| Full catalogue idempotency | PASS — second import produces no new rows |
| Published-knowledge embedding idempotency | PASS |
| General/personal boundary and retrieval security | PASS |
| Migration/RLS security tests | PASS |
| Prisma validation | PASS |
| Filtered strict TypeScript check | PASS |
| Patient portal production build | PASS |
| Full repository TypeScript check | Existing unrelated errors remain; no new assistant-file errors |
| `git diff --check` on changed files | PASS |

## Staging sequence

1. Review and apply the additive retrieval-index migration in staging.
2. Confirm the target database is staging, then run `npx tsx scripts/import-full-catalogue.ts` twice and compare returned counts.
3. Complete medical/commercial approval for general knowledge; do not change status through the embedding job.
4. Run `npx tsx scripts/embed-published-knowledge.ts` only after patient publication.
5. Run the full assistant suite and production build in staging CI.
6. Validate anonymous general chat and authenticated personal-plan mode with separate test accounts.
7. Expand the approved knowledge corpus and evaluations before any patient pilot.