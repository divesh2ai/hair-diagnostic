# HAIROS Clinical Replay Corpus V2 — Coverage Audit

**Generated:** 2026-06-06
**Total cases:** 200
**Adversarial cases:** 75 (target ≥ 50)

## 1. By category
| Category | Count |
| --- | --- |
| MALE_AGA | 50 |
| FPHL | 25 |
| PCOS | 25 |
| MULTIFACTORIAL | 20 |
| ACUTE_TE | 20 |
| CHRONIC_TE | 20 |
| ALOPECIA_AREATA | 15 |
| INFLAMMATORY_SCALP | 15 |
| POST_COVID_TE | 10 |

## 2. By severity
| Severity | Count |
| --- | --- |
| moderate | 95 |
| severe | 55 |
| mild | 50 |

## 3. By presentation clarity
| Clarity | Count |
| --- | --- |
| clear | 128 |
| ambiguous | 45 |
| conflicting | 23 |
| edge_case | 4 |

## 4. By expected protocol class
| Protocol Class | Count |
| --- | --- |
| MPHL | 50 |
| FPHL | 25 |
| PCOS | 25 |
| MULTIFACTORIAL | 20 |
| TE_ACUTE | 20 |
| TE_CHRONIC | 20 |
| AUTOIMMUNE_AA | 15 |
| INFLAMMATORY | 15 |
| TE_POST_ILLNESS | 10 |

## 5. By expected primary cause
| Cause ID | Count |
| --- | --- |
| androgen-driven-miniaturization | 75 |
| stress-driven-telogen-effluvium | 50 |
| hormonal-hair-loss | 25 |
| multifactorial-hair-loss | 20 |
| autoimmune-hair-loss | 15 |
| inflammatory-scalp-dysfunction | 15 |

## 6. By legacy DiagnosisKey emitted
| Legacy Key | Count |
| --- | --- |
| AGA_MALE_45 | 28 |
| AGA_MALE_123 | 22 |
| MULTI | 20 |
| PCOS_METABOLIC | 20 |
| AGA_FEMALE_123 | 19 |
| POST_ILLNESS_TE | 16 |
| ALOPECIA_AREATA | 15 |
| CHRONIC_TE | 12 |
| SEBORRHEIC_DERMATITIS | 9 |
| NUTRITIONAL_TE | 7 |
| AGA_FEMALE_45 | 6 |
| POSTPARTUM_TE | 6 |
| PCOS_HAIRLOSS | 5 |
| ACUTE_TE | 5 |
| STRESS_TE | 4 |
| PSORIATIC_SCALP | 3 |
| INFLAMMATORY_SCALP | 3 |

## 7. Signal coverage (asserted in expectedSignals)
| Signal ID | Cases |
| --- | --- |
| pattern-thinning-marker | 120 |
| sex-female | 104 |
| sex-male | 96 |
| age-mid-modifier | 85 |
| genetic-predisposition-reported | 82 |
| thinning-without-shedding | 75 |
| grade123-severity-marker | 75 |
| diffuse-shedding-marker | 72 |
| oily-scalp | 70 |
| age-mature-modifier | 66 |
| grade45-severity-marker | 45 |
| chronic-duration-marker | 40 |
| pcos-diagnosis | 31 |
| active-shedding-heavy | 31 |
| age-young-modifier | 30 |
| iron-deficiency-reported | 30 |
| acute-duration-marker | 25 |
| chronic-stress-reported | 24 |
| pcos-with-metabolic | 20 |
| age-senior-modifier | 19 |
| active-shedding-mild | 19 |
| dandruff-with-itching | 17 |
| post-illness-recovery | 16 |
| alopecia-areata-history | 15 |
| vitamin-d-deficiency-reported | 15 |
| patchy-loss-marker | 13 |
| perimenopause-state | 10 |
| postmenopause-state | 7 |
| chronic-medical-on-medication | 7 |
| hypothyroid-diagnosis | 6 |
| subacute-duration-marker | 5 |
| night-shift-exposure | 4 |
| irregular-diet-pattern | 4 |
| scalp-redness | 3 |
| psoriatic-scalp | 3 |
| scalp-pustules | 3 |
| dandruff-presence | 3 |
| vitamin-b12-deficiency-reported | 3 |
| bloating-symptoms | 3 |
| postpartum-lactating | 3 |
| postpartum-not-lactating | 3 |
| crash-diet-pattern | 3 |
| recurrent-infection-pattern | 2 |

## 8. Pathway coverage (asserted in expectedPathways)
| Pathway ID | Cases |
| --- | --- |
| follicular-miniaturization | 120 |
| telogen-cycle-disruption | 78 |
| hormonal-dysregulation | 67 |
| nutritional-limitation | 30 |
| scalp-inflammation | 26 |
| metabolic-dysfunction | 20 |
| immune-dysregulation | 18 |
| oxidative-stress | 10 |

