# Narrative Governance Rules

> Voice, leakage, and trust rules that every patient-facing surface must pass.

This document is enforced. Every rule here corresponds to either a Consultation Composer check, a render-time lint, or a human-review acceptance gate. A surface that fails any rule does not ship.

---

## 1. Voice Rules

Every patient-facing sentence is held to this voice:

- **Senior dermatologist, twenty-minute consult.** Knowledgeable, calm, specific.
- **Active voice. Second person.** "Your follicles are…" not "It has been determined that the follicles…".
- **One idea per sentence.** No comma-spliced clinical hedging.
- **Plain words first, clinical names in parentheses.** "Shrinking follicles (miniaturization)".
- **No exclamation points. No emoji. No marketing superlatives** ("revolutionary", "powerful", "industry-leading").
- **No false reassurance.** "Don't worry" is forbidden. "This is treatable and we have a plan" is acceptable when true.

Violations are render-time lint failures.

---

## 2. Specificity Rules

A paragraph that does not satisfy **all four** conditioning axes is not condition-specific and must be removed or rewritten:

1. Conditioned on diagnosis.
2. Conditioned on gender.
3. Conditioned on severity band.
4. Conditioned on at least one driver in the patient's profile.

The Composer enforces this by attaching `{ diagnosis, gender, severity, drivers }` requirements to every narrative fragment in the library and filtering at selection time.

**No fallback generic paragraphs.** If no fragment passes the filter, the section emits an honest minimal version rather than relaxing the filter.

---

## 3. Leakage Blocklist (Engine Internals)

The following must never appear in any patient-facing surface (report, dashboard, modal, tooltip, alt-text, PDF metadata, error message). This list is enforced as a render-time lint.

**Forbidden strings (substring or regex):**

- `pathway`, `pathway_id`, `pathway-`
- `signal`, `signal_id`, `signal-`
- `cause_id`, `CAUSE_`, `cause-`
- `registry`, `registry_id`
- `score`, `confidence`, `probability` (as numeric labels)
- `artifact`, `node_`, `engine`, `pipeline`
- `enum`, `ID:`, `id=`, UUID-shaped strings
- Template residue: `{{`, `}}`, `${`, unfilled `[PATIENT_NAME]`-style placeholders
- Internal product code names (TBD — populate from current codebase)
- JSON braces in user-visible text

**Forbidden patterns:**

- Any all-caps identifier ≥ 4 chars that is not a known acronym (DHT, PCOS, TSH, AGA, FPHL, MPHL, TE, AA).
- Any decimal number presented without a unit or band ("your score is 0.62").
- Any reference to "the system", "the engine", "the algorithm".

A surface containing any blocklisted string fails the lint and does not ship.

---

## 4. Gender-Conditioning Rules (Hard)

Content from one gender's library must never reach the other's render context.

**Examples of hard-forbidden cross-gender content:**

- PCOS, menstrual cycle, pregnancy, post-partum, peri-menopausal, HRT → never in a male render.
- Male-pattern Norwood framing as the *only* DHT explanation → never in a female render.
- Beard/body hair androgen framing as the *only* androgen explanation → never in a female render.

This is enforced at two levels:
- **Composer-level:** narrative fragments carry an explicit `gender` tag; the filter drops mismatches before render.
- **Lint-level:** a denylist of cross-gender phrases is checked against the rendered text per patient gender.

A violation here is a P0 defect, not a content polish item.

---

## 5. Diagnosis-Conditioning Rules

- **Thyroid content** appears only when a thyroid driver is in the patient's profile (or thyroid evaluation is recommended in §10).
- **Autoimmune content** appears only when an autoimmune driver is present.
- **Inflammation content** appears only when an inflammatory driver is present.
- **Metabolic content** appears only when a metabolic driver is present.
- **Scarring-alopecia content** appears only on scarring diagnoses.

A paragraph that explains a condition the patient does not have is leakage from the narrative library and must be removed.

---

## 6. Severity-Conditioning Rules

- **Early severity:** language emphasizes prevention, reversal potential where realistic, and behavioural anchors.
- **Moderate severity:** language emphasizes intervention, expected timelines, and adherence importance.
- **Advanced severity:** language emphasizes stabilization, realistic recovery framing, and quality of remaining follicular function. Regrowth language is muted and ranges narrowed.

Outcomes (§11) and expected timelines (§6, §7) are always conditioned on severity. A 365-day outcome paragraph written for early severity must never appear in an advanced-severity report.

---

## 7. Driver Back-Link Rule

Every recommendation in §5 (Roadmap), §6 (Protocol), §8 (Topical), §9 (Lifestyle) **must** cite, by plain name, a driver that appears in §4.

A recommendation with no back-linked driver is a defect. The Composer rejects it; if rejection leaves a section empty, the section's fallback rule applies (see `SECTION_BY_SECTION_CONTENT_RULES.md`).

This rule is what prevents "kit-first" reasoning from leaking into the report — a recommendation cannot exist without an upstream clinical reason.

---

## 8. Uncertainty Rules

The report must be honest about what is not yet known.

- When a driver cannot be confirmed without external data (bloodwork, biopsy, in-person trichoscopy), the report says so plainly **and** routes the question into §10 monitoring as a marker to capture.
- "We cannot determine X without Y" is acceptable, expected, and trust-building.
- Fabricated certainty is the worst possible defect — worse than omission.

Uncertainty notes are surfaced in the Doctor Report under "Key Notes" with their concrete data ask.

---

## 9. Numeric Discipline

- Scores are rendered as bands, never as raw numbers.
- Timelines are rendered as ranges with units ("4–8 weeks"), not points.
- Outcomes are rendered as ranges with plain language anchors, never as percentages without a band.
- The only numbers that may appear are: ages, dates, dosages, frequencies, and clinically meaningful counts (e.g., shedding count).

---

## 10. Trust-Layer Acceptance (Pre-Ship Checklist)

Every report build must pass, automatically or by review:

- [ ] Voice lint: no exclamation points, no emoji, no marketing superlatives.
- [ ] Leakage lint: zero matches against the §3 blocklist.
- [ ] Gender lint: zero cross-gender phrases for the patient's gender.
- [ ] Diagnosis lint: no off-condition content.
- [ ] Back-link check: every §5–§9 recommendation cites a §4 driver.
- [ ] Uncertainty audit: data we lack is named, not glossed.
- [ ] Numeric discipline: no raw decimals presented as scores.
- [ ] Length check: report falls in the 14–18 page band.
- [ ] Five-question audit: a tester can answer Q1–Q5 after one read.

A build failing any of these does not reach the patient. This is non-negotiable.

---

## 11. Governance Process

- **Owner of this document:** clinical lead + product lead jointly.
- **Change control:** modifications to the blocklist (§3) require sign-off from both owners.
- **Drift check:** sampled patient reports are reviewed weekly against this document during V3 rollout, monthly thereafter.
- **Regression corpus:** every governance violation found in the wild becomes a fixture in the validation corpus so the same defect cannot recur silently.

This document evolves. The voice, leakage, gender, and back-link rules do not.
