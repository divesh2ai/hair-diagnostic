# HairOS Follicular Biology Intelligence

**Canonical knowledge document. Source-of-truth for the mechanism-translation layer.**
**Authoring date: 2026-06-05.**
**Status: v1.0 — content authored for normalization into `src/packages/registries/mechanisms/registry.json`.**

This document is the scientific spine that makes HairOS a Follicular Biology Intelligence System rather than a recommender. It is structured so each fact is downstream-renderable: every Trigger → Molecular → Cellular → Tissue → Cycle → Clinical chain is named with the molecules, cell types, and tissue ontologies the explanation layer must be able to verbalize.

It pairs with:
- `src/packages/registries/signals/registry.json` (Clinical Manifestations — layer F)
- `src/packages/registries/pathways/registry.json` (Tissue + Cycle — layers D, E)
- `src/packages/registries/causes/registry.json` (Cause hypotheses — explanatory layer)
- `src/packages/ai-engine/knowledge-engine/kb/ingredients/*` (Intervention Atlas)

---

## 0. Operating Model

### 0.1 The Six-Layer Causal Chain

Every hair-loss explanation in HairOS must traverse exactly six layers:

```
[A] Systemic Trigger      ── what the body or environment is doing
        │
        ▼
[B] Molecular Signaling   ── which ligands, receptors, cytokines, and second messengers shift
        │
        ▼
[C] Cellular Dysfunction  ── which follicular cell populations stop doing their job
        │
        ▼
[D] Tissue Changes        ── what happens to the follicle unit, perifollicular space, and scalp
        │
        ▼
[E] Hair-Cycle Changes    ── how anagen, catagen, telogen, and exogen shift
        │
        ▼
[F] Clinical Manifestation ── what the patient and doctor actually see
```

A chain is **constitutional** only if every layer is named and the arrows between layers are mechanistically justified by published evidence. A chain that skips a layer is editorial; a chain that names all six is biology.

### 0.2 Evidence Tiers

- **Established** — multiple human RCTs or mechanistic confirmation in human follicle organ culture.
- **Strong** — consistent human observational data with ex-vivo or animal model corroboration.
- **Moderate** — animal model dominance with limited human confirmation.
- **Emerging** — recent mechanistic work, not yet replicated.

Every claim in this document carries an implicit tier; explicit tier annotations are reserved for claims that are weaker than Established.

### 0.3 The Hair Follicle Cell Cast

Naming the cells is non-negotiable. HairOS must be able to talk about:

- **Dermal Papilla Cells (DPC)** — mesenchymal signaling hub that instructs the matrix; the master regulator of anagen duration. Androgen Receptor (AR)-rich in scalp.
- **Matrix Keratinocytes** — the proliferative engine; produce the hair shaft.
- **Outer Root Sheath (ORS)** keratinocytes — bulge and infundibulum lineage.
- **Hair Follicle Stem Cells (HFSC)** — bulge-resident; LGR5+/K15+; cycle the follicle.
- **Melanocyte Stem Cells (McSC)** — bulge-resident; donate pigmenting melanocytes each anagen.
- **Dermal Sheath Cup (DSC)** — perifollicular mesenchyme; replenishes DPC.
- **Sebocytes** — sebaceous gland cells; lipid producers.
- **Perifollicular Fibroblasts** — connective-tissue sheath; become activated under chronic inflammation.
- **Mast Cells, Macrophages, Langerhans Cells, T-cells** — resident and infiltrating immune populations.
- **Endothelial Cells** of the perifollicular capillary plexus.

### 0.4 The Hair Cycle in HairOS Vocabulary

- **Anagen** — active growth, 2–7 years scalp, ~85% of follicles at any time.
- **Catagen** — programmed regression, ~2–3 weeks.
- **Telogen** — quiescence, ~2–3 months, ~10–15% of follicles.
- **Exogen** — shaft release.
- **Kenogen** — empty follicle between exogen and next anagen; pathologically prolonged in AGA.

---

## 1. Domain 1 — Androgen Biology

### A. Upstream Triggers
- Genetic AR sensitivity (CAG-repeat polymorphism in AR exon 1; chromosome 20p11 locus).
- Elevated 5α-reductase Type II activity in occipital-sparing scalp regions.
- Hyperandrogenic states: PCOS, congenital adrenal hyperplasia, anabolic steroid use, exogenous testosterone.
- Insulin resistance (cross-talks with adrenal androgen production).
- Aging: relative androgen-to-estrogen ratio shift in females (peri/post-menopause).

### B. Molecular Signaling
- **Testosterone → 5α-reductase Type II → Dihydrotestosterone (DHT)**. Local conversion in dermal papilla and outer root sheath.
- **DHT binds Androgen Receptor (AR)** in DPC. Co-activator recruitment is the rate-limiting step in androgen-sensitive scalp.
- **AR-mediated transcriptional shift:**
  - ↑ **DKK-1** (Dickkopf-1) — Wnt antagonist secreted by DPC.
  - ↑ **TGF-β1 and TGF-β2** — pro-catagen, pro-apoptotic in matrix keratinocytes.
  - ↑ **IL-6** — paracrine to matrix and stem cell niche.
  - ↓ **IGF-1** — anagen-maintaining growth factor.
  - ↓ **VEGF** — perifollicular angiogenesis support.
  - ↓ **Wnt10b / β-catenin signaling** in matrix.
- **Prostaglandin shift:** ↑ PGD2 (via lipocalin-PTGDS) — binds GPR44 on follicular epithelium, inhibits anagen.

### C. Cellular Consequences
- DPC volume reduction (lower DPC count per follicle is the cardinal cellular signature of AGA).
- Matrix keratinocyte hypoproliferation and premature apoptosis (TGF-β-driven).
- HFSC retain stemness but lose progenitor activation — the bulge is occupied, the matrix is starved.
- Melanocyte stem cell depletion is accelerated, producing earlier graying of miniaturizing follicles.
- Perifollicular fibroblast activation begins.

### D. Tissue Effects
- **Follicular miniaturization** — terminal-to-intermediate-to-vellus conversion.
- Reduction in perifollicular capillary density.
- Perifollicular lymphocytic micro-inflammation (subclinical, ~40% of AGA biopsies).
- Sebaceous gland relative hypertrophy (constant gland size, smaller follicle).
- Late-stage perifollicular fibrosis (entrenched AGA).

### E. Hair Cycle Effects
- **Anagen shortening** is the dominant cycle perturbation — from ~3–5 years to ~months.
- Telogen-fraction increases as anagen shortens.
- Kenogen lengthens — empty follicles between cycles.
- Eventually anagen fails to re-initiate (terminal follicle drop-out).

### F. Clinical Manifestations
- Norwood-Hamilton pattern in males (bitemporal recession, vertex thinning).
- Ludwig pattern in females (mid-frontal widening with preserved frontal hairline).
- Trichoscopy: hair diameter diversity ≥20%, peripilar brown halo, yellow dots, single-hair follicular units replacing 2–3 hair units.

---

## 2. Domain 2 — Inflammation Biology

### A. Upstream Triggers
- Malassezia overgrowth (seborrheic dermatitis spectrum).
- Sebum oxidation products (squalene peroxides).
- Barrier compromise (over-washing, harsh surfactants, retinoid irritation).
- Folliculitis (S. aureus, gram-negative).
- Chronic perifollicular antigen presentation in AGA scalps.
- Pollution-derived PAHs activating AhR.

