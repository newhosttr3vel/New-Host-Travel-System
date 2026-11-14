"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { t, type Locale } from "@/lib/messages";
import { LocaleToggle } from "@/components/locale-toggle";
import { AuthPortalShell } from "@/components/auth-portal-shell";

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
  const ForwardIcon = isArabic ? ArrowLeft : ArrowRight;

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
    <AuthPortalShell
      locale={locale}
      stage={forgotPassword ? "recovery" : registering ? "register" : "login"}
    >
      <div className="nh-auth-form" dir={locale}>
        <div className="nh-auth-form-tools">
          <span className="nh-auth-form-context">
            <ShieldCheck size={15} />
            {forgotPassword
              ? (isArabic ? "استعادة حسابك" : "ACCOUNT RECOVERY")
              : registering
                ? (isArabic ? "تسجيل شركة جديدة" : "NEW COMPANY SETUP")
                : (isArabic ? "تسجيل دخول الأعضاء" : "MEMBER SIGN IN")}
          </span>
          <LocaleToggle locale={locale} />
        </div>

        <header className="nh-auth-form-heading">
          <span className="nh-auth-step-line">
            <i />
            {forgotPassword
              ? (isArabic ? "استعادة آمنة" : "SECURE RECOVERY")
              : registering
                ? (isArabic ? "خطوة البداية" : "GET STARTED")
                : (isArabic ? "مرحبًا بعودتك" : "WELCOME BACK")}
          </span>
          <h2>
            {forgotPassword
              ? (isArabic ? "استعادة كلمة المرور" : "Reset your password")
              : registering
                ? t(locale, "signUp")
                : t(locale, "remember")}
          </h2>
          <p>
            {forgotPassword
              ? (isArabic
                ? "أدخل البريد الإلكتروني المرتبط بحسابك وسنرسل لك رابطًا آمنًا لإعادة تعيين كلمة المرور."
                : "Enter the email address linked to your account. We’ll send you a secure reset link.")
              : t(locale, registering ? "signUpSubtitle" : "signInSubtitle")}
          </p>
        </header>

        {error && <div className="nh-auth-message nh-auth-message-error" role="alert">{error}</div>}
        {notice && <div className="nh-auth-message nh-auth-message-success" role="status" aria-live="polite">{notice}</div>}

        <form className="nh-auth-fields" onSubmit={submit}>
          {registering && (
            <div className="nh-auth-field">
              <label htmlFor="nh-auth-name">{t(locale, "fullName")}</label>
              <div className="nh-auth-input-wrap">
                <UserRound size={17} aria-hidden="true" />
                <input
                  id="nh-auth-name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  minLength={2}
                  maxLength={100}
                  placeholder={isArabic ? "اكتب اسمك بالكامل" : "Enter your full name"}
                />
              </div>
            </div>
          )}

          <div className="nh-auth-field">
            <label htmlFor="nh-auth-email">{t(locale, "email")}</label>
            <div className="nh-auth-input-wrap" dir={locale}>
              <Mail size={17} aria-hidden="true" />
              <input
                id="nh-auth-email"
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
            </div>
          </div>

          {!forgotPassword && (
            <div className="nh-auth-field">
              <div className="nh-auth-field-heading">
                <label htmlFor="nh-auth-password">{t(locale, "password")}</label>
                {!registering && (
                  <button type="button" className="nh-auth-text-button" onClick={openRecovery}>
                    {isArabic ? "نسيت كلمة المرور؟" : "Forgot password?"}
                  </button>
                )}
              </div>

              <div className="nh-auth-password">
                <LockKeyhole className="nh-auth-password-icon" size={17} aria-hidden="true" />
                <input
                  id="nh-auth-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={registering ? "new-password" : "current-password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={registering ? 12 : 1}
                  maxLength={128}
                  dir="ltr"
                  aria-describedby={registering ? "nh-auth-password-hint" : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword
                    ? (isArabic ? "إخفاء كلمة المرور" : "Hide password")
                    : (isArabic ? "إظهار كلمة المرور" : "Show password")}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {registering && (
                <span id="nh-auth-password-hint" className="nh-auth-hint">
                  {isArabic ? "12 حرفًا على الأقل لزيادة أمان حسابك." : "Use at least 12 characters for a stronger password."}
                </span>
              )}
            </div>
          )}

          <button className="nh-auth-primary" type="submit" disabled={pending}>
            <span>
              {pending
                ? t(locale, "creating")
                : forgotPassword
                  ? (isArabic ? "إرسال رابط الاستعادة" : "Send recovery link")
                  : t(locale, registering ? "signUp" : "signIn")}
            </span>
            {!pending && <ForwardIcon size={18} />}
          </button>
        </form>

        <div className="nh-auth-form-bottom">
          {forgotPassword ? (
            <>
              <span>{isArabic ? "تذكرت كلمة المرور؟" : "Remembered your password?"}</span>
              <button type="button" onClick={returnToLogin}>
                {isArabic ? "العودة لتسجيل الدخول" : "Back to sign in"}
              </button>
            </>
          ) : registering ? (
            <>
              <span>{t(locale, "haveAccount")}</span>
              <Link href="/login">{t(locale, "signIn")}</Link>
            </>
          ) : (
            <span>
              {isArabic
                ? "إنشاء الحسابات متاح لمالك النظام فقط."
                : "New accounts can only be created by the system owner."}
            </span>
          )}
        </div>

        <div className="nh-auth-form-assurance">
          <ShieldCheck size={15} />
          <span>{isArabic ? "نحافظ على خصوصية بيانات شركتك وصلاحيات فريقك." : "Your company data and team permissions stay protected."}</span>
        </div>
      </div>
    </AuthPortalShell>
  );
}
