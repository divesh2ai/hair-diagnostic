# Stage 1 Assistant — Staging Security Review

Date: 2026-07-18  
Scope: `20260718_drfact_rag_stage1` migration, Stage 1 Prisma models, importer, and assistant routes.  
Decision: **staging validation only; blocked until required fixes below pass automated checks.**

`service_role` is expected to bypass RLS on Supabase. That is acceptable only for the importer and server-side persistence paths, which must validate clinic scope and provenance before writing. No browser code receives a service-role credential.

| Table | Owner path | RLS before fix | Policies before fix | Risk | Required fix |
|---|---|---:|---|---|---|
| Product | global catalogue or `clinicId` | Yes | one `FOR ALL` global/clinic policy | Staff could modify catalogue; null scope weak under concurrency | Split read/write/delete policies; global writes Super Admin/service only; clinic writes Clinic Admin |
| ProductAlias | parent Product + `clinicId` | Yes | one `FOR ALL` policy | Alias clinic can disagree with parent | Scope through parent and enforce matching clinic |
| ProductPriceVersion | global or `clinicId` | Yes | one `FOR ALL` policy | Null-scoped checksum uniqueness does not prevent duplicates | Expression unique index; separate read/write policies |
| ProductPrice | Product + version + `clinicId` | Yes | one `FOR ALL` policy | Overlapping active prices and invalid date windows | Date check and exclusion constraint; parent/version scope checks |
| Ingredient | global catalogue | **No** | none | Direct authenticated access depends only on grants | Enable RLS; authenticated read; Super Admin/service writes |
| ProductIngredient | parent Product | **No** | none | Cross-tenant formulation leakage | Enable RLS and scope through Product |
| Kit | global catalogue or `clinicId` | Yes | one `FOR ALL` policy | Staff can modify; global/tenant write boundaries weak | Split read/write/delete policies |
| KitAlias | parent Kit + `clinicId` | Yes | one `FOR ALL` policy | Alias clinic can disagree with parent | Scope through Kit and enforce matching clinic |
| KitVersion | parent Kit | **No** | none | Version content can leak across clinics | Enable RLS and scope through Kit |
| KitProduct | KitVersion + Kit + Product | **No** | none | Cross-clinic kit/product composition possible | Enable RLS; validate all parents share catalogue scope |
| KitPrice | Kit + `clinicId` | Yes | one `FOR ALL` policy | Concurrent duplicates/overlapping current prices | Null-safe unique index, date check, active-range exclusion |
| KitSchedule | KitVersion + Kit + Product | **No** | none | Cross-tenant schedule leakage/tampering | Enable RLS and scope through KitVersion/Kit |
| KnowledgeDocument | global or `clinicId` | Yes | one `FOR ALL` policy | Any clinic staff can alter knowledge | Read by role/scope; writes restricted to approval roles |
| KnowledgeDocumentVersion | parent document | **No** | none | Draft document versions leak | Enable RLS and inherit document scope/publication rules |
| KnowledgeChunk | document version + `clinicId` | Yes | one `FOR ALL` policy | **Critical:** patient can read pending/global chunks; dates ignored | Patient SELECT only `PUBLISHED_PATIENT` and effective; internal roles mode-gated; split writes |
| KnowledgeApproval | document/chunk | **No** | none | Approval records leak or can be forged | Enable RLS; doctor/admin SELECT; medical/commercial transitions server-enforced |
| KnowledgeConflict | global or `clinicId` | Yes | one `FOR ALL` policy | Clinic staff can alter governance conflicts | Internal read; Super Admin/Clinic Admin writes only |
| IngestionRun | global or `clinicId` | Yes | one `FOR ALL` policy | Null-scoped duplicates; staff can forge runs | Null-safe unique index; internal read; service/Super Admin writes |
| AssistantThread | clinic + creator + optional patient/assessment | Yes | owner `FOR ALL` | Patient/assessment can belong to another tenant; patient direct RLS denied while service bypasses | Cross-scope trigger; separate owner SELECT/INSERT/UPDATE; no client DELETE |
| AssistantMessage | parent thread | Yes | owner `FOR ALL` through thread | Broad mutations and ambiguous outer-column references | Qualified parent checks; SELECT/INSERT only for owner/internal roles; no client update/delete |
| AssistantToolCall | message → thread | Yes | owner `FOR ALL` | Tool trace can be forged/modified | Read through thread; service-only writes |
| AssistantCitation | message → thread | Yes | owner `FOR ALL` | Citation provenance can be forged/modified | Read through thread; service-only writes |
| AssistantSafetyEvent | clinic + thread | Yes | clinic-wide `FOR ALL` | Any staff can alter safety history; thread/clinic mismatch | Cross-scope trigger; internal SELECT; service-only writes; immutable |
| AssistantFeedback | clinic + user + thread | Yes | user `FOR ALL` | Thread/clinic mismatch; feedback can be rewritten | Cross-scope trigger; owner INSERT/SELECT; no update/delete |
| AssistantEscalation | clinic + optional thread/patient/assessment | Yes | clinic-wide `FOR ALL` | Any staff can create/delete; cross-tenant references possible | Cross-scope trigger; internal SELECT/UPDATE; service-only INSERT; no DELETE |
| AdverseEvent | clinic + optional thread/patient/assessment | Yes | clinic-wide `FOR ALL` | Sensitive event exposed clinic-wide and mutable | Cross-scope trigger; doctor/admin SELECT; service INSERT; controlled UPDATE; no DELETE |

## Migration-wide findings

- Policies must specify `TO authenticated`; relying on the default `PUBLIC` role is unnecessarily broad.
- Table grants and RLS are separate. RLS does not grant access; staging must verify grants for `authenticated` and `service_role` explicitly.
- Patient ownership cannot be derived safely from `clinic_id` alone. Server routes must bind patient requests to an owned patient/assessment record; direct patient catalogue access is read-only.
- Knowledge publication must be enforced in both RLS and repository queries. `MEDICAL_REVIEW` is never patient-retrievable.
- `effectiveUntil` must be greater than `effectiveFrom`. Retrieval must use `effectiveFrom <= now < effectiveUntil`.
- Current price selection considers `PROVISIONAL` and `PUBLISHED`; overlapping active intervals for either status must be rejected.
- Null clinic scopes require `COALESCE("clinicId", '')` expression indexes because PostgreSQL unique constraints treat nulls as distinct.
