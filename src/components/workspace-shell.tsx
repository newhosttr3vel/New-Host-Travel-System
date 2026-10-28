"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building2, BriefcaseBusiness, Compass, Hotel, LayoutDashboard, LogOut, ShieldCheck, Users } from "lucide-react";
import { signOut } from "next-auth/react";
import { t, type Locale } from "@/lib/messages";
import { LocaleToggle } from "@/components/locale-toggle";
import { hasPermission } from "@/lib/permissions";
import type { ReactNode } from "react";

const roleLabels: Record<string, { ar: string; en: string }> = {
  OWNER: { ar: "مالك الشركة", en: "Owner" }, ADMINISTRATOR: { ar: "مدير النظام", en: "Administrator" },
  BRANCH_MANAGER: { ar: "مدير فرع", en: "Branch manager" }, RESERVATIONS_MANAGER: { ar: "مدير الحجوزات", en: "Reservations manager" },
  RESERVATIONS_AGENT: { ar: "موظف حجوزات", en: "Reservations agent" }, ACCOUNTANT: { ar: "محاسب", en: "Accountant" },
  SALES: { ar: "مبيعات", en: "Sales" }, VISA_OFFICER: { ar: "مسؤول تأشيرات", en: "Visa officer" },
  OPERATIONS: { ar: "العمليات", en: "Operations" }, HR_MANAGER: { ar: "الموارد البشرية", en: "HR manager" },
  AUDITOR: { ar: "مراجع", en: "Auditor" }, READ_ONLY: { ar: "قراءة فقط", en: "Read only" }
};
export function WorkspaceShell({ children, locale, tenantName, role, userName }: { children: ReactNode; locale: Locale; tenantName: string; role: string; userName: string }) {
  const pathname = usePathname(), router = useRouter();
  async function handleSignOut() { await signOut({ redirect: false }); router.replace("/login"); router.refresh(); }
  const nav = [
    { href: "/dashboard", key: "dashboard" as const, icon: LayoutDashboard },
    ...(hasPermission(role, "customers:read") ? [{ href: "/customers", key: "customers" as const, icon: Users }] : []),
    ...(hasPermission(role, "suppliers:read") ? [{ href: "/suppliers", key: "suppliers" as const, icon: Hotel }] : []),
    ...(hasPermission(role, "reservations:read") ? [{ href: "/reservations", key: "reservations" as const, icon: BriefcaseBusiness }] : [])
  ];
  const currentItem = nav.find((item) => pathname === item.href || pathname.startsWith(item.href + "/"));
  const displayRole = roleLabels[role]?.[locale] ?? role;
  return <div className="app-shell">
    <aside className="sidebar">
      <Link className="brand" href="/dashboard"><span className="brand-mark"><Compass size={24} color="#fff" /></span><span><span className="brand-title" style={{ display: "block" }}>{t(locale, "appName")}</span><span className="brand-subtitle">{t(locale, "appSubtitle")}</span></span></Link>
      <div><div className="nav-group-label">{locale === "ar" ? "مساحة العمل" : "WORKSPACE"}</div><nav className="main-nav" aria-label={locale === "ar" ? "التنقل الرئيسي" : "Main navigation"}>
        {nav.map((item) => { const Icon = item.icon; return <Link key={item.href} href={item.href} className={"nav-link " + (pathname === item.href ? "active" : "")} aria-current={pathname === item.href ? "page" : undefined}><Icon size={18} strokeWidth={1.9} /><span>{t(locale, item.key)}</span></Link>; })}
      </nav></div>
      <div className="sidebar-spacer" /><div className="workspace-meta"><div className="meta-label">{t(locale, "currentWorkspace")}</div><div className="meta-name">{tenantName}</div><div className="meta-status"><span className="status-dot" />{t(locale, "activeWorkspace")}</div></div>
      <div className="sidebar-bottom"><ShieldCheck size={14} />{locale === "ar" ? "مساحة عمل مؤمنة" : "Protected workspace"}</div>
    </aside>
    <section className="main-area"><header className="topbar">
      <div className="breadcrumb"><Building2 size={14} /><span>{tenantName}</span><span> / </span><span style={{ color: "var(--ink)", fontWeight: 700 }}>{t(locale, currentItem?.key ?? "dashboard")}</span></div>
      <div className="topbar-right"><LocaleToggle locale={locale} /><div className="user-chip"><div className="avatar">{(userName || "N").trim().slice(0, 1).toLocaleUpperCase(locale === "ar" ? "ar-EG" : "en-US")}</div><div><div className="user-name">{userName}</div><div className="user-role">{displayRole}</div></div></div>
        <button type="button" className="icon-button" title={t(locale, "signOut")} aria-label={t(locale, "signOut")} onClick={() => void handleSignOut()}><LogOut size={16} /></button>
      </div>
    </header><main className="page-content">{children}</main></section>
  </div>;
}
