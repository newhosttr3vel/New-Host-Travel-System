import type { ReactNode } from "react";
import { ArrowUpRight, Building2, Hotel, Plane, Users } from "lucide-react";
import type { Locale } from "@/lib/messages";

type AuthStage = "login" | "register" | "recovery" | "reset";

const stageCopy = {
  ar: {
    login: {
      eyebrow: "منصة متكاملة لإدارة السفر",
      title: <>إدارة السفر،<br /><em>بصورة أوضح.</em></>,
      description: "نظّم الحجوزات والعملاء والموردين في مساحة عمل واحدة، وتابع تفاصيل عملياتك بثقة ووضوح.",
    },
    register: {
      eyebrow: "مساحة عمل جديدة",
      title: <>ابدأ من هنا،<br /><em>ورتّب كل التفاصيل.</em></>,
      description: "أنشئ مساحة مستقلة لشركتك، واجمع فريقك وعمليات السفر اليومية داخل نظام واحد.",
    },
    recovery: {
      eyebrow: "استعادة الوصول",
      title: <>نوصّلك لحسابك،<br /><em>بخطوات آمنة.</em></>,
      description: "أعد الوصول إلى مساحة عملك من خلال رابط استعادة يُرسل إلى بريدك الإلكتروني.",
    },
    reset: {
      eyebrow: "تحديث بيانات الأمان",
      title: <>حسابك يستحق،<br /><em>حماية أقوى.</em></>,
      description: "اختر كلمة مرور جديدة وقوية، ثم تابع إدارة أعمالك من مساحة شركتك.",
    },
  },
  en: {
    login: {
      eyebrow: "AN OPERATING SYSTEM FOR TRAVEL",
      title: <>Travel operations,<br /><em>with a clearer view.</em></>,
      description: "Bring reservations, clients and suppliers together in one workspace, with every operation easier to follow.",
    },
    register: {
      eyebrow: "A NEW WORKSPACE",
      title: <>Start with clarity.<br /><em>Grow with confidence.</em></>,
      description: "Create an independent company workspace and bring your team and daily travel operations together.",
    },
    recovery: {
      eyebrow: "ACCOUNT RECOVERY",
      title: <>Your workspace,<br /><em>within reach.</em></>,
      description: "Regain access to your workspace through a secure reset link sent to your email address.",
    },
    reset: {
      eyebrow: "ACCOUNT SECURITY",
      title: <>A stronger password.<br /><em>A safer workspace.</em></>,
      description: "Choose a new, strong password and continue managing your company workspace.",
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
        <aside className="nh-auth-brand-panel" dir={isArabic ? "rtl" : "ltr"}>
          <div className="nh-auth-atmosphere" aria-hidden="true">
            <span className="nh-auth-atmosphere-aurora nh-auth-atmosphere-aurora-one" />
            <span className="nh-auth-atmosphere-aurora nh-auth-atmosphere-aurora-two" />
            <span className="nh-auth-atmosphere-orbit" />
            <span className="nh-auth-atmosphere-beam" />
            <span className="nh-auth-atmosphere-glint nh-auth-atmosphere-glint-one" />
            <span className="nh-auth-atmosphere-glint nh-auth-atmosphere-glint-two" />
            <span className="nh-auth-atmosphere-glint nh-auth-atmosphere-glint-three" />
            <span className="nh-auth-atmosphere-glint nh-auth-atmosphere-glint-four" />
            <svg className="nh-auth-atmosphere-route" viewBox="0 0 900 620" preserveAspectRatio="none">
              <path d="M-60 480C110 390 160 130 360 165S650 500 960 120" />
              <path d="M-80 535C95 450 190 210 380 225S680 545 980 190" />
            </svg>
          </div>
          <div className="nh-auth-brandbar">
            <div className="nh-auth-brand-lockup">
              <span className="nh-auth-logo-frame">
                <img src="/brand/new-host-logo.jpg" alt="New Host Travel" />
              </span>
            </div>
            <span className="nh-auth-brand-index">TRAVEL OPERATIONS</span>
          </div>

          <div className="nh-auth-brand-main">
            <div className="nh-auth-brand-copy">
              <span className="nh-auth-eyebrow"><i />{copy.eyebrow}</span>
              <h1>{copy.title}</h1>
              <p>{copy.description}</p>
            </div>

            <div className="nh-auth-slogan">
              <span className="nh-auth-slogan-mark" aria-hidden="true" />
              <p>{isArabic ? "مساحة واحدة لإدارة أعمال السفر" : "ONE WORKSPACE FOR TRAVEL OPERATIONS"}</p>
            </div>

            <div className="nh-auth-scene" aria-label={isArabic ? "تصور توضيحي لمسار سفر من القاهرة إلى جدة" : "Illustrative travel route from Cairo to Jeddah"}>
              <svg className="nh-auth-scene-map" viewBox="0 0 660 360" fill="none" aria-hidden="true">
                <defs>
                  <linearGradient id="nh-route-gradient" x1="80" y1="260" x2="590" y2="70" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#D7BC88" stopOpacity=".1" />
                    <stop offset=".48" stopColor="#E4D0A7" />
                    <stop offset="1" stopColor="#B9E6C9" stopOpacity=".25" />
                  </linearGradient>
                  <radialGradient id="nh-globe-gradient" cx="0" cy="0" r="1" gradientTransform="translate(340 170) rotate(90) scale(170 290)" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#8AD2A9" stopOpacity=".15" />
                    <stop offset="1" stopColor="#8AD2A9" stopOpacity="0" />
                  </radialGradient>
                </defs>
                <circle cx="340" cy="170" r="158" fill="url(#nh-globe-gradient)" />
                <ellipse cx="340" cy="170" rx="158" ry="158" stroke="#DDF4E5" strokeOpacity=".17" />
                <ellipse cx="340" cy="170" rx="112" ry="158" stroke="#DDF4E5" strokeOpacity=".12" />
                <ellipse cx="340" cy="170" rx="52" ry="158" stroke="#DDF4E5" strokeOpacity=".09" />
                <ellipse cx="340" cy="170" rx="158" ry="72" stroke="#DDF4E5" strokeOpacity=".13" />
                <ellipse cx="340" cy="170" rx="158" ry="116" stroke="#DDF4E5" strokeOpacity=".09" />
                <path d="M182 170H498M340 12V328" stroke="#DDF4E5" strokeOpacity=".08" />
                <path className="nh-auth-map-route" d="M96 262C175 74 303 42 420 117C478 154 522 170 580 96" stroke="url(#nh-route-gradient)" strokeWidth="2" strokeDasharray="5 9" />
                <path d="M96 262C175 74 303 42 420 117C478 154 522 170 580 96" stroke="#E8D4A9" strokeOpacity=".15" strokeWidth="18" />
                <circle cx="96" cy="262" r="6" fill="#D9BF8C" />
                <circle cx="96" cy="262" r="16" stroke="#D9BF8C" strokeOpacity=".32" />
                <circle cx="580" cy="96" r="6" fill="#B7E5C8" />
                <circle cx="580" cy="96" r="16" stroke="#B7E5C8" strokeOpacity=".28" />
                <circle cx="420" cy="117" r="4" fill="#E7D6B4" />
              </svg>

              <div className="nh-auth-map-plane" aria-hidden="true">
                <Plane size={21} strokeWidth={1.8} />
              </div>

              <div className="nh-auth-map-label nh-auth-map-label-origin" dir="ltr">
                <span>{isArabic ? "نقطة الانطلاق" : "ORIGIN"}</span>
                <strong>CAI</strong>
                <small>{isArabic ? "القاهرة" : "CAIRO"}</small>
              </div>
              <div className="nh-auth-map-label nh-auth-map-label-destination" dir="ltr">
                <span>{isArabic ? "الوجهة" : "DESTINATION"}</span>
                <strong>JED</strong>
                <small>{isArabic ? "جدة" : "JEDDAH"}</small>
              </div>

              <div className="nh-auth-scene-caption" dir="ltr">
                <span className="nh-auth-scene-caption-top">
                  <i />
                  {isArabic ? "مسار توضيحي" : "ILLUSTRATIVE ROUTE"}
                </span>
                <div>
                  <strong>CAI</strong>
                  <span>—</span>
                  <strong>JED</strong>
                </div>
                <small>{isArabic ? "رحلات • حجوزات • عمليات" : "FLIGHTS · BOOKINGS · OPERATIONS"}</small>
              </div>
            </div>

            <div className="nh-auth-capabilities">
              <span><Plane size={14} />{isArabic ? "الطيران" : "FLIGHTS"}</span>
              <span><Hotel size={14} />{isArabic ? "الفنادق" : "HOTELS"}</span>
              <span><Users size={14} />{isArabic ? "العملاء" : "CLIENTS"}</span>
              <span><Building2 size={14} />{isArabic ? "الموردون" : "SUPPLIERS"}</span>
            </div>
          </div>

          <div className="nh-auth-brand-footer">
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
              {isArabic ? "إدارة أعمالك تبدأ هنا" : "YOUR WORK STARTS HERE"}
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
