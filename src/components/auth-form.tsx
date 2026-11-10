"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Bus,
  Eye,
  EyeOff,
  Hotel,
  MapPinned,
  LockKeyhole,
  Plane,
  ShieldCheck,
  Users,
} from "lucide-react";
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
  const [showPassword, setShowPassword] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setPending(true);

    try {
      if (forgotPassword) {
        const result = await authClient.requestPasswordReset({
          email: email.trim(),
          redirectTo: window.location.origin + "/reset-password",
        });

        if (result.error) {
          setError(result.error.message || t(locale, "genericError"));
        } else {
          setNotice(isArabic
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
        setNotice(isArabic
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

  return (
    <main className="auth-screen-v2">
      <div className="auth-motion-layer" aria-hidden="true">
        <span className="auth-motion-aurora auth-motion-aurora-one" />
        <span className="auth-motion-aurora auth-motion-aurora-two" />
        <span className="auth-motion-orbit auth-motion-orbit-one" />
        <span className="auth-motion-orbit auth-motion-orbit-two" />
        <span className="auth-motion-beam" />
        <span className="auth-flight-path auth-flight-path-one" />
        <span className="auth-flight-path auth-flight-path-two" />
        <span className="auth-motion-plane auth-motion-plane-one"><Plane size={25} strokeWidth={1.7} /></span>
        <span className="auth-motion-plane auth-motion-plane-two"><Plane size={19} strokeWidth={1.7} /></span>
        <span className="auth-motion-marker auth-motion-marker-one"><MapPinned size={21} strokeWidth={1.7} /></span>
        <span className="auth-motion-marker auth-motion-marker-two"><Hotel size={20} strokeWidth={1.7} /></span>
      </div>
      <div className="auth-layout-wrap">
        <header className="auth-page-heading">
          <span className="auth-heading-rule" />
          <div className="auth-heading-copy">
            <Plane size={17} strokeWidth={2.4} aria-hidden="true" />
            <span>{isArabic ? "بوابتك لإدارة أعمال السفر بسلاسة" : "Your gateway to seamless travel operations"}</span>
          </div>
          <span className="auth-heading-rule" />
        </header>

        <div className="auth-card-layout">
          <section className="auth-panel auth-form-panel" dir={locale}>
            <div className="auth-form-inner">
              <div className="auth-top-actions">
                <span className="auth-security-chip">
                  <ShieldCheck size={14} aria-hidden="true" />
                  {isArabic ? "دخول آمن ومشفّر" : "Secure workspace access"}
                </span>
                <LocaleToggle locale={locale} />
              </div>

              <div className="auth-form-heading">
                <span className="auth-form-kicker">
                  {forgotPassword
                    ? (isArabic ? "استعادة الوصول" : "ACCOUNT RECOVERY")
                    : registering
                      ? (isArabic ? "ابدأ مع نيو هوست" : "GET STARTED WITH NEW HOST")
                      : (isArabic ? "مرحبًا بعودتك" : "WELCOME BACK")}
                </span>
                <h1 className="auth-title">
                  {forgotPassword
                    ? (isArabic ? "استعادة كلمة المرور" : "Reset your password")
                    : registering
                      ? t(locale, "signUp")
                      : t(locale, "remember")}
                </h1>
                <p className="auth-subtitle">
                  {forgotPassword
                    ? (isArabic ? "اكتب بريدك الإلكتروني لإرسال رابط استعادة آمن." : "Enter your email address to receive a secure reset link.")
                    : t(locale, registering ? "signUpSubtitle" : "signInSubtitle")}
                </p>
              </div>

              {error && <div className="alert" role="alert">{error}</div>}
              {notice && <div className="alert success" role="status">{notice}</div>}

              <form className="auth-form" onSubmit={submit}>
                {registering && (
                  <label className="field auth-field">
                    <span className="field-label">{t(locale, "fullName")}</span>
                    <input
                      className="input auth-input"
                      autoComplete="name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      required
                      minLength={2}
                      maxLength={100}
                    />
                  </label>
                )}

                <label className="field auth-field">
                  <span className="field-label">{t(locale, "email")}</span>
                  <input
                    className="input auth-input"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    maxLength={254}
                    dir="ltr"
                    placeholder={isArabic ? "name@company.com" : "name@company.com"}
                  />
                </label>

                {!forgotPassword && (
                  <label className="field auth-field">
                    <span className="auth-label-row">
                      <span className="field-label">{t(locale, "password")}</span>
                      {!registering && (
                        <button
                          className="auth-inline-link"
                          type="button"
                          onClick={() => { setForgotPassword(true); setNotice(""); setError(""); }}
                        >
                          {isArabic ? "نسيت كلمة المرور؟" : "Forgot password?"}
                        </button>
                      )}
                    </span>
                    <span className="auth-password-wrap">
                      <input
                        className="input auth-input auth-password-input"
                        type={showPassword ? "text" : "password"}
                        autoComplete={registering ? "new-password" : "current-password"}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                        minLength={registering ? 12 : 1}
                        maxLength={128}
                        dir="ltr"
                      />
                      <button
                        className="auth-password-toggle"
                        type="button"
                        onClick={() => setShowPassword((current) => !current)}
                        aria-label={showPassword
                          ? (isArabic ? "إخفاء كلمة المرور" : "Hide password")
                          : (isArabic ? "إظهار كلمة المرور" : "Show password")}
                        aria-pressed={showPassword}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </span>
                    {registering && <span className="customer-secondary auth-password-hint">{t(locale, "passwordHint")}</span>}
                  </label>
                )}

                <button className="btn btn-primary auth-submit" type="submit" disabled={pending}>
                  <span>
                    {pending
                      ? t(locale, "creating")
                      : forgotPassword
                        ? (isArabic ? "إرسال رابط الاستعادة" : "Send reset link")
                        : t(locale, registering ? "signUp" : "signIn")}
                  </span>
                  {!pending && <ArrowUpRight size={17} aria-hidden="true" />}
                </button>
              </form>

              <div className="auth-switch">
                {forgotPassword ? (
                  <>
                    {isArabic ? "تذكرت كلمة المرور؟" : "Remembered your password?"}
                    <button
                      className="text-link"
                      type="button"
                      onClick={() => { setForgotPassword(false); setNotice(""); setError(""); }}
                    >
                      {isArabic ? "العودة لتسجيل الدخول" : "Back to sign in"}
                    </button>
                  </>
                ) : registering ? (
                  <>
                    {t(locale, "haveAccount")}
                    <Link className="text-link" href="/login">{t(locale, "signIn")}</Link>
                  </>
                ) : (
                  <>
                    {t(locale, "noAccount")}
                    <Link className="text-link" href="/register">{t(locale, "signUp")}</Link>
                  </>
                )}
              </div>

              <div className="auth-secure-note">
                <LockKeyhole size={13} aria-hidden="true" />
                <span>{isArabic ? "بيانات شركتك محمية بصلاحيات مستقلة" : "Your company data is protected by isolated access controls"}</span>
              </div>
            </div>
          </section>

          <section className="auth-visual-v2" dir={locale}>
            <div className="auth-visual-orbit auth-visual-orbit-one" aria-hidden="true" />
            <div className="auth-visual-orbit auth-visual-orbit-two" aria-hidden="true" />

            <div className="auth-visual-top">
              <div className="auth-brand-v2">
                <span className="auth-brand-logo">
                  <img src="/brand/new-host-logo.jpg" alt="New Host Travel" />
                </span>
                <span className="auth-brand-caption" aria-label="New Host Travel">
                  <strong>NEW HOST</strong>
                  <small>TRAVEL MANAGEMENT</small>
                </span>
              </div>
              <span className="auth-live-badge">
                <i />
                {isArabic ? "مساحة عملك" : "YOUR WORKSPACE"}
              </span>
            </div>

            <div className="auth-hero-copy">
              <span className="auth-visual-eyebrow">
                <span />
                {isArabic ? "إدارة السفر • بصورة أذكى" : "TRAVEL OPERATIONS • MADE SIMPLE"}
              </span>
              <h2>
                {isArabic
                  ? <>كل تفاصيل السفر،<br />في مساحة واحدة.</>
                  : <>Every travel detail.<br />One clear workspace.</>}
              </h2>
              <p>
                {isArabic
                  ? "من الحجز إلى المتابعة، نظّم الفنادق والطيران والعملاء والموردين من مكان واحد."
                  : "From booking to follow-up, manage hotels, flights, customers and suppliers in one place."}
              </p>
            </div>

            <div className="auth-command-preview" dir="ltr" aria-label={isArabic ? "معاينة توضيحية لواجهة إدارة الرحلات" : "Illustrative travel operations preview"}>
              <div className="auth-preview-head">
                <div className="auth-preview-heading">
                  <span className="auth-preview-icon"><MapPinned size={17} /></span>
                  <span>
                    <strong>{isArabic ? "مسار الرحلة" : "TRIP OVERVIEW"}</strong>
                    <small>{isArabic ? "معاينة توضيحية للنظام" : "ILLUSTRATIVE WORKSPACE PREVIEW"}</small>
                  </span>
                </div>
                <span className="auth-preview-tag">{isArabic ? "رحلة" : "TRIP"}</span>
              </div>

              <div className="auth-route-stage">
                <div className="auth-route-stop">
                  <strong>CAI</strong>
                  <span>{isArabic ? "القاهرة" : "CAIRO"}</span>
                </div>
                <div className="auth-route-track" aria-hidden="true">
                  <span className="auth-route-plane"><Plane size={15} /></span>
                </div>
                <div className="auth-route-stop auth-route-stop-end">
                  <strong>JED</strong>
                  <span>{isArabic ? "جدة" : "JEDDAH"}</span>
                </div>
              </div>

              <div className="auth-preview-trip" dir={locale}>
                <span className="auth-preview-trip-icon"><Hotel size={17} /></span>
                <span className="auth-preview-trip-copy">
                  <small>{isArabic ? "مثال على تفاصيل الحجز" : "BOOKING DETAILS EXAMPLE"}</small>
                  <strong>{isArabic ? "إقامة فندقية • مكة المكرمة" : "Hotel stay • Makkah"}</strong>
                  <span>{isArabic ? "بيانات الرحلة والحجز في ملف واحد" : "Trip and booking details in one record"}</span>
                </span>
                <span className="auth-preview-status"><i />{isArabic ? "مؤكد" : "CONFIRMED"}</span>
              </div>
            </div>

            <div className="auth-feature-strip">
              <div className="auth-feature-item"><Hotel size={15} /><span>{isArabic ? "الفنادق" : "Hotels"}</span></div>
              <div className="auth-feature-item"><Plane size={15} /><span>{isArabic ? "الطيران" : "Flights"}</span></div>
              <div className="auth-feature-item"><Users size={15} /><span>{isArabic ? "العملاء" : "Clients"}</span></div>
              <div className="auth-feature-item"><Bus size={15} /><span>{isArabic ? "النقل" : "Transport"}</span></div>
            </div>

            <div className="auth-visual-footer">
              <span><ShieldCheck size={14} /> {isArabic ? "خصوصية وصلاحيات مستقلة لكل شركة" : "Company-level privacy and access controls"}</span>
              <span>© {new Date().getFullYear()} NEW HOST TRAVEL</span>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
