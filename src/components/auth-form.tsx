"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Bus,
  Eye,
  EyeOff,
  Hotel,
  LockKeyhole,
  MapPinned,
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

  const registering = mode === "register";
  const isArabic = locale === "ar";

  function clearFeedback() {
    setError("");
    setNotice("");
  }

  function openRecovery() {
    setForgotPassword(true);
    setPassword("");
    setShowPassword(false);
    clearFeedback();
  }

  function returnToLogin() {
    setForgotPassword(false);
    clearFeedback();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();
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
          setNotice(
            isArabic
              ? "لو البريد الإلكتروني مرتبط بحساب، هيوصلك رابط آمن لإعادة تعيين كلمة المرور."
              : "If this email belongs to an account, a secure password reset link will be sent to it.",
          );
        }
        return;
      }

      const result = registering
        ? await authClient.signUp.email({
            name: name.trim(),
            email: email.trim(),
            password,
          })
        : await authClient.signIn.email({
            email: email.trim(),
            password,
          });

      if (result.error) {
        setError(
          registering
            ? result.error.message || t(locale, "genericError")
            : t(locale, "invalidCredentials"),
        );
        return;
      }

      if (registering && process.env.NODE_ENV === "production") {
        setNotice(
          isArabic
            ? "تم إنشاء الحساب. راجع بريدك الإلكتروني واضغط رابط التحقق قبل تسجيل الدخول."
            : "Your account was created. Verify your email using the link we sent before signing in.",
        );
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
        <span className="auth-glow auth-glow-one" />
        <span className="auth-glow auth-glow-two" />
        <span className="auth-grid-wash" />
      </div>

      <div className="auth-layout-wrap">
        <div className="auth-page-heading">
          <span className="auth-heading-rule" />
          <span className="auth-heading-copy">
            <ShieldCheck size={15} aria-hidden="true" />
            {isArabic ? "بوابة العمل الآمنة لشركة نيو هوست" : "NEW HOST SECURE WORKSPACE"}
          </span>
          <span className="auth-heading-rule" />
        </div>

        <div
          className={[
            "auth-card-layout",
            registering ? "auth-card-register" : "",
            forgotPassword ? "auth-card-recovery" : "",
          ].filter(Boolean).join(" ")}
        >
          <section className="auth-panel auth-form-panel" dir={locale}>
            <div className="auth-form-inner">
              <div className="auth-top-actions">
                <span className="auth-security-chip">
                  <LockKeyhole size={13} aria-hidden="true" />
                  {isArabic ? "اتصال آمن" : "SECURE ACCESS"}
                </span>
                <LocaleToggle locale={locale} />
              </div>

              <div className="auth-form-heading">
                <span className="auth-form-kicker">
                  {forgotPassword
                    ? (isArabic ? "استعادة الوصول" : "ACCOUNT RECOVERY")
                    : registering
                      ? (isArabic ? "انضم إلى مساحة عملك" : "CREATE YOUR WORKSPACE")
                      : (isArabic ? "مساحة عملك في انتظارك" : "WELCOME BACK")}
                </span>
                <h1 className="auth-title">
                  {forgotPassword
                    ? (isArabic ? "نسيت كلمة المرور؟" : "Forgot your password?")
                    : registering
                      ? t(locale, "signUp")
                      : t(locale, "remember")}
                </h1>
                <p className="auth-subtitle">
                  {forgotPassword
                    ? (isArabic
                      ? "اكتب البريد الإلكتروني المسجل عندك، وهنبعتلك رابط آمن لإعادة تعيين كلمة المرور."
                      : "Enter the email address linked to your account and we’ll send you a secure reset link.")
                    : t(locale, registering ? "signUpSubtitle" : "signInSubtitle")}
                </p>
              </div>

              {error && <div className="alert auth-feedback" role="alert">{error}</div>}
              {notice && <div className="alert success auth-feedback" role="status" aria-live="polite">{notice}</div>}

              <form className="auth-form" onSubmit={submit}>
                {registering && (
                  <label className="field auth-field" htmlFor="auth-full-name">
                    <span className="field-label">{t(locale, "fullName")}</span>
                    <input
                      id="auth-full-name"
                      className="input auth-input"
                      type="text"
                      autoComplete="name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      required
                      minLength={2}
                      maxLength={100}
                    />
                  </label>
                )}

                <label className="field auth-field" htmlFor="auth-email">
                  <span className="field-label">{t(locale, "email")}</span>
                  <input
                    id="auth-email"
                    className="input auth-input"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    maxLength={254}
                    dir="ltr"
                    placeholder="name@company.com"
                  />
                </label>

                {!forgotPassword && (
                  <label className="field auth-field" htmlFor="auth-password">
                    <span className="auth-label-row">
                      <span className="field-label">{t(locale, "password")}</span>
                      {!registering && (
                        <button className="auth-inline-link" type="button" onClick={openRecovery}>
                          {isArabic ? "نسيت كلمة المرور؟" : "Forgot password?"}
                        </button>
                      )}
                    </span>
                    <span className="auth-password-wrap">
                      <input
                        id="auth-password"
                        className="input auth-input auth-password-input"
                        type={showPassword ? "text" : "password"}
                        autoComplete={registering ? "new-password" : "current-password"}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                        minLength={registering ? 12 : 1}
                        maxLength={128}
                        dir="ltr"
                        aria-describedby={registering ? "auth-password-hint" : undefined}
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
                        {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </span>
                    {registering && (
                      <span id="auth-password-hint" className="auth-password-hint">
                        {isArabic ? "استخدم 12 حرفًا على الأقل لحماية حسابك." : "Use at least 12 characters to protect your account."}
                      </span>
                    )}
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
                    <span>{isArabic ? "تذكرت كلمة المرور؟" : "Remembered your password?"}</span>
                    <button className="text-link" type="button" onClick={returnToLogin}>
                      {isArabic ? "العودة لتسجيل الدخول" : "Back to sign in"}
                    </button>
                  </>
                ) : registering ? (
                  <>
                    <span>{t(locale, "haveAccount")}</span>
                    <Link className="text-link" href="/login">{t(locale, "signIn")}</Link>
                  </>
                ) : (
                  <>
                    <span>{t(locale, "noAccount")}</span>
                    <Link className="text-link" href="/register">{t(locale, "signUp")}</Link>
                  </>
                )}
              </div>

              <div className="auth-secure-note">
                <ShieldCheck size={14} aria-hidden="true" />
                <span>
                  {isArabic
                    ? "بيانات كل شركة محمية داخل مساحة مستقلة."
                    : "Every company’s data stays in its own protected workspace."}
                </span>
              </div>
            </div>
          </section>

          <section className="auth-visual-v2" dir={locale}>
            <div className="auth-visual-decoration auth-visual-decoration-one" aria-hidden="true" />
            <div className="auth-visual-decoration auth-visual-decoration-two" aria-hidden="true" />

            <div className="auth-visual-top">
              <div className="auth-brand-v2">
                <span className="auth-brand-logo">
                  <img src="/brand/new-host-logo.jpg" alt="New Host Travel" />
                </span>
                <span className="auth-brand-caption">
                  <strong>NEW HOST</strong>
                  <small>TRAVEL MANAGEMENT</small>
                </span>
              </div>
              <span className="auth-live-badge">
                <i />
                {isArabic ? "مساحة موحّدة" : "ONE WORKSPACE"}
              </span>
            </div>

            <div className="auth-hero-copy">
              <span className="auth-visual-eyebrow">
                <i />
                {isArabic ? "إدارة السفر • بصورة أذكى" : "TRAVEL OPERATIONS, SIMPLIFIED"}
              </span>
              <h2>
                {isArabic
                  ? <>كل رحلة تبدأ من هنا،<br />وكل التفاصيل في مكانها.</>
                  : <>Every journey starts here.<br />Every detail in place.</>}
              </h2>
              <p>
                {isArabic
                  ? "نظّم الحجوزات والعملاء والموردين، وتابع شغلك اليومي من مساحة واحدة مصممة لفريق السفر."
                  : "Organize reservations, clients and suppliers, then keep your travel operation moving from one focused workspace."}
              </p>
            </div>

            <div className="auth-journey-board" dir="ltr" aria-label={isArabic ? "مثال توضيحي لمسار رحلة" : "Illustrative journey preview"}>
              <div className="auth-journey-board-head">
                <span className="auth-journey-board-title">
                  <MapPinned size={16} />
                  {isArabic ? "معاينة لمسار رحلة" : "JOURNEY PREVIEW"}
                </span>
                <span className="auth-journey-board-tag">NH / 01</span>
              </div>

              <div className="auth-journey-route">
                <div className="auth-journey-stop">
                  <strong>CAI</strong>
                  <span>{isArabic ? "القاهرة" : "CAIRO"}</span>
                </div>
                <div className="auth-journey-track">
                  <span className="auth-journey-track-line" />
                  <span className="auth-journey-plane"><Plane size={17} /></span>
                  <span className="auth-journey-track-dot auth-journey-track-dot-start" />
                  <span className="auth-journey-track-dot auth-journey-track-dot-end" />
                </div>
                <div className="auth-journey-stop auth-journey-stop-end">
                  <strong>JED</strong>
                  <span>{isArabic ? "جدة" : "JEDDAH"}</span>
                </div>
              </div>

              <div className="auth-journey-divider" />
              <div className="auth-journey-detail">
                <span className="auth-journey-detail-icon"><Hotel size={17} /></span>
                <span className="auth-journey-detail-copy">
                  <small>{isArabic ? "تفاصيل الخدمات" : "SERVICE DETAILS"}</small>
                  <strong>{isArabic ? "فنادق • طيران • نقل" : "Hotels • Flights • Transport"}</strong>
                </span>
                <span className="auth-journey-detail-check"><ShieldCheck size={16} /></span>
              </div>
            </div>

            <div className="auth-visual-bottom">
              <div className="auth-feature-list">
                <span><Hotel size={14} />{isArabic ? "الفنادق" : "Hotels"}</span>
                <span><Plane size={14} />{isArabic ? "الطيران" : "Flights"}</span>
                <span><Users size={14} />{isArabic ? "العملاء" : "Clients"}</span>
                <span><Bus size={14} />{isArabic ? "النقل" : "Transport"}</span>
              </div>
              <div className="auth-visual-footer">
                <span><LockKeyhole size={13} />{isArabic ? "مصممة لفرق السفر" : "BUILT FOR TRAVEL TEAMS"}</span>
                <span>© {new Date().getFullYear()} NEW HOST TRAVEL</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
