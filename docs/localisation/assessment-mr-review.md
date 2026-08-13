# Dr FACT Hair Assessment — Marathi Translation Review

> **Generated file — do not edit by hand.**
> Produced by `scripts/build-review-doc.mjs` from the live protocol
> (`questionnaire.schema.json`) and the Marathi content pack
> (`apps/patient-portal/src/lib/assessment-i18n/content/mr.ts`).
> Re-run the script after any change so this document can never describe
> wording the app no longer renders.

## How to review

You are reviewing the **Marathi** column only. The **Key** and **Answer code**
columns are internal identifiers — they are stored in the database and read
by the clinical engine, and they are deliberately identical in every
language. Changing them would change clinical meaning; changing the Marathi
changes only what the patient reads.

If a Marathi phrase is clinically wrong or hard for a patient to follow,
write the correction in the margin and we will apply it to the content pack.

**Voice rules applied:** respectful second person (`तुम्ही`);
patient-friendly Marathi over literal translation; familiar
Indian-English clinical terms retained where they read better; brand names
never translated (Dr. FACT, HairOS).

> **Note for the Marathi reviewer:** this is a translation from English,
> not a transliteration of the Hindi pack. Marathi vocabulary is used
> throughout — केस not बाल, गळणे not झड़ना, डोक्याची त्वचा for scalp. Flag anything
> that reads as Hindi-influenced.

---

## S1_PATIENT_IDENTITY — About You

### Chapter card

| Key | English | Marathi |
| --- | --- | --- |
| `S1_PATIENT_IDENTITY.title` | About You | तुमच्याबद्दल |
| `S1_PATIENT_IDENTITY.body` | A few quick details so we can personalise the rest of the assessment. | थोडक्यात काही माहिती, जेणेकरून पुढचे मूल्यांकन पूर्णपणे तुमच्यानुसार करता येईल. |

### `name` — text · required

**Clinical intent:** Patient identity for the report and doctor queue.

| Key | English | Marathi |
| --- | --- | --- |
| `name.title` | What is your full name? | तुमचे पूर्ण नाव काय आहे? |
| `name.placeholder` | Your full name | तुमचे पूर्ण नाव |

### `age` — number · required

**Clinical intent:** Drives age-gated option filtering (e.g. greying goal hidden at 30+) and hormonal windows.

| Key | English | Marathi |
| --- | --- | --- |
| `age.title` | How old are you? | तुमचे वय किती आहे? |
| `age.placeholder` | Your age in years | वय (वर्षांमध्ये) |

### `goal` — multi_select · required

**Clinical intent:** Primary treatment objective. Regrowth-only suppresses active-shedding analysis.

| Key | English | Marathi |
| --- | --- | --- |
| `goal.title` | What are your major concerns? | तुमची सर्वात मोठी चिंता कोणती आहे? |
| `goal.exclusivityToast` | Regrowth-only mode replaces active shedding analysis. | आता फक्त नवीन केस उगवण्यावर लक्ष राहील — सुरू असलेल्या केसगळतीचे विश्लेषण काढून टाकले आहे. |

| Answer code (stored, never translated) | English label | Marathi label |
| --- | --- | --- |
| `Reduce hair fall and improve growth` | Reduce hair fall and improve quality & growth | केस गळणे कमी व्हावे आणि केसांचा दर्जा व वाढ सुधारावी |
| `Hair fall is stopped but needs to regrow lost hair` | No active hair fall but need to better hair growth quality | सध्या केस गळत नाहीत, पण केसांची वाढ आणि दर्जा सुधारायचा आहे |
| `Early greying of hair` | Early greying of hair | कमी वयात केस पांढरे होणे |

### `sex` — single_select · required

**Clinical intent:** Gates Norwood vs Ludwig grading and every female-specific hormonal option.

| Key | English | Marathi |
| --- | --- | --- |
| `sex.title` | What is your gender? | तुमचे लिंग काय आहे? |

| Answer code (stored, never translated) | English label | Marathi label |
| --- | --- | --- |
| `Male` | Male | पुरुष |
| `Female` | Female | स्त्री |
| `Other` | Other | इतर |

---

## S2_HAIR_LOSS_ASSESSMENT — Hair History

### Chapter card

