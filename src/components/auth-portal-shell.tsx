import type { ReactNode } from "react";
import type { Locale } from "@/lib/messages";

type AuthStage = "login" | "register" | "recovery" | "reset";

const stageCopy = {
  ar: {
    login: {
      eyebrow: "منصة تشغيل أعمال السفر",
      title: <>خلّي شغلك<br /><em>يمشي بسلاسة.</em></>,
      description: "كل حجوزاتك وعملاءك ومورّدينك في مساحة واحدة، بتجربة واضحة تساعد فريقك يشتغل بثقة.",
    },
    register: {
      eyebrow: "مساحة جديدة لفريقك",
      title: <>ابدأ بتنظيم<br /><em>رحلتك القادمة.</em></>,
      description: "أنشئ مساحة شركتك، واجمع عمليات السفر اليومية في نظام واحد قابل للنمو مع فريقك.",
    },
    recovery: {
      eyebrow: "استعادة الوصول",
      title: <>نرجّعك لشغلك<br /><em>بخطوات آمنة.</em></>,
      description: "هنساعدك تستعيد الوصول لحسابك من خلال رابط آمن يُرسل إلى بريدك الإلكتروني.",
    },
    reset: {
      eyebrow: "تأمين حسابك",
      title: <>كلمة مرور جديدة،<br /><em>وبداية آمنة.</em></>,
      description: "اختَر كلمة مرور قوية، وارجع لمساحة عملك مع حماية أفضل لحسابك.",
    },
  },
  en: {
    login: {
      eyebrow: "TRAVEL BUSINESS PLATFORM",
      title: <>Make every<br /><em>move seamless.</em></>,
      description: "Bring reservations, clients and suppliers together in one focused workspace built for travel teams.",
    },
    register: {
      eyebrow: "A NEW SPACE FOR YOUR TEAM",
      title: <>Build your next<br /><em>chapter here.</em></>,
      description: "Create your company workspace and bring day-to-day travel operations into one place that grows with your team.",
    },
    recovery: {
      eyebrow: "ACCOUNT RECOVERY",
      title: <>Back to work,<br /><em>securely.</em></>,
      description: "We'll help you regain access through a secure reset link sent to your email address.",
    },
    reset: {
      eyebrow: "SECURE YOUR ACCOUNT",
      title: <>A fresh password.<br /><em>A safer start.</em></>,
      description: "Choose a strong new password and return to your workspace with confidence.",
    },
  },
} as const;

export function AuthPortalShell({
  locale,
  stage,
  children,
}: {
  locale: Locale;
  stage: AuthStage;
  children: ReactNode;
}) {
  const isArabic = locale === "ar";
  const copy = stageCopy[locale][stage];

  return (
    <main className="nh-auth-shell" data-stage={stage}>
      <div className="nh-auth-backdrop" aria-hidden="true">
        <span className="nh-auth-backdrop-glow nh-auth-backdrop-glow-one" />
        <span className="nh-auth-backdrop-glow nh-auth-backdrop-glow-two" />
        <span className="nh-auth-backdrop-grid" />
      </div>

      <div className="nh-auth-frame">
        <aside className="nh-auth-brand-panel" dir={locale}>
          <div className="nh-auth-brandbar">
            <div className="nh-auth-brand-lockup">
              <span className="nh-auth-logo-frame">
                <img src="/brand/new-host-logo.jpg" alt="New Host Travel" />
              </span>
              <span className="nh-auth-wordmark">
                <strong>NEW HOST</strong>
                <small>TRAVEL MANAGEMENT</small>
              </span>
            </div>
            <span className="nh-auth-brand-index">NH / WORKSPACE</span>
          </div>

          <div className="nh-auth-brand-main">
            <div className="nh-auth-brand-copy">
              <span className="nh-auth-eyebrow"><i />{copy.eyebrow}</span>
              <h1>{copy.title}</h1>
              <p>{copy.description}</p>
            </div>

            <div className="nh-auth-route-card" dir="ltr">
              <div className="nh-auth-route-card-top">
                <span>{isArabic ? "مثال لمسار رحلة" : "SAMPLE ITINERARY"}</span>
                <span className="nh-auth-route-ref">NH <b>—</b> 001</span>
              </div>

              <div className="nh-auth-route-main">
                <div className="nh-auth-airport">
                  <span className="nh-auth-airport-label">{isArabic ? "المغادرة" : "FROM"}</span>
                  <strong>CAI</strong>
                  <small>{isArabic ? "القاهرة" : "CAIRO"}</small>
                </div>

                <div className="nh-auth-route-connector">
                  <span className="nh-auth-route-origin" />
                  <span className="nh-auth-route-line" />
                  <span className="nh-auth-route-plane">✈</span>
                  <span className="nh-auth-route-destination" />
                </div>

                <div className="nh-auth-airport nh-auth-airport-end">
                  <span className="nh-auth-airport-label">{isArabic ? "الوصول" : "TO"}</span>
                  <strong>JED</strong>
                  <small>{isArabic ? "جدة" : "JEDDAH"}</small>
                </div>
              </div>

              <div className="nh-auth-route-card-bottom">
                <span><i />{isArabic ? "رحلة توضيحية" : "ILLUSTRATIVE ROUTE"}</span>
                <span>{isArabic ? "إدارة • متابعة • تنظيم" : "MANAGE · TRACK · ORGANIZE"}</span>
              </div>
            </div>
          </div>

          <div className="nh-auth-brand-footer">
            <span>
              <i />
              {isArabic ? "كل عمليات السفر في مكان واحد" : "ONE WORKSPACE FOR TRAVEL OPERATIONS"}
            </span>
            <span>© {new Date().getFullYear()} NEW HOST TRAVEL</span>
          </div>
        </aside>

        <section className="nh-auth-form-side">
          <div className="nh-auth-form-side-top">
            <span className="nh-auth-portal-label">
              <i />
              {isArabic ? "بوابة فريق العمل" : "TEAM PORTAL"}
            </span>
            <span className="nh-auth-form-side-note">
              {isArabic ? "وصول آمن" : "SECURE ACCESS"}
            </span>
          </div>

          <div className="nh-auth-content">
            {children}
          </div>

          <div className="nh-auth-form-side-footer">
            <span><span className="nh-auth-footer-lock">⌑</span>{isArabic ? "مساحة مستقلة لكل شركة" : "PRIVATE COMPANY WORKSPACE"}</span>
            <span>{isArabic ? "نيو هوست ترافل" : "NEW HOST TRAVEL"}</span>
          </div>
        </section>
      </div>
    </main>
  );
}