### B. Molecular Signaling
- **PAMP/DAMP recognition** by TLR2 (Malassezia), TLR4 (LPS), NLRP3 inflammasome activation.
- **Cytokine cascade:** IL-1α/β, IL-6, IL-8, IL-17, TNF-α, IFN-γ.
- **Chemokines:** CCL2 (monocyte recruitment), CXCL8 (neutrophil), CXCL10 (T-cell).
- **NF-κB and STAT3** transcriptional programs dominate.
- **Eicosanoid shift:** ↑ PGE2, PGD2; arachidonic acid cascade.
- **Tissue MMP-1, MMP-9** induction (matrix remodeling).
- **Dermal papilla becomes a cytokine sink** — IL-1β directly suppresses hair shaft elongation in organ culture.

### C. Cellular Consequences
- Keratinocyte hyperproliferation in infundibulum.
- Langerhans cell activation and migration.
- T-cell (CD4+/CD8+) perifollicular infiltrate.
- Mast cell degranulation in perifollicular sheath.
- DPC functional suppression by IL-1β and IL-6.
- Sebocyte hyperplasia under inflammatory drive.

### D. Tissue Effects
- Perifollicular micro-inflammation visible on biopsy as lymphocytic cuffs around the upper follicle.
- Erythema, scaling, pustulation at scalp surface.
- Vascular dilation (acute) → vascular pruning (chronic).
- Long-term: perifollicular fibrosis (Domain 11).

### E. Hair Cycle Effects
- Premature catagen entry (IL-1β, TNF-α are catagen inducers).
- Reduced anagen re-entry probability (chronic inflammation suppresses HFSC activation).
- Mild diffuse telogen shift.

### F. Clinical Manifestations
- Pruritus, burning, tenderness.
- Visible erythema, flaking, greasy scale, pustules.
- Diffuse shedding accompanying scalp symptoms.
- Co-acceleration of AGA in genetically susceptible patients.

---

## 3. Domain 3 — Oxidative Stress Biology

### A. Upstream Triggers
- UV exposure.
- Pollution (particulate matter, ozone).
- Smoking (the single largest modifiable oxidative driver in scalp).
- Sleep deprivation and circadian disruption.
- Psychological stress (sympathetic adrenergic surge).
- Hyperglycemia (advanced glycation end products).
- Iron overload (Fenton reaction).
- Aging mitochondria.

### B. Molecular Signaling
- **ROS species:** superoxide (O2•−), hydrogen peroxide (H2O2), hydroxyl radical (•OH), peroxynitrite (ONOO−).
- **Antioxidant defenses depleted:** glutathione, SOD1/2/3, catalase, peroxiredoxins.
- **Nrf2/Keap1 pathway** activation attempts to restore redox homeostasis.
- **Lipid peroxidation products:** 4-HNE, MDA — protein adduct formation.
- **AGE/RAGE axis** — glycation-driven oxidative cascade.
- **NF-κB co-activation** — oxidative stress and inflammation are bidirectional amplifiers.
- **HIF-1α stabilization** in perifollicular hypoxia.

### C. Cellular Consequences
- DPC senescence (p16INK4a, p21 upregulation, SASP secretome).
- Mitochondrial dysfunction in matrix keratinocytes (Domain 13).
- DNA damage in HFSC, reducing self-renewal capacity over time.
- Melanocyte stem cell apoptosis — accelerated graying.
- Endothelial dysfunction in perifollicular capillaries.

### D. Tissue Effects
- Reduced microvascular perfusion.
- Accelerated miniaturization (synergy with Domain 1).
- Accumulated lipofuscin in long-cycling tissues.
- Photoaging dermal changes contribute to follicular drop-out.

### E. Hair Cycle Effects
- Anagen shortening through DPC senescence.
- Reduced regenerative capacity at each new cycle.
- Premature graying as a sentinel of oxidative load on the follicle.

### F. Clinical Manifestations
- Diffuse thinning with shaft caliber reduction.
- Premature graying (especially temple-frontal).
- Reduced response to standard therapies in heavy smokers.
- Coexists rather than presents alone — oxidative stress is a force-multiplier domain.

---

## 4. Domain 4 — Stem Cell Biology

### A. Upstream Triggers
- Chronic inflammation (Domain 2).
- Oxidative load (Domain 3).
- Repeated catagen cycles without proper recovery.
- Aging.
- Scarring insults (chemical, mechanical, autoimmune).
- BMP signaling lock from prolonged telogen.

### B. Molecular Signaling
- **Bulge-resident HFSC markers:** K15, CD200, LGR5, SOX9, NFATc1.
- **Quiescence maintenance:** BMP6, FGF18 from bulge niche; high NFATc1.
- **Activation signals:** Wnt7b, Wnt10b, β-catenin nuclear translocation; ↓ BMP; ↑ Shh from progenitors.
- **EDA/EDAR signaling** for primary hair germ activation.
- **JAK/STAT** axis in stem cell niche maintenance.
- **PGD2-GPR44 axis** inhibits HFSC activation (a key AGA mechanism).

### C. Cellular Consequences
- HFSC quiescence lock — stemness preserved, activation blocked. This is the AGA paradox: stem cells are present but unable to mount a new anagen.
- Progressive HFSC pool exhaustion in scarring disorders.
- Loss of McSC alongside HFSC produces simultaneous balding and graying.
- Loss of DSC stem-like population in late-stage miniaturization.

### D. Tissue Effects
- Kenogen prolongation (empty follicular ostia between cycles).
- Eventual follicle drop-out (terminal loss).
- In scarring alopecia: bulge destruction is the histological hallmark.

### E. Hair Cycle Effects
- Failed anagen re-entry.
- Telogen-to-kenogen transition.
- Lost cycles do not return without stem cell rescue.

### F. Clinical Manifestations
- Empty follicular ostia on trichoscopy.
- Sustained density loss not responsive to growth stimulants alone.
- Permanent loss in scarring disorders despite control of inflammation.

---

## 5. Domain 5 — Hair Cycle Biology

### A. Upstream Triggers
This domain is the **integration layer** — every other domain perturbs the hair cycle. Direct triggers include:
- Pyrexia, surgery, severe illness (synchronizing catagen).
- Pregnancy/postpartum estrogen flux.
- Crash dieting, GLP-1 agonist initiation.
- Thyroid disorders.
- Psychological stress.
- Medications: anticoagulants, beta-blockers, ACE inhibitors, lithium, retinoids, antithyroid drugs, chemotherapy.

### B. Molecular Signaling
- **Anagen drivers:** Wnt/β-catenin, Shh, IGF-1, KGF (FGF7), HGF, VEGF, FGF10.
- **Catagen drivers:** TGF-β1/2, BMP2/4, FGF5, IL-1α, TNF-α, NT-3, neurotrophins.
- **Telogen maintenance:** BMP6, FGF18.
- **Anagen re-entry triggers:** Wnt7b, Wnt10b, Shh, EDA, noggin.
- **CRH (corticotropin-releasing hormone)** — local skin HPA axis triggers catagen under stress.
- **Substance P** — neurogenic catagen induction.
- **Estrogen (E2) via ERβ** — prolongs anagen; postpartum withdrawal is the cardinal example of cycle synchronization.

