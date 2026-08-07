import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { deriveFiveKitGovernanceAudit, type GovernanceAudit } from "../src/packages/knowledge-ingestion/fiveKitGovernance";
import { buildFiveKitReviewPackages, renderClaimReviewReport, renderConflictImpactComparison, renderDecisionReadyQuantityGapReport, renderPhenotypeInflammationReview, renderProductIdentityReview, type FiveKitReviewPackages } from "../src/packages/knowledge-ingestion/fiveKitReviewPackages";
import { extractDocx, extractWorkbook } from "../src/packages/knowledge-ingestion/fiveKitSourceAdapters";
import { assertDraftOnly, buildFiveKitDraftManifest, type FiveKitDraftManifest } from "../src/packages/knowledge-ingestion/fiveKitSlice";

type Cli = { docx: string; xlsx: string; output: string; persistDraft: boolean };

function args(argv: string[]): Cli {
  const value = (flag: string) => argv[argv.indexOf(flag) + 1];
  const docx = value("--docx") ?? process.env.FIVE_KIT_DOCX;
  const xlsx = value("--xlsx") ?? process.env.FIVE_KIT_XLSX;
  if (!docx || !xlsx) throw new Error("Usage: --docx <All Kits Info.docx> --xlsx <MRP workbook.xlsx> [--output <directory>] [--persist-draft]");
  return { docx, xlsx, output: value("--output") ?? path.resolve("outputs/five-kit-real-ingestion"), persistDraft: argv.includes("--persist-draft") };
}

