# Stage 1 assistant migration security review - final staging disposition

Date: 2026-07-18. Scope: the 26 tables created by `20260718_drfact_rag_stage1`. `service_role` has explicit `GRANT ALL` and bypasses RLS; it is restricted to server/import paths. Browser-authenticated roles receive only the grants listed below, so a policy without a matching grant is intentionally inert.

| Table | Owner path | RLS enabled | SELECT / INSERT / UPDATE / DELETE policies | Current risk | Required fix / disposition |
|---|---|---:|---|---|---|
| Product | global or `clinicId` | Yes | S: scoped catalogue; I/U/D: admin policy, but no authenticated write grant | Low | Fixed for staging; keep service writes provenance-checked |
| ProductAlias | Product + `clinicId` | Yes | S: parent/scope; I/U/D: admin policy, no write grant | Medium | Before production, add DB trigger enforcing alias clinic equals parent clinic when parent is tenant-owned |
| ProductPriceVersion | global or `clinicId` | Yes | S scoped; I/U/D admin policy, no write grant | Low | Null-safe checksum uniqueness added |
| ProductPrice | Product/version + `clinicId` | Yes | S scoped; I/U/D admin policy, no write grant | Low | Positive MRP, valid windows, null-safe uniqueness and non-overlap exclusion added |
| Ingredient | global | Yes | S authenticated; I/U/D Super Admin policy, no write grant | Low | Fixed |
| ProductIngredient | Product | Yes | S through Product; I/U/D admin policy, no write grant | Low | Fixed for staging; service importer remains trusted |
| Kit | global or `clinicId` | Yes | S scoped; I/U/D admin policy, no write grant | Low | Fixed |
| KitAlias | Kit + `clinicId` | Yes | S through Kit; I/U/D admin policy, no write grant | Medium | Before production, add DB trigger enforcing alias/parent scope alignment |
| KitVersion | Kit | Yes | S through Kit; I/U/D admin policy, no write grant | Low | Fixed |
| KitProduct | KitVersion + Kit + Product | Yes | S through Kit; I/U/D admin policy, no write grant | Medium | Before production, enforce Kit, KitVersion and Product scope compatibility in DB |
| KitPrice | Kit + `clinicId` | Yes | S scoped; I/U/D admin policy, no write grant | Low | Positive MRP, valid windows, null-safe uniqueness and non-overlap exclusion added |
| KitSchedule | KitVersion + Kit + Product | Yes | S through Kit; I/U/D admin policy, no write grant | Medium | Before production, enforce all parent scopes in DB |
| KnowledgeDocument | global or `clinicId` | Yes | S internal scoped; I/U/D admin policy, no write grant | Low | Fixed for staging |
| KnowledgeDocumentVersion | KnowledgeDocument | Yes | S through document; I/U/D admin policy, no write grant | Low | Effective-window check added |
| KnowledgeChunk | DocumentVersion + `clinicId` | Yes | S internal preview; separate patient S requires `PUBLISHED_PATIENT` + effective dates; I/U/D approval policy, no write grant | Low | Critical patient leakage fixed; repository also fails closed for patient review-stage retrieval |
| KnowledgeApproval | DocumentVersion/chunk | Yes | S doctor/admin; I/U/D Super Admin policy, no write grant | Low | Seven-state lifecycle added; no chunk published |
| KnowledgeConflict | global or `clinicId` | Yes | S internal scoped; I/U/D admin policy, no write grant | Low | Fixed |
| IngestionRun | global or `clinicId` | Yes | S internal scoped; I/U/D Super Admin policy, no write grant | Low | Null-safe run uniqueness and importer race convergence added |
| AssistantThread | clinic + creator + patient/assessment | Yes | S owner/internal; I owner; U owner; D none | Low | Patient/assessment composite clinic FKs and scope trigger added; API also binds patient identity |
| AssistantMessage | AssistantThread | Yes | S through owner/internal thread; I/U/D none for authenticated | Low | Service-only immutable writes |
| AssistantToolCall | Message -> Thread | Yes | S through owner/internal thread; I/U/D none | Low | Service-only immutable writes |
| AssistantCitation | Message -> Thread | Yes | S through owner/internal thread; I/U/D none | Low | Service-only immutable writes |
| AssistantSafetyEvent | clinic + thread + patient/assessment + message | Yes | S doctor/admin; I/U/D none | Low | Composite clinic ownership and message/thread FKs added; service-only writes |
| AssistantFeedback | clinic + user + thread/message | Yes | S owner/admin; I owner with thread ownership; U/D none | Low | Composite thread-clinic and message FKs added |
| AssistantEscalation | clinic + thread + patient/assessment + message | Yes | S doctor/admin; I none; U doctor/admin; D none | Low | Composite clinic ownership FKs added; service-only creation |
| AdverseEvent | clinic + thread + patient/assessment | Yes | S doctor/admin; I none; U doctor/admin; D none | Low | Composite clinic ownership FKs added; service-only creation |

## Security decision

- Staging validation: allowed with `DISABLED`, `INTERNAL_PREVIEW`, or `DOCTOR_ONLY`; patient release remains contingent on an applied and verified migration.
- Production: blocked on the four medium catalogue parent-scope constraints above and a live Supabase role/JWT integration run. The static SQL contract is green, but this task did not apply the migration to any database.
- Publication: all supplied chunks remain `MEDICAL_REVIEW`; zero are `PUBLISHED_INTERNAL` or `PUBLISHED_PATIENT`.
