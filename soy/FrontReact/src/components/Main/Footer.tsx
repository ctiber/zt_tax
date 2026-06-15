import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getAvailableLangs } from '../../i18n';
import styles from './Footer.module.css';

export const Footer = () => {
  
  const { t } = useTranslation();
  const { i18n } = useTranslation();
  const [, setSelectedLang] = useState(window.localStorage.getItem("i18nextLng") || "en");
  /**
   * This function changes the language of the application.
   * @param language the chosen language
   */
  function changeLanguage(language: string) {
    window.localStorage.setItem("i18nextLng", language)
    setSelectedLang(language);
    i18n.changeLanguage(language);
  }

  const [langs, setLangs] = useState<any[]>([])

  useEffect( () => {

    const fetchLangs = async () => {
      setLangs(await getAvailableLangs())
    }
    if(langs.length === 0) fetchLangs()

  }, [langs])
  
  return (
    <footer className={styles.footer}>
      Copyright (c) 2022 - {t("ALL_RIGHTS_RESERVED")}
      <div>
        <div>
          <a href={process.env["REACT_APP_TERMS_AND_CONDITIONS_"+(i18n.language).toUpperCase()]}>{t("TERMS_AND_CONDITIONS")}</a>
          <a href={process.env["REACT_APP_CONFIDENTIALITY_"+(i18n.language).toUpperCase()]}>{t("CONFIDENTIALITY")}</a>
        </div>
      </div>
          
      <div className={styles.flags}>
        {
          langs.length > 0 && (
            langs.map( (lang) => (
              <button key={lang.code} data-cy={`${lang.code}-flag-button`} className={styles.flag} onClick={ () => changeLanguage(lang.code)}>
                <img className={styles.flag} src={`data:image/png;base64,${lang.flag}`} alt={`${lang.code} flag`}/>
              </button>
            ))
          )
        }
      </div>
    </footer>
  )
}