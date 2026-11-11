"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import type { Locale } from "@/lib/messages";
import { LocaleToggle } from "@/components/locale-toggle";
import { AuthPortalShell } from "@/components/auth-portal-shell";

export function ResetPasswordForm({ token, locale }: { token?: string; locale: Locale }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const isArabic = locale === "ar";
  const BackIcon = isArabic ? ArrowRight : ArrowLeft;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!token) {
      setError(isArabic ? "الرابط غير صالح أو انتهت صلاحيته. اطلب رابط استعادة جديدًا." : "This reset link is invalid or expired. Request a new one.");
      return;
    }

    if (password !== confirm) {
      setError(isArabic ? "كلمتا المرور غير متطابقتين." : "The passwords do not match.");
      return;
    }

    setPending(true);
    try {
      const result = await authClient.resetPassword({ newPassword: password, token });
      if (result.error) {
        setError(result.error.message || (isArabic ? "تعذر تغيير كلمة المرور." : "Could not reset the password."));
      } else {
        setNotice(isArabic ? "تم تغيير كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن." : "Your password has been changed. You can now sign in.");
      }
    } catch {
      setError(isArabic ? "حدث خطأ. حاول مرة أخرى." : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthPortalShell locale={locale} stage="reset">
      <div className="nh-auth-form" dir={locale}>
        <div className="nh-auth-form-tools">
          <span className="nh-auth-form-context">
            <ShieldCheck size={15} />
            {isArabic ? "تحديث بيانات الأمان" : "UPDATE SECURITY DETAILS"}
          </span>
          <LocaleToggle locale={locale} />
        </div>

        <header className="nh-auth-form-heading">
          <span className="nh-auth-step-line">
            <i />
            {isArabic ? "خطوة أخيرة" : "ONE LAST STEP"}
          </span>
          <h2>{isArabic ? "تعيين كلمة مرور جديدة" : "Choose a new password"}</h2>
          <p>{isArabic ? "اختَر كلمة مرور قوية لا تقل عن 12 حرفًا، ثم أكدها." : "Choose a strong password with at least 12 characters, then confirm it."}</p>
        </header>

        {error && <div className="nh-auth-message nh-auth-message-error" role="alert">{error}</div>}
        {notice && <div className="nh-auth-message nh-auth-message-success" role="status" aria-live="polite">{notice}</div>}

        {token && !notice && (
          <form className="nh-auth-fields" onSubmit={submit}>
            <div className="nh-auth-field">
              <label htmlFor="nh-reset-password">{isArabic ? "كلمة المرور الجديدة" : "New password"}</label>
              <div className="nh-auth-password">
                <input
                  id="nh-reset-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={12}
                  maxLength={128}
                  required
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? (isArabic ? "إخفاء كلمة المرور" : "Hide password") : (isArabic ? "إظهار كلمة المرور" : "Show password")}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <span className="nh-auth-hint">{isArabic ? "12 حرفًا على الأقل." : "At least 12 characters."}</span>
            </div>

            <div className="nh-auth-field">
              <label htmlFor="nh-reset-confirm">{isArabic ? "تأكيد كلمة المرور" : "Confirm password"}</label>
              <div className="nh-auth-password">
                <input
                  id="nh-reset-confirm"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  minLength={12}
                  maxLength={128}
                  required
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((value) => !value)}
                  aria-label={showConfirm ? (isArabic ? "إخفاء التأكيد" : "Hide confirmation") : (isArabic ? "إظهار التأكيد" : "Show confirmation")}
                  aria-pressed={showConfirm}
                >
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button className="nh-auth-primary" type="submit" disabled={pending || password.length < 12 || confirm.length < 12}>
              <span>{pending ? (isArabic ? "جارٍ تحديث كلمة المرور..." : "Updating password...") : (isArabic ? "حفظ كلمة المرور الجديدة" : "Save new password")}</span>
              {!pending && <BackIcon size={18} />}
            </button>
          </form>
        )}

        <div className="nh-auth-form-bottom">
          <span>{isArabic ? "تذكرت كلمة المرور؟" : "Remembered your password?"}</span>
          <Link href="/login">{isArabic ? "العودة لتسجيل الدخول" : "Back to sign in"}</Link>
        </div>

        <div className="nh-auth-form-assurance">
          <ShieldCheck size={15} />
          <span>{isArabic ? "لن نشارك بيانات حسابك مع أي جهة." : "Your account details remain private."}</span>
        </div>
      </div>
    </AuthPortalShell>
  );
}
