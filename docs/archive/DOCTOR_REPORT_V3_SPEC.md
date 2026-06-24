# Doctor OPD Report V3 — Specification

> A single printable page a dermatologist can act on in 60 seconds.

The doctor report is not a shortened patient report. It is a clinician handoff. Different voice, different density, different layout, same `ConsultationModel`.

---

## Format

- **One page.** A4 / Letter, portrait, printable.
- **Density:** terse. Sentence fragments are acceptable.
- **Voice:** clinical shorthand, not patient prose.
- **No marketing. No patient-comfort framing. No ingredient mechanisms.**

---

## Layout (top-to-bottom)

```
┌────────────────────────────────────────────────────────────┐
│ HEADER:  patient ref · date · gender · age band · life-stage│
├──────────────────────────┬─────────────────────────────────┤
│ DIAGNOSIS                │ SEVERITY & PROGRESSION           │
│  Primary:                │  Severity band:                  │
│  Secondary (if any):     │  Progression risk:               │
│  Pattern class:          │  Health score band:              │
├──────────────────────────┴─────────────────────────────────┤
│ DRIVERS                                                    │
│  Primary    : [name] — [one-line mechanism]                │
│  Secondary  : [name] — [one-line mechanism]                │
│  Contributing: [name; name; name]                          │
├────────────────────────────────────────────────────────────┤
│ PROTOCOL (selected items only)                             │
│  • [item]            — targets [driver]                    │
│  • [item]            — targets [driver]                    │
│  • [topical]         — scalp state: [state]                │
├────────────────────────────────────────────────────────────┤
│ MONITORING                                                 │
│  M0  : [baseline markers]                                  │
│  M3  : [expected milestones] | escalate if: [trigger]      │
│  M6  : [expected milestones] | escalate if: [trigger]      │
│  M12 : [expected milestones]                               │
├────────────────────────────────────────────────────────────┤
│ KEY NOTES                                                  │
│  • [uncertainty / data gap]                                │
│  • [contraindication / interaction watch]                  │
│  • [referral / bloodwork recommendation if any]            │
└────────────────────────────────────────────────────────────┘
```

---

## Field Rules

### Diagnosis block
- Use clinical names (e.g., "Androgenetic alopecia, Norwood III").
- Secondary diagnosis only if present in `ConsultationModel.diagnosis.secondary`.

### Severity & Progression
- Severity band as a label (Early / Moderate / Advanced).
- Progression risk as a label + one anchor (e.g., "Moderate — family history positive, onset <30").
- Health score as a band, not a number.

### Drivers
- Maximum 2 primary, 3 secondary, 3 contributing.
- Each named driver carries a one-line mechanism — the *clinician's* one-liner, not the patient's. E.g., "DHT-mediated miniaturization" not "shrinking follicles".

### Protocol
- List only items the patient is actually on.
- Each line: `item — targets [driver name]`.
- Topical line is separate and names the scalp state.

### Monitoring
- Four windows: M0, M3, M6, M12.
- Each window: markers to capture, expected milestones, escalation trigger (if any).
- Escalation triggers as concrete thresholds where possible ("shedding count not reduced by ≥30%").

### Key Notes
- Use this block for:
  - Explicit uncertainty / data we lack ("TSH not available — recommend baseline panel")
  - Contraindications or interactions to watch
  - Referrals (endocrine, derm in-person, trichoscopy)
- If there is nothing to flag, the block is **omitted**, not filled with filler.

---

## Forbidden in the Doctor Report

- Patient-comfort prose ("don't worry…", "many people experience…")
- Marketing language
- Ingredient mechanism explanations (those belong in the patient §7)
- Lifestyle paragraphs (lifestyle items appear only as a single line if they materially affect monitoring)
- Engine IDs, pathway IDs, signal names, raw scores
- Any string from the engine blocklist (`NARRATIVE_GOVERNANCE_RULES.md` §3)

---

## Embedding in the Patient Report

The doctor report is rendered as the **final page** of the patient report (Section 12). It is also exported as a standalone single-page PDF for the clinician.

When embedded in the patient report, the heading reads "For your dermatologist" and a short preface tells the patient what the page is for. The body content is identical to the standalone version.

---

## Acceptance

- A dermatologist scanning the page for 60 seconds can write a prescription.
- The page contains zero engine-internal strings (automated lint).
- Every protocol line points to a named driver.
- Every monitoring window has at least a marker set; escalation triggers are present where clinically meaningful.
- Key Notes is either substantive or omitted.
