"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import type { Locale } from "@/lib/messages";

export function ResetPasswordForm({ token, locale }: { token?: string; locale: Locale }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!token) {
      setError(locale === "ar" ? "الرابط غير صالح أو انتهت صلاحيته." : "This reset link is invalid or expired.");
      return;
    }
    if (password !== confirm) {
      setError(locale === "ar" ? "كلمتا المرور غير متطابقتين." : "The passwords do not match.");
      return;
    }
    setPending(true);
    try {
      const result = await authClient.resetPassword({ newPassword: password, token });
      if (result.error) {
        setError(result.error.message || (locale === "ar" ? "تعذر تغيير كلمة المرور." : "Could not reset the password."));
      } else {
        setNotice(locale === "ar" ? "تم تغيير كلمة المرور. يمكنك تسجيل الدخول الآن." : "Your password has been changed. You can now sign in.");
      }
    } catch {
      setError(locale === "ar" ? "حدث خطأ. حاول مرة أخرى." : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return <div className="auth-card">
    <div className="reset-brand"><img src="/brand/new-host-logo.png" alt="New Host Travel" /></div>
    <h1 className="auth-title">{locale === "ar" ? "تعيين كلمة مرور جديدة" : "Choose a new password"}</h1>
    <p className="auth-subtitle">{locale === "ar" ? "استخدم كلمة مرور قوية لا تقل عن 12 حرفًا." : "Choose a strong password with at least 12 characters."}</p>
    {error && <div className="alert" role="alert">{error}</div>}
    {notice && <div className="alert" role="status">{notice}</div>}
    {token && !notice && <form className="auth-form" onSubmit={submit}>
      <label className="field">
        <span className="field-label">{locale === "ar" ? "كلمة المرور الجديدة" : "New password"}</span>
        <input className="input" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={12} maxLength={128} required dir="ltr" />
      </label>
      <label className="field">
        <span className="field-label">{locale === "ar" ? "تأكيد كلمة المرور" : "Confirm password"}</span>
        <input className="input" type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} minLength={12} maxLength={128} required dir="ltr" />
      </label>
      <button className="btn btn-primary" type="submit" disabled={pending || password.length < 12 || confirm.length < 12}>
        {pending ? (locale === "ar" ? "جارٍ الحفظ..." : "Saving...") : (locale === "ar" ? "حفظ كلمة المرور" : "Save password")}
      </button>
    </form>}
    <div className="auth-switch"><Link className="text-link" href="/login">{locale === "ar" ? "العودة لتسجيل الدخول" : "Back to sign in"}</Link></div>
  </div>;
}
