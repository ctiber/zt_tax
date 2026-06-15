import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import http from './http-common'
import LanguageDetector from "i18next-browser-languagedetector";
import Backend from "i18next-http-backend";

let langs : any = undefined
export const getAvailableLangs = async () => {
  if(langs) return langs
  try{
    let res = await http.get('/api/langs')
    langs = res.data
    if(langs){
      for(let i = 0 ; i < langs.length ; i++){
        langs[i].flag = Buffer.from(langs[i].flag.data, 'base64').toString('ascii')
      }
    }
    return langs
  }catch(err){
    throw err
  }

}

// Needed for cypress testing
const translationPath = (window as any).Cypress ? "/public/assets/i18n/{{ns}}/{{lng}}.json" : "/assets/i18n/{{ns}}/{{lng}}.json"

i18n
  // load translation using http -> see /public/locales (i.e. https://github.com/i18next/react-i18next/tree/master/example/react/public/locales)
  // learn more: https://github.com/i18next/i18next-http-backend
  .use(Backend)
  // detect user language
  // learn more: https://github.com/i18next/i18next-browser-languageDetector
  .use(LanguageDetector)
  // pass the i18n instance to react-i18next.
  .use(initReactI18next)
  // init i18next
  // for all options read: https://www.i18next.com/overview/configuration-options
  .init({
    lng: window.localStorage.getItem("i18nextLng") || "en",
    backend: {
      /* translation file path */
      loadPath: translationPath,
    },
    fallbackLng: "en",
    debug: false,
    /* can have multiple namespace, in case you want to divide a huge translation into smaller pieces and load them on demand */
    ns: ["translations"],
    defaultNS: "translations",
    keySeparator: false,
    interpolation: {
      escapeValue: false,
      formatSeparator: ",",
    },
    react: {
      wait: true,
    },
  });

export default i18n;