| Key | English | Marathi |
| --- | --- | --- |
| `S2_HAIR_LOSS_ASSESSMENT.title` | Hair History | केसांचा इतिहास |
| `S2_HAIR_LOSS_ASSESSMENT.body` | These questions help us recognise the pattern, pace and texture of what you are experiencing. | हे प्रश्न तुमचे केस कोणत्या प्रकारे आणि किती वेगाने गळत आहेत हे समजून घेण्यास मदत करतात. |

### `duration` — single_select

**Clinical intent:** Acute (1–3 mo) vs chronic shedding — drives TE GOLD eligibility.

| Key | English | Marathi |
| --- | --- | --- |
| `duration.title` | How long have you been experiencing hair loss? | तुम्हाला केस गळण्याचा त्रास किती काळापासून आहे? |

| Answer code (stored, never translated) | English label | Marathi label |
| --- | --- | --- |
| `1–3 months` | 1–3 months | 1–3 महिने |
| `3–6 months` | 3–6 months | 3–6 महिने |
| `6–12 months` | 6–12 months | 6–12 महिने |
| `More than 1 year` | More than 1 year | 1 वर्षापेक्षा जास्त |

### `count` — single_select

**Clinical intent:** Shedding volume band; separates normal turnover from active telogen effluvium.

| Key | English | Marathi |
| --- | --- | --- |
| `count.title` | How much hair do you lose per day? | दररोज किती केस गळतात? |

| Answer code (stored, never translated) | English label | Marathi label |
| --- | --- | --- |
| `~20–50 strands␊(Normal range)` | ~20–50 strands (Normal range) | साधारण 20–50 केस (सामान्य) |
| `~50–100 strands␊(Noticeable)` | ~50–100 strands (Noticeable) | साधारण 50–100 केस (स्पष्ट जाणवते) |
| `100+ strands␊(Heavy loss)` | 100+ strands (Heavy loss) | 100 पेक्षा जास्त केस (खूप जास्त) |
| `Just thinning,␊no visible fall` | Just thinning, no visible fall | केस विरळ होत आहेत, गळताना दिसत नाहीत |

### `hairtype` — multi_select

**Clinical intent:** Shedding morphology — distinguishes diffuse TE from patterned loss and alopecia areata.

| Key | English | Marathi |
| --- | --- | --- |
| `hairtype.title` | What type of hair fall are you seeing? | केस कोणत्या प्रकारे गळत आहेत? |

| Answer code (stored, never translated) | English label | Marathi label |
| --- | --- | --- |
| `Full-length hairs␊with white bulb` | Full-length hairs with white bulb | पूर्ण लांब केस, मुळाशी पांढरा बल्ब असलेले |
| `Hair on pillow /␊floor / shower` | Hair on pillow / floor / shower | उशीवर, जमिनीवर किंवा आंघोळीच्या वेळी केस पडणे |
| `Widening parting␊or thinning` | Widening parting or thinning | भांग रुंद होणे किंवा केस विरळ होणे |
| `Circular bald␊patches/␊Coin-sized␊bald spots` | Circular bald patches / Coin-sized bald spots | गोल टक्कल पडलेले चट्टे / नाण्याएवढे टक्कल |
| `None of the above` | None of the above | यापैकी काहीही नाही |

---

## S3_SCALP_CONDITION — Symptoms

### Chapter card

| Key | English | Marathi |
| --- | --- | --- |
| `S3_SCALP_CONDITION.title` | Symptoms | लक्षणे |
| `S3_SCALP_CONDITION.body` | The scalp environment is often the silent factor behind shedding. A few short questions ahead. | डोक्याची त्वचा हे केस गळण्यामागचे बऱ्याचदा दुर्लक्षित कारण असते. पुढे काही छोटे प्रश्न आहेत. |

### `scalp` — multi_select · required

**Clinical intent:** Scalp environment: inflammation, seborrhoea, dandruff scoring.

| Key | English | Marathi |
| --- | --- | --- |
| `scalp.title` | What's your scalp like right now? | सध्या तुमच्या डोक्याची त्वचा कशी आहे? |

