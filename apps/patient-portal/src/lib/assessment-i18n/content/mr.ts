/**
 * Marathi content pack for the hair assessment protocol.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * READ THIS BEFORE EDITING
 *
 * Every key in `options` is a canonical ANSWER CODE — the protocol's
 * `SchemaOption.value`, which the runtime stores in `answers` and every
 * clinical engine downstream reads. Some of these codes contain literal `\n`
 * (the original HTML questionnaire baked line breaks into the value). The keys
 * must match those strings byte-for-byte, newlines included, or the Marathi
 * label silently falls back to English.
 *
 * NEVER translate a key. Only ever translate the value.
 *
 * `tests/localisation/assessment-locales.test.ts` asserts that every question
 * and every option in the live protocol has a key here, and that no key here is
 * orphaned — so a protocol edit that renames an option fails the suite instead
 * of quietly degrading Marathi to English.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { AssessmentContentPack } from '../types';

export const mrContent: AssessmentContentPack = {
  // Chapter cards. Titles mirror the English chapter overrides in
  // AssessmentV3Journey (About You / Hair History / …), not the raw protocol
  // section titles, because those overrides are what the patient actually sees.
  sections: {
    S1_PATIENT_IDENTITY: {
      title: 'तुमच्याबद्दल',
      body: 'थोडक्यात काही माहिती, जेणेकरून पुढचे मूल्यांकन पूर्णपणे तुमच्यानुसार करता येईल.',
    },
    S2_HAIR_LOSS_ASSESSMENT: {
      title: 'केसांचा इतिहास',
      body: 'हे प्रश्न तुमचे केस कोणत्या प्रकारे आणि किती वेगाने गळत आहेत हे समजून घेण्यास मदत करतात.',
    },
    S3_SCALP_CONDITION: {
      title: 'लक्षणे',
      body: 'डोक्याची त्वचा हे केस गळण्यामागचे बऱ्याचदा दुर्लक्षित कारण असते. पुढे काही छोटे प्रश्न आहेत.',
    },
    S4_MEDICAL_HISTORY: {
      title: 'जीवनशैली',
      body: 'झोप, ताण आणि रोजच्या सवयी केसांच्या वाढीच्या चक्रावर वाटतो त्यापेक्षा खूप जास्त परिणाम करतात.',
    },
    S5_NUTRITION_AND_DIET: {
      title: 'पोषण, आहार आणि ट्रीटमेंट',
      body: 'पोषणाची थोडीशी कमतरतासुद्धा अनुवंशिक केसगळतीसारखी दिसू शकते. आम्ही नेमका हाच फरक ओळखत आहोत.',
    },
    S6_GRADE_AND_ADDITIONAL: {
      title: 'संपूर्ण चित्र',
      body: 'तुमचे केसांचे प्रोफाइल पूर्ण करण्यासाठी काही शेवटचे प्रश्न.',
    },
  },

  questions: {
    // ── S1 · Patient identity ────────────────────────────────────────────────
    name: {
      title: 'तुमचे पूर्ण नाव काय आहे?',
      placeholder: 'तुमचे पूर्ण नाव',
    },
    age: {
      title: 'तुमचे वय किती आहे?',
      placeholder: 'वय (वर्षांमध्ये)',
    },
    goal: {
      title: 'तुमची सर्वात मोठी चिंता कोणती आहे?',
      exclusivityToast:
        'आता फक्त नवीन केस उगवण्यावर लक्ष राहील — सुरू असलेल्या केसगळतीचे विश्लेषण काढून टाकले आहे.',
      options: {
        'Reduce hair fall and improve growth':
          'केस गळणे कमी व्हावे आणि केसांचा दर्जा व वाढ सुधारावी',
        'Hair fall is stopped but needs to regrow lost hair':
          'सध्या केस गळत नाहीत, पण केसांची वाढ आणि दर्जा सुधारायचा आहे',
        'Early greying of hair': 'कमी वयात केस पांढरे होणे',
      },
    },
    sex: {
      title: 'तुमचे लिंग काय आहे?',
      options: {
        Male: 'पुरुष',
        Female: 'स्त्री',
        Other: 'इतर',
      },
    },

    // ── S2 · Hair loss assessment ────────────────────────────────────────────
    duration: {
      title: 'तुम्हाला केस गळण्याचा त्रास किती काळापासून आहे?',
      options: {
        '1–3 months': '1–3 महिने',
        '3–6 months': '3–6 महिने',
        '6–12 months': '6–12 महिने',
        'More than 1 year': '1 वर्षापेक्षा जास्त',
      },
    },
    count: {
      title: 'दररोज किती केस गळतात?',
      options: {
        '~20–50 strands\n(Normal range)': 'साधारण 20–50 केस (सामान्य)',
        '~50–100 strands\n(Noticeable)': 'साधारण 50–100 केस (स्पष्ट जाणवते)',
        '100+ strands\n(Heavy loss)': '100 पेक्षा जास्त केस (खूप जास्त)',
        'Just thinning,\nno visible fall': 'केस विरळ होत आहेत, गळताना दिसत नाहीत',
      },
    },
    hairtype: {
      title: 'केस कोणत्या प्रकारे गळत आहेत?',
      options: {
        'Full-length hairs\nwith white bulb': 'पूर्ण लांब केस, मुळाशी पांढरा बल्ब असलेले',
        'Hair on pillow /\nfloor / shower': 'उशीवर, जमिनीवर किंवा आंघोळीच्या वेळी केस पडणे',
        'Widening parting\nor thinning': 'भांग रुंद होणे किंवा केस विरळ होणे',
        'Circular bald\npatches/\nCoin-sized\nbald spots': 'गोल टक्कल पडलेले चट्टे / नाण्याएवढे टक्कल',
        'None of the above': 'यापैकी काहीही नाही',
      },
    },

    // ── S3 · Scalp condition ─────────────────────────────────────────────────
    scalp: {
      title: 'सध्या तुमच्या डोक्याची त्वचा कशी आहे?',
      options: {
        'Dandruff / white flakes': 'डँड्रफ (कोंडा)',
        'Dandruff + Itching + White flakes': 'डँड्रफ + खाज + पांढरा कोंडा',
        'Oily scalp': 'डोक्याची त्वचा तेलकट',
        'Dry scalp': 'डोक्याची त्वचा कोरडी',
        'Redness or irritation': 'लालसरपणा किंवा टोचल्यासारखे वाटणे',
        'Boils or pimples': 'फोड किंवा पुरळ',
        'Burning sensation': 'जळजळ होणे',
        'Normal scalp': 'सामान्य — काहीही त्रास नाही',
        'Psoriasis / Inflammation': 'सोरायसिस / सूज',
      },
    },

    // ── S4 · Medical history & causes ────────────────────────────────────────
    cause: {
      title: 'तुमच्या मते केस गळण्याचे कारण काय असू शकते?',
      options: {
        'Stress / Anxiety / Depression': 'ताण / चिंता / नैराश्य',
        'Genetics / Family history': 'अनुवंशिक / घरात हा त्रास असणे',
        'Nutritional deficiencies': 'पोषक घटकांची कमतरता',
        'Medication / Recent Illness / Surgery': 'एखादे औषध / अलीकडचा आजार / शस्त्रक्रिया',
        'Post partum — still feeding': 'बाळंतपणानंतर — सध्या स्तनपान सुरू आहे',
        'Post partum — not feeding': 'बाळंतपणानंतर — स्तनपान सुरू नाही',
        'Hair pulling habit (Trichotillomania)': 'केस ओढण्याची सवय (ट्रायकोटिलोमेनिया)',
        'Hard water': 'खारे पाणी (हार्ड वॉटर)',
        'Post GLP-1 receptor agonist (hair loss within 6 months)':
          'GLP-1 वजन कमी करण्याच्या औषधानंतर — 6 महिन्यांच्या आत केस गळणे',
        'Post GLP-1 receptor agonist (hair loss after 6 months)':
          'GLP-1 वजन कमी करण्याच्या औषधानंतर — 6 महिन्यांनंतर केस गळणे',
        'Post crash diet': 'झपाट्याने वजन कमी होणे / क्रॅश डाएट',
        'Not sure': 'माहीत नाही',
        'None of the above': 'यापैकी काहीही नाही',
      },
    },
    immunity: {
      title: 'प्रतिकारशक्ती किंवा त्वचेशी संबंधित काही त्रास आहे का?',
      options: {
        'Frequent infections / cold / fever': 'वारंवार इन्फेक्शन / सर्दी-पडसे / ताप',
        Allergies: 'ॲलर्जी',
        Asthma: 'दमा (अस्थमा)',
        'Skin rashes or eczema': 'त्वचेवर पुरळ किंवा एक्झिमा',
        'Recurrent Acne / Acne prone skin': 'वारंवार मुरुमे / मुरुमांची त्वचा',
        'Alopecia Areata (circular patches)': 'ॲलोपेशिया एरियाटा (गोल टक्कल पडलेले चट्टे)',
        'Mouth ulcers': 'तोंड येणे (तोंडात फोड)',
        'None of the above': 'यापैकी काहीही नाही',
      },
    },
    lifestyle: {
      title: 'तुमची जीवनशैली कशी आहे?',
      options: {
        'Smoking / Vaping': 'धूम्रपान / व्हेपिंग',
        'Alcohol (8–10×/month)': 'मद्यपान (महिन्यातून 8–10 वेळा)',
        'Bodybuilding / Heavy gym': 'बॉडीबिल्डिंग / जड जिम व्यायाम',
        'Obesity / Sedentary / Struggle to lose weight / Slowly gaining weight':
          'लठ्ठपणा / वजन कमी करण्यात अडचण',
        'Erratic / Outside eating (3–4×/week)':
          'जेवणाच्या वेळा अनियमित / बाहेरचे खाणे (आठवड्यातून 3–4 वेळा)',
        'Night shift work': 'रात्रपाळीचे काम',
        'Frequent flying': 'वारंवार विमान प्रवास',
        'None of the above': 'यापैकी काहीही नाही',
      },
    },
    thyroid: {
      title: 'यापैकी कोणता त्रास तुम्हाला आहे का?',
      exclusivityToast: 'हा पर्याय आधीच्या पर्यायाच्या विरुद्ध आहे, म्हणून आधीचा काढून टाकला आहे.',
      options: {
        Hypothyroidism: 'हायपोथायरॉइड (थायरॉइड कमी)',
        Hyperthyroidism: 'हायपरथायरॉइड (थायरॉइड जास्त)',
        'Pre diabetes': 'प्री-डायबेटिस (साखर वाढण्याची सुरुवात)',
        Diabetes: 'मधुमेह (डायबेटिस)',
        'Not Applicable': 'यापैकी काहीही नाही',
      },
    },
    medical: {
      title: 'तुम्ही कोणत्या जुन्या आजारावर उपचार घेत आहात का?',
      options: {
        'Yes, currently on medication': 'होय, सध्या औषधे सुरू आहेत',
        'No, no chronic conditions': 'नाही, कोणताही जुना आजार नाही',
      },
    },
    medical_detail: {
      title: 'कोणत्या आजारावर उपचार सुरू आहेत आणि तुम्ही कोणती औषधे घेत आहात ते सांगा:',
      placeholder: 'उदा. — थायरॉइड, मधुमेह, बीपी; औषधे — मेटफॉर्मिन, लेव्होथायरॉक्सिन…',
    },
    hormonal: {
      title: 'हार्मोन किंवा स्त्री-आरोग्याशी संबंधित काही त्रास आहे का?',
      exclusivityToast: 'ही स्थिती आधीच्या पर्यायाशी जुळत नाही, म्हणून आधीचा काढून टाकला आहे.',
      options: {
        'PCOS / PCOD only': 'पीसीओएस / पीसीओडी',
        Endometriosis: 'एंडोमेट्रिओसिस',
        'Heavy bleeding periods': 'पाळीत जास्त रक्तस्राव',
        'Currently pregnant': 'सध्या गर्भवती आहे',
        'Post-delivery or breastfeeding': 'बाळंतपणानंतर किंवा स्तनपान सुरू आहे',
        'Peri-menopause': 'मेनोपॉजची सुरुवात (पेरी-मेनोपॉज)',
        'Post-menopause': 'मेनोपॉजनंतर',
        'Hormone Replacement Therapy (HRT)': 'हार्मोन रिप्लेसमेंट थेरपी (HRT)',
        'Post-hysterectomy': 'गर्भाशय काढल्यानंतर',
        'None of the above': 'यापैकी काहीही नाही',
      },
    },

    // ── S5 · Nutrition, diet & treatments ────────────────────────────────────
    gut: {
      title: 'पोट किंवा पचनाशी संबंधित काही त्रास आहे का?',
      options: {
        'Bloating / gas': 'पोट फुगणे / गॅस',
        Constipation: 'बद्धकोष्ठता',
        "IBS / Crohn's": 'आयबीएस / क्रोन्स',
        'Acid reflux\n(heartburn) /\nGERD\n(Chronic Heartburn)':
          'ॲसिडिटी, छातीत जळजळ / GERD (सतत जळजळ)',
        Indigestion: 'अपचन',
        'No gut issues': 'पोटाशी संबंधित काहीही त्रास नाही',
      },
    },
    deficiency: {
      title: 'तपासणीत पोषक घटकांची काही कमतरता आढळली आहे का?',
      options: {
        'Iron / Anaemia': 'लोहाची कमतरता / ॲनिमिया',
        'Vitamin D3': 'व्हिटॅमिन D3',
        'Vitamin B12': 'व्हिटॅमिन B12',
        'None / Not tested': 'काहीही नाही / तपासणी केलेली नाही',
      },
    },
    diet: {
      title: 'तुमचा आहार कसा आहे?',
      options: {
        'Normal diet': 'सर्वसाधारण आहार',
        Vegetarian: 'शाकाहारी',
        Vegan: 'व्हीगन (कोणतेही प्राणिजन्य पदार्थ नाहीत)',
        'Non-vegetarian': 'मांसाहारी',
        Pescatarian: 'शाकाहारी, पण मासे खातो/खाते',
        'High protein diet': 'हाय-प्रोटीन आहार',
        'Irregular / poor diet': 'अनियमित किंवा कमकुवत आहार',
        'Crash Diet / Keto / IF': 'क्रॅश डाएट / कीटो / इंटरमिटंट फास्टिंग',
        'None of the above': 'यापैकी काहीही नाही',
      },
    },
    treatment: {
      title: 'केसांवर कोणतेही हीट किंवा केमिकल ट्रीटमेंट केले आहे का?',
      options: {
        'Heat styling (straightener etc.)': 'हीट स्टाइलिंग (स्ट्रेटनर वगैरे)',
        'Chemical treatment (colour / keratin)': 'केमिकल ट्रीटमेंट (कलर / केरॅटिन)',
        'No heat or chemical treatments': 'कोणतेही हीट किंवा केमिकल ट्रीटमेंट नाही',
      },
    },

    // ── S6 · Grade & additional notes ────────────────────────────────────────
    // Norwood / Ludwig are clinical scale names — kept as proper nouns in
    // Devanagari transliteration, with the descriptor translated.
    grade: {
      title: 'यापैकी कोणते चित्र तुमच्या सध्याच्या स्थितीशी सर्वात जास्त जुळते?',
      options: {
        'Grade 1 — Norwood I': 'नॉरवुड I — हेअरलाइनमध्ये कोणताही बदल नाही',
        'Grade 1 — Norwood II': 'नॉरवुड II — कानशिलाजवळ थोडे मागे सरकणे',
        'Grade 2 — Norwood IIa': 'नॉरवुड IIa — पुढची हेअरलाइन मागे सरकणे',
        'Grade 2 — Norwood III': 'नॉरवुड III — कपाळ आणि कानशिल, दोन्हीकडे मागे सरकणे',
        'Grade 2 — Norwood III vertex': 'नॉरवुड III व्हर्टेक्स — डोक्याच्या वरच्या भागात (क्राउन) विरळपणा सुरू',
        'Grade 2 — Norwood IIIa': 'नॉरवुड IIIa — पुढची हेअरलाइन आणखी मागे',
        'Grade 3 — Norwood IV': 'नॉरवुड IV — हेअरलाइन आणि क्राउन दोन्ही बाधित, मधली पट्टी शिल्लक',
        'Grade 3 — Norwood IVa': 'नॉरवुड IVa — पुढचा भाग डोक्याच्या मध्यापर्यंत रिकामा',
        'Grade 4 — Norwood V': 'नॉरवुड V — पुढचा भाग आणि क्राउन जुळू लागले, मधली पट्टी विरळ',
        'Grade 4 — Norwood Va': 'नॉरवुड Va — पुढचा भाग बऱ्यापैकी जुळलेला',
        'Grade 5 — Norwood VI': 'नॉरवुड VI — मधली पट्टी संपली, मोठा टक्कल पडलेला भाग',
        'Grade 5 — Norwood VII': 'नॉरवुड VII — फक्त कडेला केस शिल्लक',
        'Grade 1 — Ludwig 1': 'लुडविग ग्रेड 1 — अगदी थोडा विरळपणा',
        'Grade 2 — Ludwig 2': 'लुडविग ग्रेड 2 — भांगाजवळ थोडा विरळपणा',
        'Grade 3 — Ludwig III': 'लुडविग III — मध्यम विरळपणा',
        'Grade 3 — Ludwig I-1': 'लुडविग I-1 — वाढलेला विरळपणा',
        'Grade 4 — Ludwig II-1': 'लुडविग II-1 — बराच जास्त विरळपणा',
        'Grade 5 — Ludwig III-1': 'लुडविग III-1 — अतिशय गंभीर विरळपणा',
      },
    },
    extra: {
      title: 'Dr. FACT ला आणखी काही सांगायचे आहे का? (ऐच्छिक)',
      placeholder: 'इतर कोणतीही लक्षणे, आजार, केलेले उपचार किंवा काही चिंता…',
    },
  },
};
