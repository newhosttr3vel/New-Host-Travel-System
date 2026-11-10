"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bus,
  Eye,
  EyeOff,
  FileCheck,
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
  const [activeShowcaseSlide, setActiveShowcaseSlide] = useState(0);
  const registering = mode === "register";
  const isArabic = locale === "ar";
  const showcaseSlides = [
    {
      icon: Hotel,
      eyebrow: isArabic ? "إدارة الفنادق والإقامة" : "HOTELS & ACCOMMODATION",
      title: isArabic ? "كل تفاصيل الإقامة تحت السيطرة." : "Every stay, under control.",
      description: isArabic ? "تابع طلبات الفنادق، الغرف، تواريخ الوصول والمغادرة، الموردين وتكلفة كل حجز." : "Manage hotel requests, room details, check-in and check-out dates, suppliers and booking costs.",
      metric: isArabic ? "حجوزات الفنادق" : "HOTEL BOOKINGS",
    },
    {
      icon: Plane,
      eyebrow: isArabic ? "الطيران والرحلات الداخلية" : "FLIGHTS & DOMESTIC TRIPS",
      title: isArabic ? "من التذكرة إلى الرحلة… في ملف واحد." : "From ticket to trip, in one file.",
      description: isArabic ? "نظّم بيانات المسافرين، القطاعات، التذاكر، البرامج السياحية والتنقلات الداخلية." : "Keep passenger details, flight segments, tickets, tour programs and local transfers connected.",
      metric: isArabic ? "الطيران والبرامج السياحية" : "FLIGHTS & TOURS",
    },
    {
      icon: MapPinned,
      eyebrow: isArabic ? "العمرة والتأشيرات" : "UMRAH & VISA OPERATIONS",
      title: isArabic ? "رحلات متكاملة ومتابعة أوضح." : "Complete journeys. Clear follow-up.",
      description: isArabic ? "تابع برامج العمرة، بيانات المعتمرين، التأشيرات، المستندات ومراحل إصدار الطلب." : "Track Umrah packages, pilgrim details, visa applications, documents and each processing stage.",
      metric: isArabic ? "العمرة والتأشيرات" : "UMRAH & VISAS",
    },
  ];
  const activeSlide = showcaseSlides[activeShowcaseSlide];
  const ActiveSlideIcon = activeSlide.icon;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveShowcaseSlide((current) => (current + 1) % 3);
    }, 6500);
    return () => window.clearInterval(timer);
  }, []);

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
            <div className="auth-visual-orbit auth-visual-orbit-one" />
            <div className="auth-visual-orbit auth-visual-orbit-two" />

            <div className="auth-visual-top">
              <div className="auth-brand-v2">
                <span className="auth-brand-logo"><img src="/brand/new-host-logo.png" alt="New Host Travel" /></span>
                <span className="auth-brand-name">
                  <strong>NEW HOST</strong>
                  <small>TRAVEL MANAGEMENT</small>
                </span>
              </div>
              <span className="auth-live-badge"><i />{isArabic ? "مساحة عملك" : "YOUR WORKSPACE"}</span>
            </div>

            <div className="auth-visual-copy">
              <span className="auth-visual-eyebrow">
                <span />
                {isArabic ? "إدارة السفر • بصورة أذكى" : "TRAVEL OPERATIONS • MADE SIMPLE"}
              </span>
              <h2>
                {isArabic
                  ? <>كل رحلات شركتك،<br />في مكان واحد.</>
                  : <>Every journey.<br />One clear view.</>}
              </h2>
              <p>
                {isArabic
                  ? "نظّم الحجوزات والعملاء والموردين والعمليات المالية من مساحة واحدة مصممة لفريقك."
                  : "Bring reservations, customers, suppliers and your day-to-day operations together in one workspace."}
              </p>
            </div>

            <div className="auth-showcase" dir="ltr">
              <div className="auth-showcase-heading">
                <div className="auth-showcase-label">
                  <span className="auth-showcase-live" />
                  {isArabic ? "منصة تشغيل متكاملة لشركات السياحة" : "THE TRAVEL AGENCY WORKSPACE"}
                </div>
                <div className="auth-showcase-controls">
                  <button type="button" onClick={() => setActiveShowcaseSlide((current) => (current + 2) % 3)} aria-label={isArabic ? "الشريحة السابقة" : "Previous slide"}><ArrowLeft size={15} /></button>
                  <button type="button" onClick={() => setActiveShowcaseSlide((current) => (current + 1) % 3)} aria-label={isArabic ? "الشريحة التالية" : "Next slide"}><ArrowRight size={15} /></button>
                </div>
              </div>
              <div key={activeShowcaseSlide} className="auth-showcase-feature" aria-live="polite">
                <div className="auth-showcase-feature-top">
                  <span className="auth-showcase-feature-icon"><ActiveSlideIcon size={25} strokeWidth={1.8} /></span>
                  <span className="auth-showcase-counter">0{activeShowcaseSlide + 1}<i />03</span>
                </div>
                <span className="auth-showcase-eyebrow">{activeSlide.eyebrow}</span>
                <h3>{activeSlide.title}</h3>
                <p>{activeSlide.description}</p>
                <div className="auth-showcase-feature-bottom">
                  <span>{activeSlide.metric}</span>
                  <span className="auth-showcase-progress"><i style={{ width: `${((activeShowcaseSlide + 1) / 3) * 100}%` }} /></span>
                </div>
              </div>
              <div className="auth-service-grid">
                <div className="auth-service-tile"><Hotel size={17} /><span>{isArabic ? "الفنادق" : "Hotels"}</span></div>
                <div className="auth-service-tile"><Plane size={17} /><span>{isArabic ? "الطيران" : "Flights"}</span></div>
                <div className="auth-service-tile"><MapPinned size={17} /><span>{isArabic ? "الرحلات الداخلية" : "Local tours"}</span></div>
                <div className="auth-service-tile"><Users size={17} /><span>{isArabic ? "رحلات العمرة" : "Umrah"}</span></div>
                <div className="auth-service-tile"><FileCheck size={17} /><span>{isArabic ? "التأشيرات" : "Visas"}</span></div>
                <div className="auth-service-tile"><Bus size={17} /><span>{isArabic ? "النقل" : "Transport"}</span></div>
              </div>
              <div className="auth-showcase-dots" aria-label={isArabic ? "شرائح الخدمات" : "Service slides"}>
                {showcaseSlides.map((slide, index) => (
                  <button key={slide.metric} type="button" className={index === activeShowcaseSlide ? "active" : ""} onClick={() => setActiveShowcaseSlide(index)} aria-label={isArabic ? `الشريحة ${index + 1}` : `Slide ${index + 1}`} aria-current={index === activeShowcaseSlide ? "true" : undefined} />
                ))}
              </div>
            </div>

            <div className="auth-visual-footer">
              <span><ShieldCheck size={15} /> {isArabic ? "خصوصية وأمان على مستوى الشركة" : "Company-level privacy and security"}</span>
              <span>© {new Date().getFullYear()} NEW HOST TRAVEL</span>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