| Answer code (stored, never translated) | English label | Marathi label |
| --- | --- | --- |
| `Dandruff / white flakes` | Dandruff | डँड्रफ (कोंडा) |
| `Dandruff + Itching + White flakes` | Dandruff + Itching + White flakes | डँड्रफ + खाज + पांढरा कोंडा |
| `Oily scalp` | Oily scalp | डोक्याची त्वचा तेलकट |
| `Dry scalp` | Dry scalp | डोक्याची त्वचा कोरडी |
| `Redness or irritation` | Redness or irritation | लालसरपणा किंवा टोचल्यासारखे वाटणे |
| `Boils or pimples` | Boils or pimples | फोड किंवा पुरळ |
| `Burning sensation` | Burning sensation | जळजळ होणे |
| `Normal scalp` | Normal scalp | सामान्य — काहीही त्रास नाही |
| `Psoriasis / Inflammation` | Psoriasis / Inflammation | सोरायसिस / सूज |

---

## S4_MEDICAL_HISTORY — Lifestyle

### Chapter card

| Key | English | Marathi |
| --- | --- | --- |
| `S4_MEDICAL_HISTORY.title` | Lifestyle | जीवनशैली |
| `S4_MEDICAL_HISTORY.body` | Sleep, stress and routines shape the growth cycle more than most people realise. | झोप, ताण आणि रोजच्या सवयी केसांच्या वाढीच्या चक्रावर वाटतो त्यापेक्षा खूप जास्त परिणाम करतात. |

### `cause` — multi_select · required

**Clinical intent:** Patient-perceived aetiology; feeds cause ranking alongside objective signals.

| Key | English | Marathi |
| --- | --- | --- |
| `cause.title` | What do you think is the cause for your hair loss? | तुमच्या मते केस गळण्याचे कारण काय असू शकते? |

| Answer code (stored, never translated) | English label | Marathi label |
| --- | --- | --- |
| `Stress / Anxiety / Depression` | Stress / Anxiety / Depression | ताण / चिंता / नैराश्य |
| `Genetics / Family history` | Genetics / Family history | अनुवंशिक / घरात हा त्रास असणे |
| `Nutritional deficiencies` | Nutritional deficiencies | पोषक घटकांची कमतरता |
| `Medication / Recent Illness / Surgery` | Medication / Recent Illness / Surgery | एखादे औषध / अलीकडचा आजार / शस्त्रक्रिया |
| `Post partum — still feeding` | Post partum — still feeding | बाळंतपणानंतर — सध्या स्तनपान सुरू आहे |
| `Post partum — not feeding` | Post partum — not feeding | बाळंतपणानंतर — स्तनपान सुरू नाही |
| `Hair pulling habit (Trichotillomania)` | Hair pulling habit (Trichotillomania) | केस ओढण्याची सवय (ट्रायकोटिलोमेनिया) |
| `Hard water` | Hard water | खारे पाणी (हार्ड वॉटर) |
| `Post GLP-1 receptor agonist (hair loss within 6 months)` | Post GLP-1 receptor agonist (hair loss within 6 months) | GLP-1 वजन कमी करण्याच्या औषधानंतर — 6 महिन्यांच्या आत केस गळणे |
| `Post GLP-1 receptor agonist (hair loss after 6 months)` | Post GLP-1 receptor agonist (hair loss after 6 months) | GLP-1 वजन कमी करण्याच्या औषधानंतर — 6 महिन्यांनंतर केस गळणे |
| `Post crash diet` | Rapid weight loss / Crash diet | झपाट्याने वजन कमी होणे / क्रॅश डाएट |
| `Not sure` | Not sure | माहीत नाही |
| `None of the above` | None of the above | यापैकी काहीही नाही |

### `immunity` — multi_select · required

**Clinical intent:** Autoimmune and atopic signals; alopecia areata detection.

| Key | English | Marathi |
| --- | --- | --- |
| `immunity.title` | Any immunity or skin-related issues? | प्रतिकारशक्ती किंवा त्वचेशी संबंधित काही त्रास आहे का? |

| Answer code (stored, never translated) | English label | Marathi label |
| --- | --- | --- |
| `Frequent infections / cold / fever` | Frequent infections / cold / fever | वारंवार इन्फेक्शन / सर्दी-पडसे / ताप |
| `Allergies` | Allergies | ॲलर्जी |
| `Asthma` | Asthma | दमा (अस्थमा) |
| `Skin rashes or eczema` | Skin rashes or eczema | त्वचेवर पुरळ किंवा एक्झिमा |
| `Recurrent Acne / Acne prone skin` | Recurrent Acne / Acne prone skin | वारंवार मुरुमे / मुरुमांची त्वचा |
| `Alopecia Areata (circular patches)` | Alopecia Areata (circular patches) | ॲलोपेशिया एरियाटा (गोल टक्कल पडलेले चट्टे) |
| `Mouth ulcers` | Mouth ulcers | तोंड येणे (तोंडात फोड) |
| `None of the above` | None of the above | यापैकी काहीही नाही |

