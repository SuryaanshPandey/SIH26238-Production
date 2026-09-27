"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

type Language = "en" | "hi";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<string, Record<Language, string>> = {
  // App Header & Nav
  "app.title": {
    en: "Ministry of Tribal Affairs",
    hi: "जनजातीय कार्य मंत्रालय",
  },
  "app.subtitle": {
    en: "Unified Scholarship Mobile Portal",
    hi: "एकीकृत छात्रवृत्ति मोबाइल पोर्टल",
  },
  "nav.home": { en: "Home", hi: "होम" },
  "nav.scholarships": { en: "Scholarships", hi: "छात्रवृत्तियाँ" },
  "nav.applications": { en: "My Applications", hi: "मेरे आवेदन" },
  "nav.wallet": { en: "Wallet", hi: "दस्तावेज़" },
  "nav.jago": { en: "JAGO Help", hi: "जागो सहायता" },
  "nav.actions": { en: "Action Centre", hi: "एक्शन सेंटर" },

  // Dashboard
  "dash.welcome": { en: "Welcome back", hi: "स्वागत है" },
  "dash.st_beneficiary": { en: "ST Beneficiary", hi: "अनुसूचित जनजाति लाभार्थी" },
  "dash.active_apps": { en: "Active Applications", hi: "सक्रिय आवेदन" },
  "dash.pending_actions": { en: "Pending Actions", hi: "लंबित कार्रवाइयां" },
  "dash.verified_docs": { en: "Verified Documents", hi: "सत्यापित दस्तावेज़" },
  "dash.sanctioned_amt": { en: "Sanctioned Amount", hi: "स्वीकृत राशि" },
  "dash.action_alert": {
    en: "Action Required on Post-Matric Scholarship",
    hi: "पोस्ट-मैट्रिक छात्रवृत्ति पर कार्रवाई आवश्यक",
  },
  "dash.quick_actions": { en: "Quick Services", hi: "त्वरित सेवाएं" },
  "dash.check_eligibility": { en: "Check Eligibility", hi: "पात्रता जांचें" },
  "dash.my_wallet": { en: "Document Wallet", hi: "दस्तावेज़ वॉलेट" },
  "dash.ask_jago": { en: "Ask JAGO Chatbot", hi: "जागो से पूछें" },

  // General
  "btn.apply": { en: "Apply Now", hi: "आवेदन करें" },
  "btn.details": { en: "View Details", hi: "विवरण देखें" },
  "btn.resolve": { en: "Resolve Deficiency", hi: "समस्या हल करें" },
  "btn.track": { en: "Track Status", hi: "स्थिति ट्रैक करें" },
  "status.verified": { en: "Verified", hi: "सत्यापित" },
};

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {},
  t: (key: string) => key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    const saved = localStorage.getItem("mota_lang") as Language;
    if (saved === "en" || saved === "hi") {
      setLanguageState(saved);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("mota_lang", lang);
  };

  const t = (key: string): string => {
    return translations[key]?.[language] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
