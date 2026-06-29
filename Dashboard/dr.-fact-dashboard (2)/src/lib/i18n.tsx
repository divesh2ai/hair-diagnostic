import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'en' | 'hi' | 'mr' | 'pa' | 'gu';

interface Translations {
  [key: string]: {
    [key in Language]: string;
  };
}

export const translations: Translations = {
  dashboard: {
    en: 'Dashboard',
    hi: 'डैशबोर्ड',
    mr: 'डॅशबोर्ड',
    pa: 'ਡੈਸ਼ਬੋਰਡ',
    gu: 'ડેશબોર્ડ'
  },
  patients: {
    en: 'Patients',
    hi: 'मरीज़',
    mr: 'रुग्ण',
    pa: 'ਮਰੀਜ਼',
    gu: 'દર્દીઓ'
  },
  reports: {
    en: 'Reports',
    hi: 'रिपोर्ट्स',
    mr: 'अहवाल',
    pa: 'ਰਿਪੋਰਟਾਂ',
    gu: 'અહેવાલો'
  },
  settings: {
    en: 'Settings',
    hi: 'सेटिंग्स',
    mr: 'सेटिंग्स',
    pa: 'ਸੈਟਿੰગਾਂ',
    gu: 'સેટિંગ્સ'
  },
  welcome: {
    en: 'Welcome back',
    hi: 'नमस्ते, स्वागत है',
    mr: 'पुन्हा स्वागत आहे',
    pa: 'ਜੀ ਆਇਆਂ ਨੂੰ',
    gu: 'ફરી સ્વાગત છે'
  },
  totalClinics: {
     en: 'Total Clinics',
     hi: 'कुल क्लीनिक',
     mr: 'एकूण दवाखाने',
     pa: 'ਕੁੱਲ ਕਲੀਨਿਕ',
     gu: 'કુલ ક્લિનિક્સ'
  },
  activeDoctors: {
    en: 'Active Doctors',
    hi: 'सक्रिय डॉक्टर',
    mr: 'सक्रिय डॉक्टर',
    pa: 'ਸਰਗਰਮ ਡਾਕਟਰ',
    gu: 'સક્રિય ડોકટરો'
  },
  patientsToday: {
    en: 'Patients Today',
    hi: 'आज के मरीज',
    mr: 'आजचे रुग्ण',
    pa: 'ਅੱਜ ਦੇ ਮਰੀਜ਼',
    gu: 'આજના દર્દીઓ'
  },
  aiReports: {
    en: 'AI Reports',
    hi: 'AI रिपोर्ट्स',
    mr: 'AI अहवाल',
    pa: 'AI ਰਿਪੋਰਟਾਂ',
    gu: 'AI અહેવાલો'
  },
  auditLogs: {
    en: 'Audit Logs',
    hi: 'ऑडिट लॉग्स',
    mr: 'ऑडिट लॉग्स',
    pa: 'ਆਡਿਟ ਲੌਗਸ',
    gu: 'આડિટ લોગ્સ'
  },
  clinic_settings: {
    en: 'Clinic Settings',
    hi: 'क्लीनिक सेटिंग्स',
    mr: 'दवाखाना सेटिंग्ज',
    pa: 'ਕਲੀਨਿਕ ਸੈਟਿੰગਾਂ',
    gu: 'ક્લિનિક સેટિંગ્સ'
  }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [language, setLanguage] = useState<Language>(() => {
    return (localStorage.getItem('hair_os_lang') as Language) || 'en';
  });

  useEffect(() => {
    localStorage.setItem('hair_os_lang', language);
  }, [language]);

  const t = (key: string) => {
    return translations[key]?.[language] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