### `lifestyle` — multi_select · required

**Clinical intent:** Modifiable lifestyle drivers — metabolic, oxidative and circadian load.

| Key | English | Marathi |
| --- | --- | --- |
| `lifestyle.title` | How is your lifestyle? | तुमची जीवनशैली कशी आहे? |

| Answer code (stored, never translated) | English label | Marathi label |
| --- | --- | --- |
| `Smoking / Vaping` | Smoking / Vaping | धूम्रपान / व्हेपिंग |
| `Alcohol (8–10×/month)` | Alcohol (8–10×/month) | मद्यपान (महिन्यातून 8–10 वेळा) |
| `Bodybuilding / Heavy gym` | Bodybuilding / Heavy gym | बॉडीबिल्डिंग / जड जिम व्यायाम |
| `Obesity / Sedentary / Struggle to lose weight / Slowly gaining weight` | Obesity / Struggle to lose weight | लठ्ठपणा / वजन कमी करण्यात अडचण |
| `Erratic / Outside eating (3–4×/week)` | Irregular eating time / Outside eating (3–4×/week) | जेवणाच्या वेळा अनियमित / बाहेरचे खाणे (आठवड्यातून 3–4 वेळा) |
| `Night shift work` | Night shift work | रात्रपाळीचे काम |
| `Frequent flying` | Frequent flying | वारंवार विमान प्रवास |
| `None of the above` | None of the above | यापैकी काहीही नाही |

### `thyroid` — multi_select · required

**Clinical intent:** Thyroid and glycaemic status. Mutually exclusive hypo/hyper pairs.

| Key | English | Marathi |
| --- | --- | --- |
| `thyroid.title` | Do you have either of the following conditions? | यापैकी कोणता त्रास तुम्हाला आहे का? |
| `thyroid.exclusivityToast` | Selected the contradicting option — replacing the previous one. | हा पर्याय आधीच्या पर्यायाच्या विरुद्ध आहे, म्हणून आधीचा काढून टाकला आहे. |

| Answer code (stored, never translated) | English label | Marathi label |
| --- | --- | --- |
| `Hypothyroidism` | Hypothyroidism | हायपोथायरॉइड (थायरॉइड कमी) |
| `Hyperthyroidism` | Hyperthyroidism | हायपरथायरॉइड (थायरॉइड जास्त) |
| `Pre diabetes` | Pre diabetes | प्री-डायबेटिस (साखर वाढण्याची सुरुवात) |
| `Diabetes` | Diabetes | मधुमेह (डायबेटिस) |
| `Not Applicable` | Not Applicable | यापैकी काहीही नाही |

### `medical` — single_select · required

**Clinical intent:** Chronic-condition gate for the free-text follow-up below.

| Key | English | Marathi |
| --- | --- | --- |
| `medical.title` | Are you currently under treatment for any chronic medical condition? | तुम्ही कोणत्या जुन्या आजारावर उपचार घेत आहात का? |

| Answer code (stored, never translated) | English label | Marathi label |
| --- | --- | --- |
| `Yes, currently on medication` | Yes, currently on medication | होय, सध्या औषधे सुरू आहेत |
| `No, no chronic conditions` | No, no chronic conditions | नाही, कोणताही जुना आजार नाही |

### `medical_detail` — text

**Clinical intent:** Free-text medication and condition capture for doctor review.

| Key | English | Marathi |
| --- | --- | --- |
| `medical_detail.title` | Please tell us which condition(s) you are being treated for and any medications you are currently taking: | कोणत्या आजारावर उपचार सुरू आहेत आणि तुम्ही कोणती औषधे घेत आहात ते सांगा: |
| `medical_detail.placeholder` | e.g. Hypothyroidism, Diabetes, BP — metformin, levothyroxine... | उदा. — थायरॉइड, मधुमेह, बीपी; औषधे — मेटफॉर्मिन, लेव्होथायरॉक्सिन… |

### `hormonal` — multi_select

**Clinical intent:** Female hormonal axis: PCOS, pregnancy, postpartum, menopause continuum.

| Key | English | Marathi |
| --- | --- | --- |
| `hormonal.title` | Any hormonal or reproductive health issues? | हार्मोन किंवा स्त्री-आरोग्याशी संबंधित काही त्रास आहे का? |
| `hormonal.exclusivityToast` | Selected the contradicting reproductive state — replacing the previous one. | ही स्थिती आधीच्या पर्यायाशी जुळत नाही, म्हणून आधीचा काढून टाकला आहे. |

| Answer code (stored, never translated) | English label | Marathi label |
| --- | --- | --- |
| `PCOS / PCOD only` | PMOS / PCOS | पीसीओएस / पीसीओडी |
| `Endometriosis` | Endometriosis | एंडोमेट्रिओसिस |
| `Heavy bleeding periods` | Heavy bleeding periods | पाळीत जास्त रक्तस्राव |
| `Currently pregnant` | Currently pregnant | सध्या गर्भवती आहे |
| `Post-delivery or breastfeeding` | Post-delivery or breastfeeding | बाळंतपणानंतर किंवा स्तनपान सुरू आहे |
| `Peri-menopause` | Peri-menopause | मेनोपॉजची सुरुवात (पेरी-मेनोपॉज) |
| `Post-menopause` | Post-menopause | मेनोपॉजनंतर |
| `Hormone Replacement Therapy (HRT)` | Hormone Replacement Therapy (HRT) | हार्मोन रिप्लेसमेंट थेरपी (HRT) |
| `Post-hysterectomy` | Post-hysterectomy | गर्भाशय काढल्यानंतर |
| `None of the above` | None of the above | यापैकी काहीही नाही |

---

## S5_NUTRITION_AND_DIET — Nutrition, Diet & Treatments

### Chapter card

| Key | English | Marathi |
| --- | --- | --- |
| `S5_NUTRITION_AND_DIET.title` | Nutrition, Diet & Treatments | पोषण, आहार आणि ट्रीटमेंट |
| `S5_NUTRITION_AND_DIET.body` | Subtle nutritional gaps can mimic genetic loss. We are looking for the difference. | पोषणाची थोडीशी कमतरतासुद्धा अनुवंशिक केसगळतीसारखी दिसू शकते. आम्ही नेमका हाच फरक ओळखत आहोत. |

### `gut` — multi_select · required

**Clinical intent:** Absorption capacity — GI GOLD trigger set is a strict subset of these.

| Key | English | Marathi |
| --- | --- | --- |
| `gut.title` | Any gut or digestive issues? | पोट किंवा पचनाशी संबंधित काही त्रास आहे का? |

| Answer code (stored, never translated) | English label | Marathi label |
| --- | --- | --- |
| `Bloating / gas` | Bloating / gas | पोट फुगणे / गॅस |
| `Constipation` | Constipation | बद्धकोष्ठता |
| `IBS / Crohn's` | IBS / Crohn's | आयबीएस / क्रोन्स |
| `Acid reflux␊(heartburn) /␊GERD␊(Chronic Heartburn)` | Acid reflux (heartburn) / GERD (Chronic Heartburn) | ॲसिडिटी, छातीत जळजळ / GERD (सतत जळजळ) |
| `Indigestion` | Indigestion | अपचन |
| `No gut issues` | No gut issues | पोटाशी संबंधित काहीही त्रास नाही |

### `deficiency` — multi_select · required

**Clinical intent:** Confirmed lab deficiencies (iron, D3, B12).

| Key | English | Marathi |
| --- | --- | --- |
| `deficiency.title` | Any confirmed nutritional deficiencies? | तपासणीत पोषक घटकांची काही कमतरता आढळली आहे का? |

| Answer code (stored, never translated) | English label | Marathi label |
| --- | --- | --- |
| `Iron / Anaemia` | Iron / Anaemia | लोहाची कमतरता / ॲनिमिया |
| `Vitamin D3` | Vitamin D3 | व्हिटॅमिन D3 |
| `Vitamin B12` | Vitamin B12 | व्हिटॅमिन B12 |
| `None / Not tested` | None / Not tested | काहीही नाही / तपासणी केलेली नाही |

### `diet` — multi_select · required

**Clinical intent:** Dietary pattern and protein adequacy.

