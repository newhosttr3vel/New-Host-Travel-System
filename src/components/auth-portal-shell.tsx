import type { ReactNode } from "react";
import { Building2, FileCheck2, Hotel, Plane, Route, Users } from "lucide-react";
import type { Locale } from "@/lib/messages";

type AuthStage = "login" | "register";

const stageCopy = {
  ar: {
    login: {
      eyebrow: "نيو هوست ترافل لإدارة شركات السياحة",
      title: <>كل أعمال السفر،<br /><em>في مساحة واحدة.</em></>,
      description: "من حجوزات الفنادق والطيران إلى الرحلات الداخلية وبرامج العمرة والتأشيرات، تابع العملاء والموردين والتكاليف والتحصيل من مكان واحد.",
    },
    register: {
      eyebrow: "مساحة عمل جديدة",
      title: <>ابدأ تنظيم أعمال شركتك،<br /><em>من مساحة واحدة.</em></>,
      description: "أنشئ مساحة مستقلة لشركتك، واجمع فريقك وحجوزاتك ومتابعة الموردين والحسابات داخل نظام واحد.",
    },
  },
  en: {
    login: {
      eyebrow: "NEW HOST TRAVEL · TRAVEL ERP",
      title: <>Every travel operation,<br /><em>in one workspace.</em></>,
      description: "Manage hotels, flights, domestic trips, Umrah programs and visas alongside B2B clients, suppliers and finance.",
    },
    register: {
      eyebrow: "A NEW WORKSPACE",
      title: <>Build your company workspace.<br /><em>Keep every detail connected.</em></>,
      description: "Create an independent workspace for your company, team, bookings, suppliers and financial follow-up.",
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

      <div className="nh-auth-stage" dir={isArabic ? "rtl" : "ltr"}>
        <div className="nh-auth-slogan nh-auth-slogan-outside">
          <span className="nh-auth-slogan-mark" aria-hidden="true" />
          <p>{isArabic ? "مساحة واحدة لإدارة أعمال السفر" : "ONE WORKSPACE FOR TRAVEL OPERATIONS"}</p>
        </div>

        <div className="nh-auth-frame">
        <aside className="nh-auth-brand-panel" dir={isArabic ? "rtl" : "ltr"}>

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

            <div className="nh-auth-brand-services" aria-label={isArabic ? "خدمات النظام" : "System services"}>
              <div className="nh-auth-service-item"><Hotel size={18} /><span>{isArabic ? "حجوزات الفنادق" : "Hotel reservations"}</span></div>
              <div className="nh-auth-service-item"><Plane size={18} /><span>{isArabic ? "حجوزات الطيران" : "Flight bookings"}</span></div>
              <div className="nh-auth-service-item"><Route size={18} /><span>{isArabic ? "الرحلات الداخلية" : "Domestic trips"}</span></div>
              <div className="nh-auth-service-item"><Building2 size={18} /><span>{isArabic ? "برامج العمرة" : "Umrah programs"}</span></div>
              <div className="nh-auth-service-item"><FileCheck2 size={18} /><span>{isArabic ? "إصدار التأشيرات" : "Visa processing"}</span></div>
              <div className="nh-auth-service-item"><Users size={18} /><span>{isArabic ? "العملاء والموردون" : "B2B clients & suppliers"}</span></div>
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
      </div>
    </main>
  );
}
