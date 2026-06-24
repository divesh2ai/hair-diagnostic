# HairOS Report Philosophy

> The report is not an engine output. It is a clinical conversation rendered on paper.

---

## 1. Purpose

The HairOS report exists to answer five — and only five — questions for the patient:

1. **What is my current hair condition?**
2. **Why is it happening?**
3. **What is happening inside my follicles?**
4. **What should I do first?**
5. **What outcome can I realistically expect?**

Any section, sentence, chart, or label that does not measurably help answer one of these five questions is removed. This is the single editorial filter that governs every consultation artifact.

---

## 2. Voice & Stance

The report speaks in the voice of a **senior dermatologist who has spent twenty minutes with the patient's case**. It is:

- **Specific** — never generic. If a paragraph could appear in any patient's report, it does not belong.
- **Confident, not absolute** — clinical certainty is graded; the report reflects that.
- **Mechanistic** — every recommendation is tied to a biological mechanism the patient can understand.
- **Calm** — no marketing language, no urgency theatre, no exclamation points.
- **Honest about uncertainty** — "we cannot determine X without bloodwork" is acceptable; fabricated confidence is not.

The report must never read like a software-generated document. The patient should not be able to detect that a system, registry, or pipeline produced it.

---

## 3. The Five-Question Filter (Editorial Rule)

Every section in the report is mapped to one of the five questions. Sections that map to none are deleted. Sections that map to more than one are split.

| Question | Sections that answer it |
|---|---|
| Q1. What is my condition? | Current Hair Assessment, What We Found |
| Q2. Why is it happening? | Root Cause Analysis, Understanding Your Hair Loss |
| Q3. What is happening in my follicles? | Understanding Your Hair Loss, Ingredient Intelligence |
| Q4. What should I do first? | Treatment Priority Roadmap, Personalized Protocol, Topical Plan, Lifestyle Prescription |
| Q5. What outcome can I expect? | Monitoring Plan, Expected Outcomes |

If a candidate section cannot be placed in this table, it does not enter the report.

---

## 4. What the Report Is Not

- It is **not** a dump of engine artifacts (signals, pathways, causes, scores, registry IDs).
- It is **not** a marketing brochure for protocols or ingredients.
- It is **not** a generic hair-loss explainer document.
- It is **not** a record of the system's reasoning process — that lives in the doctor view and the audit trail, not the patient report.
- It is **not** the place to surface debug objects, JSON, enums, or any implementation terminology.

---

## 5. The Trust Contract

The patient is paying for clinical thinking, not for software output. The report must satisfy three trust requirements:

1. **Recognition** — within the first 60 seconds of reading, the patient must feel "this is about me, specifically."
2. **Comprehension** — by the end of the report, the patient must be able to explain their condition to a family member in their own words.
3. **Direction** — the patient must close the report knowing the single next action to take this week.

If any of these three fail in user testing, the report has failed regardless of how complete the underlying analysis is.

---

## 6. Specificity Hierarchy

Every paragraph in every section is conditioned on, in priority order:

1. **Diagnosis** (e.g., AGA, TE, alopecia areata, scarring vs. non-scarring)
2. **Gender** (a male patient never receives PCOS content; a female patient never receives male-pattern-only DHT framings)
3. **Severity** (early/moderate/advanced — language and expectations differ)
4. **Root cause profile** (which drivers are actually present)
5. **Life stage / context** (post-partum, peri-menopausal, post-illness, post-surgical, etc., when known)

A paragraph that is not conditioned on at least the first three is generic by definition and must be rewritten or removed.

---

## 7. What Earns a Section

A section earns its place in the report if and only if it satisfies all four:

- It answers one of the five questions above.
- It is condition-, gender-, and severity-specific.
- It connects evidence → mechanism → action.
- It changes what the patient does or believes after reading it.

This is the standard the patient-facing report is held to. Every section in `PATIENT_REPORT_V3_SPEC.md` must pass this test before shipping.

---

## 8. Governing Documents

This philosophy is the parent document. The following specifications operationalize it:

- `CONSULTATION_EXPERIENCE_ARCHITECTURE.md` — end-to-end consultation flow
- `PATIENT_REPORT_V3_SPEC.md` — patient-facing report sections
- `DOCTOR_REPORT_V3_SPEC.md` — clinician-facing OPD summary
- `DASHBOARD_V3_SPEC.md` — in-app dashboard cards
- `SECTION_BY_SECTION_CONTENT_RULES.md` — per-section content & conditioning rules
- `NARRATIVE_GOVERNANCE_RULES.md` — language, leakage, and trust rules

If any downstream document conflicts with this one, this document wins and the downstream document is corrected.
