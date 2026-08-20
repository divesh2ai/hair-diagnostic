/**
 * Marathi chrome dictionary.
 *
 * Marathi shares Devanagari with Hindi but is a different language — this is a
 * translation from the English master, not a transliteration of ./hi.ts. The
 * words a Marathi patient actually uses differ throughout:
 *
 *   hair   केस   (not बाल)      scalp  डोक्याची त्वचा / टाळू
 *   is     आहे   (not है)        you    तुम्ही (not आप)
 *   fall   गळणे  (not झड़ना)     age    वय (not उम्र)
 *
 * Voice rules (see docs/localisation/assessment-mr-review.md):
 *  - Respectful second person: always "तुम्ही"/"तुमचे", never "तू"/"तुझे".
 *  - Standard written forms ("तुमचे", not the colloquial "तुमचं") — this is a
 *    clinical document, and the written form reads correctly across Maharashtra
 *    rather than favouring one region's speech.
 *  - Respectful imperatives: निवडा, करा, लिहा, द्या.
 *  - Familiar Indian-English clinical terms kept where they read better than a
 *    forced Marathi coinage (डँड्रफ, हेअरलाइन, थायरॉइड).
 *  - Brand names (Dr. FACT, HairOS) never translated or transliterated.
 *
 * Typed as `AssessmentDictionary`, so a missing key is a build error rather
 * than a runtime fallback.
 */

import type { AssessmentDictionary } from '../types';