### C. Cellular Consequences
- During catagen: matrix apoptosis, DPC condensation and ascent, ORS shortening.
- During telogen: club hair formation, DPC quiescence adjacent to bulge.
- During anagen re-entry: HFSC activation, transit-amplifying cell expansion, new DPC instruction.

### D. Tissue Effects
- Phase distribution shifts (telogen ratio is the read-out).
- Hair density preserved under normal cycling; loss begins when re-entry fails.

### E. Hair Cycle Effects (the domain itself)
- Anagen effluvium: matrix toxicity (chemotherapy) — shaft breaks at the matrix.
- Telogen effluvium: synchronized catagen induction → shedding 2–4 months later.
- Chronic telogen effluvium: persistent shortening of anagen across many cycles.
- Loose anagen syndrome: poor attachment of inner root sheath.
- Short anagen syndrome: genetically capped anagen.

### F. Clinical Manifestations
- Acute TE: diffuse shedding, positive pull test (>6 telogen hairs per ~60), white-bulb shafts.
- Chronic TE: bitemporal recession with intact density elsewhere, reduced ponytail circumference.
- Postpartum TE: 3–4 month post-delivery shedding peak.
- Anagen effluvium: rapid near-total loss with dystrophic anagen hairs.

---

## 6. Domain 6 — Scalp Barrier Biology

### A. Upstream Triggers
- Harsh surfactants (sulfates at high concentration with frequent washing).
- High-pH cleansers disrupting acid mantle.
- Mechanical trauma (over-brushing, tight hairstyles).
- Climate (low humidity, cold winds).
- Topical retinoids, alpha-hydroxy acids beyond barrier tolerance.
- Atopic predisposition (filaggrin loss-of-function).

### B. Molecular Signaling
- **Stratum corneum lipid matrix:** ceramides (especially Cer-NP, Cer-EOS), cholesterol, free fatty acids in 1:1:1 molar ratio.
- **Filaggrin → natural moisturizing factor (NMF)** — pyrrolidone carboxylic acid, urocanic acid.
- **Tight junction proteins:** claudin-1, occludin, ZO-1.
- **Antimicrobial peptides:** β-defensins, cathelicidin (LL-37), dermcidin.
- **TLR2/4 surveillance** at the barrier interface.
- **TEWL (transepidermal water loss)** is the functional read-out.

### C. Cellular Consequences
- Keratinocyte differentiation disruption.
- Langerhans cell activation under repeated antigen ingress.
- Sebocyte response to dehydration (compensatory hyperseborrhea or atrophy).

### D. Tissue Effects
- Increased TEWL.
- Microbiome dysbiosis (Malassezia, Staphylococcus shifts).
- Visible flaking, dryness, or paradoxical oiliness.
- Bridge into Domain 2 — barrier failure is a frequent inflammation trigger.

### E. Hair Cycle Effects
- Indirect: through inflammation-induced catagen.
- Direct effect on hair cycle is minor unless barrier failure is chronic and severe.

### F. Clinical Manifestations
- Dryness, tightness, sensitivity.
- Flaking without classic seborrheic features.
- Sensitive scalp syndrome (subjective burning without visible signs).
- Worsening response to active topical therapies (irritation rather than efficacy).

---

## 7. Domain 7 — Hormonal Biology

### A. Upstream Triggers
- Pregnancy and postpartum estrogen withdrawal.
- Peri- and post-menopausal estrogen decline.
- Thyroid dysfunction (hypo- and hyperthyroid).
- PCOS and hyperandrogenism (overlaps with Domain 1).
- Hyperprolactinemia.
- Cortisol dysregulation (Cushing, chronic stress, exogenous glucocorticoids).
- Hormonal contraception initiation or discontinuation (especially androgenic progestins).
- Anti-androgen withdrawal.

### B. Molecular Signaling
- **Estrogen (E2) via ERα/ERβ** — ERβ-dominant in DPC; pro-anagen, suppresses 5α-reductase.
- **Progesterone via PR** — modest anti-androgenic, anti-5α-reductase activity.
- **Thyroid hormones (T3, T4) via TRα/β** — direct anagen prolongation; T3 stimulates DPC.
- **Cortisol via GR** — catabolic, anti-proliferative, immunosuppressive; suppresses matrix proliferation at supraphysiologic exposure.
- **Prolactin via PRLR** — pro-catagen, inhibits anagen in human follicle organ culture.
- **Insulin/IGF-1 via IR/IGF-1R** — pro-anagen at physiologic levels; pro-androgenic in hyperinsulinemia.
- **Melatonin via MT1/MT2** — direct anagen-prolonging effect demonstrated on human scalp.

### C. Cellular Consequences
- Estrogen withdrawal removes a major DPC pro-anagen signal — accounts for postpartum and menopausal cycle synchronization.
- Thyroid deficit slows matrix proliferation and shifts cycle distribution.
- Prolactin excess accelerates catagen via DPC PRLR engagement.
- Cortisol excess produces matrix hypoproliferation and impaired wound/inflammation resolution.

### D. Tissue Effects
- Cycle-distribution shift dominates; structural change minimal in pure hormonal etiologies (distinguishes hormonal effluvium from AGA).
- Exception: chronic untreated hypothyroid produces a coarse, brittle shaft phenotype.

### E. Hair Cycle Effects
- Synchronized catagen → telogen effluvium pattern.
- Anagen-fraction depression (thyroid).
- In peri/post-meno: AGA-like miniaturization overlaid on TE-like shedding.

### F. Clinical Manifestations
- Postpartum diffuse shedding peaking 3–4 months post-partum.
- Mid-frontal widening in peri/post-menopausal women.
- Lateral eyebrow thinning in hypothyroid (Hertoghe sign).
- Coarse-to-fine shaft transition under thyroid normalization timeline.

---

## 8. Domain 8 — Metabolic Biology

### A. Upstream Triggers
- Insulin resistance, type 2 diabetes, metabolic syndrome.
- Visceral adiposity.
- High-glycemic dietary patterns.
- GLP-1 agonist–induced rapid weight loss (cycle perturbation more than metabolic per se).
- NAFLD/MAFLD (hepatic insulin resistance with sex-hormone binding globulin suppression).

### B. Molecular Signaling
- **Hyperinsulinemia ↓ SHBG → ↑ free testosterone/DHT bioavailability** — direct bridge into Domain 1.
- **IGF-1 axis dysregulation:** baseline pro-anagen, but pathologic insulin/IGF-1 hybrid signaling in chronic metabolic disease.
- **AGE/RAGE activation** — glycation drives Domain 3 (oxidative).
- **Adipokine shift:** ↓ adiponectin, ↑ leptin resistance, ↑ resistin.
- **Chronic low-grade inflammation:** ↑ IL-6, TNF-α, CRP — drives Domain 2.
- **Vitamin D receptor activity** is impaired in obesity (sequestration in adipose).

### C. Cellular Consequences
- DPC androgen sensitivity amplification (via insulin/IGF cross-talk).
- Endothelial dysfunction in perifollicular vasculature.
- Adipose-derived inflammatory paracrine load on scalp tissue.

### D. Tissue Effects
- Accelerated miniaturization risk.
- Reduced perifollicular vascular reserve.
- Increased baseline oxidative load.

### E. Hair Cycle Effects
- Anagen shortening (via androgen amplification and chronic inflammation).
- Telogen shift during rapid weight loss episodes.

