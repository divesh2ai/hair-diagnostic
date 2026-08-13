/**
 * Hindi content pack for the hair assessment protocol.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * READ THIS BEFORE EDITING
 *
 * Every key in `options` is a canonical ANSWER CODE — the protocol's
 * `SchemaOption.value`, which the runtime stores in `answers` and every
 * clinical engine downstream reads. Some of these codes contain literal `\n`
 * (the original HTML questionnaire baked line breaks into the value). The keys
 * must match those strings byte-for-byte, newlines included, or the Hindi label
 * silently falls back to English.
 *
 * NEVER translate a key. Only ever translate the value.
 *
 * `tests/localisation/assessment-hi.test.ts` asserts that every question and
 * every option in the live protocol has a key here, and that no key here is
 * orphaned — so a protocol edit that renames an option fails the suite instead
 * of quietly degrading Hindi to English.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { AssessmentContentPack } from '../types';

export const hiContent: AssessmentContentPack = {
  // Chapter cards. Titles mirror the English chapter overrides in
  // AssessmentV3Journey (About You / Hair History / …), not the raw protocol
  // section titles, because those overrides are what the patient actually sees.
  sections: {
    S1_PATIENT_IDENTITY: {
      title: 'आपके बारे में',
      body: 'कुछ छोटी जानकारियाँ, ताकि आगे का आकलन पूरी तरह आपके अनुसार हो सके।',
    },
    S2_HAIR_LOSS_ASSESSMENT: {
      title: 'बालों का इतिहास',
      body: 'ये सवाल यह समझने में मदद करते हैं कि आपके बाल किस तरह और किस रफ़्तार से झड़ रहे हैं।',
    },
    S3_SCALP_CONDITION: {
      title: 'लक्षण',
      body: 'सिर की त्वचा अक्सर बाल झड़ने की छिपी हुई वजह होती है। आगे कुछ छोटे सवाल हैं।',
    },
    S4_MEDICAL_HISTORY: {
      title: 'जीवनशैली',
      body: 'नींद, तनाव और रोज़ की आदतें बालों के विकास चक्र पर सोच से कहीं ज़्यादा असर डालती हैं।',
    },
    S5_NUTRITION_AND_DIET: {
      title: 'पोषण, खान-पान और ट्रीटमेंट',
      body: 'पोषण की हल्की कमी भी आनुवंशिक बाल झड़ने जैसी दिख सकती है। हम यही फ़र्क़ पहचान रहे हैं।',
    },
    S6_GRADE_AND_ADDITIONAL: {
      title: 'पूरी तस्वीर',
      body: 'आपकी हेयर प्रोफ़ाइल पूरी करने के लिए कुछ आख़िरी सवाल।',
    },
  },

  questions: {
    // ── S1 · Patient identity ────────────────────────────────────────────────
    name: {
      title: 'आपका पूरा नाम क्या है?',
      placeholder: 'आपका पूरा नाम',
    },
    age: {
      title: 'आपकी उम्र कितनी है?',
      placeholder: 'उम्र (वर्षों में)',
    },
    goal: {
      title: 'आपकी सबसे बड़ी चिंता क्या है?',
      exclusivityToast:
        'अब सिर्फ़ नए बाल उगाने पर ध्यान रहेगा — चल रहे बाल झड़ने का विश्लेषण हटा दिया गया है।',
      options: {
        'Reduce hair fall and improve growth':
          'बाल झड़ना कम हो और बालों की क्वालिटी व ग्रोथ बेहतर हो',
        'Hair fall is stopped but needs to regrow lost hair':
          'अभी बाल झड़ नहीं रहे, पर बालों की ग्रोथ और क्वालिटी सुधारनी है',
        'Early greying of hair': 'कम उम्र में बाल सफ़ेद होना',
      },
    },
    sex: {
      title: 'आपका लिंग क्या है?',
      options: {
        Male: 'पुरुष',
        Female: 'महिला',
        Other: 'अन्य',
      },
    },

    // ── S2 · Hair loss assessment ────────────────────────────────────────────
    duration: {
      title: 'आपको बाल झड़ने की समस्या कितने समय से है?',
      options: {
        '1–3 months': '1–3 महीने',
        '3–6 months': '3–6 महीने',
        '6–12 months': '6–12 महीने',
        'More than 1 year': '1 साल से ज़्यादा',
      },
    },
    count: {
      title: 'रोज़ाना कितने बाल झड़ते हैं?',
      options: {
        '~20–50 strands\n(Normal range)': 'लगभग 20–50 बाल (सामान्य)',
        '~50–100 strands\n(Noticeable)': 'लगभग 50–100 बाल (साफ़ दिखता है)',
        '100+ strands\n(Heavy loss)': '100 से ज़्यादा बाल (बहुत ज़्यादा)',
        'Just thinning,\nno visible fall': 'बाल पतले हो रहे हैं, झड़ते नहीं दिखते',
      },
    },
    hairtype: {
      title: 'बाल किस तरह झड़ रहे हैं?',
      options: {
        'Full-length hairs\nwith white bulb': 'पूरे लंबे बाल, जड़ पर सफ़ेद बल्ब के साथ',
        'Hair on pillow /\nfloor / shower': 'तकिए, फ़र्श पर या नहाते समय बाल गिरना',
        'Widening parting\nor thinning': 'माँग चौड़ी होना या बाल पतले होना',
        'Circular bald\npatches/\nCoin-sized\nbald spots': 'गोल खाली चकत्ते / सिक्के जितने गंजे धब्बे',
        'None of the above': 'इनमें से कोई नहीं',
      },
    },

    // ── S3 · Scalp condition ─────────────────────────────────────────────────
    scalp: {
      title: 'इस समय आपके सिर की त्वचा कैसी है?',
      options: {
        'Dandruff / white flakes': 'डैंड्रफ (रूसी)',
        'Dandruff + Itching + White flakes': 'डैंड्रफ + खुजली + सफ़ेद पपड़ी',
        'Oily scalp': 'सिर की त्वचा तैलीय (ऑयली)',
        'Dry scalp': 'सिर की त्वचा रूखी (ड्राई)',
        'Redness or irritation': 'लालपन या चुभन',
        'Boils or pimples': 'फुंसियाँ या दाने',
        'Burning sensation': 'जलन महसूस होना',
        'Normal scalp': 'सामान्य — कोई दिक्कत नहीं',
        'Psoriasis / Inflammation': 'सोरायसिस / सूजन',
      },
    },

    // ── S4 · Medical history & causes ────────────────────────────────────────
    cause: {
      title: 'आपके अनुसार बाल झड़ने की वजह क्या हो सकती है?',
      options: {
        'Stress / Anxiety / Depression': 'तनाव / घबराहट / डिप्रेशन',
        'Genetics / Family history': 'आनुवंशिक / परिवार में यह समस्या',
        'Nutritional deficiencies': 'पोषक तत्वों की कमी',
        'Medication / Recent Illness / Surgery': 'कोई दवा / हाल की बीमारी / ऑपरेशन',
        'Post partum — still feeding': 'प्रसव के बाद — अभी स्तनपान करा रही हैं',
        'Post partum — not feeding': 'प्रसव के बाद — स्तनपान नहीं करा रहीं',
        'Hair pulling habit (Trichotillomania)': 'बाल खींचने की आदत (ट्राइकोटिलोमेनिया)',
        'Hard water': 'खारा पानी (हार्ड वॉटर)',
        'Post GLP-1 receptor agonist (hair loss within 6 months)':
          'GLP-1 वज़न घटाने की दवा के बाद — 6 महीने के भीतर बाल झड़ना',
        'Post GLP-1 receptor agonist (hair loss after 6 months)':
          'GLP-1 वज़न घटाने की दवा के बाद — 6 महीने के बाद बाल झड़ना',
        'Post crash diet': 'तेज़ी से वज़न घटना / क्रैश डाइट',
        'Not sure': 'पता नहीं',
        'None of the above': 'इनमें से कोई नहीं',
      },
    },
    immunity: {
      title: 'इम्यूनिटी या त्वचा से जुड़ी कोई समस्या?',
      options: {
        'Frequent infections / cold / fever': 'बार-बार इन्फेक्शन / सर्दी-ज़ुकाम / बुख़ार',
        Allergies: 'एलर्जी',
        Asthma: 'अस्थमा (दमा)',
        'Skin rashes or eczema': 'त्वचा पर चकत्ते या एक्ज़िमा',
        'Recurrent Acne / Acne prone skin': 'बार-बार मुँहासे / मुँहासे वाली त्वचा',
        'Alopecia Areata (circular patches)': 'एलोपेसिया एरियाटा (गोल खाली चकत्ते)',
        'Mouth ulcers': 'मुँह के छाले',
        'None of the above': 'इनमें से कोई नहीं',
      },
    },
    lifestyle: {
      title: 'आपकी जीवनशैली कैसी है?',
      options: {
        'Smoking / Vaping': 'धूम्रपान / वेपिंग',
        'Alcohol (8–10×/month)': 'शराब (महीने में 8–10 बार)',
        'Bodybuilding / Heavy gym': 'बॉडीबिल्डिंग / भारी जिम वर्कआउट',
        'Obesity / Sedentary / Struggle to lose weight / Slowly gaining weight':
          'मोटापा / वज़न घटाने में मुश्किल',
        'Erratic / Outside eating (3–4×/week)':
          'खाने का समय अनियमित / बाहर का खाना (हफ़्ते में 3–4 बार)',
        'Night shift work': 'रात की शिफ़्ट में काम',
        'Frequent flying': 'बार-बार हवाई यात्रा',
        'None of the above': 'इनमें से कोई नहीं',
      },
    },
    thyroid: {
      title: 'क्या इनमें से कोई समस्या आपको है?',
      exclusivityToast: 'यह विकल्प पिछले विकल्प के विपरीत है, इसलिए पिछला हटा दिया गया है।',
      options: {
        Hypothyroidism: 'हाइपोथायरॉइड (थायरॉइड कम)',
        Hyperthyroidism: 'हाइपरथायरॉइड (थायरॉइड ज़्यादा)',
        'Pre diabetes': 'प्री-डायबिटीज़ (शुगर बढ़ने की शुरुआत)',
        Diabetes: 'डायबिटीज़ (शुगर)',
        'Not Applicable': 'इनमें से कोई नहीं',
      },
    },
    medical: {
      title: 'क्या आप किसी पुरानी बीमारी का इलाज करा रहे हैं?',
      options: {
        'Yes, currently on medication': 'हाँ, अभी दवा चल रही है',
        'No, no chronic conditions': 'नहीं, कोई पुरानी बीमारी नहीं',
      },
    },
    medical_detail: {
      title: 'बताएँ कि किस बीमारी का इलाज चल रहा है और आप कौन-सी दवाएँ ले रहे हैं:',
      placeholder: 'जैसे — थायरॉइड, डायबिटीज़, बीपी; दवाएँ — मेटफ़ॉर्मिन, लेवोथायरॉक्सिन…',
    },
    hormonal: {
      title: 'हार्मोन या महिला स्वास्थ्य से जुड़ी कोई समस्या?',
      exclusivityToast: 'यह स्थिति पिछले विकल्प से मेल नहीं खाती, इसलिए पिछला हटा दिया गया है।',
      options: {
        'PCOS / PCOD only': 'पीसीओएस / पीसीओडी',
        Endometriosis: 'एंडोमेट्रियोसिस',
        'Heavy bleeding periods': 'पीरियड्स में ज़्यादा ब्लीडिंग',
        'Currently pregnant': 'अभी गर्भवती हैं',
        'Post-delivery or breastfeeding': 'प्रसव के बाद या स्तनपान करा रही हैं',
        'Peri-menopause': 'मेनोपॉज़ की शुरुआत (पेरी-मेनोपॉज़)',
        'Post-menopause': 'मेनोपॉज़ के बाद',
        'Hormone Replacement Therapy (HRT)': 'हार्मोन रिप्लेसमेंट थेरेपी (HRT)',
        'Post-hysterectomy': 'गर्भाशय निकलवाने के बाद',
        'None of the above': 'इनमें से कोई नहीं',
      },
    },

    // ── S5 · Nutrition, diet & treatments ────────────────────────────────────
    gut: {
      title: 'पेट या पाचन से जुड़ी कोई समस्या?',
      options: {
        'Bloating / gas': 'पेट फूलना / गैस',
        Constipation: 'कब्ज़',
        "IBS / Crohn's": 'आईबीएस / क्रोन्स',
        'Acid reflux\n(heartburn) /\nGERD\n(Chronic Heartburn)':
          'एसिडिटी, सीने में जलन / GERD (लगातार जलन)',
        Indigestion: 'अपच',
        'No gut issues': 'पेट से जुड़ी कोई समस्या नहीं',
      },
    },
    deficiency: {
      title: 'जाँच में कोई पोषक तत्व की कमी पाई गई है?',
      options: {
        'Iron / Anaemia': 'आयरन की कमी / एनीमिया',
        'Vitamin D3': 'विटामिन D3',
        'Vitamin B12': 'विटामिन B12',
        'None / Not tested': 'कोई नहीं / जाँच नहीं कराई',
      },
    },
    diet: {
      title: 'आपका खान-पान कैसा है?',
      options: {
        'Normal diet': 'सामान्य खान-पान',
        Vegetarian: 'शाकाहारी',
        Vegan: 'वीगन (कोई भी पशु-उत्पाद नहीं)',
        'Non-vegetarian': 'मांसाहारी',
        Pescatarian: 'शाकाहारी, पर मछली खाते हैं',
        'High protein diet': 'हाई-प्रोटीन डाइट',
        'Irregular / poor diet': 'अनियमित या कमज़ोर खान-पान',
        'Crash Diet / Keto / IF': 'क्रैश डाइट / कीटो / इंटरमिटेंट फ़ास्टिंग',
        'None of the above': 'इनमें से कोई नहीं',
      },
    },
    treatment: {
      title: 'बालों पर कोई हीट या केमिकल ट्रीटमेंट कराया है?',
      options: {
        'Heat styling (straightener etc.)': 'हीट स्टाइलिंग (स्ट्रेटनर आदि)',
        'Chemical treatment (colour / keratin)': 'केमिकल ट्रीटमेंट (कलर / केराटिन)',
        'No heat or chemical treatments': 'कोई हीट या केमिकल ट्रीटमेंट नहीं',
      },
    },

    // ── S6 · Grade & additional notes ────────────────────────────────────────
    // Norwood / Ludwig are clinical scale names — kept as proper nouns in
    // Devanagari transliteration, with the descriptor translated.
    grade: {
      title: 'इनमें से कौन-सी तस्वीर आपकी अभी की स्थिति से सबसे ज़्यादा मिलती है?',
      options: {
        'Grade 1 — Norwood I': 'नॉरवुड I — हेयरलाइन में कोई बदलाव नहीं',
        'Grade 1 — Norwood II': 'नॉरवुड II — कनपटी के पास हल्का पीछे हटना',
        'Grade 2 — Norwood IIa': 'नॉरवुड IIa — आगे की हेयरलाइन पीछे हटना',
        'Grade 2 — Norwood III': 'नॉरवुड III — माथे और कनपटी, दोनों तरफ़ पीछे हटना',
        'Grade 2 — Norwood III vertex': 'नॉरवुड III वर्टेक्स — सिर के ऊपरी हिस्से (क्राउन) में पतलापन शुरू',
        'Grade 2 — Norwood IIIa': 'नॉरवुड IIIa — आगे की हेयरलाइन और पीछे तक',
        'Grade 3 — Norwood IV': 'नॉरवुड IV — हेयरलाइन और क्राउन दोनों प्रभावित, बीच की पट्टी बाक़ी',
        'Grade 3 — Norwood IVa': 'नॉरवुड IVa — आगे का हिस्सा सिर के बीच तक खाली',
        'Grade 4 — Norwood V': 'नॉरवुड V — आगे और क्राउन मिलने लगे, बीच की पट्टी पतली',
        'Grade 4 — Norwood Va': 'नॉरवुड Va — आगे का हिस्सा काफ़ी हद तक मिल चुका',
        'Grade 5 — Norwood VI': 'नॉरवुड VI — बीच की पट्टी ख़त्म, बड़ा गंजा हिस्सा',
        'Grade 5 — Norwood VII': 'नॉरवुड VII — सिर्फ़ किनारों पर बाल बचे',
        'Grade 1 — Ludwig 1': 'लुडविग ग्रेड 1 — बहुत हल्का पतलापन',
        'Grade 2 — Ludwig 2': 'लुडविग ग्रेड 2 — माँग के आसपास हल्का पतलापन',
        'Grade 3 — Ludwig III': 'लुडविग III — मध्यम पतलापन',
        'Grade 3 — Ludwig I-1': 'लुडविग I-1 — पतलापन बढ़ा हुआ',
        'Grade 4 — Ludwig II-1': 'लुडविग II-1 — काफ़ी ज़्यादा पतलापन',
        'Grade 5 — Ludwig III-1': 'लुडविग III-1 — बहुत गंभीर पतलापन',
      },
    },
    extra: {
      title: 'कुछ और जो Dr. FACT को जानना चाहिए? (वैकल्पिक)',
      placeholder: 'कोई और लक्षण, बीमारी, आज़माए गए इलाज या कोई चिंता…',
    },
  },
};