export const mr: AssessmentDictionary = {
  gate: {
    eyebrow: 'Dr. FACT केस मूल्यांकन',
    titleEnglish: 'Choose your language',
    titleNative: 'तुमची भाषा निवडा',
    body: 'तुम्हाला ज्या भाषेत सोयीचे वाटेल त्याच भाषेत उत्तर द्या. तुम्ही मध्येच भाषा बदलू शकता — तुमची उत्तरे सुरक्षित राहतील.',
    continueLabel: 'मूल्यांकन सुरू करा',
    metaDuration: 'सुमारे 3 मिनिटे',
    metaPrivacy: 'खाजगी आणि सुरक्षित',
    metaReview: 'डॉक्टरांनी तपासलेले',
    switchHint: 'भाषा नंतर वरील पर्यायातून बदलता येईल.',
  },
  intake: {
    eyebrow: 'Dr. FACT मध्ये तुमचे स्वागत आहे',
    title: 'सुरू करण्यापूर्वी',
    body: 'फक्त दोन तपशील, म्हणजे तुमचे मूल्यांकन तुमच्या उपचारांशी जोडलेले राहील.',
    nameLabel: 'तुमचे नाव',
    namePlaceholder: 'उदा. प्रिया',
    mobileLabel: 'मोबाइल नंबर',
    mobilePlaceholder: '98765 43210',
    mobileHint: 'यामुळे तुमच्या प्रत्येक भेटी एकमेकांशी जोडलेल्या राहतात.',
    privacyNote: 'खाजगी आणि सुरक्षित. फक्त तुमच्या क्लिनिकसोबत शेअर केले जाते.',
    continueLabel: 'पुढे जा',
    checking: 'क्षणभर थांबा…',
    nameRequired: 'कृपया तुमचे नाव लिहा.',
    nameInvalid: 'फक्त अक्षरे वापरा.',
    phoneEmpty: 'मोबाइल नंबर लिहा.',
    phoneTooShort: 'हा नंबर लहान आहे — पूर्ण 10 अंक लिहा.',
    phoneTooLong: 'या नंबरमध्ये जास्त अंक आहेत.',
    phoneNotAMobile: '6, 7, 8 किंवा 9 ने सुरू होणारा मोबाइल नंबर लिहा.',
    phoneMalformed: 'फक्त अंक लिहा.',
    connectionErrorTitle: 'क्लिनिकशी संपर्क होऊ शकला नाही',
    connectionErrorBody: 'तुमचे इंटरनेट तपासा आणि पुन्हा प्रयत्न करा.',
    unavailableTitle: 'अजून मूल्यांकन सुरू करता येत नाही',
    unavailableBody: 'या क्लिनिकची प्रणाली अपडेट होत आहे. कृपया रिसेप्शनला कळवा.',
    continueAnyway: 'हा टप्पा वगळून पुढे जा',
    returningTitle: 'पुन्हा स्वागत आहे',
    returningBody: 'आज तुम्ही कशासाठी आला आहात?',
    intentFollowUp: 'माझ्या उपचारांचा फॉलो-अप',
    intentKitFulfilment: 'उरलेले किट घेण्यासाठी किंवा पुढे सुरू ठेवण्यासाठी',
    intentConditionChanged: 'माझ्या केसांची स्थिती बदलली आहे',
    intentNewConcern: 'केसांबाबत नवीन समस्या आहे',
    intentReassessment: 'पुन्हा मूल्यांकन करायचे आहे',
    intentRequired: 'पुढे जाण्यासाठी एक पर्याय निवडा.',
  },
  common: {
    back: 'मागे',
    skip: 'वगळा',
    retry: 'पुन्हा प्रयत्न करा',
    language: 'भाषा',
    languageSwitchLabel: 'भाषा बदला',
  },
  questionnaire: {
    questionEyebrow: 'प्रश्न {number}',
    progressCounter: 'प्रश्न {position} / {total}',
    multiSelectHint: 'जे-जे लागू असेल ते सर्व निवडा.',
    selectedCount: '{count} निवडले',
    enterHintPrefix: 'पुढे जाण्यासाठी',
    enterHintSuffix: 'दाबा',
    beginChapter: 'सुरू करा',
    beginFinalChapter: 'शेवटचा टप्पा सुरू करा',
    chapterAriaLabel: 'हा टप्पा सुरू करा: {title}',
    progressAriaLabel: 'मूल्यांकनाची प्रगती',
    loading: 'तुमचे मूल्यांकन तयार होत आहे…',
    forwardContinue: 'पुढच्या प्रश्नाकडे जा',
    forwardComplete: 'मूल्यांकन पूर्ण करा',
    forwardSubmitting: 'तुमच्या उत्तरांचे विश्लेषण सुरू आहे',
  },
  input: {
    textPlaceholder: 'तुमचे उत्तर लिहा…',
    textareaPlaceholder: 'इथे लिहायला सुरुवात करा…',
    numberPlaceholder: 'उदा. 28',
  },
  validation: {
    required: 'कृपया पुढे जाण्यापूर्वी एक पर्याय निवडा.',
    outOfRange: 'कृपया {min} ते {max} दरम्यानचा आकडा भरा.',
  },
  photo: {
    tapToAdd: 'फोटो जोडण्यासाठी टॅप करा',
    fileHint: 'JPEG, PNG किंवा WebP · जास्तीत जास्त 4 MB',
    uploading: 'अपलोड होत आहे',
    savedSecurely: 'सुरक्षितपणे सेव्ह झाले',
    replace: 'बदला',
    remove: 'काढून टाका',
    retryUpload: 'पुन्हा अपलोड करा',
    previewAlt: '{name} चा प्रीव्ह्यू',
    errorType: 'कृपया JPEG, PNG किंवा WebP फोटो निवडा.',
    errorSize: 'फोटोचा आकार 4 MB पेक्षा कमी असावा.',
    errorGeneric: 'फोटो अपलोड होऊ शकला नाही. कृपया पुन्हा प्रयत्न करा.',
    errorRemove: 'फोटो काढून टाकता आला नाही.',
    guidanceLighting: 'चांगल्या आणि सारख्या प्रकाशात, कॅमेरा स्थिर धरून फोटो काढा.',
  },
  submission: {
    submitting: 'तुमचे मूल्यांकन पाठवले जात आहे',
    doNotClose: 'कृपया ही विंडो बंद करू नका.',
    completeTitle: 'मूल्यांकन पूर्ण झाले',
    completeBody: 'धन्यवाद. तुमची उत्तरे डॉक्टरांच्या तपासणीसाठी तयार आहेत.',
    failedTitle: 'मूल्यांकन पाठवता आले नाही',
  },
  thankYou: {
    eyebrow: 'मूल्यांकन मिळाले',
    title: 'धन्यवाद. तुमचे मूल्यांकन आम्हाला मिळाले आहे.',
    body: 'तुमची उत्तरे सुरक्षितपणे तुमच्या क्लिनिकच्या वैद्यकीय टीमकडे पोहोचली आहेत.',
    nextTitle: 'पुढे काय होईल',
    nextReview: 'क्लिनिकचे डॉक्टर स्वतः तुमच्या मूल्यांकनाची तपासणी करतील.',
    nextPlan: 'ती तपासणी पूर्ण झाल्यावरच तुमची उपचार योजना तयार केली जाईल.',
    nextContact: 'पुढील टप्प्यासाठी क्लिनिक तुमच्याशी संपर्क साधेल.',
    closeNote: 'तुम्ही आता हे पान बंद करू शकता — तुम्हाला आणखी काही करायचे नाही.',
  },
  processing: {
    warmupEyebrow: 'तयारी',
    warmupHead: 'तुमचे मूल्यांकन तयार केले जात आहे',
    warmupSub: 'सर्व काही व्यवस्थित लावले जात आहे.',
    warmupEta: 'हे आत्ताच सुरू होईल.',
    step1Eyebrow: 'टप्पा 1 / 5',
    step1Head: 'तुमची उत्तरे वाचली जात आहेत',
    step1Sub: 'तुमच्या उत्तरांचे क्लिनिकल संकेतांमध्ये रूपांतर केले जात आहे.',
    step1Eta: 'याला सहसा एका मिनिटापेक्षा कमी वेळ लागतो.',
    step2Eyebrow: 'टप्पा 2 / 5',
    step2Head: 'तुमच्या केसांची स्थिती समजून घेतली जात आहे',
    step2Sub: 'ताण, हार्मोन, डोक्याची त्वचा आणि पोषण — सर्व एकत्र जोडले जात आहे.',
    step2Eta: 'आणखी काही क्षण.',
    step3Eyebrow: 'टप्पा 3 / 5',
    step3Head: 'तुमचा उपचार आराखडा तयार होत आहे',
    step3Sub: 'तुमच्या स्थितीनुसार योग्य थेरपी निवडली जात आहे.',
    step3Eta: 'जवळपास पूर्ण झाले आहे.',
    step4Eyebrow: 'टप्पा 4 / 5',
    step4Head: 'डॉक्टरांसाठी तुमचा तपशील तयार होत आहे',
    step4Sub: 'तुमच्या स्थितीचे संपूर्ण वर्णन लिहिले जात आहे.',
    step4Eta: 'अगदी थोडा वेळ.',
    step5Eyebrow: 'टप्पा 5 / 5',
    step5Head: 'तुमचा वैयक्तिक व्हिडिओ तयार होत आहे',
    step5Sub: 'तुमच्या केसांची कहाणी व्हिडिओमध्ये मांडली जात आहे.',
    step5Eta: '30–90 सेकंद.',
    doneEyebrow: 'तयार',
    doneHead: 'तुमचा अहवाल तयार आहे',
    doneSub: 'तुमचा रिकव्हरी प्लॅन उघडला जात आहे.',
    errorTitle: 'काहीतरी अडचण आली',
    errorBody: 'प्रोसेसिंग पूर्ण होऊ शकली नाही.',
  },
  bridgeStages: {
    identity: 'तुमची ओळख',
    biological: 'जैविक कारणे',
    lifestyle: 'जीवनशैलीच्या सवयी',
    stress: 'ताण आणि मानसिक आरोग्य',
    hormonal: 'हार्मोन संतुलन',
    nutritional: 'पोषणाची स्थिती',
    scalp: 'डोक्याच्या त्वचेचे आरोग्य',
    environmental: 'पर्यावरणीय कारणे',
  },
};