| Key | English | Marathi |
| --- | --- | --- |
| `diet.title` | What best describes your diet? | तुमचा आहार कसा आहे? |

| Answer code (stored, never translated) | English label | Marathi label |
| --- | --- | --- |
| `Normal diet` | Normal diet | सर्वसाधारण आहार |
| `Vegetarian` | Vegetarian | शाकाहारी |
| `Vegan` | Vegan | व्हीगन (कोणतेही प्राणिजन्य पदार्थ नाहीत) |
| `Non-vegetarian` | Non-vegetarian | मांसाहारी |
| `Pescatarian` | Pescatarian | शाकाहारी, पण मासे खातो/खाते |
| `High protein diet` | High protein diet | हाय-प्रोटीन आहार |
| `Irregular / poor diet` | Irregular / poor diet | अनियमित किंवा कमकुवत आहार |
| `Crash Diet / Keto / IF` | Crash / Keto / Intermittent fasting | क्रॅश डाएट / कीटो / इंटरमिटंट फास्टिंग |
| `None of the above` | None of the above | यापैकी काहीही नाही |

### `treatment` — multi_select · required

**Clinical intent:** Heat and chemical damage load on the shaft.

| Key | English | Marathi |
| --- | --- | --- |
| `treatment.title` | Any heat or chemical treatments on your hair? | केसांवर कोणतेही हीट किंवा केमिकल ट्रीटमेंट केले आहे का? |

| Answer code (stored, never translated) | English label | Marathi label |
| --- | --- | --- |
| `Heat styling (straightener etc.)` | Heat styling (straightener etc.) | हीट स्टाइलिंग (स्ट्रेटनर वगैरे) |
| `Chemical treatment (colour / keratin)` | Chemical treatment (colour / keratin) | केमिकल ट्रीटमेंट (कलर / केरॅटिन) |
| `No heat or chemical treatments` | No heat or chemical treatments | कोणतेही हीट किंवा केमिकल ट्रीटमेंट नाही |

---

## S6_GRADE_AND_ADDITIONAL — The Final Picture

### Chapter card

| Key | English | Marathi |
| --- | --- | --- |
| `S6_GRADE_AND_ADDITIONAL.title` | The Final Picture | संपूर्ण चित्र |
| `S6_GRADE_AND_ADDITIONAL.body` | A few final questions to complete your hair profile. | तुमचे केसांचे प्रोफाइल पूर्ण करण्यासाठी काही शेवटचे प्रश्न. |

### `grade` — image_select

**Clinical intent:** Visual severity grade — Norwood (male) or Ludwig (female).

| Key | English | Marathi |
| --- | --- | --- |
| `grade.title` | Which image best describes your hair loss right now? | यापैकी कोणते चित्र तुमच्या सध्याच्या स्थितीशी सर्वात जास्त जुळते? |

