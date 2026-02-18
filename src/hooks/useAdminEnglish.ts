import { useEffect } from "react";
import { useTranslation } from "react-i18next";

export default function useAdminEnglish() {
  const { i18n } = useTranslation();

  useEffect(() => {
    if (i18n.language !== "en") {
      i18n.changeLanguage("en");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}


export  function useAdminFrench() {
  const { i18n } = useTranslation();
    
  useEffect(() => {
    if (i18n.language !== "fr") {
      i18n.changeLanguage("fr");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}