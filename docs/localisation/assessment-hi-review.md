# Dr FACT Hair Assessment — Hindi Translation Review

> **Generated file — do not edit by hand.**
> Produced by `scripts/build-review-doc.mjs` from the live protocol
> (`questionnaire.schema.json`) and the Hindi content pack
> (`apps/patient-portal/src/lib/assessment-i18n/content/hi.ts`).
> Re-run the script after any change so this document can never describe
> wording the app no longer renders.

## How to review

You are reviewing the **Hindi** column only. The **Key** and **Answer code**
columns are internal identifiers — they are stored in the database and read
by the clinical engine, and they are deliberately identical in every
language. Changing them would change clinical meaning; changing the Hindi
changes only what the patient reads.

If a Hindi phrase is clinically wrong or hard for a patient to follow,
write the correction in the margin and we will apply it to the content pack.

**Voice rules applied:** respectful second person (`आप`);
patient-friendly Hindi over literal translation; familiar
Indian-English clinical terms retained where they read better; brand names
never translated (Dr. FACT, HairOS).

---

## S1_PATIENT_IDENTITY — About You

### Chapter card

| Key | English | Hindi |
| --- | --- | --- |
| `S1_PATIENT_IDENTITY.title` | About You | आपके बारे में |
| `S1_PATIENT_IDENTITY.body` | A few quick details so we can personalise the rest of the assessment. | कुछ छोटी जानकारियाँ, ताकि आगे का आकलन पूरी तरह आपके अनुसार हो सके। |

### `name` — text · required

**Clinical intent:** Patient identity for the report and doctor queue.

| Key | English | Hindi |
| --- | --- | --- |
| `name.title` | What is your full name? | आपका पूरा नाम क्या है? |
| `name.placeholder` | Your full name | आपका पूरा नाम |

### `age` — number · required

**Clinical intent:** Drives age-gated option filtering (e.g. greying goal hidden at 30+) and hormonal windows.

| Key | English | Hindi |
| --- | --- | --- |
| `age.title` | How old are you? | आपकी उम्र कितनी है? |
| `age.placeholder` | Your age in years | उम्र (वर्षों में) |

### `goal` — multi_select · required

**Clinical intent:** Primary treatment objective. Regrowth-only suppresses active-shedding analysis.

| Key | English | Hindi |
| --- | --- | --- |
| `goal.title` | What are your major concerns? | आपकी सबसे बड़ी चिंता क्या है? |
| `goal.exclusivityToast` | Regrowth-only mode replaces active shedding analysis. | अब सिर्फ़ नए बाल उगाने पर ध्यान रहेगा — चल रहे बाल झड़ने का विश्लेषण हटा दिया गया है। |

| Answer code (stored, never translated) | English label | Hindi label |
| --- | --- | --- |
| `Reduce hair fall and improve growth` | Reduce hair fall and improve quality & growth | बाल झड़ना कम हो और बालों की क्वालिटी व ग्रोथ बेहतर हो |
| `Hair fall is stopped but needs to regrow lost hair` | No active hair fall but need to better hair growth quality | अभी बाल झड़ नहीं रहे, पर बालों की ग्रोथ और क्वालिटी सुधारनी है |
| `Early greying of hair` | Early greying of hair | कम उम्र में बाल सफ़ेद होना |

### `sex` — single_select · required

**Clinical intent:** Gates Norwood vs Ludwig grading and every female-specific hormonal option.

| Key | English | Hindi |
| --- | --- | --- |
| `sex.title` | What is your gender? | आपका लिंग क्या है? |

| Answer code (stored, never translated) | English label | Hindi label |
| --- | --- | --- |
| `Male` | Male | पुरुष |
| `Female` | Female | महिला |
| `Other` | Other | अन्य |

---

## S2_HAIR_LOSS_ASSESSMENT — Hair History

### Chapter card

