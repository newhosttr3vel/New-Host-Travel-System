"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Building2, Compass, ShieldCheck } from "lucide-react";
import { t, type Locale } from "@/lib/messages";
import { LocaleToggle } from "@/components/locale-toggle";

export function OnboardingForm({ locale, userName }: { locale: Locale; userName: string }) {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [defaultCurrency, setDefaultCurrency] = useState("EGP");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setError("");
    try {
      const response = await fetch("/api/onboarding", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, defaultCurrency, defaultLanguage: locale, timeZone: "Africa/Cairo" })
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error === "WORKSPACE_ALREADY_EXISTS" ? t(locale, "genericError") : t(locale, "genericError"));
        return;
      }
      router.push("/dashboard"); router.refresh();
    } catch {
      setError(t(locale, "genericError"));
    } finally { setPending(false); }
  }
  return <main className="onboard-wrap">
    <div className="onboard-card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 15, marginBottom: 25 }}>
        <div className="brand"><span className="brand-mark"><Compass size={23} color="#fff" /></span><div><div className="brand-title" style={{ color: "var(--ink)" }}>{t(locale, "appName")}</div><div className="brand-subtitle">{t(locale, "appSubtitle")}</div></div></div>
        <LocaleToggle locale={locale} />
      </div>
      <span className="eyebrow-chip">{locale === "ar" ? "الخطوة 01 / إعداد المساحة" : "STEP 01 / WORKSPACE SETUP"}</span>
      <h1 className="page-title" style={{ fontSize: 27 }}>{t(locale, "createWorkspace")}</h1>
      <p className="page-description" style={{ marginBottom: 23 }}>{t(locale, "onboardingSubtitle")} {userName ? (locale === "ar" ? `أهلًا ${userName}.` : `Welcome, ${userName}.`) : ""}</p>
      {error && <div className="alert" role="alert">{error}</div>}
      <form className="auth-form" onSubmit={submit}>
        <label className="field"><span className="field-label">{t(locale, "companyName")}</span><input className="input" value={companyName} onChange={(e) => setCompanyName(e.target.value)} minLength={2} maxLength={120} required autoComplete="organization" /></label>
        <label className="field"><span className="field-label">{t(locale, "defaultCurrency")}</span><select className="select" value={defaultCurrency} onChange={(e) => setDefaultCurrency(e.target.value)}><option value="EGP">{t(locale, "currencyEGP")}</option><option value="SAR">{t(locale, "currencySAR")}</option><option value="USD">{t(locale, "currencyUSD")}</option></select></label>
        <button className="btn btn-primary" type="submit" disabled={pending}><Building2 size={16} />{pending ? t(locale, "creating") : t(locale, "createCompany")}</button>
      </form>
      <div className="notice-card"><ShieldCheck size={14} style={{ display: "inline", verticalAlign: "middle", marginInlineEnd: 6 }} />{t(locale, "securityNote")}</div>
    </div>
  </main>;
}
