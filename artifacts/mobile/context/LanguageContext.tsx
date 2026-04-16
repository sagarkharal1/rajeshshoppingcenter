import React, { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ne, { type Translations } from "@/i18n/ne";
import en from "@/i18n/en";
import hi from "@/i18n/hi";

export type LanguageCode = "ne" | "en" | "hi";

export type Language = {
  code: LanguageCode;
  label: string;
  nativeLabel: string;
  flag: string;
};

export const LANGUAGES: Language[] = [
  { code: "ne", label: "Nepali", nativeLabel: "नेपाली", flag: "🇳🇵" },
  { code: "en", label: "English", nativeLabel: "English", flag: "🇬🇧" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी", flag: "🇮🇳" },
];

const TRANSLATIONS: Record<LanguageCode, Translations> = { ne, en, hi };
const STORAGE_KEY = "rajesh_language";

type LanguageContextType = {
  language: LanguageCode;
  setLanguage: (code: LanguageCode) => void;
  t: Translations;
};

const LanguageContext = createContext<LanguageContextType>({
  language: "ne",
  setLanguage: () => {},
  t: ne,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>("ne");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored && (stored === "ne" || stored === "en" || stored === "hi")) {
        setLanguageState(stored);
      }
    });
  }, []);

  const setLanguage = (code: LanguageCode) => {
    setLanguageState(code);
    AsyncStorage.setItem(STORAGE_KEY, code);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: TRANSLATIONS[language] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