| Key | English | Hindi |
| --- | --- | --- |
| `S2_HAIR_LOSS_ASSESSMENT.title` | Hair History | बालों का इतिहास |
| `S2_HAIR_LOSS_ASSESSMENT.body` | These questions help us recognise the pattern, pace and texture of what you are experiencing. | ये सवाल यह समझने में मदद करते हैं कि आपके बाल किस तरह और किस रफ़्तार से झड़ रहे हैं। |

### `duration` — single_select

**Clinical intent:** Acute (1–3 mo) vs chronic shedding — drives TE GOLD eligibility.

| Key | English | Hindi |
| --- | --- | --- |
| `duration.title` | How long have you been experiencing hair loss? | आपको बाल झड़ने की समस्या कितने समय से है? |

| Answer code (stored, never translated) | English label | Hindi label |
| --- | --- | --- |
| `1–3 months` | 1–3 months | 1–3 महीने |
| `3–6 months` | 3–6 months | 3–6 महीने |
| `6–12 months` | 6–12 months | 6–12 महीने |
| `More than 1 year` | More than 1 year | 1 साल से ज़्यादा |

### `count` — single_select

**Clinical intent:** Shedding volume band; separates normal turnover from active telogen effluvium.

| Key | English | Hindi |
| --- | --- | --- |
| `count.title` | How much hair do you lose per day? | रोज़ाना कितने बाल झड़ते हैं? |

| Answer code (stored, never translated) | English label | Hindi label |
| --- | --- | --- |
| `~20–50 strands␊(Normal range)` | ~20–50 strands (Normal range) | लगभग 20–50 बाल (सामान्य) |
| `~50–100 strands␊(Noticeable)` | ~50–100 strands (Noticeable) | लगभग 50–100 बाल (साफ़ दिखता है) |
| `100+ strands␊(Heavy loss)` | 100+ strands (Heavy loss) | 100 से ज़्यादा बाल (बहुत ज़्यादा) |
| `Just thinning,␊no visible fall` | Just thinning, no visible fall | बाल पतले हो रहे हैं, झड़ते नहीं दिखते |

### `hairtype` — multi_select

**Clinical intent:** Shedding morphology — distinguishes diffuse TE from patterned loss and alopecia areata.

| Key | English | Hindi |
| --- | --- | --- |
| `hairtype.title` | What type of hair fall are you seeing? | बाल किस तरह झड़ रहे हैं? |

| Answer code (stored, never translated) | English label | Hindi label |
| --- | --- | --- |
| `Full-length hairs␊with white bulb` | Full-length hairs with white bulb | पूरे लंबे बाल, जड़ पर सफ़ेद बल्ब के साथ |
| `Hair on pillow /␊floor / shower` | Hair on pillow / floor / shower | तकिए, फ़र्श पर या नहाते समय बाल गिरना |
| `Widening parting␊or thinning` | Widening parting or thinning | माँग चौड़ी होना या बाल पतले होना |
| `Circular bald␊patches/␊Coin-sized␊bald spots` | Circular bald patches / Coin-sized bald spots | गोल खाली चकत्ते / सिक्के जितने गंजे धब्बे |
| `None of the above` | None of the above | इनमें से कोई नहीं |

---

## S3_SCALP_CONDITION — Symptoms

### Chapter card

| Key | English | Hindi |
| --- | --- | --- |
| `S3_SCALP_CONDITION.title` | Symptoms | लक्षण |
| `S3_SCALP_CONDITION.body` | The scalp environment is often the silent factor behind shedding. A few short questions ahead. | सिर की त्वचा अक्सर बाल झड़ने की छिपी हुई वजह होती है। आगे कुछ छोटे सवाल हैं। |

### `scalp` — multi_select · required

**Clinical intent:** Scalp environment: inflammation, seborrhoea, dandruff scoring.

| Key | English | Hindi |
| --- | --- | --- |
| `scalp.title` | What's your scalp like right now? | इस समय आपके सिर की त्वचा कैसी है? |

