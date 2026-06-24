# Section-by-Section Content Rules

> Per-section conditioning and inclusion/exclusion rules. This document is the source of truth for the Consultation Composer when assembling each section.

For each section: **required inputs**, **content rules**, **forbidden content**, and **fallback behaviour** when inputs are insufficient.

---

## Section 1 — Current Hair Assessment

**Required inputs:** `diagnosis.primary`, `severity`, `progressionRisk`, `patternClass`, `healthScore.band`.

**Rules:**
- Diagnosis stated once in plain language and once with clinical name in parentheses.
- Severity rendered as label only.
- Progression risk label is followed by one sentence explaining what that label means for *this* patient.
- Pattern class translated to plain-language stage description.
- Health score: band label only; no number.

**Forbidden:** drivers, treatments, mechanism explanations, lifestyle copy, ingredient names.

**Fallback (low data):** show what we have; explicitly state which fields await additional input. Never invent.

---

## Section 2 — What We Found

**Required inputs:** `findings[]` (top 5 by impact).

**Rules:**
- Maximum 5 findings. Items 6+ collapse into "additional findings under monitoring" line.
- Each finding has three lines: plain-language statement; what it means for the patient; evidence basis (intake symptom / history / pattern — never "signal X").
- Findings ordered by impact, not detection confidence.
- Each finding is gender- and diagnosis-conditioned.

**Forbidden:** signal names, registry IDs, scores, the word "signal" anywhere in patient text.

**Fallback (low data):** if fewer than 3 findings are confident, show what is confident and add an honest "we are gathering more data to refine these findings" line.

---

## Section 3 — Understanding Your Hair Loss

**Required inputs:** `diagnosis.primary`, `drivers.primary[]`, `identity.gender`, `identity.lifeStage`.

**Conditioning table (paragraph included only if all conditions are true):**

| Paragraph | Diagnosis | Gender | Driver present | Other |
|---|---|---|---|---|
| Follicular biology baseline | any | any | — | always included, ≤ 3 sentences |
| DHT impact | AGA / androgenic | any | androgenic driver | — |
| Male-pattern DHT framing | AGA | male | androgenic driver | — |
| Female-pattern DHT framing | AGA / FPHL | female | androgenic driver | — |
| Inflammation impact | any | any | inflammatory driver | — |
| Metabolic impact | any | any | metabolic driver | — |
| Hormonal impact (PCOS) | — | female | PCOS-consistent driver set | menstrual / cyst history present |
| Hormonal impact (peri-menopausal) | — | female | hormonal driver | life-stage = peri/post-menopausal |
| Hormonal impact (post-partum) | TE / post-partum | female | — | life-stage = post-partum |
| Thyroid impact | any | any | thyroid-consistent driver | thyroid flag present |
| Autoimmune impact | AA / scarring | any | autoimmune driver | — |
| Nutritional impact | any | any | nutritional driver | — |

**Forbidden:** any row not satisfying *all* its column constraints. A male patient must never receive any female-pattern row, full stop.

**Fallback:** if no row's conditions are satisfied, emit only the baseline follicular biology paragraph + an honest "your follicular biology summary will expand as your driver profile is confirmed".

---

## Section 4 — Root Cause Analysis

**Required inputs:** `drivers.primary[]`, `drivers.secondary[]`, `drivers.contributing[]`.

**Rules:**
- Tiers shown in order: Primary, Secondary, Contributing.
- Each driver renders: plain name · evidence · mechanism · impact.
- Primary: max 2. Secondary: max 3. Contributing: max 3.
- A driver appears in at most one tier.
- "Evidence" lines reference intake/history items in plain words.

**Forbidden:** cause IDs, registry references, raw probability numbers, "we're 0.73 confident" phrasings.

**Fallback:** if no primary driver is confidently identified, the section opens with "We have not yet confirmed a primary driver — see Monitoring for the data we need." Secondary/contributing drivers may still be listed if confident.

---

## Section 5 — Treatment Priority Roadmap

**Required inputs:** `roadmap[3]`, `drivers.primary[]`.

**Rules:**
- Exactly three priorities.
- Each priority cites the driver it addresses by plain name.
- Each priority has a one-line "why this comes first / next / last".
- The first priority must be actionable within one week.

**Forbidden:** more than three priorities; priorities that do not back-link to a driver; vague guidance ("eat better").

**Fallback:** if only 1 or 2 priorities are confident, render those and explicitly say "Priority 3 will be set after the M0 monitoring window."

---

## Section 6 — Personalized HairOS Protocol

