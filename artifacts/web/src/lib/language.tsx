import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { en, ne, type Translations } from "@/i18n/business-translations-clean";

type Lang = "ne" | "en";

interface LanguageContextType {
  lang: Lang;
  t: Translations;
  toggleLanguage: () => void;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "ne",
  t: ne,
  toggleLanguage: () => {},
});

const STORAGE_KEY = "rajesh_web_lang_v2";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return (saved === "en" || saved === "ne") ? saved : "ne";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang === "ne" ? "ne" : "en";
  }, [lang]);

  const toggleLanguage = () => setLang(l => l === "ne" ? "en" : "ne");

  const t = lang === "ne" ? ne : en;

  return (
    <LanguageContext.Provider value={{ lang, t, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
