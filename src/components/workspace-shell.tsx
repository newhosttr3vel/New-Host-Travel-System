"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  CalendarDays,
  Hotel,
  LayoutDashboard,
  LogOut,
  PlaneTakeoff,
  ShieldCheck,
  Settings2,
  Users,
  WalletCards,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { t, type Locale } from "@/lib/messages";
import { LocaleToggle } from "@/components/locale-toggle";
import { hasPermission } from "@/lib/permissions";
import type { ReactNode } from "react";

const roleLabels: Record<string, { ar: string; en: string }> = {
  OWNER: { ar: "مالك الشركة", en: "Owner" },
  ADMINISTRATOR: { ar: "مدير النظام", en: "Administrator" },
  BRANCH_MANAGER: { ar: "مدير فرع", en: "Branch manager" },
  RESERVATIONS_MANAGER: { ar: "مدير الحجوزات", en: "Reservations manager" },
  RESERVATIONS_AGENT: { ar: "موظف حجوزات", en: "Reservations agent" },
  ACCOUNTANT: { ar: "محاسب", en: "Accountant" },
  SALES: { ar: "مبيعات", en: "Sales" },
  VISA_OFFICER: { ar: "مسؤول تأشيرات", en: "Visa officer" },
  OPERATIONS: { ar: "العمليات", en: "Operations" },
  HR_MANAGER: { ar: "الموارد البشرية", en: "HR manager" },
  AUDITOR: { ar: "مراجع", en: "Auditor" },
  READ_ONLY: { ar: "قراءة فقط", en: "Read only" },
};

type NavItem = {
  href: string;
  key: "dashboard" | "customers" | "suppliers" | "reservations" | "finance" | "settings";
  icon: typeof LayoutDashboard;
};

export function WorkspaceShell({
  children,
  locale,
  tenantName,
  role,
  userName,
}: {
  children: ReactNode;
  locale: Locale;
  tenantName: string;
  role: string;
  userName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const ar = locale === "ar";

  async function signOut() {
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  }

  const sections: { label: string; items: NavItem[] }[] = [
    {
      label: ar ? "مركز القيادة" : "COMMAND CENTER",
      items: [{ href: "/dashboard", key: "dashboard" as const, icon: LayoutDashboard }],
    },
    {
      label: ar ? "إدارة أعمال السفر" : "TRAVEL BUSINESS",
      items: [
        ...(hasPermission(role, "customers:read")
          ? [{ href: "/customers", key: "customers" as const, icon: Users }]
          : []),
        ...(hasPermission(role, "suppliers:read")
          ? [{ href: "/suppliers", key: "suppliers" as const, icon: Hotel }]
          : []),
        ...(hasPermission(role, "reservations:read")
          ? [{ href: "/reservations", key: "reservations" as const, icon: CalendarDays }]
          : []),
      ],
    },
    {
      label: ar ? "إعدادات النظام" : "SYSTEM SETTINGS",
      items: (hasPermission(role, "settings:manage") || hasPermission(role, "customers:read") || hasPermission(role, "suppliers:read"))
        ? [{ href: "/settings", key: "settings" as const, icon: Settings2 }]
        : [],
    },
    {
      label: ar ? "الحسابات والمالية" : "FINANCE",
      items: hasPermission(role, "finance:read")
        ? [{ href: "/finance", key: "finance" as const, icon: WalletCards }]
        : [],
    },
  ].filter((section) => section.items.length > 0);

  const currentItem = sections
    .flatMap((section) => section.items)
    .find((item) => pathname === item.href || pathname.startsWith(item.href + "/"));
  const displayRole = roleLabels[role]?.[locale] ?? role;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand brand-logo-only" href="/dashboard" aria-label={t(locale, "appName")}>
          <span className="brand-logo-frame"><img src="/brand/new-host-logo.jpg" alt="New Host Travel" /></span>
        </Link>

        <div className="sidebar-workspace-caption">
          <span className="sidebar-workspace-mark"><PlaneTakeoff size={14} /></span>
          <span>{ar ? "مساحة تشغيل الشركة" : "COMPANY WORKSPACE"}</span>
        </div>

        <div className="sidebar-navigation">
          {sections.map((section) => (
            <div className="sidebar-section" key={section.label}>
              <div className="nav-group-label">{section.label}</div>
              <nav className="main-nav" aria-label={section.label}>
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`nav-link ${active ? "active" : ""}`}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon size={18} strokeWidth={1.9} />
                      <span>{t(locale, item.key)}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        <div className="sidebar-spacer" />
        <div className="workspace-meta">
          <div className="meta-label">{t(locale, "currentWorkspace")}</div>
          <div className="meta-name">{tenantName}</div>
          <div className="meta-status"><span className="status-dot" />{t(locale, "activeWorkspace")}</div>
        </div>
        <div className="sidebar-bottom"><ShieldCheck size={14} />{ar ? "صلاحيات حسب دور المستخدم" : "Role-based workspace access"}</div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <Building2 size={14} />
            <span>{tenantName}</span>
            <span>/</span>
            <span style={{ color: "var(--ink)", fontWeight: 700 }}>{t(locale, currentItem?.key ?? "dashboard")}</span>
          </div>
          <div className="topbar-right">
            <span className="topbar-system-label">
              <span className="topbar-system-dot" />
              {ar ? "نظام التشغيل" : "OPERATIONS"}
            </span>
            <LocaleToggle locale={locale} />
            <div className="user-chip">
              <div className="avatar">{(userName || "N").trim().slice(0, 1).toLocaleUpperCase(ar ? "ar-EG" : "en-US")}</div>
              <div>
                <div className="user-name">{userName}</div>
                <div className="user-role">{displayRole}</div>
              </div>
            </div>
            <button
              type="button"
              className="icon-button"
              title={t(locale, "signOut")}
              aria-label={t(locale, "signOut")}
              onClick={signOut}
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>
        <main className="page-content">{children}</main>
      </section>
    </div>
  );
}
