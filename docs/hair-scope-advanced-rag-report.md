# Dr. FACT advanced RAG: Hair scope correction

## Active scope

| Domain | Lifecycle | Retrieval/publication | User-facing route |
|---|---|---|---|
| HAIR | Active priority | Enabled only for active, effective, approved records and claims | General Hair assistant and explicit approved personal-plan mode |
| SKIN | Future | Disabled; no documents ingested | None |
| ORTHO | Future | Disabled; no documents ingested | None |
| AYURVEDA | Disabled indefinitely | Publication guarded; no retrieval corpus or ingestion | None; controlled Hair-focused out-of-scope response |

The domain and topic fields are now separate. Anonymous retrieval always supplies `domain=HAIR`; Hair biology, conditions, scalp conditions, topicals, ingredients, lifestyle and safety remain metadata topics under that domain. Exact product, kit, composition, schedule and MRP facts continue to use structured catalogue tools. Personal-plan access remains explicit and authenticated. The deterministic clinical engine was not changed.

## Removed or deferred Ayurveda surfaces

- Removed the public UI entry card and Ayurveda product copy.
- Removed the patient-published static Ayurveda seed.
- Removed Ayurveda retrieval filters and response generation.
- Replaced the active Ayurveda golden question and removed the legacy Ayurveda scope example.
- Kept only the disabled `AYURVEDA` domain value and controlled detection needed to return an out-of-scope response.
- Added a database publication guard that rejects published non-Hair documents and claims.

No Skin, Ortho or Ayurveda content is ingested or published by these changes.

## Hair coverage map

| Area | Current authority | Status |
|---|---|---|
| TE and stress/illness/postpartum shedding | Approved Hair knowledge | Covered |
| MPHL/FPHL and follicular miniaturisation | Approved Hair knowledge | Covered generally |
| Alopecia areata and sudden patchy loss | Approved Hair knowledge + safety boundary | Covered generally |
| Hair cycle / follicular biology | Approved Hair knowledge | Covered generally |
| Scalp inflammation, dandruff and red flags | Approved Hair/safety knowledge | Covered at general and escalation level |
| Breakage and hair care | Approved Hair lifestyle knowledge | Covered generally |
| Iron, protein, restrictive diet and weight loss | Approved Hair lifestyle knowledge | Covered generally |
| Kits, products and composition | Structured catalogue | All governed catalogue entities resolvable; missing fields remain null |
| MRP and schedules | Structured catalogue | Answered only when an active exact record exists |
| Topicals / minoxidil | Approved Hair knowledge + safety policy | Covered generally; no personal dosing |
| PCOS-specific mechanism | No approved claim loaded | Abstains; knowledge gap |
| Thyroid-specific mechanism | No approved claim loaded | Abstains; knowledge gap |
| Menopause-specific mechanism | No approved claim loaded | Abstains; knowledge gap |
| Greying | No approved claim loaded | Abstains; knowledge gap |
| Unsupported remedies / guaranteed outcomes | Evidence threshold and safety boundary | Abstains |

## Governed ingestion architecture

`file -> SHA-256 fingerprint -> duplicate/version lookup -> document-type classifier -> Hair-domain classifier -> extractor -> section-aware text/table/image-text chunks -> entity extraction -> structured-fact extraction -> claim extraction -> authority assignment -> contradiction detection -> medical/commercial review -> explicit publish approval -> embedding`

Supported classifications are PDF, brochure, DOCX, spreadsheet and scientific document. The extractor, entity extractor, structured extractor, claim extractor and contradiction detector are ports so production adapters can use fit-for-purpose parsers/models without bypassing governance. Section hashes enable delta ingestion; an unchanged section is not recreated. A duplicate fingerprint produces no draft. Every accepted batch is saved as `DRAFT` with embedding `BLOCKED_PENDING_APPROVAL`. High-severity contradictions and missing required approvals block publication.

Source authority order is encoded. `PRODUCT_MASTER` and `SAFETY_MASTER` are highest; `CLINICAL_PROTOCOL`, `SCIENTIFIC_EVIDENCE`, commercial sources and patient education follow. `PRODUCT_BROCHURE` cannot override structured composition, approved safety, protocol or scientific claims. `INTERNAL_DRAFT` is lowest.

## Claim governance

`KnowledgeClaim` records claim ID, Hair domain, subject/entity, claim type, statement, source/type, authority, evidence status, approval status, audience, effective window, contradiction group and supersession. Patient retrieval requires a supported, `PUBLISHED_PATIENT`, effective Hair claim under an active, patient-published document and version. Citations now identify claim IDs instead of treating an entire chunk as one undifferentiated source.

The retrieval path performs normalisation and bounded query rewriting, alias/entity extraction, PostgreSQL full-text search, pgvector similarity, reciprocal-rank fusion, authority/freshness scoring, an injectable cross-encoder reranking stage, contradiction grouping, evidence sufficiency and abstention. A configurable HTTP cross-encoder adapter is wired through `ASSISTANT_RERANK_URL` and optional API key. It activates only when an approved endpoint is configured; otherwise the deterministic rerank fallback remains in use.

## Future Skin/Ortho extension contract

A future domain cannot be enabled by changing one flag alone. It requires:

1. A versioned taxonomy and topic mapping that never reuses Hair topic identifiers ambiguously.
2. Stable entity types/IDs, aliases and structured-fact ownership rules.
3. Domain-specific source-authority and override rules.
4. Domain-specific safety, red-flag, diagnosis, treatment-change and escalation policy.
5. The same draft -> medical/commercial review -> audience publication workflow, including effective dates and supersession.
6. A domain evaluation dataset covering core knowledge, entities, multilingual/typo queries, contradictions, unsafe requests and unsupported claims.
7. A deliberate user-facing entry point plus server-side domain authorization.
8. Removal or alteration of the current Hair-only publication guard only after explicit approval.

## Validation and remaining work

Automated coverage includes Hair-only/static publication checks, future/disabled domain responses, governed multi-format classification, fingerprint idempotency, out-of-scope rejection, draft-only persistence, approval gates, brochure override prevention, retrieval SQL boundaries and an expanded Hair evaluation set. Final command results are recorded in the implementation handoff.

Remaining Hair knowledge work is approval-dependent: authoritative claims for PCOS, thyroid-related shedding, menopause, greying, broader scalp disorders, individual ingredient mechanisms, formulation facts, schedules and current MRP. These must be ingested as drafts and reviewed; this change does not infer or publish them.

### Validation results

- Prisma schema validation: PASS.
- Full assistant suite: PASS, 240/240 tests.
- Supplied Stage 1 golden set: PASS, 50/50 questions within the 59-test golden/boundary file.
- Filtered TypeScript check for changed RAG files/tests: PASS.
- Patient portal production build: PASS (one pre-existing Turbopack tracing warning in the sandbox route).
- Repository-wide TypeScript check: NOT CLEAN due to pre-existing unrelated errors across legacy app, clinical, PDF and test files; the changed RAG slice emitted no remaining errors.
- Migration application, document ingestion, knowledge publication and deployment: NOT RUN by design.
