"use client";
import { useState, type FormEvent } from "react";
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
  const [notice, setNotice] = useState("");
  const [forgotPassword, setForgotPassword] = useState(false);
  const registering = mode === "register";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setPending(true);
    try {
      if (forgotPassword) {
        const result = await authClient.requestPasswordReset({
          email: email.trim(),
          redirectTo: window.location.origin + "/reset-password"
        });
        if (result.error) {
          setError(result.error.message || t(locale, "genericError"));
        } else {
          setNotice(locale === "ar"
            ? "لو البريد مسجل عندنا، هيوصلك رابط آمن لاستعادة كلمة المرور."
            : "If that address belongs to an account, a secure password-reset link will arrive by email.");
        }
        return;
      }

      const result = registering
        ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
        : await authClient.signIn.email({ email: email.trim(), password });
      if (result.error) {
        setError(registering ? result.error.message || t(locale, "genericError") : t(locale, "invalidCredentials"));
        return;
      }
      if (registering && process.env.NODE_ENV === "production") {
        setNotice(locale === "ar"
          ? "تم إنشاء الحساب. راجع بريدك الإلكتروني واضغط رابط التحقق قبل تسجيل الدخول."
          : "Your account was created. Verify your email using the link we sent before signing in.");
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
        <h2 className="auth-title">{forgotPassword ? (locale === "ar" ? "استعادة كلمة المرور" : "Reset your password") : t(locale, registering ? "signUp" : "remember")}</h2>
        <p className="auth-subtitle">{forgotPassword ? (locale === "ar" ? "اكتب بريدك الإلكتروني لإرسال رابط استعادة آمن." : "Enter your email address to receive a secure reset link.") : t(locale, registering ? "signUpSubtitle" : "signInSubtitle")}</p>
        {error && <div className="alert" role="alert">{error}</div>}
        {notice && <div className="alert" role="status">{notice}</div>}
        <form className="auth-form" onSubmit={submit}>
          {registering && <label className="field"><span className="field-label">{t(locale, "fullName")}</span><input className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={100} /></label>}
          <label className="field"><span className="field-label">{t(locale, "email")}</span><input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={254} dir="ltr" /></label>
          {!forgotPassword && <label className="field"><span className="field-label">{t(locale, "password")}</span><input className="input" type="password" autoComplete={registering ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={registering ? 12 : 1} maxLength={128} dir="ltr" />{registering && <span className="customer-secondary">{t(locale, "passwordHint")}</span>}</label>}
          <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? t(locale, "creating") : forgotPassword ? (locale === "ar" ? "إرسال رابط الاستعادة" : "Send reset link") : t(locale, registering ? "signUp" : "signIn")}</button>
        </form>
        <div className="auth-switch">{forgotPassword ? (locale === "ar" ? "تذكرت كلمة المرور؟ " : "Remembered your password? ") : t(locale, registering ? "haveAccount" : "noAccount")} <button className="text-link" type="button" onClick={() => { setForgotPassword(false); setNotice(""); setError(""); }}>{forgotPassword ? (locale === "ar" ? "العودة للدخول" : "Back to sign in") : t(locale, registering ? "signIn" : "signUp")}</button>{!registering && !forgotPassword && <button className="text-link" type="button" onClick={() => { setForgotPassword(true); setNotice(""); setError(""); }}>{locale === "ar" ? "نسيت كلمة المرور؟" : "Forgot password?"}</button>}</div>
        <div className="auth-secure-note"><ShieldCheck size={14} /><LockKeyhole size={13} />{locale === "ar" ? "جلسات آمنة • صلاحيات على مستوى الخادم" : "Secure sessions • Server-side authorization"}</div>
      </div>
    </section>
  </main>;
}
