"use client";
import { Languages } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";

export function LocaleToggle({ locale }: { locale: Locale }) {
  function toggle() {
    const next = locale === "ar" ? "en" : "ar";
    document.cookie = `locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    window.location.reload();
  }
  return <button type="button" className="language-button" onClick={toggle} aria-label={locale === "ar" ? "Switch language to English" : "تغيير اللغة إلى العربية"}>
    <Languages size={15} />{t(locale, "language")}
  </button>;
}