| Answer code (stored, never translated) | English label | Marathi label |
| --- | --- | --- |
| `Grade 1 — Norwood I` | Norwood I — No visible recession | नॉरवुड I — हेअरलाइनमध्ये कोणताही बदल नाही |
| `Grade 1 — Norwood II` | Norwood II — Slight temporal recession | नॉरवुड II — कानशिलाजवळ थोडे मागे सरकणे |
| `Grade 2 — Norwood IIa` | Norwood IIa — Anterior recession | नॉरवुड IIa — पुढची हेअरलाइन मागे सरकणे |
| `Grade 2 — Norwood III` | Norwood III — Frontotemporal recession | नॉरवुड III — कपाळ आणि कानशिल, दोन्हीकडे मागे सरकणे |
| `Grade 2 — Norwood III vertex` | Norwood III vertex — Crown thinning begins | नॉरवुड III व्हर्टेक्स — डोक्याच्या वरच्या भागात (क्राउन) विरळपणा सुरू |
| `Grade 2 — Norwood IIIa` | Norwood IIIa — Deeper anterior recession | नॉरवुड IIIa — पुढची हेअरलाइन आणखी मागे |
| `Grade 3 — Norwood IV` | Norwood IV — Hairline + vertex loss, bridge intact | नॉरवुड IV — हेअरलाइन आणि क्राउन दोन्ही बाधित, मधली पट्टी शिल्लक |
| `Grade 3 — Norwood IVa` | Norwood IVa — Anterior loss extends to mid-scalp | नॉरवुड IVa — पुढचा भाग डोक्याच्या मध्यापर्यंत रिकामा |
| `Grade 4 — Norwood V` | Norwood V — Hairline + vertex merging, bridge thinning | नॉरवुड V — पुढचा भाग आणि क्राउन जुळू लागले, मधली पट्टी विरळ |
| `Grade 4 — Norwood Va` | Norwood Va — Advanced anterior merging | नॉरवुड Va — पुढचा भाग बऱ्यापैकी जुळलेला |
| `Grade 5 — Norwood VI` | Norwood VI — Bridge gone, large bald zone | नॉरवुड VI — मधली पट्टी संपली, मोठा टक्कल पडलेला भाग |
| `Grade 5 — Norwood VII` | Norwood VII — Only horseshoe rim remains | नॉरवुड VII — फक्त कडेला केस शिल्लक |
| `Grade 1 — Ludwig 1` | Ludwig Grade 1 — Minimal thinning | लुडविग ग्रेड 1 — अगदी थोडा विरळपणा |
| `Grade 2 — Ludwig 2` | Ludwig Grade 2 — Slight central thinning | लुडविग ग्रेड 2 — भांगाजवळ थोडा विरळपणा |
| `Grade 3 — Ludwig III` | Ludwig III — Moderate thinning | लुडविग III — मध्यम विरळपणा |
| `Grade 3 — Ludwig I-1` | Ludwig I-1 — Increased thinning | लुडविग I-1 — वाढलेला विरळपणा |
| `Grade 4 — Ludwig II-1` | Ludwig II-1 — Advanced thinning | लुडविग II-1 — बराच जास्त विरळपणा |
| `Grade 5 — Ludwig III-1` | Ludwig III-1 — Severe thinning | लुडविग III-1 — अतिशय गंभीर विरळपणा |

### `extra` — textarea

**Clinical intent:** Open-ended notes surfaced verbatim to the reviewing doctor.

| Key | English | Marathi |
| --- | --- | --- |
| `extra.title` | Anything else Dr. FACT should know? (optional) | Dr. FACT ला आणखी काही सांगायचे आहे का? (ऐच्छिक) |
| `extra.placeholder` | Any other symptoms, medical history, treatments tried, or concerns... | इतर कोणतीही लक्षणे, आजार, केलेले उपचार किंवा काही चिंता… |

---

## Coverage

- Questions: 21 / 21
- Answer options: 114 / 114
- Chapter cards: 6 / 6

Enforced by `tests/localisation/assessment-locales.test.ts`, which fails
the build if any question, option or section loses its Marathi entry,
or if the pack retains a key the protocol no longer defines.

---

## TRANSLATION_REVIEW_REQUIRED

Items where the **English source** is unclear or wrong. Per the localisation
brief these were not silently rewritten — the Marathi renders the
clinically intended meaning, and the English needs a separate decision.

### 1. `hormonal` option `PCOS / PCOD only`

- **Original English label:** `PMOS / PCOS`
- **Problem:** `PMOS` is a typo. The stored answer code is `PCOS / PCOD only`,
  so the label and the code disagree, and `PMOS` is not a clinical entity.
- **Suggested improved English:** `PCOS / PCOD`
- **Hindi shipped:** `पीसीओएस / पीसीओडी` (renders the code's meaning, not the typo)
- **Action:** English label fix is a protocol edit; out of scope for a
  localisation change. Answer code must NOT change — it is in production data.

### 2. `scalp` option `Dandruff / white flakes`

- **Original English label:** `Dandruff`
- **Problem:** Label is narrower than the answer code, and sits next to
  `Dandruff + Itching + White flakes`, so "Dandruff" alone reads as the same
  thing minus symptoms. Patients cannot tell the two apart.
- **Suggested improved English:** `Dandruff / white flakes (no itching)`
- **Shipped:** `डँड्रफ (कोंडा)`
- **Action:** needs clinical sign-off before either language changes.

### 3. `count` / `hairtype` / `gut` option codes contain literal newlines

- **Problem:** several answer codes embed `\n` (e.g. `~20–50 strands\n(Normal range)`)
  because the original HTML questionnaire baked line breaks into the value.
- **Impact on localisation:** none — the Hindi pack keys match byte-for-byte and
  the test suite enforces it. Flagged so a future cleanup does not assume the
  codes are newline-free.
- **Action:** do not "tidy" these codes; they are in production data.
