"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Check, Compass, LockKeyhole, ShieldCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { t, type Locale } from "@/lib/messages";
import { LocaleToggle } from "@/components/locale-toggle";

export function AuthForm({ mode, locale }: { mode: "login" | "register"; locale: Locale }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const registering = mode === "register";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const result = registering
        ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
        : await authClient.signIn.email({ email: email.trim(), password });
      if (result.error) {
        setError(registering ? result.error.message || t(locale, "genericError") : t(locale, "invalidCredentials"));
        return;
      }
      window.location.assign(registering ? "/onboarding" : "/dashboard");
    } catch {
      setError(t(locale, "genericError"));
    } finally {
      setPending(false);
    }
  }

  return <main className="auth-screen">
    <section className="auth-visual">
      <div className="auth-brand">
        <span className="brand-mark"><Compass size={24} color="#fff" /></span>
        <div><div className="brand-title">{t(locale, "appName")}</div><div className="brand-subtitle">{t(locale, "appSubtitle")}</div></div>
      </div>
      <div className="auth-art-content">
        <div className="eyebrow">{locale === "ar" ? "إدارة السفر • الجيل الجديد" : "TRAVEL OPERATIONS • REIMAGINED"}</div>
        <h1 className="auth-art-title">{locale === "ar" ? "كل تفاصيل شركتك. في مساحة واحدة." : "Every detail of your travel business. In one workspace."}</h1>
        <p className="auth-art-copy">{locale === "ar" ? "نظام تشغيلي يجمع العملاء والحجوزات وعمليات الشركة في تجربة واضحة، مبنية لتتوسع مع فريقك." : "A focused workspace for customers, reservations, and company operations — built to grow with your team."}</p>
        <div className="auth-feature-list">
          {[locale === "ar" ? "مساحة مستقلة لكل شركة" : "A separate workspace for every agency", locale === "ar" ? "صلاحيات منظمة حسب دور المستخدم" : "Role-based access for your team", locale === "ar" ? "بيانات تشغيلية محفوظة في قاعدة البيانات" : "Business records stored in your database"].map((feature) =>
            <div className="auth-feature" key={feature}><span className="feature-check"><Check size={13} /></span>{feature}</div>
          )}
        </div>
      </div>
      <div className="auth-foot">© {new Date().getFullYear()} New Host Travel System</div>
    </section>
    <section className="auth-panel">
      <div className="auth-card">
        <div className="auth-top-actions"><LocaleToggle locale={locale} /></div>
        <div className="auth-mobile-brand">
          <span className="brand-mark"><Compass size={22} color="#fff" /></span>
          <div><div className="brand-title" style={{ color: "var(--ink)" }}>{t(locale, "appName")}</div><div className="brand-subtitle" style={{ color: "var(--muted)" }}>{t(locale, "appSubtitle")}</div></div>
        </div>
        <h2 className="auth-title">{t(locale, registering ? "signUp" : "remember")}</h2>
        <p className="auth-subtitle">{t(locale, registering ? "signUpSubtitle" : "signInSubtitle")}</p>
        {error && <div className="alert" role="alert">{error}</div>}
        <form className="auth-form" onSubmit={submit}>
          {registering && <label className="field"><span className="field-label">{t(locale, "fullName")}</span><input className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={100} /></label>}
          <label className="field"><span className="field-label">{t(locale, "email")}</span><input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={254} dir="ltr" /></label>
          <label className="field"><span className="field-label">{t(locale, "password")}</span><input className="input" type="password" autoComplete={registering ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={registering ? 12 : 1} maxLength={128} dir="ltr" />{registering && <span className="customer-secondary">{t(locale, "passwordHint")}</span>}</label>
          <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? t(locale, "creating") : t(locale, registering ? "signUp" : "signIn")}</button>
        </form>
        <div className="auth-switch">{t(locale, registering ? "haveAccount" : "noAccount")} <Link className="text-link" href={registering ? "/login" : "/register"}>{t(locale, registering ? "signIn" : "signUp")}</Link></div>
        <div className="auth-secure-note"><ShieldCheck size={14} /><LockKeyhole size={13} />{locale === "ar" ? "جلسات آمنة • صلاحيات على مستوى الخادم" : "Secure sessions • Server-side authorization"}</div>
      </div>
    </section>
  </main>;
}