| Answer code (stored, never translated) | English label | Hindi label |
| --- | --- | --- |
| `Dandruff / white flakes` | Dandruff | डैंड्रफ (रूसी) |
| `Dandruff + Itching + White flakes` | Dandruff + Itching + White flakes | डैंड्रफ + खुजली + सफ़ेद पपड़ी |
| `Oily scalp` | Oily scalp | सिर की त्वचा तैलीय (ऑयली) |
| `Dry scalp` | Dry scalp | सिर की त्वचा रूखी (ड्राई) |
| `Redness or irritation` | Redness or irritation | लालपन या चुभन |
| `Boils or pimples` | Boils or pimples | फुंसियाँ या दाने |
| `Burning sensation` | Burning sensation | जलन महसूस होना |
| `Normal scalp` | Normal scalp | सामान्य — कोई दिक्कत नहीं |
| `Psoriasis / Inflammation` | Psoriasis / Inflammation | सोरायसिस / सूजन |

---

## S4_MEDICAL_HISTORY — Lifestyle

### Chapter card

| Key | English | Hindi |
| --- | --- | --- |
| `S4_MEDICAL_HISTORY.title` | Lifestyle | जीवनशैली |
| `S4_MEDICAL_HISTORY.body` | Sleep, stress and routines shape the growth cycle more than most people realise. | नींद, तनाव और रोज़ की आदतें बालों के विकास चक्र पर सोच से कहीं ज़्यादा असर डालती हैं। |

### `cause` — multi_select · required

**Clinical intent:** Patient-perceived aetiology; feeds cause ranking alongside objective signals.

| Key | English | Hindi |
| --- | --- | --- |
| `cause.title` | What do you think is the cause for your hair loss? | आपके अनुसार बाल झड़ने की वजह क्या हो सकती है? |

| Answer code (stored, never translated) | English label | Hindi label |
| --- | --- | --- |
| `Stress / Anxiety / Depression` | Stress / Anxiety / Depression | तनाव / घबराहट / डिप्रेशन |
| `Genetics / Family history` | Genetics / Family history | आनुवंशिक / परिवार में यह समस्या |
| `Nutritional deficiencies` | Nutritional deficiencies | पोषक तत्वों की कमी |
| `Medication / Recent Illness / Surgery` | Medication / Recent Illness / Surgery | कोई दवा / हाल की बीमारी / ऑपरेशन |
| `Post partum — still feeding` | Post partum — still feeding | प्रसव के बाद — अभी स्तनपान करा रही हैं |
| `Post partum — not feeding` | Post partum — not feeding | प्रसव के बाद — स्तनपान नहीं करा रहीं |
| `Hair pulling habit (Trichotillomania)` | Hair pulling habit (Trichotillomania) | बाल खींचने की आदत (ट्राइकोटिलोमेनिया) |
| `Hard water` | Hard water | खारा पानी (हार्ड वॉटर) |
| `Post GLP-1 receptor agonist (hair loss within 6 months)` | Post GLP-1 receptor agonist (hair loss within 6 months) | GLP-1 वज़न घटाने की दवा के बाद — 6 महीने के भीतर बाल झड़ना |
| `Post GLP-1 receptor agonist (hair loss after 6 months)` | Post GLP-1 receptor agonist (hair loss after 6 months) | GLP-1 वज़न घटाने की दवा के बाद — 6 महीने के बाद बाल झड़ना |
| `Post crash diet` | Rapid weight loss / Crash diet | तेज़ी से वज़न घटना / क्रैश डाइट |
| `Not sure` | Not sure | पता नहीं |
| `None of the above` | None of the above | इनमें से कोई नहीं |

### `immunity` — multi_select · required

**Clinical intent:** Autoimmune and atopic signals; alopecia areata detection.

| Key | English | Hindi |
| --- | --- | --- |
| `immunity.title` | Any immunity or skin-related issues? | इम्यूनिटी या त्वचा से जुड़ी कोई समस्या? |

