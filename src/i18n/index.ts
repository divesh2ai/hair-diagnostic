export type Locale = "en" | "hi" | "ar";

const dictionaries: Record<Locale, Record<string, string>> = {
  en: {
    "landing.hero.title": "Understand your hair. Recover with confidence.",
    "landing.hero.cta": "Start your assessment",
    "processing.title": "Analyzing your clinical profile",
    "processing.subtitle": "Our AI is reviewing your responses and scalp signals",
    "sandbox.title": "Clinical QA Sandbox",
  },
  hi: {
    "landing.hero.title": "अपने बालों को समझें। आत्मविश्वास से ठीक हों।",
    "landing.hero.cta": "अपना आकलन शुरू करें",
    "processing.title": "आपकी क्लिनिकल प्रोफ़ाइल का विश्लेषण",
    "processing.subtitle": "हमारी AI आपके उत्तरों की समीक्षा कर रही है",
    "sandbox.title": "क्लिनिकल QA सैंडबॉक्स",
  },
  ar: {
    "landing.hero.title": "افهم شعرك. تعافَ بثقة.",
    "landing.hero.cta": "ابدأ التقييم",
    "processing.title": "تحليل ملفك السريري",
    "processing.subtitle": "الذكاء الاصطناعي يراجع إجاباتك",
    "sandbox.title": "بيئة ضمان الجودة",
  },
};

export function t(key: string, locale: Locale = "en"): string {
  return dictionaries[locale]?.[key] ?? dictionaries.en[key] ?? key;
}

export function getClinicLocale(clinicLanguage?: string): Locale {
  if (clinicLanguage === "hi") return "hi";
  if (clinicLanguage === "ar") return "ar";
  return "en";
}
