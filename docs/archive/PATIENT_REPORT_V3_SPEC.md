# Patient Report V3 — Specification

> The patient-facing consultation document. Twelve sections, each earning its place by answering one of the five questions in `REPORT_PHILOSOPHY.md`.

This spec defines structure, content rules, and acceptance criteria for each section. Per-section narrative conditioning rules live in `SECTION_BY_SECTION_CONTENT_RULES.md`. Voice and leakage rules live in `NARRATIVE_GOVERNANCE_RULES.md`.

---

## Document Frame

- **Length target:** 14–18 pages.
- **Reading time:** ~12 minutes cover-to-cover; ~3 minutes for the patient-priority subset (§1, §2, §5, §11).
- **Format:** PDF, printable, indexed table of contents, every section reachable in one click from the TOC.
- **Cover page:** patient name, report date, summary line "Primary diagnosis · Severity · Top driver". No marketing.
- **Footer on every page:** report ID + date. No engine IDs.

---

## Section 1 — Current Hair Assessment

**Answers Q1.** A one-page clinical snapshot.

**Must display:**
- Primary diagnosis (plain language + clinical name)
- Secondary diagnosis (if present)
- Severity band (Early / Moderate / Advanced)
- Progression risk (Low / Moderate / High) with a one-line "what this means"
- Pattern classification (e.g., Norwood / Ludwig stage in plain words)
- Hair Health Score (banded: Critical / At Risk / Stable / Strong) — never as a raw number

**Must not contain:** drivers, causes, treatment language, or biology. Those have their own sections.

**Acceptance:** the patient can read this page in 60 seconds and state, in one sentence, what they have.

---

## Section 2 — What We Found

**Answers Q1, sets up Q2.** Top 5 findings, ranked by impact.

**Format:** ordered list. Each item has:
- Plain-language finding (e.g., "Active follicular miniaturization")
- One-sentence "what this means for you"
- One-sentence "evidence we used" (intake symptom, photo finding, history pattern — never "signal X fired")

**Ranking:** by impact on outcome, not by detection confidence.

**Must not contain:** more than 5 items. If 6+ are clinically relevant, the bottom items collapse into "additional findings under monitoring" with no detail.

---

## Section 3 — Understanding Your Hair Loss

**Answers Q3.** Condition-specific follicular biology.

**Must explain, only when relevant:**
- Follicular biology (growth cycle, shaft anatomy — only the parts needed for this diagnosis)
- DHT impact (only if AGA / androgenic component is present)
- Inflammation impact (only if inflammatory drivers are present)
- Metabolic impact (only if metabolic drivers are present)
- Hormonal impact (only if hormonal drivers are present and consistent with gender/life-stage)

**Forbidden:** PCOS content in male reports, menstrual/pregnancy content in male reports, post-partum content outside post-partum patients, thyroid content unless thyroid is flagged, autoimmune content unless autoimmune is flagged.

**Acceptance:** every paragraph in this section references a finding from §2. Paragraphs with no §2 anchor are removed.

---

## Section 4 — Root Cause Analysis

**Answers Q2.** Three tiers: Primary, Secondary, Contributing.

**Each driver displays:**
- Name (plain language)
- **Evidence:** what in the intake/history pointed here
- **Mechanism:** the biological "how it harms the follicle"
- **Impact:** what it is doing to this patient now

**Tier rules:**
- Primary: typically 1, max 2.
- Secondary: 1–3.
- Contributing: 0–3.

If a driver cannot be confidently placed, it is named under "additional factors under evaluation" with the uncertainty stated.

---

## Section 5 — Treatment Priority Roadmap

**Answers Q4 (sequencing).** Three priorities, in order, each with a "why first".

**Format:**
- **Priority 1 — [name]**: what to fix first, why it must come first (mechanistically), what happens if it's skipped.
- **Priority 2 — [name]**: what comes next, why it follows priority 1.
- **Priority 3 — [name]**: stabilization / maintenance focus.

**Acceptance:** the patient finishes this page knowing the single action to start this week.

---

## Section 6 — Personalized HairOS Protocol

**Answers Q4 (what to take/do).** Only the protocol items selected for this patient.