### F. Clinical Manifestations
- Early-onset AGA in young men with metabolic syndrome.
- Female pattern with hyperandrogenic features (PCOS-spectrum).
- Diffuse shedding during the first 3–6 months of GLP-1 weight loss therapy.

---

## 9. Domain 9 — Nutritional Biology

### A. Upstream Triggers
- Iron deficiency (the single most frequent treatable cause of female chronic TE).
- Vitamin D insufficiency.
- Zinc, copper, selenium deficiency.
- B-complex insufficiency (especially B12, biotin in restricted diets).
- Vitamin A toxicity (retinoid-induced telogen).
- Protein-calorie restriction.
- Essential fatty acid deficiency.
- Bariatric surgery sequelae.
- Restrictive diets (vegan without supplementation, ketogenic with poor planning).
- Malabsorption (celiac, IBD, post-surgical).

### B. Molecular Signaling
- **Iron** — ribonucleotide reductase cofactor; rate-limiting for DNA synthesis in highly proliferative matrix keratinocytes.
- **Ferritin >40 ng/mL** is the threshold many trichologists use as the floor for hair function (vs ~12 ng/mL for systemic anemia).
- **Zinc** — cofactor for >300 enzymes; 5α-reductase modulation, matrix metalloproteinase function, keratinization.
- **Vitamin D / VDR** — DPC express VDR; ligation drives anagen re-entry. VDR-null mice phenocopy alopecia.
- **Biotin** — carboxylase cofactor; clinically meaningful only in true deficiency, not as a supplement in replete patients.
- **Vitamin A** — RAR/RXR ligation; therapeutic window narrow, excess induces telogen.
- **Selenium** — glutathione peroxidase cofactor (oxidative defense, Domain 3).
- **Omega-3 / EPA-DHA** — resolvin and protectin precursors; resolve inflammation.
- **Protein/amino acids** — cystine, methionine for keratin synthesis; lysine modulates iron uptake and 5α-reductase.

### C. Cellular Consequences
- Matrix keratinocyte proliferation impairment under iron, zinc, protein restriction.
- DPC signaling impairment under vitamin D deficiency.
- Anti-oxidative collapse under selenium deficiency.

### D. Tissue Effects
- No structural miniaturization in pure nutritional etiologies.
- Shaft caliber reduction and shaft fragility.

### E. Hair Cycle Effects
- Anagen shortening proportional to deficit severity.
- Telogen shift under acute deprivation episodes (crash dieting).
- Anagen re-entry impairment under vitamin D deficit.

### F. Clinical Manifestations
- Diffuse thinning with intact pattern.
- Reduced shaft diameter on trichoscopy.
- Brittle hair, longitudinal grooving (zinc).
- Hair loss preceded or accompanied by other deficiency signs (koilonychia, glossitis, dermatitis).
- Improvement timeline of 3–6 months after correction (cycle-bound).

---

## 10. Domain 10 — Immune Biology

### A. Upstream Triggers
- Autoimmune predisposition (HLA-DQB1\*03, HLA-DRB1\*04 in alopecia areata).
- Viral infection (CMV, EBV, SARS-CoV-2 implicated in TE and AA flares).
- Vaccination (rare AA triggers reported).
- Atopic background (eczema, asthma, allergic rhinitis).
- Thyroid autoimmunity (Hashimoto, Graves — frequent AA comorbidity).
- Vitamin D deficiency (immunomodulatory).
- Stress (sympathetic immune cross-talk).
- Drug-induced immune activation (immune checkpoint inhibitors).

### B. Molecular Signaling
- **Loss of immune privilege of the anagen hair bulb** — the seminal mechanism of alopecia areata.
- **MHC class I upregulation** on bulb keratinocytes under IFN-γ.
- **NKG2D ligands (MICA, ULBP3)** induced — recruit CD8+ NKG2D+ T-cells.
- **IFN-γ → JAK1/2 → STAT1** axis is the therapeutically actionable node (JAK inhibitors).
- **IL-15** — bulb-keratinocyte and T-cell amplification loop.
- **Th1/Th17 imbalance** — IFN-γ, TNF-α, IL-17.
- **Tregs (FOXP3+)** functionally insufficient in active AA.
- **CXCL9, CXCL10, CXCL11** — IFN-γ-induced chemokines recruit T-cells perifollicularly.

### C. Cellular Consequences
- CD8+ T-cell perifollicular swarm ("swarm of bees" on biopsy).
- Anagen bulb apoptosis.
- HFSC spared in non-scarring AA — explains regrowth potential.
- HFSC destroyed in scarring autoimmunity (LPP, FFA) — explains permanence.

### D. Tissue Effects
- Acute anagen arrest in active patch.
- Pigment incontinence (melanocytes are the target in early AA, accounting for white regrowth).
- Late: empty follicular ostia, no scarring in classic AA; scarring in cicatricial variants.

### E. Hair Cycle Effects
- Sudden catagen induction in affected follicles.
- Cycle re-entry possible once immune attack resolves (in non-scarring forms).

### F. Clinical Manifestations
- Discrete circular patches (AA patch).
- Exclamation-mark hairs at patch periphery.
- Yellow dots, black dots on trichoscopy.
- Alopecia totalis, universalis in extensive cases.
- Nail pitting in ~30% of AA.

---

## 11. Domain 11 — Fibrosis Biology

### A. Upstream Triggers
- Chronic perifollicular inflammation (Domain 2).
- Autoimmune lichenoid inflammation (lichen planopilaris, frontal fibrosing alopecia).
- Mechanical traction.
- Burns, chemical injury, post-surgical scarring.
- Late-stage entrenched AGA in genetically susceptible patients.
- Central centrifugal cicatricial alopecia drivers (genetic + styling practices).

### B. Molecular Signaling
- **TGF-β1, TGF-β2, TGF-β3** — master fibrogenic cytokines.
- **CTGF (CCN2)** — TGF-β downstream amplifier.
- **PDGF** — fibroblast mitogen.
- **IL-6, IL-13** — fibrogenic cytokines.
- **Wnt/β-catenin in fibroblasts** (distinct from follicular Wnt) — myofibroblast transition.
- **PPAR-γ deficiency** in sebocytes implicated in cicatricial alopecia pathogenesis.
- **MMP/TIMP imbalance** governs ECM turnover.
- **Type I and III collagen** deposition; loss of normal collagen IV basement membrane organization.

### C. Cellular Consequences
- Perifollicular fibroblast → myofibroblast (α-SMA+) transition.
- Sebocyte loss (an early CCCA/FFA event).
- HFSC destruction at the bulge (the pivotal step in irreversible scarring).
- Lymphocytic + plasma cell + (in some variants) neutrophilic infiltrate.

### D. Tissue Effects
- Concentric perifollicular fibrosis cuff.
- Sebaceous gland atrophy (early sign).
- Follicular plugging.
- Loss of follicular ostia (final stage).
- Smooth, shiny, atrophic patch in late disease.

### E. Hair Cycle Effects
- Cycles cease in destroyed follicles — not a cycle disorder so much as a cycle termination disorder.

### F. Clinical Manifestations
- Loss of follicular ostia (the definitive clinical sign of scarring alopecia).
- Perifollicular erythema and scale (LPP).
- Frontal hairline recession with eyebrow loss (FFA).
- Central scalp patch in CCCA.
- Symptoms: itching, burning, tenderness during active phase.

---

## 12. Domain 12 — Microvascular Biology

### A. Upstream Triggers
- Smoking (single largest modifiable driver).
- Chronic hypertension.
- Diabetes mellitus.
- Atherosclerosis.
- Sleep apnea (intermittent hypoxia).
- Sedentary lifestyle.
- Cold exposure (acute vasoconstriction).
- Local trauma or surgery.

### B. Molecular Signaling
- **VEGF-A** — perifollicular angiogenesis driver, secreted by DPC.
- **Angiopoietin-1/2 (Ang1/2)** — vessel maturation and remodeling.
- **eNOS / NO** — endothelial vasodilation.
- **ET-1 (endothelin-1)** — vasoconstrictor; elevated under oxidative stress.
- **HIF-1α** — hypoxia sensor; stabilized in perifollicular hypoxia.
- **PDGF-B/PDGFR-β** — pericyte recruitment.

### C. Cellular Consequences
- Endothelial dysfunction.
- Pericyte loss.
- DPC hypoxia under chronic perifollicular vascular pruning.

### D. Tissue Effects
- Reduced perifollicular capillary density (documented in AGA and smokers).
- Impaired delivery of nutrients, hormones, and topical actives.
- Synergy with Domain 1 (miniaturization amplification).

### E. Hair Cycle Effects
- Indirect: anagen requires sustained nutrient and oxygen delivery; chronic hypoperfusion shortens anagen.

### F. Clinical Manifestations
- Reduced response to topical therapy in heavy smokers and uncontrolled diabetics.
- Often subclinical alone — surfaces as a modifier of other etiologies.

---

## 13. Domain 13 — Mitochondrial Biology

### A. Upstream Triggers
- Aging.
- Chronic oxidative stress (Domain 3).
- Nutritional deficits (CoQ10, B vitamins, iron-sulfur cluster substrates).
- Statin therapy (CoQ10 depletion — clinically modest scalp effect).
- Mitochondrial DNA mutations (rare overt phenotypes).
- Sedentary lifestyle.

### B. Molecular Signaling
- **Electron transport chain Complexes I–V** function.
- **CoQ10** — electron carrier and antioxidant.
- **PGC-1α** — mitochondrial biogenesis master regulator.
- **mTOR, AMPK** — energy-sensing axes; balance mitochondrial biogenesis vs. autophagy.
- **Mitophagy** via PINK1/Parkin.
- **Mitochondrial ROS** — physiologic signaling at low levels; damage at high.
- **NAD+/NADH ratio** — cellular redox state; sirtuin substrate.

### C. Cellular Consequences
- DPC ATP deficit reduces secretory function.
- Matrix keratinocyte proliferation depends on robust mitochondrial output.
- HFSC quiescence regulation involves mitochondrial dynamics.
- Senescence accumulation accelerates with mitochondrial dysfunction.

### D. Tissue Effects
- Reduced regenerative capacity at every cycle.
- Synergistic with Domain 3 — mitochondria are both source and target of ROS.

### E. Hair Cycle Effects
- Anagen shortening through cellular energetic limitation.
- Reduced anagen re-entry probability with aging mitochondria.

### F. Clinical Manifestations
- Age-related diffuse thinning over decades.
- Reduced therapeutic responsiveness in advanced age (mitochondrial reserve hypothesis).

---

## 14. Cross-Domain Interaction Matrix

The thirteen domains do not act in isolation. The recurrent multiplicative interactions HairOS must verbalize:

| Domain pair | Interaction |
|---|---|
| Androgen × Inflammation | Perifollicular micro-inflammation accelerates DHT-driven miniaturization. Treating one without the other under-performs. |
| Androgen × Metabolic | Hyperinsulinemia ↓ SHBG → ↑ free androgens → amplified Domain 1. |
| Inflammation × Oxidative | Bidirectional amplifier; NF-κB and Nrf2 cross-regulation. |
| Oxidative × Mitochondrial | Mitochondria are major ROS source and primary ROS target. |
| Stem Cell × Inflammation | Chronic inflammation locks HFSC out of activation. |
| Cycle × Hormonal | Hormonal flux is the most common cycle-synchronizing trigger. |
| Cycle × Nutritional | Nutritional deficit shortens anagen and synchronizes catagen. |
| Fibrosis × Inflammation | Chronic Domain 2 → Domain 11; unidirectional ratchet. |
| Microvascular × Androgen | Perifollicular capillary pruning amplifies miniaturization. |
| Barrier × Inflammation | Barrier failure is a frequent inflammation trigger. |
| Immune × Stem Cell | In non-scarring autoimmunity (AA) HFSC are spared; in scarring autoimmunity they are destroyed — the difference defines reversibility. |

This matrix is the basis of the multifactorial cause logic already encoded in `cause-registry/registry.json` (`multifactorial-hair-loss` composite leadership).

---

## 15. Intervention Atlas

For each ingredient: **Mechanism → Biological Target → Affected Molecular Signals → Cellular Effects → Tissue Effects → Clinical Effects.**

### 15.1 Minoxidil
- **Mechanism:** ATP-sensitive K+ channel opener; sulfated metabolite is the active form (sulfotransferase activity is a known responder/non-responder determinant).
- **Target:** Dermal papilla cell membrane, vascular smooth muscle, follicular epithelium.
- **Molecular signals:** ↑ VEGF, ↑ HGF, ↑ prostaglandin E2, ↑ Wnt/β-catenin, prolongation of anagen-driving programs.
- **Cellular effects:** DPC activation, matrix keratinocyte proliferation, perifollicular endothelial recruitment.
- **Tissue effects:** ↑ perifollicular capillary density, partial reversal of miniaturization.
- **Clinical effects:** Shedding arrest at 4–8 weeks; visible regrowth at 3–6 months; plateau at 12 months. Topical 2–5%, oral 0.25–2.5 mg.

### 15.2 Finasteride
- **Mechanism:** Selective 5α-reductase Type II inhibitor; reduces scalp and serum DHT by ~60–70% at 1 mg/day.
- **Target:** Type II 5α-R in DPC, ORS, and prostate.
- **Molecular signals:** ↓ DHT → ↓ AR activation → ↓ DKK-1, ↓ TGF-β1/2 → ↑ Wnt/β-catenin, ↑ IGF-1.
- **Cellular effects:** Rescue of DPC volume and secretory function; reduced matrix apoptosis.
- **Tissue effects:** Halt or partial reversal of miniaturization; reduced perifollicular micro-inflammation.
- **Clinical effects:** Stabilization at 6 months; modest regrowth at 12 months; sustained response requires sustained therapy.

### 15.3 Dutasteride
- **Mechanism:** Dual 5α-reductase Type I + II inhibitor; reduces serum DHT >90%.
- **Target:** Both 5α-R isoforms (Type I in sebaceous gland and liver, Type II in scalp DPC).
- **Molecular signals:** Same as finasteride but deeper DHT suppression.
- **Cellular effects:** Stronger DPC rescue.
- **Tissue effects:** Greater miniaturization reversal in head-to-head trials.
- **Clinical effects:** Superior to finasteride in some RCTs; trade-off is broader androgenic side-effect profile and longer half-life.

### 15.4 Ketoconazole (topical)
- **Mechanism:** Antifungal (ergosterol synthesis inhibition) + mild 5α-reductase inhibition + anti-inflammatory.
- **Target:** Malassezia, sebocyte 5α-R, perifollicular immune cells.
- **Molecular signals:** ↓ Malassezia load → ↓ TLR2 activation → ↓ IL-1, IL-6, IL-8; modest ↓ local DHT.
- **Cellular effects:** Reduced perifollicular inflammatory infiltrate.
- **Tissue effects:** Reduced erythema and scaling; mild miniaturization mitigation in AGA with co-existent seborrhea.
- **Clinical effects:** Improvement in seborrheic features within 4 weeks; AGA adjunct benefit over months.

### 15.5 Melatonin (topical)
- **Mechanism:** MT1/MT2 receptor agonism on DPC and ORS; potent free-radical scavenger.
- **Target:** Follicular melatonin receptors, mitochondria.
- **Molecular signals:** Direct ROS quenching; ↑ glutathione; ↑ anagen-supportive gene expression; modulation of clock genes (BMAL1, PER1).
- **Cellular effects:** Reduced DPC senescence markers; mitochondrial protection.
- **Tissue effects:** Modest perifollicular oxidative load reduction.
- **Clinical effects:** Modest density gains over 3–6 months in topical 0.1% formulations; strong tolerability.

### 15.6 Caffeine
- **Mechanism:** Phosphodiesterase inhibition → ↑ intracellular cAMP; adenosine receptor antagonism.
- **Target:** Dermal papilla cells, follicular epithelium.
- **Molecular signals:** ↑ cAMP → ↑ matrix proliferation; antagonizes TGF-β-induced apoptosis in ex-vivo follicle culture.
- **Cellular effects:** Improved matrix keratinocyte proliferation under androgen stress.
- **Tissue effects:** Modest miniaturization mitigation.
- **Clinical effects:** Modest density and shaft caliber gains as adjunct; not standalone therapy.

### 15.7 Redensyl
- **Mechanism:** DHQG (a flavanone) + EGCG2 — activate Wnt/β-catenin in HFSC and ORS.
- **Target:** Outer root sheath stem cells.
- **Molecular signals:** ↑ β-catenin nuclear translocation; ↑ HFSC proliferation markers; ↓ apoptosis under inflammatory stress.
- **Cellular effects:** HFSC activation; supports anagen re-entry.
- **Tissue effects:** Partial reversal of miniaturization in industry-sponsored 3-month trials.
- **Clinical effects:** Modest density gains; positioned as a cosmetic adjunct.

### 15.8 Procapil
- **Mechanism:** Apigenin (flavonoid) + oleanolic acid (5α-R inhibitor) + biotinyl-GHK peptide.
- **Target:** Perifollicular microcirculation + 5α-R + ECM attachment.
- **Molecular signals:** Modest ↓ local DHT, ↑ perifollicular vasodilation, ↑ basement membrane protein expression.
- **Cellular effects:** Improved DPC anchorage; reduced androgenic signaling.
- **Tissue effects:** Microcirculatory improvement; modest miniaturization mitigation.
- **Clinical effects:** Adjunct density support; weak monotherapy.

### 15.9 Capixyl
- **Mechanism:** Acetyl tetrapeptide-3 + biochanin A (red clover isoflavone, 5α-R inhibitor).
- **Target:** ECM proteins (collagen III, IV, laminin) + 5α-R.
- **Molecular signals:** ↑ ECM/basement membrane protein synthesis; ↓ DHT; modest anti-inflammatory.
- **Cellular effects:** DPC anchorage support; reduced perifollicular inflammation.
- **Tissue effects:** Reduced miniaturization signature.
- **Clinical effects:** Modest density gains; adjunct.

### 15.10 Baicapil
- **Mechanism:** Baicalin (Scutellaria) + biotin + soy isoflavones.
- **Target:** Anagen-supporting signaling.
- **Molecular signals:** ↑ Wnt/β-catenin–adjacent programs; ↓ DKK-1 in claims data; anti-inflammatory and antioxidant.
- **Cellular effects:** Anagen prolongation in industry-reported organ culture.
- **Tissue effects:** Modest.
- **Clinical effects:** Cosmetic adjunct; evidence weaker than Redensyl.

### 15.11 Copper Peptides (GHK-Cu)
- **Mechanism:** Tripeptide-copper complex; broad effects on ECM remodeling, anti-inflammatory, angiogenic.
- **Target:** Fibroblasts, keratinocytes, perifollicular vasculature.
- **Molecular signals:** ↑ decorin, ↑ collagen, ↑ VEGF; ↓ TGF-β1 (a key fibrosis-modulating effect); anti-oxidant.
- **Cellular effects:** Fibroblast modulation, endothelial support, modest HFSC support.
- **Tissue effects:** ECM normalization; perifollicular vascular support.
- **Clinical effects:** Adjunct support; particularly suited to scalps with inflammatory or fibrotic features.

### 15.12 Niacinamide (Nicotinamide)
- **Mechanism:** NAD+ precursor; barrier-supportive; anti-inflammatory.
- **Target:** Keratinocytes, sebocytes, perifollicular immune cells.
- **Molecular signals:** ↑ NAD+, ↑ sirtuin substrate availability; ↓ pro-inflammatory cytokine release; modulation of sebum.
- **Cellular effects:** Barrier-protective; sebocyte normalization; mitochondrial support.
- **Tissue effects:** Reduced TEWL; reduced surface inflammation.
- **Clinical effects:** Scalp comfort, reduced flaking, modest growth-supportive role.

### 15.13 Zinc (Topical and Oral)
- **Mechanism:** Cofactor for 5α-R modulation, anti-inflammatory, antimicrobial.
- **Target:** Enzymatic systems, sebocytes, immune cells.
- **Molecular signals:** Modulation of 5α-R activity; ↓ pro-inflammatory cytokines; antimicrobial (esp. zinc pyrithione).
- **Cellular effects:** Sebocyte normalization, matrix keratinocyte support.
- **Tissue effects:** Anti-seborrheic; mild miniaturization modulation.
- **Clinical effects:** Treats deficiency-driven loss; topical zinc pyrithione for seborrheic adjunct.

### 15.14 Iron (Oral)
- **Mechanism:** Replenishes hemoglobin and ferritin pools; ribonucleotide reductase cofactor.
- **Target:** Systemic iron stores; matrix keratinocyte proliferation substrate.
- **Molecular signals:** Restored DNA synthesis capacity in proliferative tissues.
- **Cellular effects:** Matrix keratinocyte proliferation recovery.
- **Tissue effects:** Restored shaft caliber.
- **Clinical effects:** Reversal of chronic diffuse shedding in iron-deficient patients; target ferritin >40 ng/mL for hair (controversial floor; some clinicians target >70).

### 15.15 Vitamin D
- **Mechanism:** VDR ligation; pro-anagen and immunomodulatory.
- **Target:** DPC (express VDR), HFSC, immune cells.
- **Molecular signals:** ↑ anagen-supportive gene expression; immunomodulation; calcium signaling.
- **Cellular effects:** DPC instructional capacity restoration.
- **Tissue effects:** Cycle normalization under deficit.
- **Clinical effects:** Improvement in TE and AGA outcomes in deficient patients; target 25(OH)D ≥30 ng/mL.

### 15.16 Omega-3 (EPA/DHA)
- **Mechanism:** Resolvin and protectin precursors; competitive substrate for COX/LOX shifts eicosanoid balance.
- **Target:** Perifollicular immune cells, endothelium.
- **Molecular signals:** ↑ resolvins (RvD, RvE); ↓ pro-inflammatory eicosanoids; ↓ TNF-α, IL-6.
- **Cellular effects:** Reduced perifollicular inflammatory infiltrate.
- **Tissue effects:** Inflammation resolution support.
- **Clinical effects:** Adjunct in inflammatory and metabolic-driven loss; slow onset.

### 15.17 Curcumin
- **Mechanism:** NF-κB inhibitor; antioxidant; broad anti-inflammatory.
- **Target:** Perifollicular immune cells, fibroblasts.
- **Molecular signals:** ↓ NF-κB → ↓ TNF-α, IL-1, IL-6; ↑ Nrf2; modest 5α-R modulation in vitro.
- **Cellular effects:** Reduced inflammatory tone; anti-fibrotic in models.
- **Tissue effects:** Inflammation and early-fibrosis modulation.
- **Clinical effects:** Bioavailability is limiting; adjunctive role.

### 15.18 Saw Palmetto (Serenoa repens)
- **Mechanism:** Plant-derived weak 5α-R inhibitor (both isoforms).
- **Target:** 5α-R Type I and II.
- **Molecular signals:** Modest ↓ DHT.
- **Cellular effects:** Mild AR-axis suppression.
- **Tissue effects:** Modest miniaturization mitigation.
- **Clinical effects:** Weaker than finasteride; option when pharmacologic 5α-R inhibition is declined.

### 15.19 Latanoprost / Bimatoprost (off-label)
- **Mechanism:** Prostaglandin F2α analogs; FP receptor agonism.
- **Target:** Follicular FP receptors.
- **Molecular signals:** Anagen prolongation; melanogenesis stimulation.
- **Cellular effects:** DPC and matrix support.
- **Tissue effects:** Reversal of miniaturization in eyelash data; scalp data limited.
- **Clinical effects:** Established for eyelash hypotrichosis; emerging scalp data.

### 15.20 JAK Inhibitors (tofacitinib, ruxolitinib, baricitinib)
- **Mechanism:** JAK1/2/3 kinase inhibition; blocks IFN-γ → STAT1 axis.
- **Target:** Immune privilege restoration in alopecia areata.
- **Molecular signals:** ↓ IFN-γ signaling, ↓ CXCL9/10, ↓ MHC-I upregulation on bulb keratinocytes.
- **Cellular effects:** CD8+ T-cell retreat from perifollicular niche.
- **Tissue effects:** Restoration of anagen bulb immune privilege.
- **Clinical effects:** Substantial regrowth in moderate-to-severe AA; baricitinib FDA-approved 2022.

---

## 16. Cause-Domain Mapping (Bridge to HairOS Cause Registry)

How the ten HairOS causes map onto the thirteen biological domains. Each cause is a weighted combination — never a single domain.

| Cause (id) | Primary Domains | Secondary Domains |
|---|---|---|
| `androgen-driven-miniaturization` | 1 (Androgen), 5 (Cycle) | 2, 3, 8, 12 |
| `stress-driven-telogen-effluvium` | 5 (Cycle), 7 (Hormonal — cortisol/CRH) | 3, 10 |
| `hormonal-hair-loss` | 7 (Hormonal), 5 (Cycle) | 1 (overlap in PCOS, peri/post-meno) |
| `nutritional-hair-stress` | 9 (Nutritional), 5 (Cycle) | 3, 13 |
| `metabolic-hair-dysfunction` | 8 (Metabolic), 1 (Androgen amplification) | 2, 3, 12 |
| `inflammatory-scalp-dysfunction` | 2 (Inflammation), 6 (Barrier) | 3, 11 (chronic) |
| `gut-hair-axis-dysfunction` | 9 (Nutritional malabsorption), 2 (Inflammation) | 10 (immune activation) |
| `autoimmune-hair-loss` | 10 (Immune), 4 (Stem Cell — sparing or destruction) | 11 (if scarring variant) |
| `hair-shaft-damage-syndrome` | (No follicular biology) — shaft physical/chemical injury | — |
| `multifactorial-hair-loss` | Composite; ≥3 domains simultaneously above activation threshold | — |

**Constitutional gap explicit in this mapping:** scarring/cicatricial alopecia is implied only via Domain 11 spilling into `inflammatory-scalp-dysfunction`. A clean **`scarring-cicatricial-alopecia`** cause should be added in cause-registry v2, as already noted by the audit and by [`project-sprint1-week3-causes`](memory/project_sprint1_week3_causes.md) governance.

---

## 17. Three-Level Narrative Templates

Every HairOS narrative must traverse the same chain (Trigger → Molecular → Cellular → Tissue → Cycle → Clinical) but at three depths. Authoritative templates per representative cause:

### 17.1 Androgen-Driven Miniaturization

**Level 1 — Patient-Friendly:**
> Your follicles are reading a hereditary hormone signal that gradually shrinks each hair shaft a little more with every growth cycle. The hair is not falling out all at once — it is becoming finer, lighter, and shorter over years. With the right intervention, the signal can be quieted and many follicles can produce thicker hair again.

**Level 2 — Doctor-Clinical:**
> Androgen-sensitive scalp dermal papilla cells convert testosterone to DHT via 5α-reductase Type II. DHT-bound androgen receptor up-regulates DKK-1 and TGF-β1/2 while suppressing IGF-1 and VEGF. The result is a stepwise shortening of anagen, dermal papilla volume reduction, and progressive terminal-to-vellus conversion. The patient presents with pattern thinning, preserved follicular ostia, and increased hair diameter diversity on trichoscopy.

**Level 3 — Research-Biology:**
> The androgenic miniaturization phenotype emerges from AR-mediated transcriptional reprogramming of dermal papilla cells. DHT-AR complexes recruit co-activators that drive DKK-1, TGF-β1, TGF-β2, and IL-6 transcription while repressing IGF-1 and VEGF. The resulting Wnt/β-catenin attenuation and pro-apoptotic signaling shorten anagen by reducing matrix keratinocyte proliferation and accelerating catagen via TGF-β-Smad2/3. The PGD2-GPR44 axis, induced through lipocalin-PTGDS upregulation in balding scalp, imposes an additional inhibition on hair follicle stem cell activation. Across successive cycles dermal papilla cell census declines, kenogen prolongs, and terminal-to-vellus conversion proceeds. Perifollicular micro-inflammation and capillary pruning are common co-features that amplify the phenotype.

### 17.2 Stress-Driven Telogen Effluvium

**Level 1:**
> A physical or emotional stress pushed a large group of follicles to rest at the same time. Three to four months later, those resting hairs are being released — which is why you are seeing the shedding now. The follicles themselves are healthy; they are simply out of phase. Once the trigger resolves the cycle realigns and density returns over 3 to 6 months.

**Level 2:**
> Synchronized premature catagen induction — most often via HPA-axis activation, thyroid perturbation, or substrate availability shift — produces a phase-distribution shift toward telogen. The patient presents with diffuse shedding, positive pull test, and intact follicular architecture. Anagen pool depletion expressed clinically 60 to 120 days after the precipitant. Resolution timeline matches cycle re-entry.