const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const json = (value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull => value === null || value === undefined ? Prisma.JsonNull : value as Prisma.InputJsonValue;
const sourceKey = (fileName: string) => `fluence-five-kit:${normalise(path.basename(fileName))}`;
const sourceId = (fingerprint: string) => `src_${fingerprint.slice(0, 28)}`;
const md = (value: unknown) => String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");

async function persistDraft(prisma: PrismaClient, manifest: FiveKitDraftManifest): Promise<void> {
  assertDraftOnly(manifest);
  await prisma.$transaction(async (tx) => {
    const sources = new Map<string, string>();
    for (const source of manifest.sourceFiles) {
      const id = sourceId(source.fingerprint);
      sources.set(source.fileName, id);
      await tx.knowledgeSourceFile.upsert({
        where: { fingerprint: source.fingerprint },
        create: { id, fingerprint: source.fingerprint, logicalDocumentKey: sourceKey(source.fileName), fileName: source.fileName, mimeType: /\.docx$/i.test(source.fileName) ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", documentType: /\.docx$/i.test(source.fileName) ? "DOCX" : "SPREADSHEET", domain: "HAIR", sourceType: /\.docx$/i.test(source.fileName) ? "INTERNAL_DRAFT" : "COMMERCIAL_PRICE_SOURCE", sourceStatus: "ACTIVE", version: source.version, extractionMetadata: { extractorVersion: manifest.extractorVersion, generatedAt: manifest.generatedAt, publication: "DRAFT_ONLY" } },
        update: { extractionMetadata: { extractorVersion: manifest.extractorVersion, generatedAt: manifest.generatedAt, publication: "DRAFT_ONLY" } },
      });
    }
    const docxSource = manifest.sourceFiles.find((source) => /\.docx$/i.test(source.fileName));
    if (!docxSource) throw new Error("DOCX source is missing from manifest");
    const document = await tx.knowledgeDocument.upsert({ where: { sourceId: sourceId(docxSource.fingerprint) }, create: { sourceId: sourceId(docxSource.fingerprint), title: "Fluence five-kit Hair narratives", domain: "HAIR", sourceType: "INTERNAL_DRAFT", sourceStatus: "ACTIVE", authorityScore: 20, status: "DRAFT" }, update: { status: "DRAFT", sourceStatus: "ACTIVE" } });
    const version = await tx.knowledgeDocumentVersion.upsert({ where: { documentId_checksum: { documentId: document.id, checksum: docxSource.fingerprint } }, create: { documentId: document.id, version: 1, checksum: docxSource.fingerprint, sourceFile: docxSource.fileName, sourceStatus: "ACTIVE", status: "DRAFT" }, update: { status: "DRAFT", sourceStatus: "ACTIVE" } });

    for (const kit of manifest.kits) {
      const dbKit = await tx.kit.upsert({ where: { canonicalId: kit.kitId }, create: { canonicalId: kit.kitId, canonicalName: kit.canonicalName, status: "DRAFT", approvalStatus: "DRAFT", currentVersion: 1, medicalVersion: kit.medicalVersion, commercialVersion: kit.commercialVersion, sourceId: sources.get(docxSource.fileName) }, update: { canonicalName: kit.canonicalName, status: "DRAFT", approvalStatus: "DRAFT", medicalVersion: kit.medicalVersion, commercialVersion: kit.commercialVersion } });
      for (const alias of kit.aliases) {
        const normalizedAlias = normalise(alias);
        await tx.kitAlias.upsert({ where: { kitId_normalizedAlias: { kitId: dbKit.id, normalizedAlias } }, create: { kitId: dbKit.id, alias, normalizedAlias, sourceName: alias, matchMethod: kit.sourceNames.some((name) => normalise(name) === normalizedAlias) ? "EXACT_NORMALISED" : "PROPOSED_HIGH_CONFIDENCE", matchConfidence: kit.sourceNames.some((name) => normalise(name) === normalizedAlias) ? 1 : 0.8, reviewStatus: "DRAFT", provenance: { sourceFile: docxSource.fileName, sourceFingerprint: docxSource.fingerprint } }, update: { alias, reviewStatus: "DRAFT" } });
      }
    }
    const productByCanonical = new Map<string, string>();
    for (const mapping of manifest.productMappings) {
      if (!mapping.productId || !mapping.canonicalName) continue;
      const product = await tx.product.upsert({ where: { canonicalId: mapping.productId }, create: { canonicalId: mapping.productId, canonicalName: mapping.canonicalName, status: "DRAFT" }, update: { canonicalName: mapping.canonicalName, status: "DRAFT" } });
      productByCanonical.set(mapping.productId, product.id);
      const normalizedAlias = normalise(mapping.sourceName);
      await tx.productAlias.upsert({ where: { productId_normalizedAlias: { productId: product.id, normalizedAlias } }, create: { productId: product.id, alias: mapping.sourceName, normalizedAlias, sourceName: mapping.sourceName, matchMethod: mapping.matchMethod, matchConfidence: mapping.matchConfidence, reviewStatus: mapping.reviewStatus, provenance: mapping.provenance as unknown as Prisma.InputJsonValue }, update: { matchMethod: mapping.matchMethod, matchConfidence: mapping.matchConfidence, reviewStatus: mapping.reviewStatus, provenance: mapping.provenance as unknown as Prisma.InputJsonValue } });
    }
    for (const fact of manifest.structuredFacts) {
      const sourceFile = sources.get(fact.provenance.sourceFile);
      if (!sourceFile) throw new Error(`Unknown provenance source ${fact.provenance.sourceFile}`);
      await tx.structuredFactRecord.upsert({ where: { id: fact.id }, create: { id: fact.id, sourceFileId: sourceFile, domain: "HAIR", entityType: fact.entityType, entityId: fact.entityId, field: fact.field, rawValue: json(fact.provenance.rawExtractedValue), normalizedValue: json(fact.value), provenance: fact.provenance as unknown as Prisma.InputJsonValue, formula: fact.provenance.formula, formulaResult: json(fact.provenance.formulaResult), formulaError: fact.provenance.formulaError, approvalStatus: fact.approvalStatus, conflictStatus: fact.conflictStatus, requiresReview: true, publicationStatus: "DRAFT" }, update: { rawValue: json(fact.provenance.rawExtractedValue), normalizedValue: json(fact.value), provenance: fact.provenance as unknown as Prisma.InputJsonValue, formula: fact.provenance.formula, formulaResult: json(fact.provenance.formulaResult), formulaError: fact.provenance.formulaError, approvalStatus: fact.approvalStatus, conflictStatus: fact.conflictStatus, requiresReview: true, publicationStatus: "DRAFT" } });
    }
    for (const chunk of manifest.chunks) {
      await tx.knowledgeChunk.upsert({ where: { id: chunk.id }, create: { id: chunk.id, documentVersionId: version.id, entityType: "KIT", entityId: chunk.kitId, domain: "HAIR", topic: "KIT_EXPLANATION", knowledgeSystem: "INTEGRATIVE", audience: "INTERNAL", language: "en", sectionType: chunk.sectionType, content: chunk.content, approvalStatus: "DRAFT", authorityScore: 20, metadata: chunk.provenance as unknown as Prisma.InputJsonValue }, update: { content: chunk.content, approvalStatus: "DRAFT", metadata: chunk.provenance as unknown as Prisma.InputJsonValue } });
    }
    for (const claim of manifest.claims) {
      await tx.knowledgeClaim.upsert({ where: { claimId: claim.claimId }, create: { claimId: claim.claimId, chunkId: claim.chunkId, documentVersionId: version.id, domain: "HAIR", subject: claim.kitId, subjectType: "KIT", subjectId: claim.kitId, claimType: claim.claimType, statement: claim.claimText, sourceType: "INTERNAL_DRAFT", sourceId: sourceId(docxSource.fingerprint), authorityScore: claim.sourceAuthority, evidenceStatus: claim.evidenceStatus, approvalStatus: "DRAFT", audience: claim.audience, patientVisible: false, medicalReviewStatus: claim.medicalReviewStatus, commercialReviewStatus: claim.commercialReviewStatus, sourceLocation: claim.provenance as unknown as Prisma.InputJsonValue, supersessionStatus: claim.supersessionStatus }, update: { statement: claim.claimText, approvalStatus: "DRAFT", patientVisible: false, medicalReviewStatus: claim.medicalReviewStatus, commercialReviewStatus: claim.commercialReviewStatus, sourceLocation: claim.provenance as unknown as Prisma.InputJsonValue } });
      const evidenceId = `evidence_${createHash("sha256").update(claim.claimId).digest("hex").slice(0, 24)}`;
      await tx.claimEvidence.upsert({ where: { id: evidenceId }, create: { id: evidenceId, claimId: claim.claimId, sourceFileId: sourceId(docxSource.fingerprint), evidenceType: "SOURCE_EXCERPT", status: claim.evidenceStatus, sourceLocation: claim.provenance as unknown as Prisma.InputJsonValue, excerptHash: createHash("sha256").update(claim.claimText).digest("hex") }, update: { status: claim.evidenceStatus, sourceLocation: claim.provenance as unknown as Prisma.InputJsonValue } });
    }
    for (const item of manifest.conflicts) {
      await tx.knowledgeConflict.upsert({ where: { id: item.id }, create: { id: item.id, documentId: document.id, entity: item.entity, issue: `${item.type}: ${item.fieldOrClaim}`, conflictType: item.type, fieldOrClaim: item.fieldOrClaim, sourceA: item.sourceA as unknown as Prisma.InputJsonValue ?? Prisma.JsonNull, sourceB: item.sourceB as unknown as Prisma.InputJsonValue ?? Prisma.JsonNull, valueA: json(item.valueA), valueB: json(item.valueB), authorityA: item.authorityA, authorityB: item.authorityB, proposedCanonicalValue: json(item.proposedCanonicalValue), automaticResolutionAllowed: item.automaticResolutionAllowed, reviewRequired: item.reviewRequired, publicationBlocked: item.publicationBlocked, severity: item.publicationBlocked ? "HIGH" : "MEDIUM", requiredAction: item.recommendedAction, status: "OPEN" }, update: { issue: `${item.type}: ${item.fieldOrClaim}`, requiredAction: item.recommendedAction, status: "OPEN", publicationBlocked: item.publicationBlocked } });
    }
    const checksum = createHash("sha256").update(JSON.stringify(manifest.sourceFiles)).digest("hex");
    const existingRun = await tx.ingestionRun.findFirst({ where: { clinicId: null, checksum, configVersion: manifest.extractorVersion }, select: { id: true } });
    const runData = { status: "AWAITING_REVIEW", completedAt: new Date(), counts: manifest.counts };
    if (existingRun) await tx.ingestionRun.update({ where: { id: existingRun.id }, data: runData });
    else await tx.ingestionRun.create({ data: { sourceFile: manifest.sourceFiles.map((source) => source.fileName).join(" + "), checksum, configVersion: manifest.extractorVersion, status: runData.status, startedAt: new Date(manifest.generatedAt), completedAt: runData.completedAt, counts: runData.counts } });
  });
}

function ingestionReport(manifest: FiveKitDraftManifest, governance: GovernanceAudit, workbookSheets: string[]): string {
  const c = manifest.counts;
  return `# Five-kit real ingestion report

Generated: ${manifest.generatedAt}

## Safety outcome

- Production publication: **NO**
- Imported lifecycle: **DRAFT / AWAITING_REVIEW**
- Extractor: \`${manifest.extractorVersion}\`
- Source fingerprints: ${manifest.sourceFiles.map((source) => `\`${source.fileName}\` = \`${source.fingerprint}\``).join("; ")}

## Files and workbook scope

- Files processed: ${manifest.sourceFiles.length}
- Primary sheets processed: Individual products MRP; New MRP of kits; Complete formulation
- Non-authoritative sheets inspected for conflicts: ${workbookSheets.filter((name) => /copy|working|temp|do not consider|not confirm/i.test(name)).join("; ") || "none"}

## Results

| Metric | Count |
|---|---:|
${Object.entries(c).map(([key, value]) => `| ${key} | ${value} |`).join("\n")}

## Governance reconciliation

- Raw missing values: ${governance.counts.raw.missingValues}
- Route nulls reclassified as not required for publication: ${governance.counts.routeNullsNotRequired}
- Publication-blocking quantity gaps: ${governance.counts.publicationBlockingQuantityGaps}
- Consolidated conflict groups: ${governance.counts.groupedConflictCount} from ${governance.counts.raw.conflictImpacts} conflict impacts
- Claims awaiting authorized HairOS replacement: ${governance.counts.raw.blockedClaims}
- Price records intentionally parked: ${governance.counts.raw.priceRecords}
- Meta B canonical status: ${governance.metaBIdentity.status}

All extracted facts, chunks and claims remain blocked from patient retrieval until explicit governed review and publication.`;
}

function conflictReport(governance: GovernanceAudit): string {
  return `# Five-kit conflict report

Generated: ${governance.generatedAt}

| Group | Type | Entity | Impact count | Kit ids | Status | Authoritative resolution available | Recommended decision |
|---|---|---|---:|---|---|---|---|
${governance.conflictGroups.map((item) => `| ${item.id} | ${item.conflictType} | ${md(item.entity)} | ${item.impactCount} | ${md(item.kitIds.join(", ") || "unmapped")} | ${item.status} | ${item.authoritativeResolutionAvailable ? "YES" : "NO"} | ${md(item.recommendedDecision)} |`).join("\n") || "| none | | | | | | | |"}

Conflicts remain unresolved until a governed winning value, identity decision, or missing narrative replacement is explicitly recorded.`;
}

function quantityGapReport(governance: GovernanceAudit): string {
  const rows = governance.missingValues.filter((item) => item.field === "quantity" && item.status === "STILL_BLOCKING");
  return `# Five-kit publication-blocking quantity gaps

Generated: ${governance.generatedAt}

- Total publication-blocking quantity gaps: ${rows.length}
- Parseable formulation quantity impacts needing governed normalization: ${governance.counts.parseableQuantityGapImpacts}
- Remaining source-incomplete quantity gaps: ${rows.length - governance.counts.parseableQuantityGapImpacts}

| Fact id | Entity | Type | Reason | Source cell | Raw source value |
|---|---|---|---|---|---|
${rows.map((item) => `| ${item.factId} | ${md(item.entityId)} | ${item.entityType} | ${item.reason} | ${md(item.provenance.cellAddress ?? "n/a")} | ${md(item.provenance.rawExtractedValue)} |`).join("\n")}`;
}

function claimReviewReport(governance: GovernanceAudit): string {
  return `# Five-kit medical claim review report

Generated: ${governance.generatedAt}

- Claims in queue: ${governance.claimReviewQueue.length}
- Safe for patient publication: 0
- Queue status: AWAITING_AUTHORIZED_HAIROS_CONTENT

| Claim id | Kit | Type | Audience | Required approvals | Reason |
|---|---|---|---|---|---|
${governance.claimReviewQueue.map((item) => `| ${item.claimId} | ${item.kitId} | ${item.claimType} | ${item.audience} | ${md(item.requiredApprovals.join(", "))} | ${item.reason} |`).join("\n")}`;
}

function checklist(governance: GovernanceAudit): string {
  return `# Five-kit review checklist

## Medical reviewer

- [ ] Replace all ${governance.claimReviewQueue.length} narrative claims with authorized HairOS science.
- [ ] Attach evidence and medical approval to every replacement claim before any patient visibility is considered.
- [ ] Backfill the missing TE GOLD indication narrative and GI HEALTH GOLD conclusion narrative.
- [ ] Keep recommendation questions routed to the deterministic clinical decision engine rather than free-form RAG.

## Commercial reviewer

- [ ] Keep all ${governance.counts.raw.priceRecords} price-related records parked under PENDING_PRICE_REVISION.
- [ ] Do not expose MRP, GST, doctor price, selling price, discount, or price-effective-date records to patients.
- [ ] Enter or approve missing kit-component quantities only from authoritative commercial or product sources.

## Product reviewer

- [ ] Resolve the F-TRICHOGROW+ identity decision under governed alias or canonical-product review.
- [ ] Confirm the normalized quantity and unit for the ${governance.counts.parseableQuantityGapImpacts} parseable formulation quantity impacts.
- [ ] Preserve the ${governance.counts.routeNullsNotRequired} route nulls as source-authentic and non-blocking rather than filling them in.

## Technical reviewer

- [ ] Regenerate the draft-only outputs after each governed content batch.
- [ ] Verify the review API and UI still operate without persistence or schema changes.
- [ ] Confirm no patient publication occurs while claims, quantity gaps, or price parking remain unresolved.`;
}

function validationReport(manifest: FiveKitDraftManifest, governance: GovernanceAudit, reviewPackages: FiveKitReviewPackages): string {
  return `# Five-kit validation report

Generated: ${governance.generatedAt}

## Comparison against previous reported blockers

- 49 blocked claims -> ${governance.comparison.current.blockedClaims.status} (${governance.comparison.current.blockedClaims.count})
- 13 reported conflict blockers -> ${governance.counts.raw.conflictImpacts} impacts consolidated into ${governance.comparison.current.conflictGroups.count} current conflict groups
- Generic Meta B ambiguity -> ${governance.comparison.current.ambiguousGenericMetaBMapping}
- Price records pending revision -> ${governance.comparison.current.priceRecords.status} (${governance.comparison.current.priceRecords.count})
- 222 missing values -> ${governance.comparison.current.missingValues.routeNullsNotRequired} NOT_REQUIRED_FOR_PUBLICATION + ${governance.comparison.current.missingValues.publicationBlockingQuantityGaps} STILL_BLOCKING

## Why conflict impacts increased

${reviewPackages.conflictImpactExplanation.explanation}

## Current status counts

| Status | Count |
|---|---:|
${Object.entries(governance.counts.statuses).map(([status, count]) => `| ${status} | ${count} |`).join("\n")}

## Exact 67-gap breakdown by category

${Object.entries(reviewPackages.quantityGapBreakdown).map(([category, count]) => `- ${category}: ${count}`).join("\n")}

## Product identity decisions

- Resolved automatically: ${reviewPackages.productIdentityReview.filter((item) => item.status === "RESOLVED_BY_GOVERNED_SOURCE").length}
- Awaiting human decision: ${reviewPackages.productIdentityReview.filter((item) => item.status === "AWAITING_HUMAN_DECISION").length}

${reviewPackages.productIdentityReview.map((item) => `- ${item.sourceName}: ${item.classification}; ${item.humanQuestion}`).join("\n")}

## Claim counts by batch and risk

${Object.entries(reviewPackages.claimBatchCounts).map(([batch, count]) => `- ${batch}: ${count}`).join("\n")}

${Object.entries(reviewPackages.claimRiskCounts).map(([risk, count]) => `- ${risk}: ${count}`).join("\n")}

## Phenotype Inflammation review items

- Purpose claims: ${reviewPackages.phenotypeInflammationReview.purposeClaims.length}
- Inflammation biology claims: ${reviewPackages.phenotypeInflammationReview.inflammationBiologyClaims.length}
- Kit-selection, escalation, and response claims: ${reviewPackages.phenotypeInflammationReview.kitSelectionClaims.length}
- Scalp symptom review topics: ${reviewPackages.phenotypeInflammationReview.scalpSymptomReview.length}
- Product and quantity dependencies: ${reviewPackages.phenotypeInflammationReview.productAndQuantityDependencies.length}
- Conflict dependencies: ${reviewPackages.phenotypeInflammationReview.conflictDependencies.length}

## Records safe for internal RAG testing

- ${governance.safeForInternalRagTesting.length} records, consisting of route-null non-blockers and the resolved Meta B identity.

## Records safe for patient publication

- ${governance.safeForPatientPublication.length} non-blocking records, none of which override the draft-only publication guard.
- Claims safe for patient publication: 0

## Records that must remain blocked

- ${governance.mustRemainBlocked.length} records across claims, price records, quantity gaps, and unresolved conflict groups.

## Remaining blockers by kit

${governance.remainingBlockersByKit.map((item) => `- ${item.kitId}: ${item.severity} severity, ${item.blockers.length} blocking records`).join("\n")}

## Exact human decisions required next

${governance.decisionsRequired.map((item) => `- ${item}`).join("\n")}
${reviewPackages.quantityGapDecisions.map((gap) => `- ${gap.humanQuestion}`).join("\n")}
${reviewPackages.productIdentityReview.map((item) => `- ${item.humanQuestion}`).join("\n")}

## Recommended next implementation sequence

${governance.recommendedImplementationSequence.map((item, index) => `${index + 1}. ${item}`).join("\n")}

## Draft-only publication guard

- Lifecycle publication status remains ${manifest.publicationStatus}
- Production published flag remains ${manifest.productionPublished ? "true" : "false"}
- No migration, database persistence, approval, publication, deployment, or production modification occurred.`;
}
async function main() {
  const cli = args(process.argv.slice(2));
  const [docxBytes, xlsxBytes] = await Promise.all([readFile(cli.docx), readFile(cli.xlsx)]);
  const [docx, workbook] = await Promise.all([extractDocx(docxBytes, path.basename(cli.docx)), extractWorkbook(xlsxBytes, path.basename(cli.xlsx))]);
  const manifest = buildFiveKitDraftManifest(workbook, docx);
  const governance = deriveFiveKitGovernanceAudit(manifest);
  const reviewPackages = buildFiveKitReviewPackages(manifest, governance);
  assertDraftOnly(manifest);
  await mkdir(cli.output, { recursive: true });
  await mkdir(path.resolve("docs"), { recursive: true });
  await writeFile(path.join(cli.output, "draft-manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  await writeFile(path.join(cli.output, "governance-audit.json"), JSON.stringify(governance, null, 2), "utf8");
  await writeFile(path.join(cli.output, "conflict-groups.json"), JSON.stringify(governance.conflictGroups, null, 2), "utf8");
  await writeFile(path.join(cli.output, "publication-blocking-quantity-gaps.json"), JSON.stringify(reviewPackages.quantityGapDecisions, null, 2), "utf8");
  await writeFile(path.join(cli.output, "medical-claim-review-queue.json"), JSON.stringify(reviewPackages.prioritizedClaimReviewQueue, null, 2), "utf8");
  await writeFile(path.join(cli.output, "conflict-impact-explanation.json"), JSON.stringify(reviewPackages.conflictImpactExplanation, null, 2), "utf8");
  await writeFile(path.join(cli.output, "product-identity-review.json"), JSON.stringify(reviewPackages.productIdentityReview, null, 2), "utf8");
  await writeFile(path.join(cli.output, "phenotype-inflammation-review.json"), JSON.stringify(reviewPackages.phenotypeInflammationReview, null, 2), "utf8");
  await writeFile(path.resolve("docs/five-kit-real-ingestion-report.md"), ingestionReport(manifest, governance, workbook.sheets.map((sheet) => sheet.name)), "utf8");
  await writeFile(path.resolve("docs/five-kit-conflict-report.md"), conflictReport(governance), "utf8");
  await writeFile(path.resolve("docs/five-kit-publication-blocking-quantity-gaps.md"), renderDecisionReadyQuantityGapReport(reviewPackages), "utf8");
  await writeFile(path.resolve("docs/five-kit-conflict-impact-comparison.md"), renderConflictImpactComparison(reviewPackages), "utf8");
  await writeFile(path.resolve("docs/five-kit-product-identity-review.md"), renderProductIdentityReview(reviewPackages), "utf8");
  await writeFile(path.resolve("docs/phenotype-inflammation-medical-review.md"), renderPhenotypeInflammationReview(reviewPackages), "utf8");
  await writeFile(path.resolve("docs/five-kit-medical-claim-review-report.md"), renderClaimReviewReport(reviewPackages), "utf8");
  await writeFile(path.resolve("docs/five-kit-review-checklist.md"), checklist(governance), "utf8");
  await writeFile(path.resolve("docs/five-kit-validation-report.md"), validationReport(manifest, governance, reviewPackages), "utf8");
  if (cli.persistDraft) {
    const prisma = new PrismaClient();
    try { await persistDraft(prisma, manifest); } finally { await prisma.$disconnect(); }
  }
  process.stdout.write(`${JSON.stringify({ output: cli.output, persisted: cli.persistDraft, counts: manifest.counts, governance: governance.counts, quantityGapBreakdown: reviewPackages.quantityGapBreakdown, claimBatchCounts: reviewPackages.claimBatchCounts, productIdentityIssues: reviewPackages.productIdentityReview.length }, null, 2)}\n`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });