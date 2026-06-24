# HAIROS_CONSTITUTIONAL_TEST_CORPUS_V1.md

**Document Status:** Canonical
**Version:** 1.0.0
**Date:** 2026-06-04
**Classification:** Regulatory-Grade Medical AI Verification Corpus
**Author Roles:** Senior Clinical Systems Architect · Medical AI Verification Architect · Clinical QA Governance Lead
**Designation:** CTC v1 (Constitutional Test Corpus v1)

---

## Authoritative Dependencies (Immutable)

This corpus consumes — and never modifies — the following constitutional documents:

- `HAIROS_ARCHITECTURE.md`
- `HAIROS_CLINICAL_INTELLIGENCE_MASTER_KNOWLEDGE_MODEL.md`
- `HAIROS_SIGNAL_REGISTRY_V1.md`
- `HAIROS_ROOT_CAUSE_ENGINE.md`
- `HAIROS_CLINICAL_TRUST_LAYER.md`
- `HAIROS_RECOMMENDATION_DECISION_ENGINE_CONSTITUTION.md`
- `HAIROS_UX_CONTRACT_SPECIFICATION.md`
- `HAIROS_CLINICAL_EXPLANATION_AND_NARRATIVE_ENGINE.md`
- `HAIROS_REPORT_SYSTEM_SPECIFICATION.md`
- `HAIROS_CEH_V1.md`
- `HAIROS_CEH_CK_V1_SPEC.md`

CTC is the **permanent release-gating test universe** for HairOS. CEH executes it; REES is bound by it; no constitutional change is considered shipped until CTC is updated to cover it.

---

# PART I — TEST CORPUS ARCHITECTURE

## 1.1 Corpus Philosophy

A constitutional system without a regression corpus is a system that cannot be verified. CEH defines *how* to validate a single execution; CTC defines *what set of executions must be validated* before HairOS may be released. CTC is the difference between a specification that is internally consistent and a system that is *demonstrably* compliant on every release.

The corpus is not a sample. It is the **universe of cases the system must clear** before any change reaches a patient.

## 1.2 Verification Goals

CTC verifies:

1. **Constitutional coverage** — every rule in every constitutional document is exercised by at least one positive case and at least one negative (seeded-fault) case.
2. **Determinism stability** — every case produces byte-identical outputs across runs and across implementers.
3. **Regression non-introduction** — no change to any component degrades a previously passing case.
4. **Fault-detection completeness** — every constitutional rule has a seeded fault that the harness detects.
5. **Edge-band integrity** — boundary, threshold, and near-tie behavior is explicitly covered.
6. **Clinical breadth** — every canonical cause is exercised across its full presentation spectrum.

## 1.3 Coverage Principles

- **No silent coverage.** A case must declare which constitutional rules it covers and which validators it exercises.
- **One rule, many cases; one case, many rules.** Coverage is a many-to-many graph; CTC tracks both directions.
- **Negative coverage parity.** For every PASS-expected case verifying a rule, there is at least one FAIL-expected case proving the rule's enforcement is real.
- **Boundary parity.** Any rule with a numeric threshold has cases at, just-above, and just-below the threshold.
- **Composite parity.** Any rule that may interact with another rule has at least one composite case exercising the interaction.

## 1.4 Deterministic Requirements

Every CTC case MUST:

- Be a pure structured input (no free-text patient narratives that admit interpretation).
- Pin the registry/engine version manifest.
- Pin the seed.
- Declare expected outputs at the granularity of: SignalSet IDs, accepted CauseSet, RecommendationSet IDs, ConfidenceBand enums, MonitoringVerdict enum, Validation Matrix, System Integrity Score, and detected seeded faults.
- Be byte-identically reproducible across runs and across implementations.

A CTC case that varies in output across runs is, by definition, broken — either the case or the system.

## 1.5 Versioning Rules

- CTC carries its own semver (`CTC vX.Y.Z`).
- A CTC version is bound to a constitutional-document version manifest. Changing any bound document forces a CTC minor bump.
- Adding cases without changing expected outputs is a patch bump.
- Removing or modifying a case requires governance approval and is recorded as a constitutional change event.
- A registry/engine upgrade that invalidates ≥1 CTC case is **blocked from release** until either the case is migrated (with governance approval) or the upgrade is amended.

## 1.6 Regulatory Rationale

Regulated medical AI systems are evaluated on three axes: (a) what the system claims to do, (b) whether it does that consistently, (c) whether failures are detected and prevented. CTC is the artifact that answers (b) and (c). Without CTC, claims (a) are unverifiable assertions.

## 1.7 Why CEH Without a Test Corpus Is Incomplete

CEH defines the validation grammar. A grammar without a corpus tests nothing. CEH alone could be used to validate ad-hoc cases — which means coverage becomes a function of which cases the implementer chose to write. CTC removes that discretion. With CTC, coverage is constitutional, not editorial.

---

# PART II — MASTER TEST TAXONOMY

For each of the 10 canonical causes, CTC defines seven presentation classes:

| Class | Definition | Expected CEH outcome |
|---|---|---|
| Early | Earliest constitutionally-recognizable presentation; signals minimal but sufficient | Acceptance with MODERATE band; monitoring plan emphasized |
| Moderate | Established presentation; clear signal set | Acceptance with HIGH band; full recommendation set |
| Advanced | Long-duration / high-severity presentation | Acceptance with HIGH band; escalation pathway active |
| Borderline | Posterior near the 0.30 acceptance threshold | Acceptance or INSUFFICIENT_EVIDENCE depending on side of threshold |
| Ambiguous | Top-1 vs Top-2 posterior margin < 0.05 | Acceptance with dissent flag set |
| Composite | Multiple causes co-eligible per compositeRule | Multi-acceptance via compositeRule |
| Adversarial | Inputs constructed to provoke a constitutional violation | BLOCK; specific failure mode detected |

The seven-class spec yields a **minimum 70 cases per taxonomy** (10 causes × 7 classes), with ID convention:

```
CTC-CAUSE-{CAUSE_SHORT}-{CLASS}-{NN}
```

## 2.1 CAUSE.ANDROGENETIC_ALOPECIA (AGA)

| Class | Case ID | Defining Signal Configuration |
|---|---|---|
| Early | CTC-AGA-EARLY-01 | Frontal miniaturization only; occipital sparing; FH+; no inflammation |
| Moderate | CTC-AGA-MOD-01 | Frontal + vertex miniaturization; FH+; occipital sparing; chronic onset |
| Advanced | CTC-AGA-ADV-01 | Norwood ≥V pattern; multi-region miniaturization; FH+ |
| Borderline | CTC-AGA-BORD-01 | Single-region miniaturization, weak FH signal; posterior ~0.30 |
| Ambiguous | CTC-AGA-AMB-01 | AGA vs CHRONIC_MULTIFACTORIAL near-tie |
| Composite | CTC-AGA-COMP-01 | AGA + co-accepted TELOGEN_EFFLUVIUM (post-illness shed overlay) |
| Adversarial | CTC-AGA-ADV-FAULT-01 | Miniaturization present but SCARRING signal also active (should EXCLUDE AGA) |

## 2.2 CAUSE.TELOGEN_EFFLUVIUM (TE)

| Class | Case ID | Defining Signal Configuration |
|---|---|---|
| Early | CTC-TE-EARLY-01 | Acute onset (3mo), moderate shed, recent illness |
| Moderate | CTC-TE-MOD-01 | Acute onset (5mo), severe shed, recent illness, no miniaturization |
| Advanced | CTC-TE-ADV-01 | Chronic TE (≥6mo) with ongoing nutritional stressor |
| Borderline | CTC-TE-BORD-01 | Shed=moderate, onset=6mo, no clear trigger |
| Ambiguous | CTC-TE-AMB-01 | TE vs STRESS_INDUCED_SHEDDING near-tie |
| Composite | CTC-TE-COMP-01 | TE + NUTRITIONAL_DEFICIT |
| Adversarial | CTC-TE-ADV-FAULT-01 | Severe shed claimed but onset > 24mo and no trigger (should not accept TE) |

## 2.3 CAUSE.NUTRITIONAL_DEFICIT (ND)

| Class | Case ID | Defining Signal Configuration |
|---|---|---|
| Early | CTC-ND-EARLY-01 | Restrictive diet, mild shed, no weight loss |
| Moderate | CTC-ND-MOD-01 | Restrictive diet + weight loss ≥5kg + shed |
| Advanced | CTC-ND-ADV-01 | Long-standing restriction + severe shed + diffuse low density |
| Borderline | CTC-ND-BORD-01 | Vegan diet only; no shed; no weight loss |
| Ambiguous | CTC-ND-AMB-01 | ND vs TE near-tie |
| Composite | CTC-ND-COMP-01 | ND + TE + STRESS |
| Adversarial | CTC-ND-ADV-FAULT-01 | Recommendation IRON_REPLETION emitted without ND acceptance (orphan) |

## 2.4 CAUSE.HORMONAL_DISORDER (HD)

| Class | Case ID | Defining Signal Configuration |
|---|---|---|
| Early | CTC-HD-EARLY-01 | Cycle irregularity + mild shed |
| Moderate | CTC-HD-MOD-01 | Hormonal transition (post-OCP) + shed + acute onset |
| Advanced | CTC-HD-ADV-01 | Chronic hormonal disturbance + diffuse low density |
| Borderline | CTC-HD-BORD-01 | Cycle irregularity only; no shed; no transition event |
| Ambiguous | CTC-HD-AMB-01 | HD vs TE near-tie post-OCP discontinuation |
| Composite | CTC-HD-COMP-01 | HD + ND |
| Adversarial | CTC-HD-ADV-FAULT-01 | HORMONAL_TRANSITION signal absent yet HD accepted (eligibility violation) |

## 2.5 CAUSE.SEBORRHEIC_DERMATITIS (SD)

| Class | Case ID | Defining Signal Configuration |
|---|---|---|
| Early | CTC-SD-EARLY-01 | Scaling + itch grade 1 |
| Moderate | CTC-SD-MOD-01 | Scaling + erythema + itch grade 2 |
| Advanced | CTC-SD-ADV-01 | Persistent scaling + erythema + burning + itch grade 3 |
| Borderline | CTC-SD-BORD-01 | Scaling visible (image quality 0.62) only |
| Ambiguous | CTC-SD-AMB-01 | SD vs FOLLICULITIS near-tie |
| Composite | CTC-SD-COMP-01 | SD + AGA |
| Adversarial | CTC-SD-ADV-FAULT-01 | SCARRING active (should EXCLUDE SD) |

## 2.6 CAUSE.FOLLICULITIS (FOL)

| Class | Case ID | Defining Signal Configuration |
|---|---|---|
| Early | CTC-FOL-EARLY-01 | Pustules + mild erythema |
| Moderate | CTC-FOL-MOD-01 | Pustules + erythema + pain grade 1 |
| Advanced | CTC-FOL-ADV-01 | Multifocal pustules + erythema + pain grade 3 |
| Borderline | CTC-FOL-BORD-01 | Single image pustule signal (quality 0.61) |
| Ambiguous | CTC-FOL-AMB-01 | FOL vs SD near-tie |
| Composite | CTC-FOL-COMP-01 | (composite ineligible per cause model — verifies refusal) |
| Adversarial | CTC-FOL-ADV-FAULT-01 | Pustules absent but FOL accepted (req_signals violation) |

## 2.7 CAUSE.CICATRICIAL_ALOPECIA (CIC)

| Class | Case ID | Defining Signal Configuration |
|---|---|---|
| Early | CTC-CIC-EARLY-01 | Early scarring image signal + pattern class Cicatricial |
| Moderate | CTC-CIC-MOD-01 | Scarring + pain + burning |
| Advanced | CTC-CIC-ADV-01 | Extensive scarring + multi-region involvement |
| Borderline | CTC-CIC-BORD-01 | Scarring image quality at 0.60 threshold |
| Ambiguous | CTC-CIC-AMB-01 | CIC vs FOL near-tie when pustules + scarring co-present |
| Composite | CTC-CIC-COMP-01 | (composite ineligible — verifies refusal) |
| Adversarial | CTC-CIC-ADV-FAULT-01 | Scarring present yet AGA accepted (AGA exclusion violation) |

## 2.8 CAUSE.ALOPECIA_AREATA (AA)

| Class | Case ID | Defining Signal Configuration |
|---|---|---|
| Early | CTC-AA-EARLY-01 | Single patch, acute onset, no inflammation |
| Moderate | CTC-AA-MOD-01 | Multiple patches, acute onset |
| Advanced | CTC-AA-ADV-01 | Extensive patchy loss, total/universalis pattern declared |
| Borderline | CTC-AA-BORD-01 | Patchy pattern declared without image confirmation |
| Ambiguous | CTC-AA-AMB-01 | AA vs CIC near-tie when patches overlap scarring concerns |
| Composite | CTC-AA-COMP-01 | (composite ineligible — verifies refusal) |
| Adversarial | CTC-AA-ADV-FAULT-01 | SCARRING active but AA accepted (exclusion violation) |

## 2.9 CAUSE.CHRONIC_MULTIFACTORIAL (CM)

| Class | Case ID | Defining Signal Configuration |
|---|---|---|
| Early | CTC-CM-EARLY-01 | Chronic onset + mild FH+ + no inflammation |
| Moderate | CTC-CM-MOD-01 | Chronic onset + FH+ + non-inflammatory diffuse loss |
| Advanced | CTC-CM-ADV-01 | Long-standing multifactorial loss with stable plateau |
| Borderline | CTC-CM-BORD-01 | Chronic onset only; no FH, no other signals |
| Ambiguous | CTC-CM-AMB-01 | CM vs AGA near-tie |
| Composite | CTC-CM-COMP-01 | CM + AGA + ND |
| Adversarial | CTC-CM-ADV-FAULT-01 | Acute onset case forced into CM acceptance (req_signals violation) |

## 2.10 CAUSE.STRESS_INDUCED_SHEDDING (SIS)

| Class | Case ID | Defining Signal Configuration |
|---|---|---|
| Early | CTC-SIS-EARLY-01 | High stress + mild shed |
| Moderate | CTC-SIS-MOD-01 | High stress + sleep deprivation + diffuse shed |
| Advanced | CTC-SIS-ADV-01 | Sustained stress axis activation with shed across 6mo |
| Borderline | CTC-SIS-BORD-01 | Stress grade 2 only; no shed |
| Ambiguous | CTC-SIS-AMB-01 | SIS vs TE near-tie |
| Composite | CTC-SIS-COMP-01 | SIS + TE + ND |
| Adversarial | CTC-SIS-ADV-FAULT-01 | Stress signal absent yet SIS accepted (eligibility violation) |

---

# PART III — CASE CLASSES

Twelve constitutional case classes. Every case in CTC carries one or more class tags. Class tags are orthogonal to taxonomy tags from Part II.

| Class | Code | Definition | Expected Outcome | Minimum Cases |
|---|---|---|---|---|
| A | Canonical Positive | Textbook acceptance of a single cause | PASS, score 100 | 30 |
| B | Canonical Negative | Textbook rejection / INSUFFICIENT_EVIDENCE | PASS (correct rejection), score 100 | 20 |
| C | Boundary Threshold | Case sits at, just-above, just-below a numeric threshold | PASS with expected enum on each side | 40 |
| D | Composite Multifactorial | compositeRule invoked, ≥2 causes co-accepted | PASS, both causes in CauseSet | 25 |
| E | Conflicting Signal | Signals from incompatible pathways co-present | PASS, exclusions correctly applied | 20 |
| F | Noise Floor | Monitoring deltas at noise boundaries | PASS with correct verdict enum | 30 |
| G | Monitoring/Reassessment | Stateful executions with pinned baseline | PASS with correct trend verdict | 40 |
| H | Trust Layer Integrity | Confidence / banding / monotonicity stress | PASS or seeded-fault detection | 25 |
| I | Explanation Engine | 5-axis binding stress | PASS or seeded-fault detection | 25 |
| J | Report Layer | Section binding / sealed channel / rendering stress | PASS or seeded-fault detection | 25 |
| K | Adversarial | Inputs constructed to provoke constitutional violations | BLOCK with specific failure mode | 30 |
| L | Seeded Fault | Explicit `injectedFaults` to verify detection | BLOCK with seeded faults detected | 50 |

**Minimum corpus per class total: 360.** Combined with Part II's 70 taxonomy cases (which double-count under their natural class), CTC v1 minimum is **500+** cases (Part XIV).

---

# PART IV — SIGNAL REGISTRY COVERAGE

Every signal in `SIGNAL_REGISTRY_V1` (per CEH-CK §1) MUST have at least four cases: Activation, Non-Activation, Threshold, Exclusion.

## 4.1 Signal → Case Mapping Matrix

| SIGNAL_ID | Activation | Non-Activation | Threshold | Exclusion |
|---|---|---|---|---|
| SIG.MIN.FRONTAL | CTC-SIG-FRONT-ACT-01 | CTC-SIG-FRONT-NACT-01 | CTC-SIG-FRONT-THR-01 (qualityScore=0.60) | CTC-SIG-FRONT-EXC-01 |
| SIG.MIN.VERTEX | CTC-SIG-VERT-ACT-01 | CTC-SIG-VERT-NACT-01 | CTC-SIG-VERT-THR-01 | CTC-SIG-VERT-EXC-01 |
| SIG.MIN.TEMPORAL | CTC-SIG-TEMP-ACT-01 | CTC-SIG-TEMP-NACT-01 | CTC-SIG-TEMP-THR-01 | CTC-SIG-TEMP-EXC-01 |
| SIG.OCCIPITAL_SPARING | CTC-SIG-OCC-ACT-01 | CTC-SIG-OCC-NACT-01 | CTC-SIG-OCC-THR-01 | CTC-SIG-OCC-EXC-01 |
| SIG.DIFFUSE_LOW_DENSITY | CTC-SIG-DLD-ACT-01 | CTC-SIG-DLD-NACT-01 | CTC-SIG-DLD-THR-01 | CTC-SIG-DLD-EXC-01 (excluded by FRONTAL_DOMINANT) |
| SIG.SCALING_VISIBLE | CTC-SIG-SCAL-ACT-01 | CTC-SIG-SCAL-NACT-01 | CTC-SIG-SCAL-THR-01 | CTC-SIG-SCAL-EXC-01 |
| SIG.ERYTHEMA_VISIBLE | CTC-SIG-ERY-ACT-01 | CTC-SIG-ERY-NACT-01 | CTC-SIG-ERY-THR-01 | CTC-SIG-ERY-EXC-01 |
| SIG.PUSTULES | CTC-SIG-PUST-ACT-01 | CTC-SIG-PUST-NACT-01 | CTC-SIG-PUST-THR-01 | CTC-SIG-PUST-EXC-01 |
| SIG.SCARRING_VISIBLE | CTC-SIG-SCAR-ACT-01 | CTC-SIG-SCAR-NACT-01 | CTC-SIG-SCAR-THR-01 | CTC-SIG-SCAR-EXC-01 (mutually excludes NO_INFLAMMATION) |
| SIG.ITCH | CTC-SIG-ITCH-ACT-01 | CTC-SIG-ITCH-NACT-01 | CTC-SIG-ITCH-THR-01 (ordinal=1) | CTC-SIG-ITCH-EXC-01 |
| SIG.PAIN | CTC-SIG-PAIN-ACT-01 | CTC-SIG-PAIN-NACT-01 | CTC-SIG-PAIN-THR-01 | CTC-SIG-PAIN-EXC-01 |
| SIG.BURNING | CTC-SIG-BURN-ACT-01 | CTC-SIG-BURN-NACT-01 | CTC-SIG-BURN-THR-01 | CTC-SIG-BURN-EXC-01 |
| SIG.NO_INFLAMMATION | CTC-SIG-NOINF-ACT-01 | CTC-SIG-NOINF-NACT-01 | CTC-SIG-NOINF-THR-01 | CTC-SIG-NOINF-EXC-01 (vs SCARRING) |
| SIG.DIFFUSE_SHED | CTC-SIG-SHED-ACT-01 | CTC-SIG-SHED-NACT-01 | CTC-SIG-SHED-THR-01 (low→moderate boundary) | CTC-SIG-SHED-EXC-01 |
| SIG.FAMILY_HISTORY_POSITIVE | CTC-SIG-FH-ACT-01 | CTC-SIG-FH-NACT-01 | CTC-SIG-FH-THR-01 | CTC-SIG-FH-EXC-01 |
| SIG.RECENT_ILLNESS | CTC-SIG-ILL-ACT-01 | CTC-SIG-ILL-NACT-01 | CTC-SIG-ILL-THR-01 (onset=6mo boundary) | CTC-SIG-ILL-EXC-01 |
| SIG.RECENT_SURGERY | CTC-SIG-SURG-ACT-01 | CTC-SIG-SURG-NACT-01 | CTC-SIG-SURG-THR-01 | CTC-SIG-SURG-EXC-01 |
| SIG.WEIGHT_LOSS_SIGNIFICANT | CTC-SIG-WTL-ACT-01 | CTC-SIG-WTL-NACT-01 | CTC-SIG-WTL-THR-01 (-5kg boundary) | CTC-SIG-WTL-EXC-01 |
| SIG.NUTRITIONAL_RESTRICTION | CTC-SIG-NUTR-ACT-01 | CTC-SIG-NUTR-NACT-01 | CTC-SIG-NUTR-THR-01 | CTC-SIG-NUTR-EXC-01 |
| SIG.SLEEP_DEPRIVED | CTC-SIG-SLEEP-ACT-01 | CTC-SIG-SLEEP-NACT-01 | CTC-SIG-SLEEP-THR-01 (6h boundary) | CTC-SIG-SLEEP-EXC-01 |
| SIG.HIGH_STRESS | CTC-SIG-STR-ACT-01 | CTC-SIG-STR-NACT-01 | CTC-SIG-STR-THR-01 (stress=2 boundary) | CTC-SIG-STR-EXC-01 |
| SIG.HORMONAL_TRANSITION | CTC-SIG-HORM-ACT-01 | CTC-SIG-HORM-NACT-01 | CTC-SIG-HORM-THR-01 | CTC-SIG-HORM-EXC-01 |
| SIG.ACUTE_ONSET | CTC-SIG-ACUTE-ACT-01 | CTC-SIG-ACUTE-NACT-01 | CTC-SIG-ACUTE-THR-01 (onset=6mo boundary) | CTC-SIG-ACUTE-EXC-01 (vs CHRONIC) |
| SIG.CHRONIC_ONSET | CTC-SIG-CHRON-ACT-01 | CTC-SIG-CHRON-NACT-01 | CTC-SIG-CHRON-THR-01 (onset=24mo boundary) | CTC-SIG-CHRON-EXC-01 |
| SIG.NO_MINIATURIZATION | CTC-SIG-NOMIN-ACT-01 | CTC-SIG-NOMIN-NACT-01 | CTC-SIG-NOMIN-THR-01 | CTC-SIG-NOMIN-EXC-01 |
| SIG.PATCHY_LOSS | CTC-SIG-PATCH-ACT-01 | CTC-SIG-PATCH-NACT-01 | CTC-SIG-PATCH-THR-01 | CTC-SIG-PATCH-EXC-01 |
| SIG.CICATRICIAL_PATTERN | CTC-SIG-CICP-ACT-01 | CTC-SIG-CICP-NACT-01 | CTC-SIG-CICP-THR-01 | CTC-SIG-CICP-EXC-01 |

**Total signal coverage: 27 signals × 4 cases = 108 cases minimum.**

**Rule:** No signal added to the registry without simultaneous addition of these four cases. Registry update without coverage update is BLOCKED.

---

# PART V — PATHWAY COVERAGE

Every pathway in the Pathway Model (per CEH-CK §2) MUST have three cases: Activation, Suppression, Indeterminate-band.

## 5.1 Pathway → Case Mapping Matrix

| PATHWAY_ID | Activation (≥0.50) | Suppression (<0.15) | Indeterminate ([0.15, 0.50)) |
|---|---|---|---|
| PATH.ANDROGEN_DEPENDENT_MINIATURIZATION | CTC-PATH-ADM-ACT-01 | CTC-PATH-ADM-SUP-01 | CTC-PATH-ADM-IND-01 |
| PATH.TELOGEN_SHIFT | CTC-PATH-TS-ACT-01 | CTC-PATH-TS-SUP-01 | CTC-PATH-TS-IND-01 |
| PATH.NUTRITIONAL_STRESS | CTC-PATH-NS-ACT-01 | CTC-PATH-NS-SUP-01 | CTC-PATH-NS-IND-01 |
| PATH.HORMONAL_TRANSITION | CTC-PATH-HT-ACT-01 | CTC-PATH-HT-SUP-01 | CTC-PATH-HT-IND-01 |
| PATH.INFLAMMATORY | CTC-PATH-INF-ACT-01 | CTC-PATH-INF-SUP-01 | CTC-PATH-INF-IND-01 |
| PATH.SUPPURATIVE | CTC-PATH-SUP-ACT-01 | CTC-PATH-SUP-SUP-01 | CTC-PATH-SUP-IND-01 |
| PATH.CICATRICIAL | CTC-PATH-CIC-ACT-01 | CTC-PATH-CIC-SUP-01 | CTC-PATH-CIC-IND-01 |
| PATH.AUTOIMMUNE_FOCAL | CTC-PATH-AF-ACT-01 | CTC-PATH-AF-SUP-01 | CTC-PATH-AF-IND-01 |
| PATH.CHRONIC_STRUCTURAL | CTC-PATH-CS-ACT-01 | CTC-PATH-CS-SUP-01 | CTC-PATH-CS-IND-01 |
| PATH.STRESS_AXIS | CTC-PATH-SA-ACT-01 | CTC-PATH-SA-SUP-01 | CTC-PATH-SA-IND-01 |

**Total pathway coverage: 10 pathways × 3 cases = 30 cases minimum.**

---

# PART VI — ROOT CAUSE ENGINE COVERAGE

For each canonical cause, six explicit cases.

## 6.1 Per-Cause Coverage Matrix

| Cause | Eligibility | Ineligibility | Acceptance | Composite Acceptance | Rejection | Dissent Flag |
|---|---|---|---|---|---|---|
| AGA | CTC-RCE-AGA-ELIG-01 | CTC-RCE-AGA-INEL-01 | CTC-RCE-AGA-ACC-01 | CTC-RCE-AGA-COMP-01 | CTC-RCE-AGA-REJ-01 | CTC-RCE-AGA-DIS-01 |
| TE | CTC-RCE-TE-ELIG-01 | CTC-RCE-TE-INEL-01 | CTC-RCE-TE-ACC-01 | CTC-RCE-TE-COMP-01 | CTC-RCE-TE-REJ-01 | CTC-RCE-TE-DIS-01 |
| ND | CTC-RCE-ND-ELIG-01 | CTC-RCE-ND-INEL-01 | CTC-RCE-ND-ACC-01 | CTC-RCE-ND-COMP-01 | CTC-RCE-ND-REJ-01 | CTC-RCE-ND-DIS-01 |
| HD | CTC-RCE-HD-ELIG-01 | CTC-RCE-HD-INEL-01 | CTC-RCE-HD-ACC-01 | CTC-RCE-HD-COMP-01 | CTC-RCE-HD-REJ-01 | CTC-RCE-HD-DIS-01 |
| SD | CTC-RCE-SD-ELIG-01 | CTC-RCE-SD-INEL-01 | CTC-RCE-SD-ACC-01 | CTC-RCE-SD-COMP-01 | CTC-RCE-SD-REJ-01 | CTC-RCE-SD-DIS-01 |
| FOL | CTC-RCE-FOL-ELIG-01 | CTC-RCE-FOL-INEL-01 | CTC-RCE-FOL-ACC-01 | N/A (non-composite) | CTC-RCE-FOL-REJ-01 | CTC-RCE-FOL-DIS-01 |
| CIC | CTC-RCE-CIC-ELIG-01 | CTC-RCE-CIC-INEL-01 | CTC-RCE-CIC-ACC-01 | N/A | CTC-RCE-CIC-REJ-01 | CTC-RCE-CIC-DIS-01 |
| AA | CTC-RCE-AA-ELIG-01 | CTC-RCE-AA-INEL-01 | CTC-RCE-AA-ACC-01 | N/A | CTC-RCE-AA-REJ-01 | CTC-RCE-AA-DIS-01 |
| CM | CTC-RCE-CM-ELIG-01 | CTC-RCE-CM-INEL-01 | CTC-RCE-CM-ACC-01 | CTC-RCE-CM-COMP-01 | CTC-RCE-CM-REJ-01 | CTC-RCE-CM-DIS-01 |
| SIS | CTC-RCE-SIS-ELIG-01 | CTC-RCE-SIS-INEL-01 | CTC-RCE-SIS-ACC-01 | CTC-RCE-SIS-COMP-01 | CTC-RCE-SIS-REJ-01 | CTC-RCE-SIS-DIS-01 |

## 6.2 Posterior Margin Edge Cases

| Case ID | Configuration |
|---|---|
| CTC-RCE-EDGE-ACC-01 | Top-1 posterior = 0.300 (exactly at acceptance) |
| CTC-RCE-EDGE-REJ-01 | Top-1 posterior = 0.299 (just below) |
| CTC-RCE-EDGE-COMP-01 | Top-2 posterior = 0.200 (composite acceptance lower bound) |
| CTC-RCE-EDGE-COMP-02 | Top-1 vs Top-2 margin = 0.400 (composite margin boundary) |
| CTC-RCE-EDGE-DIS-01 | Top-1 vs Top-2 margin = 0.049 (dissent flag set) |
| CTC-RCE-EDGE-DIS-02 | Top-1 vs Top-2 margin = 0.050 (dissent flag NOT set) |

## 6.3 Composite-Rule Edge Cases

| Case ID | Configuration |
|---|---|
| CTC-RCE-COMP-EDGE-01 | Composite candidate eligible by margin but composite==false → MUST NOT co-accept |
| CTC-RCE-COMP-EDGE-02 | Three-way composite candidates with all margins ≤ 0.40 |
| CTC-RCE-COMP-EDGE-03 | Composite candidate's required pathway not activated → MUST NOT co-accept |
| CTC-RCE-COMP-EDGE-04 | Composite candidate's exclusion signal active → MUST NOT co-accept |

**Total RCE coverage: 60 + 6 + 4 = 70 cases minimum.**

---

# PART VII — RDE COVERAGE

Every cause→capability mapping in CEH-CK §4 MUST have six cases.

## 7.1 Per-Capability Coverage

For each `(cause, capability)` row in the cause_to_capability_table:

| Sub-case | Description |
|---|---|
| Proper Emission | Capability emitted with all preconditions satisfied |
| Contraindication Withholding | Hard contraindication active → status=WITHHELD |
| Conditional Recommendation | Soft contraindication active → status=CONDITIONAL |
| WhyNot Generation | At least one alternative exists; whyNotSet populated |
| Objective Binding | Objective enum correctly bound |
| Cause Binding | causeRefs correctly populated; orphan refused |

## 7.2 Orphan Recommendation Detection Cases

| Case ID | Description |
|---|---|
| CTC-RDE-ORPH-01 | Recommendation emitted with empty causeRefs → BLOCK at S4 |
| CTC-RDE-ORPH-02 | causeRefs references rejected cause → BLOCK at S4 |
| CTC-RDE-ORPH-03 | causeRefs references cause from another execution → BLOCK at S4 |
| CTC-RDE-ORPH-04 | Recommendation emitted without objective → BLOCK at S4 |
| CTC-RDE-ORPH-05 | Recommendation emitted without capabilityRef → BLOCK at S4 |

## 7.3 Contraindication Coverage

For every hard and soft contraindication declared in CEH-CK §4:

- One case where the contraindication is present → withholding/conditional behavior verified.
- One case where the contraindication is absent → normal emission verified.

**Total RDE coverage: ~10 capabilities × 6 + 5 orphan + ~12 contraindication × 2 = 89 cases minimum.**

---

# PART VIII — TRUST LAYER COVERAGE

## 8.1 Trust Layer Functional Coverage

| Case ID | Validates |
|---|---|
| CTC-TL-CALC-01 | Confidence formula correctness (HIGH input → HIGH band) |
| CTC-TL-CALC-02 | Confidence formula correctness (low signal strength → INSUFFICIENT) |
| CTC-TL-BAND-01 | Band boundary at 0.80 (HIGH/MODERATE) |
| CTC-TL-BAND-02 | Band boundary at 0.60 (MODERATE/PROVISIONAL) |
| CTC-TL-BAND-03 | Band boundary at 0.40 (PROVISIONAL/INSUFFICIENT) |
| CTC-TL-MONO-01 | Monotonicity satisfied (rec.C ≤ min cause.C) |
| CTC-TL-ELIG-01 | Finding eligibility allows PROVISIONAL |
| CTC-TL-ELIG-02 | Cause eligibility blocks PROVISIONAL from report |
| CTC-TL-ELIG-03 | Recommendation PROVISIONAL → CONDITIONAL status |
| CTC-TL-ELIG-04 | INSUFFICIENT routed to Audit Report only |
| CTC-TL-SEAL-01 | Sealed channel hash verified at S7 entry |

## 8.2 Trust Layer Seeded-Fault Cases

| Case ID | Seeded Fault | Expected Detection |
|---|---|---|
| CTC-TL-FAULT-01 | FABRICATED_CONFIDENCE (S7 overrides S5 band) | V2 FAIL |
| CTC-TL-FAULT-02 | SMOOTHED_CONFIDENCE (S7 rounds 0.79 → HIGH) | V2 FAIL |
| CTC-TL-FAULT-03 | MONOTONICITY_VIOLATION (rec.C > min cause.C) | V2 FAIL |
| CTC-TL-FAULT-04 | SEALED_CHANNEL_VIOLATION (envelope hash mismatch) | V2 FAIL + RI-009 HARD_FAIL |

**Total Trust Layer coverage: 15 cases minimum.**

---

# PART IX — NOISE FLOOR COVERAGE

For each monitoring verdict enum, multi-case coverage.

## 9.1 Per-Verdict Coverage

| Verdict | Sub-threshold | At-threshold | Near-threshold (just above) | Above-threshold |
|---|---|---|---|---|
| STABLE | CTC-NF-STAB-SUB-01 | CTC-NF-STAB-AT-01 | N/A | N/A |
| IMPROVEMENT | N/A | CTC-NF-IMP-AT-01 | CTC-NF-IMP-NEAR-01 | CTC-NF-IMP-ABOVE-01 |
| PROGRESSION | N/A | CTC-NF-PROG-AT-01 | CTC-NF-PROG-NEAR-01 | CTC-NF-PROG-ABOVE-01 |
| MIXED | N/A | N/A | CTC-NF-MIX-NEAR-01 | CTC-NF-MIX-ABOVE-01 |
| LOSS_OF_RESPONSE | N/A | CTC-NF-LOR-AT-01 | CTC-NF-LOR-NEAR-01 | CTC-NF-LOR-ABOVE-01 |
| ESCALATION | N/A | N/A | CTC-NF-ESC-NEAR-01 | CTC-NF-ESC-ABOVE-01 |

## 9.2 Noise Laundering Cases (Seeded Faults)

| Case ID | Seeded Fault |
|---|---|
| CTC-NF-LAUND-01 | Sub-threshold positive delta rendered as IMPROVEMENT |
| CTC-NF-LAUND-02 | Sub-threshold negative delta rendered as PROGRESSION |
| CTC-NF-LAUND-03 | Mixed deltas rendered as IMPROVEMENT (collapse violation) |
| CTC-NF-LAUND-04 | Noise band not rendered in chart payload |
| CTC-NF-LAUND-05 | S7 narrative contradicts S5 verdict enum |

**Total noise floor coverage: 20+ cases minimum.**

---

# PART X — EXPLANATION ENGINE COVERAGE

## 10.1 Per-Output-Type 5-Axis Coverage

For each output type (Finding, Cause, Recommendation, Monitoring Verdict), one case per axis verifying correct binding plus an aggregate case verifying all five.

| Output Type | Why | WhyNot | Evidence | Confidence | Change Triggers | All-Five Aggregate |
|---|---|---|---|---|---|---|
| Finding | CTC-EXP-FIND-WHY-01 | CTC-EXP-FIND-WN-01 | CTC-EXP-FIND-EV-01 | CTC-EXP-FIND-CF-01 | CTC-EXP-FIND-CT-01 | CTC-EXP-FIND-ALL-01 |
| Cause | CTC-EXP-CAUSE-WHY-01 | CTC-EXP-CAUSE-WN-01 | CTC-EXP-CAUSE-EV-01 | CTC-EXP-CAUSE-CF-01 | CTC-EXP-CAUSE-CT-01 | CTC-EXP-CAUSE-ALL-01 |
| Recommendation | CTC-EXP-REC-WHY-01 | CTC-EXP-REC-WN-01 | CTC-EXP-REC-EV-01 | CTC-EXP-REC-CF-01 | CTC-EXP-REC-CT-01 | CTC-EXP-REC-ALL-01 |
| Monitoring Verdict | CTC-EXP-MON-WHY-01 | CTC-EXP-MON-WN-01 | CTC-EXP-MON-EV-01 | CTC-EXP-MON-CF-01 | CTC-EXP-MON-CT-01 | CTC-EXP-MON-ALL-01 |

## 10.2 Seeded Fault Cases

| Case ID | Seeded Fault | Expected Failure Mode |
|---|---|---|
| CTC-EXP-FAULT-01 | MISSING_WHY (Finding) | V5 FAIL |
| CTC-EXP-FAULT-02 | MISSING_WHY_NOT (Cause) | V5 FAIL |
| CTC-EXP-FAULT-03 | MISSING_EVIDENCE (Recommendation) | V5 FAIL |
| CTC-EXP-FAULT-04 | MISSING_CONFIDENCE_SOURCE (any) | V5 FAIL |
| CTC-EXP-FAULT-05 | MISSING_CHANGE_TRIGGERS (Monitoring Verdict) | V5 FAIL |
| CTC-EXP-FAULT-06 | Free-text narrative authored outside template | V5 FAIL (lexicon violation) |

**Total Explanation Engine coverage: 24 + 6 = 30 cases minimum.**

---

# PART XI — REPORT SYSTEM COVERAGE

## 11.1 Functional Cases

| Case ID | Validates |
|---|---|
| CTC-REP-PV-01 | Patient view section sequence (per Report Spec §3.1) |
| CTC-REP-PV-02 | Patient view omits doctor-only fields |
| CTC-REP-PV-03 | Patient view dissent flag rendered as patient-safe wording |
| CTC-REP-DV-01 | Doctor view contains all doctor expansions |
| CTC-REP-DV-02 | Doctor view + patient view share identical canonical payload on shared fields (hash equality) |
| CTC-REP-SRC-01 | Each section bound to its declared sole source |
| CTC-REP-OWN-01 | Section owners match Report Spec §3.3 mapping |
| CTC-REP-CONF-01 | Confidence rendered via pointer to TrustEnvelope, not copied value |
| CTC-REP-NB-01 | Noise band rendered in monitoring chart payload |
| CTC-REP-TREND-01 | Trend verbiage matches S5 enum exactly |
| CTC-REP-DIS-01 | Dissent flag rendered in patient layer (as flag) and doctor layer (full detail) |
| CTC-REP-AUDIT-01 | Audit Footer contains complete version manifest and content hash |
| CTC-REP-RECON-01 | Replay regeneration yields identical content hash |

## 11.2 Seeded Fault Cases

| Case ID | Seeded Fault | Expected Detection |
|---|---|---|
| CTC-REP-FAULT-01 | MISBOUND_REPORT_SECTION (Findings sourced from RDE) | V1 FAIL |
| CTC-REP-FAULT-02 | CONFIDENCE_OVERRIDE at report layer | V2 FAIL |
| CTC-REP-FAULT-03 | TREND_OVERRIDE (S7 emits IMPROVEMENT against S5 STABLE) | V4 FAIL |
| CTC-REP-FAULT-04 | DISSENT_SUPPRESSION (dissent flag stripped at S7) | V1 FAIL (provenance break) + RI-019 HARD_FAIL |
| CTC-REP-FAULT-05 | Unvalidated image embedded in clinical evidence section | V1 FAIL |
| CTC-REP-FAULT-06 | Patient view contains marketing language | V5 lexicon FAIL |

**Total Report System coverage: 19 cases minimum.**

---

# PART XII — VALIDATOR COVERAGE MATRIX

For each validator: PASS, single-failure, multi-failure, primary-failure, cascading-failure.

| Validator | PASS | Single FAIL | Multi FAIL (with V_X) | Primary FAIL | Cascading FAIL |
|---|---|---|---|---|---|
| V1 Traceability | CTC-V1-PASS-01 | CTC-V1-FAIL-01 | CTC-V1+V5-FAIL-01 | CTC-V1-PRIM-01 | CTC-V1-CASC-01 |
| V2 Confidence Integrity | CTC-V2-PASS-01 | CTC-V2-FAIL-01 | CTC-V2+V5-FAIL-01 | CTC-V2-PRIM-01 | CTC-V2-CASC-01 |
| V3 Causal Consistency | CTC-V3-PASS-01 | CTC-V3-FAIL-01 | CTC-V3+V1-FAIL-01 | CTC-V3-PRIM-01 | CTC-V3-CASC-01 |
| V4 Noise Floor | CTC-V4-PASS-01 | CTC-V4-FAIL-01 | CTC-V4+V5-FAIL-01 | CTC-V4-PRIM-01 | CTC-V4-CASC-01 |
| V5 Explanation Completeness | CTC-V5-PASS-01 | CTC-V5-FAIL-01 | CTC-V5+V1-FAIL-01 | CTC-V5-PRIM-01 | CTC-V5-CASC-01 |

**Multi-failure expanded cases** (combinations beyond pairs): at minimum, all C(5,3) = 10 three-failure combinations exercised once each.

**Total validator coverage: 5 × 5 + 10 = 35 cases minimum.**

---

# PART XIII — SEEDED FAULT LIBRARY

Every constitutional rule must be exercised by at least one seeded-fault case proving its enforcement.

## 13.1 Rule → Fault → Test Case Mapping

| Constitution Source | Rule | Fault Code | Test Case |
|---|---|---|---|
| Signal Registry §activation | "Signal activates iff condition true" | INVENTED_SIGNAL | CTC-SR-FAULT-INV-01 |
| Signal Registry §EXCLUDES | "Mutually-exclusive signals resolve by confidence" | EXCLUDE_VIOLATION | CTC-SR-FAULT-EXC-01 |
| Signal Registry §quality | "qualityScore < 0.60 suppresses image signal" | QUALITY_BYPASS | CTC-SR-FAULT-QB-01 |
| Pathway §thresholds | "Pathway < 0.50 not activated" | PATHWAY_OVERACTIVATION | CTC-PW-FAULT-OA-01 |
| Pathway §adjacency | "Pathway uses only declared adjacency signals" | ADJACENCY_LEAK | CTC-PW-FAULT-AL-01 |
| RCE §eligibility | "All req_pathways activated for eligibility" | INELIGIBLE_ACCEPTANCE | CTC-RCE-FAULT-IE-01 |
| RCE §exclusions | "Exclusion signal blocks acceptance" | EXCLUSION_BYPASS | CTC-RCE-FAULT-EB-01 |
| RCE §composite | "Composite-ineligible cause may not co-accept" | COMPOSITE_VIOLATION | CTC-RCE-FAULT-CV-01 |
| RCE §dissent | "Margin < 0.05 → dissent flag" | DISSENT_SUPPRESSION | CTC-RCE-FAULT-DS-01 |
| RCE §acceptance | "Posterior < 0.30 → INSUFFICIENT_EVIDENCE" | FORCED_ACCEPTANCE | CTC-RCE-FAULT-FA-01 |
| RDE §preconditions | "Non-empty causeRefs required" | ORPHAN_RECOMMENDATION | CTC-RDE-FAULT-OR-01 |
| RDE §objective | "Objective bound" | MISSING_OBJECTIVE | CTC-RDE-FAULT-MO-01 |
| RDE §capability | "capabilityRef bound" | MISSING_CAPABILITY | CTC-RDE-FAULT-MC-01 |
| RDE §contraindication | "Hard contraindication → WITHHELD" | CONTRA_BYPASS | CTC-RDE-FAULT-CB-01 |
| RDE §whyNot | "whyNotSet populated when alternatives exist" | MISSING_WHYNOT | CTC-RDE-FAULT-MW-01 |
| Trust Layer §ownership | "Confidence only from S5" | FABRICATED_CONFIDENCE | CTC-TL-FAULT-01 |
| Trust Layer §banding | "Bands at fixed thresholds" | SMOOTHED_CONFIDENCE | CTC-TL-FAULT-02 |
| Trust Layer §monotonicity | "rec.C ≤ min cause.C" | MONOTONICITY_VIOLATION | CTC-TL-FAULT-03 |
| Trust Layer §sealed | "S7 banding hash == S5 banding hash" | SEALED_CHANNEL_VIOLATION | CTC-TL-FAULT-04 |
| Noise Floor §verdict | "Sub-threshold → STABLE only" | FABRICATED_IMPROVEMENT | CTC-NF-LAUND-01 |
| Noise Floor §verdict | "Sub-threshold → STABLE only" | FABRICATED_PROGRESSION | CTC-NF-LAUND-02 |
| Noise Floor §mixed | "Mixed deltas not collapsed" | MIXED_COLLAPSE | CTC-NF-LAUND-03 |
| Noise Floor §rendering | "Noise band rendered" | NOISE_BAND_NOT_RENDERED | CTC-NF-LAUND-04 |
| Noise Floor §authority | "S5 owns trend verdict" | TREND_OVERRIDE | CTC-REP-FAULT-03 |
| Explanation §axes | "All 5 axes bound" | MISSING_WHY | CTC-EXP-FAULT-01 |
| Explanation §axes | — | MISSING_WHY_NOT | CTC-EXP-FAULT-02 |
| Explanation §axes | — | MISSING_EVIDENCE | CTC-EXP-FAULT-03 |
| Explanation §axes | — | MISSING_CONFIDENCE_SOURCE | CTC-EXP-FAULT-04 |
| Explanation §axes | — | MISSING_CHANGE_TRIGGERS | CTC-EXP-FAULT-05 |
| Explanation §mode | "Template projection only" | FREE_TEXT_GENERATION | CTC-EXP-FAULT-06 |
| Report §sequence | "Mandatory section order" | SECTION_REORDER | CTC-REP-FAULT-SEQ-01 |
| Report §source-binding | "Section sole-source binding" | MISBOUND_REPORT_SECTION | CTC-REP-FAULT-01 |
| Report §confidence | "Render only; never author" | CONFIDENCE_OVERRIDE | CTC-REP-FAULT-02 |
| Report §dissent | "Dissent rendered in both layers" | DISSENT_SUPPRESSION | CTC-REP-FAULT-04 |
| Report §images | "Validated images only" | UNVALIDATED_IMAGE | CTC-REP-FAULT-05 |
| Report §language | "No marketing language" | MARKETING_LEAK | CTC-REP-FAULT-06 |
| REES RI-001 | "Stage order S1→S7" | STAGE_REORDER | CTC-REES-FAULT-RI001-01 |
| REES RI-002 | "No stage re-entry" | STAGE_REENTRY | CTC-REES-FAULT-RI002-01 |
| REES RI-003 | "No stage skipped" | STAGE_SKIP | CTC-REES-FAULT-RI003-01 |
| REES RI-006 | "No downstream mutation" | UPSTREAM_MUTATION | CTC-REES-FAULT-RI006-01 |
| REES RI-018 | "Version manifest pinned" | VERSION_MISMATCH | CTC-REES-FAULT-RI018-01 |
| REES RI-019 | "Dissent flag immutable" | DISSENT_MUTATION | CTC-REES-FAULT-RI019-01 |

**Total seeded fault library: 42+ rule→fault mappings, minimum 50 seeded-fault cases (Class L floor).**

**Coverage Invariant:** Adding any new constitutional rule MUST simultaneously add at least one row to this matrix. A constitutional rule without a seeded-fault case is, for QA purposes, untested and BLOCKS release.

---

# PART XIV — CORPUS SCALE REQUIREMENTS

## 14.1 Minimum Scale (CTC v1)

| Source | Minimum Cases |
|---|---|
| Part II — Taxonomy (10 causes × 7 classes) | 70 |
| Part III — Class Floors (A–L, after de-duplication with Part II) | 290 |
| Part IV — Signal Coverage (27 × 4) | 108 |
| Part V — Pathway Coverage (10 × 3) | 30 |
| Part VI — RCE Coverage | 70 |
| Part VII — RDE Coverage | 89 |
| Part VIII — Trust Layer Coverage | 15 |
| Part IX — Noise Floor Coverage | 20 |
| Part X — Explanation Coverage | 30 |
| Part XI — Report Coverage | 19 |
| Part XII — Validator Coverage | 35 |
| Part XIII — Seeded Faults (de-duplicated with other parts) | +30 unique |
| **Total minimum CTC v1 corpus** | **≥500 cases** |

## 14.2 Long-Term Target (CTC v1.x)

- 1000+ cases by CTC v1.5.
- 2000+ cases by CTC v2 (with image-pipeline cases per Part XVII).

## 14.3 Coverage Percentages

| Coverage Dimension | Target |
|---|---|
| Signal Registry rule coverage | 100% |
| Pathway Model rule coverage | 100% |
| Cause Model rule coverage | 100% |
| RDE cause→capability rule coverage | 100% |
| Trust Layer rule coverage | 100% |
| Noise Floor verdict enum coverage | 100% |
| Explanation Engine axis coverage | 100% |
| Report Spec section binding coverage | 100% |
| REES Runtime Invariant (RI-001..RI-020) coverage | 100% |
| Seeded-fault → constitutional rule coverage | 100% |

**100% is the only acceptable target.** Sub-100% on any line is a release blocker.

## 14.4 Coverage Guarantees

CTC guarantees, by construction, that:

- Every signal has activation, non-activation, threshold, and exclusion cases.
- Every pathway has activation, suppression, indeterminate cases.
- Every cause has all six structural cases plus seven presentation classes.
- Every constitutional rule has a seeded fault.
- Every validator has PASS, single-FAIL, multi-FAIL, primary, and cascading cases.

## 14.5 Gap-Detection Strategy

A **Coverage Linter** (specification only — see Part XVI) runs at every CTC update and:

1. Parses every constitutional document for declared rules (tagged constructs).
2. Cross-references against the Rule→Fault matrix.
3. Emits a GAP report listing any constitutional rule lacking ≥1 positive case and ≥1 seeded-fault case.
4. Blocks CTC version bump until GAP report is empty.

---

# PART XV — REGRESSION EXECUTION PROTOCOL

## 15.1 Release Candidate Process

Trigger: any change to a constitutional document, registry, engine, or REES component.

Steps:

1. **Build** the release candidate (RC) with pinned version manifest.
2. **Execute** the full CTC against the RC under CEH.
3. **Collect** Validation Matrix and System Integrity Score for every case.
4. **Compare** against the previous accepted baseline.
5. **Compute** regression delta: any case whose outcome changed from PASS→FAIL, BLOCK→ISSUE, or whose System Integrity Score changed by ≥10.
6. **Decision:** zero regressions AND zero new BLOCKs on previously ISSUE-eligible cases → eligible for promotion. Any regression → BLOCK.

## 15.2 Nightly Regression

- Full CTC run scheduled per 24h cycle on the current main branch.
- Failure of any case = immediate notification to engineering lead + clinical QA lead.
- Three consecutive nightly failures of the same case = automatic release-branch freeze.

## 15.3 Pre-Deployment Certification

Before any environment promotion (dev → staging → pilot → production):

- 100% CTC PASS required.
- All seeded-fault cases must be detected at full strength (no missed faults).
- Replay verification must succeed for every case.
- Coverage Linter (Part XIV.5) must return zero gaps.
- Sign-off required from: Clinical Systems Architect + Medical AI Verification Architect + Clinical QA Governance Lead.

## 15.4 Failure Escalation Rules

| Failure Class | Action |
|---|---|
| V1/V2/V3 FAIL on a previously PASS case | Engineering review within 24h; release branch frozen |
| V4 FAIL on a previously PASS case | Engineering review within 24h; release branch frozen |
| V5 FAIL on a previously PASS case | Engineering review within 48h |
| New BLOCK on a previously ISSUE-eligible case | Engineering + Clinical review within 24h |
| Seeded fault not detected by harness | CRITICAL: clinical QA review immediately; production freeze considered |
| Replay divergence on any emitted case | CRITICAL: revocation review of affected reports; production freeze |

## 15.5 Block-Issuance Rules

A release is blocked from any pre-production promotion if:

- Any CTC regression is open.
- Any seeded fault is undetected.
- Coverage Linter returns ≥1 gap.
- Replay verification fails on any case.

## 15.6 Engineering Review Rules

- All BLOCKing failures get a written root-cause analysis before remediation.
- Remediations that touch a constitutional document require CTC update simultaneously.
- Remediations that change a numeric threshold trigger automatic boundary-case regeneration.

## 15.7 Clinical Review Rules

- Any change that alters acceptance/rejection on a real-patient-analogous case requires clinical review.
- Any change that alters confidence banding on ≥5% of CTC requires clinical review.
- Any change that alters monitoring verdict enum on ≥1 case requires clinical review.
- Clinical review may reject a technically-passing release on clinical-safety grounds. This authority is non-overridable by engineering.

---

# PART XVI — CONSTITUTIONAL COVERAGE MATRIX

Master mapping. Every constitutional rule MUST appear in the left column; the right column lists all CTC case IDs covering it (positive + seeded-fault).

Format:

```
[Document §Section §Rule] → [Positive Cases] + [Seeded-Fault Cases]
```

## 16.1 Coverage Matrix (Abridged)

| Constitution Rule (Source §Anchor) | Positive Cases | Seeded-Fault Cases |
|---|---|---|
| Signal Registry §activation | CTC-SIG-*-ACT-* (27 cases) | CTC-SR-FAULT-INV-01 |
| Signal Registry §EXCLUDES | CTC-SIG-*-EXC-* (27 cases) | CTC-SR-FAULT-EXC-01 |
| Signal Registry §qualityScore | CTC-SIG-FRONT-THR-01 + 26 sibs | CTC-SR-FAULT-QB-01 |
| Pathway §thresholds | CTC-PATH-*-ACT-* / *-SUP-* / *-IND-* (30 cases) | CTC-PW-FAULT-OA-01 |
| Pathway §adjacency | All Pathway cases (30) | CTC-PW-FAULT-AL-01 |
| RCE §eligibility | CTC-RCE-*-ELIG-* (10) | CTC-RCE-FAULT-IE-01 |
| RCE §exclusions | CTC-RCE-*-REJ-* (10) | CTC-RCE-FAULT-EB-01 |
| RCE §acceptance threshold (0.30) | CTC-RCE-EDGE-ACC-01, CTC-RCE-EDGE-REJ-01 | CTC-RCE-FAULT-FA-01 |
| RCE §composite (margin ≤0.40, posterior ≥0.20) | CTC-RCE-EDGE-COMP-01/02 + 7 COMP cases | CTC-RCE-FAULT-CV-01 |
| RCE §dissent (margin <0.05) | CTC-RCE-EDGE-DIS-01/02 + 10 DIS cases | CTC-RCE-FAULT-DS-01 |
| RDE §preconditions (causeRefs, objective, capabilityRef) | All RDE proper-emission cases | CTC-RDE-FAULT-OR-01, MO-01, MC-01 |
| RDE §whyNot | All RDE WhyNot cases | CTC-RDE-FAULT-MW-01 |
| RDE §contraindication | All RDE contraindication cases | CTC-RDE-FAULT-CB-01 |
| Trust Layer §confidence formula | CTC-TL-CALC-01/02 | CTC-TL-FAULT-01/02 |
| Trust Layer §banding | CTC-TL-BAND-01/02/03 | CTC-TL-FAULT-02 |
| Trust Layer §monotonicity | CTC-TL-MONO-01 | CTC-TL-FAULT-03 |
| Trust Layer §sealed channel | CTC-TL-SEAL-01 | CTC-TL-FAULT-04 |
| Noise Floor §verdicts | All Part IX cases | CTC-NF-LAUND-01/02/03/04 |
| Noise Floor §authority (S5 owns verdict) | All Part IX cases | CTC-REP-FAULT-03 |
| Explanation §5-axes | All Part X functional cases | CTC-EXP-FAULT-01/02/03/04/05 |
| Explanation §template-only | All Part X functional cases | CTC-EXP-FAULT-06 |
| Report §section sequence | CTC-REP-PV-01, DV-01 | CTC-REP-FAULT-SEQ-01 |
| Report §sole-source binding | CTC-REP-SRC-01, OWN-01 | CTC-REP-FAULT-01 |
| Report §confidence rendering | CTC-REP-CONF-01 | CTC-REP-FAULT-02 |
| Report §dissent rendering | CTC-REP-DIS-01 | CTC-REP-FAULT-04 |
| Report §image validation | (image cases per Part XVII v2) | CTC-REP-FAULT-05 |
| Report §no marketing | All PV/DV cases | CTC-REP-FAULT-06 |
| Report §Audit Footer | CTC-REP-AUDIT-01 | (RI-018 fault case) |
| Report §reconstructability | CTC-REP-RECON-01 | (Replay divergence escalation, §15.4) |
| REES RI-001..RI-020 | Distributed across all CTC | CTC-REES-FAULT-RI001/002/003/006/018/019-01 |

## 16.2 Coverage Invariant

**No constitutional rule may remain uncovered.** Coverage Linter (Part XIV.5) computes the left column from constitutional documents; any rule absent from the right column blocks release.

---

# PART XVII — FUTURE EXPANSION

## 17.1 CTC v2 — Severity-Graded Image Pipeline

**Trigger:** Closure of REES gap G-01 (quantitative image severity).

**Adds:**
- Image Pipeline Validation cases: quantitative density, miniaturization ratio, hair-shaft caliber.
- Severity-tier transition boundary cases (Minimal / Mild / Moderate / Marked / Severe).
- Image quality-band cases beyond the binary suppression threshold.

**Does not add:** new causes, new pathways, new recommendations.

## 17.2 Quantitative Trichoscopy Validation

**Adds:**
- Cases anchored to quantitative trichoscopic measurements (hair density per cm², anagen:telogen ratio, vellus:terminal ratio).
- Cross-modality consistency cases (intake vs trichoscopy disagreement).

## 17.3 Biomarker Validation

**Adds:**
- Cases incorporating laboratory biomarkers (ferritin, vitamin D, TSH, androgen panel) as first-class signals, **only once those signals enter the Signal Registry by constitutional amendment**.
- Conflict cases: biomarker contradicts intake / imaging.

## 17.4 Longitudinal Outcome Validation

**Adds:**
- Multi-cycle cases (≥3 reassessments) verifying trajectory persistence rules.
- Loss-of-response and re-induction cases.
- Long-horizon stability cases (≥12 months).

## 17.5 Multi-Encounter Validation

**Adds:**
- Cases spanning multiple encounter types (initial assessment, follow-up, reassessment, escalation).
- Encounter-to-encounter version-compatibility cases (paired with REES v3 versionCompatibilityMatrix).

## 17.6 CTC v3 (Provisional)

Reserved for closure of REES gaps G-02 through H-04. No cases declared until those gaps are constitutionally closed.

---

# CLOSING STATEMENT

CTC v1 is the release-gating test universe of HairOS. It is the artifact that converts the constitutional ecosystem from *internally consistent specification* into *demonstrably compliant system*. A release that has not cleared CTC has not been verified. A constitutional change that does not update CTC has not been made.

The corpus is exhaustive by construction, regulatory-grade by intent, and permanent by mandate. Every rule covered. Every fault detected. Every regression caught. No exceptions.

**End of Specification.**