## 9. Therapy needs coverage
| Therapy Need | Cases |
| --- | --- |
| INFLAMMATION_CONTROL | 150 |
| DHT_SUPPRESSION | 120 |
| NUTRITIONAL_REPLETION | 82 |
| ENDOCRINE_OPTIMIZATION | 70 |
| CYCLE_RESTORATION | 70 |
| STRESS_DOWNREGULATION | 50 |
| SCALP_DECONGESTION | 20 |
| METABOLIC_OPTIMIZATION | 20 |
| AUTOIMMUNE_QUIESCENCE | 15 |
| IMMUNE_MODULATION | 15 |
| GUT_REPAIR | 3 |

## 10. Narrative theme coverage
| Narrative Theme | Cases |
| --- | --- |
| EXPECTATION_SETTING_SLOW | 130 |
| ANDROGENIC_PROGRESSION | 100 |
| ENDOCRINE_REBALANCE | 50 |
| CYCLE_RESET | 50 |
| STRESS_RECOVERY | 50 |
| REVERSIBILITY_REASSURANCE | 45 |
| MULTIFACTORIAL_COORDINATION | 40 |
| INFLAMMATORY_QUIESCENCE | 20 |
| NUTRITIONAL_RESTORATION | 19 |
| AUTOIMMUNE_CONTROL | 15 |

## 11. Adversarial cases
Total: 75 / 200

### 11.1 Adversarial cases by expected primary driver
| Cause ID | Count |
| --- | --- |
| multifactorial-hair-loss | 20 |
| androgen-driven-miniaturization | 17 |
| stress-driven-telogen-effluvium | 14 |
| hormonal-hair-loss | 10 |
| autoimmune-hair-loss | 9 |
| inflammatory-scalp-dysfunction | 5 |

### 11.2 Adversarial failure modes covered
| Failure Mode | Count |
| --- | --- |
| COMPOSITE_RULE_NOT_EVALUATED | 20 |
| SINGLE_CAUSE_OVERCONFIDENCE | 20 |
| MONO_PROTOCOL_SHIPPED | 20 |
| PATCHY_DISMISSED | 7 |
| INFLAMMATION_DISMISSED_AS_AGA | 5 |
| NUTRITIONAL_OVERTAKES_ANDROGENIC | 5 |
| INFLAMMATION_MASKS_AGA | 5 |
| INFLAMMATORY_PROTOCOL_OVERRIDE | 5 |
| PCOS_LEAN_MISSED | 5 |
| TE_AS_AGA | 5 |
| CHRONIC_TE_AS_AGA | 5 |
| FEMALE_AGA_MISSED_AS_NUTRITIONAL | 4 |
| POST_COVID_AS_CHRONIC_TE | 4 |
| FEMALE_AGA_MISSED_AS_HORMONAL_ONLY | 3 |
| PCOS_NORMO_MISCLASS | 3 |
| AA_MISSED_AS_TE | 2 |
| POST_BARIATRIC_NUTRITIONAL_OVERTAKE | 2 |

## 12. Edge-case representation checks
| Edge case | Represented |
| --- | --- |
| AGA + ferritin deficiency | ✅ |
| AGA + heavy scalp inflammation | ✅ |
| PCOS lean phenotype | ✅ |
| PCOS normal androgen | ✅ |
| PCOS post-bariatric | ✅ |
| TE mimicking AGA (chronic crown) | ✅ |
| AA mimicking TE (incipient diffuse) | ✅ |
| Inflammation masking AGA | ✅ |
| Multifactorial AGA+TE | ✅ |
| Multifactorial PCOS+TE+nutritional | ✅ |
| FPHL + hypothyroid co-driver | ✅ |
| Post-COVID acute phase | ✅ |
| Post-COVID late phase | ✅ |
| Postpartum lactating TE | ✅ |
| Folliculitis decalvans | ✅ |
| Psoriatic scalp | ✅ |

All required edge cases represented.

## 13. Invariant checks
| Invariant | Pass |
| --- | --- |
| All cases have non-empty whyPrimary ≥ 50 words | ✅ |
| All cases reference at least one expectedSignal | ✅ |
| All cases reference at least one expectedPathway | ✅ |
| All cases reference at least one expectedRootCause | ✅ |
| All cases have expectedDiagnosis.legacyDiagnosisKey | ✅ |
| All cases have expectedMonitoringRequirements.required[] | ✅ |
| All cases have ≥1 narrative theme | ✅ |
| ≥ 50 adversarial cases | ✅ |