| Answer code (stored, never translated) | English label | Hindi label |
| --- | --- | --- |
| `Frequent infections / cold / fever` | Frequent infections / cold / fever | बार-बार इन्फेक्शन / सर्दी-ज़ुकाम / बुख़ार |
| `Allergies` | Allergies | एलर्जी |
| `Asthma` | Asthma | अस्थमा (दमा) |
| `Skin rashes or eczema` | Skin rashes or eczema | त्वचा पर चकत्ते या एक्ज़िमा |
| `Recurrent Acne / Acne prone skin` | Recurrent Acne / Acne prone skin | बार-बार मुँहासे / मुँहासे वाली त्वचा |
| `Alopecia Areata (circular patches)` | Alopecia Areata (circular patches) | एलोपेसिया एरियाटा (गोल खाली चकत्ते) |
| `Mouth ulcers` | Mouth ulcers | मुँह के छाले |
| `None of the above` | None of the above | इनमें से कोई नहीं |

### `lifestyle` — multi_select · required

**Clinical intent:** Modifiable lifestyle drivers — metabolic, oxidative and circadian load.

| Key | English | Hindi |
| --- | --- | --- |
| `lifestyle.title` | How is your lifestyle? | आपकी जीवनशैली कैसी है? |

| Answer code (stored, never translated) | English label | Hindi label |
| --- | --- | --- |
| `Smoking / Vaping` | Smoking / Vaping | धूम्रपान / वेपिंग |
| `Alcohol (8–10×/month)` | Alcohol (8–10×/month) | शराब (महीने में 8–10 बार) |
| `Bodybuilding / Heavy gym` | Bodybuilding / Heavy gym | बॉडीबिल्डिंग / भारी जिम वर्कआउट |
| `Obesity / Sedentary / Struggle to lose weight / Slowly gaining weight` | Obesity / Struggle to lose weight | मोटापा / वज़न घटाने में मुश्किल |
| `Erratic / Outside eating (3–4×/week)` | Irregular eating time / Outside eating (3–4×/week) | खाने का समय अनियमित / बाहर का खाना (हफ़्ते में 3–4 बार) |
| `Night shift work` | Night shift work | रात की शिफ़्ट में काम |
| `Frequent flying` | Frequent flying | बार-बार हवाई यात्रा |
| `None of the above` | None of the above | इनमें से कोई नहीं |

### `thyroid` — multi_select · required

**Clinical intent:** Thyroid and glycaemic status. Mutually exclusive hypo/hyper pairs.

| Key | English | Hindi |
| --- | --- | --- |
| `thyroid.title` | Do you have either of the following conditions? | क्या इनमें से कोई समस्या आपको है? |
| `thyroid.exclusivityToast` | Selected the contradicting option — replacing the previous one. | यह विकल्प पिछले विकल्प के विपरीत है, इसलिए पिछला हटा दिया गया है। |

| Answer code (stored, never translated) | English label | Hindi label |
| --- | --- | --- |
| `Hypothyroidism` | Hypothyroidism | हाइपोथायरॉइड (थायरॉइड कम) |
| `Hyperthyroidism` | Hyperthyroidism | हाइपरथायरॉइड (थायरॉइड ज़्यादा) |
| `Pre diabetes` | Pre diabetes | प्री-डायबिटीज़ (शुगर बढ़ने की शुरुआत) |
| `Diabetes` | Diabetes | डायबिटीज़ (शुगर) |
| `Not Applicable` | Not Applicable | इनमें से कोई नहीं |

### `medical` — single_select · required

**Clinical intent:** Chronic-condition gate for the free-text follow-up below.

| Key | English | Hindi |
| --- | --- | --- |
| `medical.title` | Are you currently under treatment for any chronic medical condition? | क्या आप किसी पुरानी बीमारी का इलाज करा रहे हैं? |

| Answer code (stored, never translated) | English label | Hindi label |
| --- | --- | --- |
| `Yes, currently on medication` | Yes, currently on medication | हाँ, अभी दवा चल रही है |
| `No, no chronic conditions` | No, no chronic conditions | नहीं, कोई पुरानी बीमारी नहीं |

### `medical_detail` — text

**Clinical intent:** Free-text medication and condition capture for doctor review.

