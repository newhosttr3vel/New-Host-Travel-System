"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Compass, LockKeyhole, ShieldCheck } from "lucide-react";
import { signIn } from "@/lib/auth-client";
import { t, type Locale } from "@/lib/messages";
import { LocaleToggle } from "@/components/locale-toggle";

export function AuthForm({ mode, locale }: { mode: "login" | "register"; locale: Locale }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const registering = mode === "register";
  async function continueWithGoogle() {
    setError(""); setPending(true);
    try { await signIn("google", { callbackUrl: "/dashboard" }); }
    catch { setError(t(locale, "genericError")); setPending(false); }
  }
  return <main className="auth-screen">
    <section className="auth-visual">
      <div className="auth-brand"><span className="brand-mark"><Compass size={24} color="#fff" /></span><div><div className="brand-title">{t(locale, "appName")}</div><div className="brand-subtitle">{t(locale, "appSubtitle")}</div></div></div>
      <div className="auth-art-content">
        <div className="eyebrow">{locale === "ar" ? "إدارة السفر • الجيل الجديد" : "TRAVEL OPERATIONS • REIMAGINED"}</div>
        <h1 className="auth-art-title">{locale === "ar" ? "كل تفاصيل شركتك. في مساحة واحدة." : "Every detail of your travel business. In one workspace."}</h1>
        <p className="auth-art-copy">{locale === "ar" ? "نظام تشغيلي يجمع العملاء والحجوزات وعمليات الشركة في تجربة واضحة، مبنية لتتوسع مع فريقك." : "A focused workspace for customers, reservations, and company operations — built to grow with your team."}</p>
        <div className="auth-feature-list">{[locale === "ar" ? "مساحة مستقلة لكل شركة" : "A separate workspace for every agency", locale === "ar" ? "صلاحيات منظمة حسب دور المستخدم" : "Role-based access for your team", locale === "ar" ? "تخزين مرحلي في Google Sheets" : "Interim storage powered by Google Sheets"].map((feature) => <div className="auth-feature" key={feature}><span className="feature-check"><Check size={13} /></span>{feature}</div>)}</div>
      </div>
      <div className="auth-foot">© {new Date().getFullYear()} New Host Travel System</div>
    </section>
    <section className="auth-panel"><div className="auth-card">
      <div className="auth-top-actions"><LocaleToggle locale={locale} /></div>
      <div className="auth-mobile-brand"><span className="brand-mark"><Compass size={22} color="#fff" /></span><div><div className="brand-title" style={{ color: "var(--ink)" }}>{t(locale, "appName")}</div><div className="brand-subtitle" style={{ color: "var(--muted)" }}>{t(locale, "appSubtitle")}</div></div></div>
      <h2 className="auth-title">{t(locale, registering ? "signUp" : "remember")}</h2>
      <p className="auth-subtitle">{locale === "ar" ? "استخدم حساب Google لتسجيل الدخول، وسيتم حفظ بيانات الشركة في Google Sheets." : "Use your Google account to sign in. Your company records will be stored in Google Sheets."}</p>
      {error && <div className="alert" role="alert">{error}</div>}
      <button className="btn btn-primary" style={{ width: "100%", minHeight: 46, marginTop: 22 }} type="button" onClick={() => void continueWithGoogle()} disabled={pending}>{pending ? t(locale, "creating") : (locale === "ar" ? "المتابعة باستخدام Google" : "Continue with Google")}</button>
      <div className="auth-secure-note"><ShieldCheck size={14} /><LockKeyhole size={13} />{locale === "ar" ? "جلسات موقعة • صلاحيات على مستوى الخادم" : "Signed sessions • Server-side authorization"}</div>
      <div className="auth-switch">{t(locale, registering ? "haveAccount" : "noAccount")} <Link className="text-link" href={registering ? "/login" : "/register"}>{t(locale, registering ? "signIn" : "signUp")}</Link></div>
    </div></section>
  </main>;
}
