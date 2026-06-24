# Dashboard V3 — Specification

> The in-app surface. Eight cards, glanceable, no engine artifacts.

The V2 dashboard is artifact-centric: it shows what the engine produced. V3 is patient-centric: it shows where the patient is and what to do next. The same `ConsultationModel` powers both surfaces; only the rendering differs.

---

## What V3 Removes

The following are removed from the dashboard entirely:

- Artifact cards (pathway nodes, signal panels, cause grids)
- Raw enum dumps
- Numeric score dumps (`hairHealthScore: 0.62` etc.)
- Debug / JSON-style objects
- Any card whose title is an engine concept ("Pathways", "Signals", "Causes", "Registry")

These are not redesigned. They are deleted.

---

## V3 Card Inventory

Eight cards, laid out in a responsive grid. Order on first paint:

| # | Card | Answers | Default state |
|---|---|---|---|
| 1 | Current Hair Status | Q1 | Expanded |
| 2 | Primary Drivers | Q2 | Expanded |
| 3 | Treatment Roadmap | Q4 (sequencing) | Expanded |
| 4 | Recommended Protocols | Q4 (what) | Expanded |
| 5 | Monitoring Timeline | Q5 (how we know) | Collapsed |
| 6 | Expected Recovery Journey | Q5 (when) | Collapsed |
| 7 | Lifestyle Priorities | Q4 (behaviour) | Collapsed |
| 8 | Doctor Notes | (all) | Collapsed |

Mobile: stacked, same order. Desktop: 2-column grid, cards 1–4 above the fold.

---

## Card Specifications

### Card 1 — Current Hair Status
- Diagnosis (plain language)
- Severity band (label, not number)
- Progression risk (label + one-line meaning)
- Hair Health band (Critical / At Risk / Stable / Strong) with trend arrow if available
- "Read full assessment →" link to patient report §1

**Forbidden:** numeric score, raw enums.

### Card 2 — Primary Drivers
- Up to 2 primary drivers shown as chips with plain names
- Tap chip → modal: evidence / mechanism / impact (one sentence each)
- "See all drivers →" link to patient report §4

**Forbidden:** showing all drivers in one wall; showing cause IDs.

### Card 3 — Treatment Roadmap
- Three priority steps, vertical, numbered
- Each step: name + one-line "why first / next / last"
- The current priority is highlighted; the others are dimmed
- CTA: "Start Priority 1 this week"

### Card 4 — Recommended Protocols
- List of protocol items the patient is on (and only those)
- Each item: name + the driver it targets + a small "why this" tooltip
- No catalogue, no recommendations the patient is not actually taking
- Link to patient report §6 for full detail

### Card 5 — Monitoring Timeline
- Horizontal timeline with M0, M3, M6, M12 markers
- Current position highlighted
- Each marker reveals on tap: what to track, expected milestones, escalation triggers (plain language)

### Card 6 — Expected Recovery Journey
- Four pills: 30d / 90d / 180d / 365d
- Each pill on tap: realistic range of outcomes, what to notice, what not to expect yet
- Never displays guarantees or before/after numbers

### Card 7 — Lifestyle Priorities
- Only the lifestyle items linked to a driver in the patient's profile
- Each item: action · reason · expected benefit (one line each)
- If no lifestyle items are linked, card collapses to: "No lifestyle priorities at this time — focus on Card 3 first."

### Card 8 — Doctor Notes
- Embeds the one-page Doctor OPD summary (see `DOCTOR_REPORT_V3_SPEC.md`)
- Read-only view with a "Download PDF for my dermatologist" button
- This is the *only* place the clinician-shorthand voice appears on the dashboard

---

## Card Behaviour Rules

1. **No empty card states.** A card with no real content collapses to a single line of honest copy ("No lifestyle priorities at this time"). It does not show placeholder squares or fake skeletons after data has loaded.

2. **No engine terminology on labels or empty states.** "We're still computing your pathway" is forbidden. "We're putting together your consultation" is acceptable.

3. **Every "see more" link points to a patient-report section, not a JSON view.**

4. **No card surfaces an editable field.** The dashboard is read-only. Re-intake / edits go through their own flow.

5. **Tooltips and modals follow the same governance.** A tooltip with engine leakage is the same defect as a section with engine leakage.

---

## Information Hierarchy

The four expanded cards (1–4) are above the fold and answer:
- "Where am I?" (Card 1)
- "Why?" (Card 2)
- "What do I do next?" (Card 3)
- "What am I doing now?" (Card 4)

The four collapsed cards (5–8) answer:
- "How will we know it's working?" (Card 5)
- "When?" (Card 6)
- "What else helps?" (Card 7)
- "What does my doctor need?" (Card 8)

This ordering is non-negotiable. Engineering may not re-order cards based on whichever module shipped first.

---

## Acceptance

- A patient opening the dashboard sees Cards 1–4 above the fold on a 13" screen.
- Zero engine-internal strings in any card, modal, or tooltip (automated lint over rendered DOM).
- Card 4 contains only items the patient is on; Card 7 contains only items linked to a driver.
- Card 8 prints to one page.
- Removing the V2 artifact cards does not regress any clinically meaningful information; every datum a clinician cared about appears in Cards 1–4 or 8.