| Key | English | Hindi |
| --- | --- | --- |
| `medical_detail.title` | Please tell us which condition(s) you are being treated for and any medications you are currently taking: | बताएँ कि किस बीमारी का इलाज चल रहा है और आप कौन-सी दवाएँ ले रहे हैं: |
| `medical_detail.placeholder` | e.g. Hypothyroidism, Diabetes, BP — metformin, levothyroxine... | जैसे — थायरॉइड, डायबिटीज़, बीपी; दवाएँ — मेटफ़ॉर्मिन, लेवोथायरॉक्सिन… |

### `hormonal` — multi_select

**Clinical intent:** Female hormonal axis: PCOS, pregnancy, postpartum, menopause continuum.

| Key | English | Hindi |
| --- | --- | --- |
| `hormonal.title` | Any hormonal or reproductive health issues? | हार्मोन या महिला स्वास्थ्य से जुड़ी कोई समस्या? |
| `hormonal.exclusivityToast` | Selected the contradicting reproductive state — replacing the previous one. | यह स्थिति पिछले विकल्प से मेल नहीं खाती, इसलिए पिछला हटा दिया गया है। |

| Answer code (stored, never translated) | English label | Hindi label |
| --- | --- | --- |
| `PCOS / PCOD only` | PMOS / PCOS | पीसीओएस / पीसीओडी |
| `Endometriosis` | Endometriosis | एंडोमेट्रियोसिस |
| `Heavy bleeding periods` | Heavy bleeding periods | पीरियड्स में ज़्यादा ब्लीडिंग |
| `Currently pregnant` | Currently pregnant | अभी गर्भवती हैं |
| `Post-delivery or breastfeeding` | Post-delivery or breastfeeding | प्रसव के बाद या स्तनपान करा रही हैं |
| `Peri-menopause` | Peri-menopause | मेनोपॉज़ की शुरुआत (पेरी-मेनोपॉज़) |
| `Post-menopause` | Post-menopause | मेनोपॉज़ के बाद |
| `Hormone Replacement Therapy (HRT)` | Hormone Replacement Therapy (HRT) | हार्मोन रिप्लेसमेंट थेरेपी (HRT) |
| `Post-hysterectomy` | Post-hysterectomy | गर्भाशय निकलवाने के बाद |
| `None of the above` | None of the above | इनमें से कोई नहीं |

---

## S5_NUTRITION_AND_DIET — Nutrition, Diet & Treatments

### Chapter card

| Key | English | Hindi |
| --- | --- | --- |
| `S5_NUTRITION_AND_DIET.title` | Nutrition, Diet & Treatments | पोषण, खान-पान और ट्रीटमेंट |
| `S5_NUTRITION_AND_DIET.body` | Subtle nutritional gaps can mimic genetic loss. We are looking for the difference. | पोषण की हल्की कमी भी आनुवंशिक बाल झड़ने जैसी दिख सकती है। हम यही फ़र्क़ पहचान रहे हैं। |

### `gut` — multi_select · required

**Clinical intent:** Absorption capacity — GI GOLD trigger set is a strict subset of these.

| Key | English | Hindi |
| --- | --- | --- |
| `gut.title` | Any gut or digestive issues? | पेट या पाचन से जुड़ी कोई समस्या? |

| Answer code (stored, never translated) | English label | Hindi label |
| --- | --- | --- |
| `Bloating / gas` | Bloating / gas | पेट फूलना / गैस |
| `Constipation` | Constipation | कब्ज़ |
| `IBS / Crohn's` | IBS / Crohn's | आईबीएस / क्रोन्स |
| `Acid reflux␊(heartburn) /␊GERD␊(Chronic Heartburn)` | Acid reflux (heartburn) / GERD (Chronic Heartburn) | एसिडिटी, सीने में जलन / GERD (लगातार जलन) |
| `Indigestion` | Indigestion | अपच |
| `No gut issues` | No gut issues | पेट से जुड़ी कोई समस्या नहीं |

### `deficiency` — multi_select · required

**Clinical intent:** Confirmed lab deficiencies (iron, D3, B12).

| Key | English | Hindi |
| --- | --- | --- |
| `deficiency.title` | Any confirmed nutritional deficiencies? | जाँच में कोई पोषक तत्व की कमी पाई गई है? |