**Level 3:**
> Acute or sustained stressors elevate CRH and substance P in the skin compartment, activate the local cutaneous HPA axis, and induce premature catagen via TGF-β1, FGF5, BMP4, and IL-1α. Mast cell degranulation contributes substance P–mediated catagen induction. Hair follicle stem cells are spared; architecture is preserved. The cohort of follicles entering catagen synchronously cycles into telogen and exogen approximately 2–4 months later — the canonical telogen effluvium shedding peak. Anagen re-entry depends on trigger resolution and sufficient Wnt/β-catenin and Shh signaling in the bulge-DP unit.

### 17.3 Inflammatory Scalp Dysfunction

**Level 1:**
> The scalp's microbial and immune balance is disrupted, and the resulting inflammation is putting steady pressure on the hair follicles. Even when you don't see obvious irritation, that pressure can shorten growth cycles and accelerate other forms of thinning. Restoring scalp comfort is a foundational step before other treatments can perform at their best.

**Level 2:**
> Malassezia overgrowth, sebum oxidation, or barrier compromise drives a TLR2/4-mediated cytokine cascade dominated by IL-1, IL-6, IL-8, IL-17, and TNF-α. Perifollicular lymphocytic infiltrate suppresses dermal papilla function and induces premature catagen. Chronicity amplifies any co-existing androgenic or hormonal etiology and risks progression toward perifollicular fibrosis.

**Level 3:**
> Innate immune surveillance via TLR2 (Malassezia recognition) and TLR4 (LPS) activates NF-κB and NLRP3-inflammasome signaling in keratinocytes and resident immune cells. The resulting cytokine milieu (IL-1β, IL-6, TNF-α, IL-17) drives Langerhans cell activation, CD4+/CD8+ T-cell recruitment via CXCL9/10, and mast cell degranulation. IL-1β and TNF-α directly suppress hair shaft elongation in human follicle organ culture and induce premature catagen via Smad and JNK signaling. Chronic perifollicular inflammation establishes the substrate for TGF-β/CTGF-driven fibrosis and accelerates androgenic miniaturization in genetically susceptible scalps.

### 17.4 Multifactorial — The Final Goal Sentence (Template)

> "The current evidence suggests a combination of {{domain_1_phenotype}}, {{domain_2_phenotype}}, and {{domain_3_phenotype}} mechanisms. These processes are {{cycle_perturbation_summary}} and reducing follicular output. The recommended protocol targets {{intervention_chain_summary}} — the biological pathways most likely contributing to this dysfunction."

Slot filling rules:
- `domain_N_phenotype` — from active pathways in PathwayGraph, mapped through Section 16.
- `cycle_perturbation_summary` — derived from active pathways' contribution to Domain 5.
- `intervention_chain_summary` — derived from selected ingredients' Intervention Atlas entries, summarized at their respective level.

This is the template that operationalizes the Dr FACT final-goal sentence as a deterministic composition.

---

## 18. Recovery Biology — How Follicles Heal

Equally important to "why follicles fail" is "how they recover". HairOS must explain recovery as the **reversal of each layer**:

1. **Trigger removal** — first-order requirement. Without it, downstream interventions plateau.
2. **Molecular re-balancing** — restoration of Wnt/β-catenin, IGF-1, VEGF, and resolution of inflammatory and oxidative tone.
3. **Cellular restoration** — DPC re-expansion (anti-androgens, growth-supportive actives), HFSC activation (Wnt activators, prostaglandin analogs), endothelial recovery (vasodilators).
4. **Tissue repair** — perifollicular capillary regrowth, resolution of micro-inflammation, prevention of fibrosis lock-in.
5. **Cycle resynchronization** — new anagen cohort emergence over 3–6 months (cycle-bound).
6. **Clinical restoration** — shedding arrest, then shaft caliber gains, then density gains, in that order.

**Recovery ceilings are domain-determined:**

| Domain perturbation | Recovery ceiling |
|---|---|
| Nutritional (uncorrected) | Reversible if corrected before chronicity |
| Hormonal flux (resolved) | Near-complete |
| Stress TE (resolved) | Near-complete |
| Inflammation (controlled) | Near-complete if no fibrosis |
| Androgen (suppressed) | Partial — stabilization > regrowth, time-dependent |
| Stem cell exhaustion | Limited — restorative threshold matters |
| Fibrosis (established) | None at destroyed sites; halt progression in unaffected |
| Autoimmune (non-scarring) | High |
| Autoimmune (scarring) | None at destroyed sites |

This ceiling structure is the basis on which the (not-yet-built) Recovery Engine should compute realistic outcome expectations.

---

## 19. Integration Notes — How This Document Wires Into HairOS

### 19.1 Registry sidecar
Each Section 1–13 maps onto rows in a planned `src/packages/registries/mechanisms/registry.json`:

```
{
  "id": "androgen-biology",
  "domain": "androgen",
  "triggers": [...],                 // Section A
  "molecularSignals": [              // Section B
    { "id": "DHT", "direction": "up", "role": "primary" },
    { "id": "DKK1", "direction": "up", "role": "downstream" },
    ...
  ],
  "cellularConsequences": [...],     // Section C
  "tissueEffects": [...],            // Section D
  "cycleEffects": [...],             // Section E
  "clinicalManifestations": [...],   // Section F
  "expressedByPathways": ["follicular-miniaturization"],
  "explainsCauses": ["androgen-driven-miniaturization"],
  "targetedByIngredients": ["finasteride","dutasteride","saw-palmetto","minoxidil"],
  "framings": { "doctor": "...", "patient": "...", "scientific": "..." }
}
```

### 19.2 Pathway / Cause additive fields
Each pathway and cause object gains an optional `mechanismChain: string[]` referencing ids in the mechanism registry. **Additive, non-breaking.**

### 19.3 Narrative template
`src/packages/ai-engine/explanations/templates/mechanism-cascade.ts` — a deterministic composer that walks `mechanismChain` and emits three-level output by joining `framings.{doctor|patient|scientific}` per layer.

### 19.4 Ingredient KB authoring
Section 15 is the authoring brief for new files under `src/packages/ai-engine/knowledge-engine/kb/ingredients/`. Existing `IngredientKnowledge` type already supports the full chain (verified in audit) — only content to add.

### 19.5 Cause registry v2
Section 16 surfaces the need for `scarring-cicatricial-alopecia` as a cause-registry v2 addition (governed by [`project-sprint1-week3-causes`](memory/project_sprint1_week3_causes.md)).

### 19.6 Recovery Engine (future)
Section 18 is the explicit specification for the Recovery Engine to consume — out of scope for activation per [`project-brain-activation`](memory/project_brain_activation.md), but pre-specified here so the eventual implementation has a knowledge substrate.

---

## 20. Governance and Versioning

- This document is **v1.0** of the HairOS Follicular Biology Intelligence model.
- Updates require:
  - Evidence citation in the change record.
  - Tier annotation for claims weaker than Established.
  - Cross-check against existing Pathway and Cause registries to maintain symmetry.
- Minor revisions (text refinement, evidence-tier adjustments): patch version.
- New molecular signals or new cellular populations: minor version.
- New domain or restructuring of the six-layer chain: major version, requires governance review per `clinical-engine/cause-ranker/governance/governance-constraints.md`.

This is the canonical scientific source for HairOS. Every patient-, doctor-, and research-facing explanation should be traceable back to a chain defined here.