**Per protocol item:**
- **Why selected** (linked back to a specific driver from §4)
- **What it targets** (mechanism)
- **Expected timeline** (when the patient should notice change)
- **Success markers** (what improvement looks like)

**Forbidden:** generic catalogues, items the patient is not on, marketing claims, ingredient lists (those belong in §7).

---

## Section 7 — Ingredient Intelligence

**Answers Q3 (mechanism at ingredient level).** Per ingredient *in the patient's protocol only*:

- Ingredient name
- Mechanism (one sentence)
- Target (which driver/mechanism it acts on)
- Expected benefit (timeline + observable change)

**Hard rule:** an ingredient not present in this patient's protocol does not appear. No "ingredient encyclopedia" pages.

---

## Section 8 — Topical Scalp Plan

**Answers Q4 (scalp).** Condition-specific.

**Scalp conditions covered (one applies per patient):**
- Dandruff
- Seborrheic dermatitis
- Inflamed scalp
- Sensitive scalp
- Oily scalp
- Dry scalp
- Healthy scalp (light maintenance)

**Per patient, the section shows:**
- Why topical is recommended for *this* scalp state
- How it helps (mechanism, brief)
- How to use (frequency, technique)
- Why **TrichoSilk D / F / [other]** specifically was selected for this patient

If the patient has a healthy scalp, the section is a short maintenance note, not a generic shampoo lecture.

---

## Section 9 — Lifestyle Prescription

**Answers Q4 (behaviour).** Not advice — a prescription.

**Per recommendation, the format is fixed:**
- **Action:** the specific thing to do (with frequency / dosage / duration where applicable)
- **Reason:** the driver from §4 it addresses
- **Expected benefit:** what improvement to expect, when

**Domains covered, only when relevant to the patient's drivers:**
sleep, stress, nutrition, exercise, meditation/breathwork, hydration.

A domain that is not connected to any driver in §4 is **omitted**. There is no "good general advice" block.

---

## Section 10 — Monitoring Plan

**Answers Q5 (how we'll know).** Four windows.

**Per window (M0, M3, M6, M12):**
- **Markers** to track (photos, shedding count, scalp comfort, symptom diary, bloodwork if indicated)
- **Expected milestones** at this point
- **Escalation triggers** — what would cause us to change course

Escalation triggers are stated plainly: "if shedding has not reduced by month 3, we re-evaluate."

---

## Section 11 — Expected Outcomes

**Answers Q5 (realistic expectations).** Four horizons.

**Per horizon (30 / 90 / 180 / 365 days):**
- Realistic range of outcomes for *this severity and these drivers*
- What the patient is most likely to notice
- What the patient should not yet expect

**Forbidden:** guarantees, before/after promises, regrowth percentages without a band.

---

## Section 12 — Doctor OPD Summary

**Answers all five, in clinician shorthand.** A printable one-page handoff.

Spec lives in `DOCTOR_REPORT_V3_SPEC.md`; this section embeds it as the final page of the patient report so a dermatologist can act on the patient's case in a single glance.

---

## Cross-Section Rules

1. **Five-question filter:** every paragraph is tagged with the question it serves. Untagged paragraphs are removed.
2. **Driver back-link:** every recommendation in §5–§9 cites a driver from §4 by plain name. Recommendations with no driver back-link are removed.
3. **Specificity:** every section is conditioned on (diagnosis, gender, severity, driver profile). See `SECTION_BY_SECTION_CONTENT_RULES.md`.
4. **Leakage:** no section contains any string from the engine blocklist. See `NARRATIVE_GOVERNANCE_RULES.md` §3.
5. **Uncertainty:** when a finding requires data we do not have, the report says so plainly and routes the question into §10 monitoring.

---

## Acceptance Checklist (per report)

- [ ] Patient can answer the five questions after one read.
- [ ] Every recommendation cites a driver.
- [ ] Zero engine-internal strings (automated lint).
- [ ] Zero off-gender content (automated check on gender × section content map).
- [ ] §6 contains only items in the patient's protocol; §7 contains only ingredients in §6.
- [ ] §8 reflects the patient's actual scalp state.
- [ ] §9 contains no domain that is not linked to a §4 driver.
- [ ] §11 contains no guarantees.
- [ ] §12 fits on one printable page.