| Answer code (stored, never translated) | English label | Hindi label |
| --- | --- | --- |
| `Iron / Anaemia` | Iron / Anaemia | आयरन की कमी / एनीमिया |
| `Vitamin D3` | Vitamin D3 | विटामिन D3 |
| `Vitamin B12` | Vitamin B12 | विटामिन B12 |
| `None / Not tested` | None / Not tested | कोई नहीं / जाँच नहीं कराई |

### `diet` — multi_select · required

**Clinical intent:** Dietary pattern and protein adequacy.

| Key | English | Hindi |
| --- | --- | --- |
| `diet.title` | What best describes your diet? | आपका खान-पान कैसा है? |

| Answer code (stored, never translated) | English label | Hindi label |
| --- | --- | --- |
| `Normal diet` | Normal diet | सामान्य खान-पान |
| `Vegetarian` | Vegetarian | शाकाहारी |
| `Vegan` | Vegan | वीगन (कोई भी पशु-उत्पाद नहीं) |
| `Non-vegetarian` | Non-vegetarian | मांसाहारी |
| `Pescatarian` | Pescatarian | शाकाहारी, पर मछली खाते हैं |
| `High protein diet` | High protein diet | हाई-प्रोटीन डाइट |
| `Irregular / poor diet` | Irregular / poor diet | अनियमित या कमज़ोर खान-पान |
| `Crash Diet / Keto / IF` | Crash / Keto / Intermittent fasting | क्रैश डाइट / कीटो / इंटरमिटेंट फ़ास्टिंग |
| `None of the above` | None of the above | इनमें से कोई नहीं |

### `treatment` — multi_select · required

**Clinical intent:** Heat and chemical damage load on the shaft.

| Key | English | Hindi |
| --- | --- | --- |
| `treatment.title` | Any heat or chemical treatments on your hair? | बालों पर कोई हीट या केमिकल ट्रीटमेंट कराया है? |

| Answer code (stored, never translated) | English label | Hindi label |
| --- | --- | --- |
| `Heat styling (straightener etc.)` | Heat styling (straightener etc.) | हीट स्टाइलिंग (स्ट्रेटनर आदि) |
| `Chemical treatment (colour / keratin)` | Chemical treatment (colour / keratin) | केमिकल ट्रीटमेंट (कलर / केराटिन) |
| `No heat or chemical treatments` | No heat or chemical treatments | कोई हीट या केमिकल ट्रीटमेंट नहीं |

---

## S6_GRADE_AND_ADDITIONAL — The Final Picture

### Chapter card

| Key | English | Hindi |
| --- | --- | --- |
| `S6_GRADE_AND_ADDITIONAL.title` | The Final Picture | पूरी तस्वीर |
| `S6_GRADE_AND_ADDITIONAL.body` | A few final questions to complete your hair profile. | आपकी हेयर प्रोफ़ाइल पूरी करने के लिए कुछ आख़िरी सवाल। |

### `grade` — image_select

**Clinical intent:** Visual severity grade — Norwood (male) or Ludwig (female).

| Key | English | Hindi |
| --- | --- | --- |
| `grade.title` | Which image best describes your hair loss right now? | इनमें से कौन-सी तस्वीर आपकी अभी की स्थिति से सबसे ज़्यादा मिलती है? |