**Required inputs:** `protocol[]` (items the patient is on only).

**Rules:**
- Render only items present in the patient's actual protocol.
- Per item: why selected · what it targets · expected timeline · success markers.
- Every "why selected" cites a driver from §4 by plain name.

**Forbidden:** items not in the patient's protocol; ingredient mechanism deep-dives (those belong in §7); marketing claims; superlatives ("the best…").

**Fallback:** if the protocol is empty, render a single explanatory paragraph: protocol will be finalized after [missing data]. Do not invent items.

---

## Section 7 — Ingredient Intelligence

**Required inputs:** the deduplicated ingredient list of items from §6.

**Rules:**
- Render each ingredient once even if it appears in multiple protocol items.
- Per ingredient: name · mechanism (1 sentence) · target (driver or biological process) · expected benefit (timeline + observable change).

**Forbidden:** ingredients not present in the patient's §6 protocol; ingredient encyclopedias; comparisons to competitor products.

**Fallback:** if §6 is empty, this section is omitted entirely.

---

## Section 8 — Topical Scalp Plan

**Required inputs:** `topicalPlan.scalpState`, `topicalPlan.recommendedProduct`, driver linkage.

**Conditioning:**

| Scalp state | Content focus |
|---|---|
| Dandruff | sebum + Malassezia mechanism; product rationale; usage cadence |
| Seborrheic dermatitis | inflammatory + sebum framing; clinical caution language |
| Inflamed scalp | inflammation reduction first; gentle vehicle |
| Sensitive scalp | minimal-actives approach; patch test guidance |
| Oily scalp | sebum balance; not over-stripping |
| Dry scalp | barrier repair; humectants |
| Healthy scalp | short maintenance note only |

**Rules:**
- Always state *why* TrichoSilk D or F (or other) was chosen specifically.
- Always include how-to-use (frequency, technique, contact time).

**Forbidden:** generic shampoo lectures; copy that applies to any scalp; recommending products the patient was not given.

**Fallback:** if scalp state is "healthy", render a 2-sentence maintenance note; do not pad with generic scalp education.

---

## Section 9 — Lifestyle Prescription

**Required inputs:** `lifestyle[]`, each item linked to a driver.

**Rules:**
- A lifestyle domain (sleep, stress, nutrition, exercise, meditation, hydration) appears only if at least one driver in §4 implicates it.
- Per item: action (with frequency/dosage/duration where applicable) · reason (driver name) · expected benefit (timeline).

**Forbidden:** "good general advice" sections; domains not linked to a driver; generic wellness copy.

**Fallback:** if no domain is linked, omit the section entirely with a one-line note: "Lifestyle prescriptions will be added once your driver profile is finalized."

---

## Section 10 — Monitoring Plan

**Required inputs:** `monitoring[4]` (M0, M3, M6, M12), each with markers + milestones + escalation.

**Rules:**
- All four windows always render.
- Each window: markers to track · expected milestones · escalation triggers.
- Escalation triggers are concrete and patient-readable ("if you do not notice less shedding by month 3, we re-evaluate").

**Forbidden:** generic "track your progress" copy; thresholds expressed only as numbers without plain-language meaning.

**Fallback:** if a window has no clinically meaningful milestone yet, render the marker set and write "milestones for this window will be set at your previous review".

---

## Section 11 — Expected Outcomes

**Required inputs:** `outcomes[4]` (30/90/180/365 days), conditioned on severity + driver profile.

**Rules:**
- Outcomes given as ranges, not points.
- Plain language of what the patient is most likely to notice; what they should not yet expect.
- Realism takes precedence over optimism.

**Forbidden:** guarantees; before/after promises; regrowth percentages without a band; comparisons to other patients.

**Fallback:** if severity is too advanced for typical recovery framings, the section reframes around stabilization and quality of follicular function rather than regrowth.

---

## Section 12 — Doctor OPD Summary

See `DOCTOR_REPORT_V3_SPEC.md`. The rules there are this section's rules.

---

## Cross-Section Inclusion Rules

1. **A section is omitted, not faked, when inputs are insufficient.** Honest omission > generic fallback.
2. **Every recommendation across §5–§9 must back-link to a driver in §4.** A recommendation with no back-link is a defect.
3. **No section may include content from another section.** §6 does not explain ingredients; §3 does not list lifestyle items.
4. **Gender × content matrix is enforced at the composer.** PCOS rows cannot reach a male render context.
5. **Severity affects voice across all sections.** Early severity → optimistic-but-cautious; advanced severity → stabilization-focused.
