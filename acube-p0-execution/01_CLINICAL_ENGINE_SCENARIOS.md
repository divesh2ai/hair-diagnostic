# Clinical Engine — Six Scenarios, Before/After Each Proposed Correction

**Status: REVIEW ONLY. No clinical/medical logic has been modified, committed, or pushed.**
The "after" columns below were produced by running throwaway copies of the engine in an
isolated scratch directory (never on any tracked branch) purely to measure the effect of
each proposed correction. The approved engine on PR #24 (`src/packages/ai-engine/cause-registry/`)
is byte-for-byte unchanged.

---

## 0. What the engine does today (the mechanics behind the numbers)

File: `src/packages/ai-engine/cause-registry/engine.ts` (228 lines, pure mechanics; the clinical
knowledge lives entirely in `catalog.ts`).

A cause's score is:

```
raw = (Σ pathwayAffinity.weight × pathwayScore/100) × 30      ← pathwayScale
    + (Σ signalConfirmation.weight)                 × 5        ← signalScale
raw × (1 + 0.15 × (activePathways − 1))                        ← multi-pathway breadth bonus
raw × severityPriorMult[LOW 0.85 | MEDIUM 1.0 | HIGH 1.15]     ← severity prior
```

Bucketing thresholds (the tunables in question):

| Tunable | Value | Meaning |
|---|---|---|
| `primaryFloor` | **35** | score ≥ 35 → eligible to be elected PRIMARY |
| `secondaryFloor` | 25 | score ≥ 25 → SECONDARY |
| `contributingFloor` | 12 | score ≥ 12 → CONTRIBUTING |
| `confidenceHighFloor` | 60 | score ≥ 60 → HIGH confidence |
| `confidenceMediumFloor` | 30 | score ≥ 30 → MEDIUM confidence (else LOW) |
| `excludesDemotionScore` | 12 | flat penalty an excluder applies to an excluded cause |
| `excludesRankGap` | 1 | an excluder is forced to outrank its excluded causes |

**Two facts that explain every failing scenario:**

1. A single confirmed cause (one `CONFIRMS` signal weight 3.0 on one pathway) tops out at roughly
   `(pathwaySum×30) + 15`, then ×1.15 for a HIGH-severity prior. With the pathway only partially
   lit, PCOS / Hypothyroid / Iron land at **27–28**, i.e. **below `primaryFloor:35` but above
   `secondaryFloor:25`** → they are elected SECONDARY, and `primary` is `null`.
2. **The catalog declares no `excludes` relationships at all.** The engine fully supports exclusion
   (demotion of a clinically-incompatible cause beneath its excluder), but `AUTOIMMUNE_HAIR_LOSS`
   does not list `ANDROGEN_DRIVEN_MINIATURIZATION` in an `excludes` array, so Alopecia Areata can
   never demote Androgen today.

Both artefacts originate in the single WIP commit `a45f51f "Baseline before V2 report contract
migration"` — the tests and the engine were written together and **never passed**. This is unfinished
clinical calibration, not a regression.

---

## 1. The corrections under review

The D1 proposal, as I understand the two changes you flagged, plus the one it does not cover:

- **Correction A — Global `primaryFloor` reduction** (35 → 27). *You have NOT authorised this.*
  Modelled here only to show its exact reach.
- **Correction B — Autoimmune demotes Androgen** via a catalog `excludes: ['ANDROGEN_DRIVEN_MINIATURIZATION']`
  on `AUTOIMMUNE_HAIR_LOSS`. **This is *demotion*, not removal** — Androgen remains in the output as a
  coexisting cause. This is the opposite of the "automatic removal of androgen-related causes" you
  declined, and it preserves the clinically-supported coexisting cause as you require.
- **Correction C — Multifactorial fallback** (emit `MULTIFACTORIAL_HAIR_LOSS` when no cause clears a
  floor). Needed for Scenario 6; addressed by **neither** A nor B. Flagged, not modelled, pending your direction.

`A+B` = both A and B applied together.

> **Important for your two stated non-authorisations:**
> - *Global `primaryFloor` reduction*: the measurements below show A lowers the PRIMARY bar for **all
>   21 causes at once**, and elects PRIMARY causes the engine itself labels **LOW confidence** (score < 30).
>   It also **does not fix the autoimmune scenario** (Scenario 4).
> - *Automatic removal of androgen under autoimmune*: **not modelled and not recommended.** Correction B
>   keeps Androgen as a demoted SECONDARY (score 31.77) — removal would erase a cause that a Grade-4 male
>   with a genetics history genuinely carries. Demotion, not deletion, is what preserves coexisting causes.

---

## 2. The six scenarios — exact engine outputs

Legend: `ID=score[ROLE]`; ROLE = **P**rimary / **S**econdary / **C**ontributing. "✓/✗" = matches the
scenario's clinical target (the assertion in `tests/ai-engine/cause-registry.test.ts`).

### Scenario 1 — PCOS (Female 30, PCOS + Obesity + Sedentary)
Clinical target: **PCOS_DRIVEN_HORMONAL = PRIMARY**, metabolic coexisting.

| Variant | PRIMARY | Full output | Target |
|---|---|---|---|
| **BEFORE** | none | `PCOS:27.6[S]` · `METABOLIC:25.8[S]` | ✗ no primary |
| A (floor 27) | PCOS 27.6 | `PCOS:27.6[P]` · `METABOLIC:25.8[S]` | ✓ (but PRIMARY at LOW confidence) |
| B (AA⊳AGA) | none | `PCOS:27.6[S]` · `METABOLIC:25.8[S]` | ✗ unchanged |
| A+B | PCOS 27.6 | `PCOS:27.6[P]` · `METABOLIC:25.8[S]` | ✓ |

Coexisting METABOLIC cause is preserved in every variant. ✅

### Scenario 2 — Hypothyroid only (Hypothyroidism)
Clinical target: **HYPOTHYROID_HAIR_LOSS = PRIMARY**.

| Variant | PRIMARY | Full output | Target |
|---|---|---|---|
| **BEFORE** | none | `HYPOTHYROID:27.6[S]` | ✗ no primary |
| A (floor 27) | HYPOTHYROID 27.6 | `HYPOTHYROID:27.6[P]` | ✓ (LOW confidence) |
| B (AA⊳AGA) | none | `HYPOTHYROID:27.6[S]` | ✗ unchanged |
| A+B | HYPOTHYROID 27.6 | `HYPOTHYROID:27.6[P]` | ✓ |

### Scenario 3 — Iron-deficiency vegetarian (Iron deficiency + Vegetarian diet)
Clinical target: **IRON_DEFICIENCY_ANAEMIA = PRIMARY**.

| Variant | PRIMARY | Full output | Target |
|---|---|---|---|
| **BEFORE** | none | `IRON_DEFICIENCY:28.29[S]` | ✗ no primary |
| A (floor 27) | IRON 28.29 | `IRON_DEFICIENCY:28.29[P]` | ✓ (LOW confidence) |
| B (AA⊳AGA) | none | `IRON_DEFICIENCY:28.29[S]` | ✗ unchanged |
| A+B | IRON 28.29 | `IRON_DEFICIENCY:28.29[P]` | ✓ |

### Scenario 4 — Alopecia Areata + Genetics (Male 45, Grade 4, Genetics, Alopecia Areata, circular patches)
Clinical target: **AUTOIMMUNE_HAIR_LOSS = PRIMARY**, ANDROGEN demoted (but preserved as coexisting).

| Variant | PRIMARY | Full output | Target |
|---|---|---|---|
| **BEFORE** | ANDROGEN 47.27 | `ANDROGEN:47.27[P]` · `AUTOIMMUNE:32.77[S]` | ✗ androgen wins |
| A (floor 27) | ANDROGEN 47.27 | `ANDROGEN:47.27[P]` · `AUTOIMMUNE:32.77[S]` | ✗ **A does NOT fix this** |
| B (AA⊳AGA) | none | `AUTOIMMUNE:32.77[S]` · `ANDROGEN:31.77[S]` | partial — AA now outranks AGA, but 32.77 < 35 so no primary |
| **A+B** | **AUTOIMMUNE 32.77** | `AUTOIMMUNE:32.77[P]` · `ANDROGEN:31.77[S]` · `demoted=ANDROGEN` | ✓ **full target met** |

**This is the clinically important row.** Correction B demotes Androgen `47.27 → 31.77` (a flat −12
capped to one point below the excluder) and **keeps it in the output as a SECONDARY coexisting cause** —
exactly the "preserve clinically supported coexisting causes" requirement. Only `A+B` together elect
Autoimmune as PRIMARY *and* keep Androgen visible. A alone fails this scenario entirely; B alone
re-orders correctly but leaves no primary because Autoimmune's own score (32.77) sits below the floor.

### Scenario 5 — PCOS + co-existing scalp inflammation (PCOS + Obesity + Sedentary + Redness + Dandruff)
Clinical target: **PCOS = PRIMARY**, inflammatory scalp present but not primary.

| Variant | PRIMARY | Full output | Target |
|---|---|---|---|
| **BEFORE** | none | `PCOS:27.6[S]` · `INFLAMMATORY:27.3[S]` · `METABOLIC:25.8[S]` · `MULTIFACTORIAL:12.29[C]` | ✗ no primary |
| A (floor 27) | PCOS 27.6 | `PCOS:27.6[P]` · `INFLAMMATORY:27.3[S]` · `METABOLIC:25.8[S]` · `MULTIFACTORIAL:12.29[C]` | ✓ |
| B (AA⊳AGA) | none | (unchanged from BEFORE) | ✗ |
| A+B | PCOS 27.6 | `PCOS:27.6[P]` · `INFLAMMATORY:27.3[S]` · `METABOLIC:25.8[S]` · `MULTIFACTORIAL:12.29[C]` | ✓ |

All coexisting causes preserved. Note INFLAMMATORY (27.3) sits just under PCOS — with floor 27 it stays
SECONDARY only because PCOS was elected PRIMARY first (the engine allows one primary; ties broken by score).

### Scenario 6 — Multifactorial (Stress + Dandruff + Smoking + IBS, no dominant cause)
Clinical target: **MULTIFACTORIAL_HAIR_LOSS present in output.**

| Variant | PRIMARY | Full output | Target |
|---|---|---|---|
| **BEFORE** | STRESS_DRIVEN_TE 35.1 | `STRESS_TE:35.1[P]` · `GUT:21.3[C]` · `OXIDATIVE:21.3[C]` | ✗ no MULTIFACTORIAL emitted |
| A (floor 27) | STRESS_TE 35.1 | (unchanged) | ✗ |
| B (AA⊳AGA) | STRESS_TE 35.1 | (unchanged) | ✗ |
| A+B | STRESS_TE 35.1 | (unchanged) | ✗ |

**Neither A nor B touches this.** `MULTIFACTORIAL_HAIR_LOSS` scores 0 here (its three pathway
affinities are 0.3 each and none are lit strongly enough), so it never reaches `contributingFloor:12`.
This needs **Correction C** — an explicit multifactorial fallback — which is a separate clinical
decision, not a threshold tweak.

---

## 3. Controls — must NOT regress (both pass today; stay green under every variant)

| Scenario | BEFORE | A | B | A+B |
|---|---|---|---|---|
| Male 45, Grade 4, Genetics (AGA) | `ANDROGEN:74.86[P]` ✓ | ✓ | ✓ | ✓ |
| Recent surgery + Stress (TE) | `ILLNESS_TE:48.3[P]` · `STRESS_TE:41.4[S]` ✓ | ✓ | ✓ | ✓ |

No variant changes either control — the corrections are confined to the under-floor cases.

---

## 4. Downstream: the four `hair-evaluation-expanded` failures are the same root cause

`tests/assistant/hair-evaluation-expanded.test.ts` fails on `PCOS_GAP`, `THYROID_GAP`,
`MENOPAUSE_GAP`, `ALOPECIA_AREATA`. These are the assistant reading the *same* cause engine: when no
PRIMARY is elected, the evaluation reports a "gap". Fixing the six scenarios above closes all four of
these automatically — they are not a separate defect. (Total clinical-engine family = **6 + 4 = 10**
of the 15 suite failures, exactly as PR #24 states.)

---

## 5. Recommendation for your review (no action taken)

| Correction | Fixes | Side effects | My read |
|---|---|---|---|
| **A** global floor 35→27 | Scn 1,2,3,5 | Lowers PRIMARY bar for all 21 causes; elects LOW-confidence primaries; **does not fix Scn 4 or 6** | **Not recommended as a global change** — matches your non-authorisation |
| **B** AA `excludes` AGA | re-orders Scn 4 | none outside autoimmune; preserves Androgen as coexisting | **Safe & targeted; does not remove androgen** |
| **A+B** | Scn 1,2,3,4,5 | as A | Closes 5 of 6 + all 4 GAP tests, but inherits A's global-floor concern |
| **C** multifactorial fallback | Scn 6 | TBD | **Needs clinical definition** before modelling |

**A more surgical alternative to A** (for you to consider, not implemented): rather than lowering the
global floor, raise the *per-cause* signal/pathway calibration so a single confirmed endocrine/nutritional
cause clears 35 on its own merit (e.g. a confirmed-cause `signalScale` boost, or per-cause severity
priors), which would elect these PRIMARY at **MEDIUM/HIGH** confidence instead of LOW, and would leave
the global bucketing bar untouched. This keeps the "one confirmed dominant cause → PRIMARY" clinical
intent without globally weakening the PRIMARY definition. Happy to model this on request.

**Nothing above is applied.** Awaiting your scenario-by-scenario sign-off before any engine or catalog edit.