| Answer code (stored, never translated) | English label | Hindi label |
| --- | --- | --- |
| `Grade 1 — Norwood I` | Norwood I — No visible recession | नॉरवुड I — हेयरलाइन में कोई बदलाव नहीं |
| `Grade 1 — Norwood II` | Norwood II — Slight temporal recession | नॉरवुड II — कनपटी के पास हल्का पीछे हटना |
| `Grade 2 — Norwood IIa` | Norwood IIa — Anterior recession | नॉरवुड IIa — आगे की हेयरलाइन पीछे हटना |
| `Grade 2 — Norwood III` | Norwood III — Frontotemporal recession | नॉरवुड III — माथे और कनपटी, दोनों तरफ़ पीछे हटना |
| `Grade 2 — Norwood III vertex` | Norwood III vertex — Crown thinning begins | नॉरवुड III वर्टेक्स — सिर के ऊपरी हिस्से (क्राउन) में पतलापन शुरू |
| `Grade 2 — Norwood IIIa` | Norwood IIIa — Deeper anterior recession | नॉरवुड IIIa — आगे की हेयरलाइन और पीछे तक |
| `Grade 3 — Norwood IV` | Norwood IV — Hairline + vertex loss, bridge intact | नॉरवुड IV — हेयरलाइन और क्राउन दोनों प्रभावित, बीच की पट्टी बाक़ी |
| `Grade 3 — Norwood IVa` | Norwood IVa — Anterior loss extends to mid-scalp | नॉरवुड IVa — आगे का हिस्सा सिर के बीच तक खाली |
| `Grade 4 — Norwood V` | Norwood V — Hairline + vertex merging, bridge thinning | नॉरवुड V — आगे और क्राउन मिलने लगे, बीच की पट्टी पतली |
| `Grade 4 — Norwood Va` | Norwood Va — Advanced anterior merging | नॉरवुड Va — आगे का हिस्सा काफ़ी हद तक मिल चुका |
| `Grade 5 — Norwood VI` | Norwood VI — Bridge gone, large bald zone | नॉरवुड VI — बीच की पट्टी ख़त्म, बड़ा गंजा हिस्सा |
| `Grade 5 — Norwood VII` | Norwood VII — Only horseshoe rim remains | नॉरवुड VII — सिर्फ़ किनारों पर बाल बचे |
| `Grade 1 — Ludwig 1` | Ludwig Grade 1 — Minimal thinning | लुडविग ग्रेड 1 — बहुत हल्का पतलापन |
| `Grade 2 — Ludwig 2` | Ludwig Grade 2 — Slight central thinning | लुडविग ग्रेड 2 — माँग के आसपास हल्का पतलापन |
| `Grade 3 — Ludwig III` | Ludwig III — Moderate thinning | लुडविग III — मध्यम पतलापन |
| `Grade 3 — Ludwig I-1` | Ludwig I-1 — Increased thinning | लुडविग I-1 — पतलापन बढ़ा हुआ |
| `Grade 4 — Ludwig II-1` | Ludwig II-1 — Advanced thinning | लुडविग II-1 — काफ़ी ज़्यादा पतलापन |
| `Grade 5 — Ludwig III-1` | Ludwig III-1 — Severe thinning | लुडविग III-1 — बहुत गंभीर पतलापन |

### `extra` — textarea

**Clinical intent:** Open-ended notes surfaced verbatim to the reviewing doctor.

| Key | English | Hindi |
| --- | --- | --- |
| `extra.title` | Anything else Dr. FACT should know? (optional) | कुछ और जो Dr. FACT को जानना चाहिए? (वैकल्पिक) |
| `extra.placeholder` | Any other symptoms, medical history, treatments tried, or concerns... | कोई और लक्षण, बीमारी, आज़माए गए इलाज या कोई चिंता… |

---

## Coverage

- Questions: 21 / 21
- Answer options: 114 / 114
- Chapter cards: 6 / 6

Enforced by `tests/localisation/assessment-locales.test.ts`, which fails
the build if any question, option or section loses its Hindi entry,
or if the pack retains a key the protocol no longer defines.

---

## TRANSLATION_REVIEW_REQUIRED

Items where the **English source** is unclear or wrong. Per the localisation
brief these were not silently rewritten — the Hindi renders the
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
- **Shipped:** `डैंड्रफ (रूसी)`
- **Action:** needs clinical sign-off before either language changes.

### 3. `count` / `hairtype` / `gut` option codes contain literal newlines

- **Problem:** several answer codes embed `\n` (e.g. `~20–50 strands\n(Normal range)`)
  because the original HTML questionnaire baked line breaks into the value.
- **Impact on localisation:** none — the Hindi pack keys match byte-for-byte and
  the test suite enforces it. Flagged so a future cleanup does not assume the
  codes are newline-free.
- **Action:** do not "tidy" these codes; they are in production data.
