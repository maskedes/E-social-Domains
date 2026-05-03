import { createContext, useContext } from 'react';
import { translations, Language, TranslationKey } from '../translations';

export interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

export const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const translate = (language: Language, key: TranslationKey): string => {
  return translations[language][key] || translations['en'][key] || key;
};
