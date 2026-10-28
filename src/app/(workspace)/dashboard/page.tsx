import Link from "next/link";
import { ArrowUpLeft, ArrowUpRight, CalendarDays, CircleUserRound, Hotel, Plus, ShieldCheck, Users, WalletCards } from "lucide-react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTenantContext } from "@/lib/tenant-context";
import { currentLocale } from "@/lib/i18n";
import { t } from "@/lib/messages";
import { hasPermission } from "@/lib/permissions";

export default async function DashboardPage() {
  const { session, membership } = await getTenantContext();
  if (!session) redirect("/login");
  if (!membership) redirect("/onboarding");
  const locale = await currentLocale();
  const tenantId = membership.tenantId;
  const canReadCustomers = hasPermission(membership.role, "customers:read");
  const canReadSuppliers = hasPermission(membership.role, "suppliers:read");
  const canReadReservations = hasPermission(membership.role, "reservations:read");
  const [customers, suppliers, reservations, recentCustomers] = await Promise.all([
    canReadCustomers ? prisma.customer.count({ where: { tenantId, archivedAt: null } }) : Promise.resolve(null),
    canReadSuppliers ? prisma.supplier.count({ where: { tenantId, archivedAt: null } }) : Promise.resolve(null),
    canReadReservations ? prisma.reservation.count({ where: { tenantId, archivedAt: null } }) : Promise.resolve(null),
    canReadCustomers ? prisma.customer.findMany({ where: { tenantId, archivedAt: null }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, name: true, email: true, phone: true, createdAt: true } }) : Promise.resolve([])
  ]);
  const number = new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US");
  const dateLocale = locale === "ar" ? "ar-EG" : "en-US";
  const Arrow = locale === "ar" ? ArrowUpLeft : ArrowUpRight;
  const stats = [
    { key: "totalCustomers" as const, value: customers, hint: t(locale, "customerCountHint"), icon: Users },
    { key: "totalSuppliers" as const, value: suppliers, hint: t(locale, "supplierCountHint"), icon: Hotel },
    { key: "totalReservations" as const, value: reservations, hint: t(locale, "reservationCountHint"), icon: CalendarDays }
  ];
  return <>
    <div className="page-heading">
      <div><div className="eyebrow">{locale === "ar" ? "نظرة عامة" : "OVERVIEW"}</div><h1 className="page-title">{t(locale, "dashboardWelcome")}</h1><p className="page-description">{t(locale, "dashboardSubtitle")}</p></div>
      <div className="page-actions"><Link className="btn btn-primary" href="/customers"><Plus size={16} />{t(locale, "addCustomer")}</Link></div>
    </div>
    <section className="stat-grid" aria-label={t(locale, "dashboard")}>
      {stats.map((stat) => { const Icon = stat.icon; return <article className="stat-card" key={stat.key}>
        <div className="stat-top"><span className="stat-label">{t(locale, stat.key)}</span><span className="stat-icon"><Icon size={18} /></span></div>
        <div className="stat-value">{stat.value === null ? "—" : number.format(stat.value)}</div><div className="stat-hint">{stat.hint}</div>
      </article>; })}
    </section>
    <div className="dashboard-grid">
      <section className="panel">
        <div className="panel-header"><div><h2 className="panel-title">{t(locale, "recentCustomers")}</h2><div className="panel-subtitle">{locale === "ar" ? "آخر السجلات المضافة إلى قاعدة البيانات" : "Latest records saved to the database"}</div></div><Link className="btn btn-secondary" href="/customers">{t(locale, "viewCustomers")} <Arrow size={14} /></Link></div>
        {!canReadCustomers ? <div className="empty-state"><div className="empty-icon"><CircleUserRound size={22} /></div><div className="empty-title">{t(locale, "accessDenied")}</div></div> : recentCustomers.length === 0 ? <div className="empty-state"><div className="empty-icon"><CircleUserRound size={22} /></div><div className="empty-title">{t(locale, "noCustomersYet")}</div><p className="empty-copy">{t(locale, "startWithCustomer")}</p><Link className="btn btn-primary" style={{ marginTop: 16 }} href="/customers"><Plus size={15} />{t(locale, "addCustomer")}</Link></div> :
          <div className="table-wrap"><table className="data-table"><thead><tr><th>{t(locale, "customerName")}</th><th>{t(locale, "phone")}</th><th>{t(locale, "createdAt")}</th></tr></thead><tbody>
            {recentCustomers.map((customer) => <tr key={customer.id}><td><div className="customer-primary">{customer.name}</div><div className="customer-secondary">{customer.email || "—"}</div></td><td>{customer.phone || "—"}</td><td>{new Intl.DateTimeFormat(dateLocale, { dateStyle: "medium" }).format(customer.createdAt)}</td></tr>)}
          </tbody></table></div>}
      </section>
      <aside className="panel">
        <div className="panel-header"><div><h2 className="panel-title">{t(locale, "quickActions")}</h2><div className="panel-subtitle">{locale === "ar" ? "أقصر طريق إلى عملك اليومي" : "Shortcuts to your daily work"}</div></div><WalletCards size={19} color="var(--green)" /></div>
        <div className="panel-body"><div className="action-list">
          {canReadCustomers && <Link className="action-item" href="/customers"><span className="action-symbol"><Users size={18} /></span><span><span className="action-title" style={{ display: "block" }}>{t(locale, "addCustomer")}</span><span className="action-copy">{locale === "ar" ? "إضافة سجل جديد إلى قاعدة العملاء" : "Add a record to your customer directory"}</span></span><Arrow size={15} style={{ marginInlineStart: "auto", color: "var(--muted)" }} /></Link>}
          {canReadSuppliers && <Link className="action-item" href="/suppliers"><span className="action-symbol"><Hotel size={18} /></span><span><span className="action-title" style={{ display: "block" }}>{t(locale, "suppliers")}</span><span className="action-copy">{t(locale, "suppliersSubtitle")}</span></span><Arrow size={15} style={{ marginInlineStart: "auto", color: "var(--muted)" }} /></Link>}
          {canReadReservations && <Link className="action-item" href="/reservations"><span className="action-symbol"><CalendarDays size={18} /></span><span><span className="action-title" style={{ display: "block" }}>{t(locale, "reservations")}</span><span className="action-copy">{t(locale, "reservationsSubtitle")}</span></span><Arrow size={15} style={{ marginInlineStart: "auto", color: "var(--muted)" }} /></Link>}
          <div className="action-item"><span className="action-symbol"><ShieldCheck size={18} /></span><span><span className="action-title" style={{ display: "block" }}>{t(locale, "systemStatus")}</span><span className="action-copy">{t(locale, "databaseConnected")}</span></span></div>
        </div><div className="notice-card" style={{ marginTop: 16 }}>{t(locale, "securityNote")}</div></div>
      </aside>
    </div>
  </>;
}
