import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from '../locales/en.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import pt from '../locales/pt.json';
import zh from '../locales/zh.json';
import hi from '../locales/hi.json';
import ru from '../locales/ru.json';

const LANGUAGE_KEY = 'app_language';

export const languages = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
];

const resources = {
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  pt: { translation: pt },
  zh: { translation: zh },
  hi: { translation: hi },
  ru: { translation: ru },
};

// Get saved language or device language
const getInitialLanguage = async (): Promise<string> => {
  try {
    const savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (savedLanguage && resources[savedLanguage as keyof typeof resources]) {
      return savedLanguage;
    }
  } catch (error) {
    console.log('Error getting saved language:', error);
  }
  
  // Fall back to device language or English
  const deviceLanguage = Localization.getLocales()[0]?.languageCode || 'en';
  return resources[deviceLanguage as keyof typeof resources] ? deviceLanguage : 'en';
};

// Save language preference
export const setLanguage = async (languageCode: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(LANGUAGE_KEY, languageCode);
    await i18n.changeLanguage(languageCode);
  } catch (error) {
    console.log('Error saving language:', error);
  }
};

// Initialize i18n
const initI18n = async () => {
  const initialLanguage = await getInitialLanguage();
  
  await i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: initialLanguage,
      fallbackLng: 'en',
      interpolation: {
        escapeValue: false,
      },
      react: {
        useSuspense: false,
      },
    });
};

// Initialize immediately
initI18n();

export default i18n;
