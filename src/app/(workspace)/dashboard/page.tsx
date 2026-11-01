import Link from "next/link";
import {
  ArrowUpLeft,
  ArrowUpRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Hotel,
  Plus,
  Users,
} from "lucide-react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTenantContext } from "@/lib/tenant-context";
import { currentLocale } from "@/lib/i18n";
import { t } from "@/lib/messages";
import { hasPermission } from "@/lib/permissions";

const followUpStatuses = ["INQUIRY", "QUOTATION", "PENDING", "ON_HOLD"] as const;
const confirmedStatuses = ["CONFIRMED", "PARTIALLY_PAID", "FULLY_PAID"] as const;

const statusLabels: Record<string, { ar: string; en: string; className: string }> = {
  INQUIRY: { ar: "استفسار جديد", en: "Inquiry", className: "status-inquiry" },
  QUOTATION: { ar: "عرض سعر", en: "Quotation", className: "status-quotation" },
  PENDING: { ar: "بانتظار التأكيد", en: "Pending", className: "status-pending" },
  ON_HOLD: { ar: "معلق", en: "On hold", className: "status-hold" },
  CONFIRMED: { ar: "مؤكد", en: "Confirmed", className: "status-confirmed" },
  PARTIALLY_PAID: { ar: "مدفوع جزئيًا", en: "Part-paid", className: "status-partial" },
  FULLY_PAID: { ar: "مدفوع بالكامل", en: "Paid", className: "status-paid" },
  COMPLETED: { ar: "مكتمل", en: "Completed", className: "status-completed" },
  CANCELLED: { ar: "ملغي", en: "Cancelled", className: "status-cancelled" },
  REFUNDED: { ar: "مسترد", en: "Refunded", className: "status-cancelled" },
};

const serviceLabels: Record<string, { ar: string; en: string }> = {
  HOTEL: { ar: "فندق", en: "Hotel" },
  FLIGHT: { ar: "طيران", en: "Flight" },
  VISA: { ar: "تأشيرة", en: "Visa" },
  TRANSPORT: { ar: "نقل", en: "Transport" },
  UMRAH_PACKAGE: { ar: "باقة عمرة", en: "Umrah" },
  HAJJ_PACKAGE: { ar: "باقة حج", en: "Hajj" },
  TOUR: { ar: "برنامج سياحي", en: "Tour" },
  OTHER: { ar: "خدمة أخرى", en: "Other" },
};

export default async function DashboardPage() {
  const { session, membership } = await getTenantContext();
  if (!session) redirect("/login");
  if (!membership) redirect("/onboarding");

  const locale = await currentLocale();
  const ar = locale === "ar";
  const tenantId = membership.tenantId;
  const canReadCustomers = hasPermission(membership.role, "customers:read");
  const canReadSuppliers = hasPermission(membership.role, "suppliers:read");
  const canReadReservations = hasPermission(membership.role, "reservations:read");

  const [
    customers,
    suppliers,
    reservations,
    followUpCount,
    confirmedCount,
    statusGroups,
    recentReservations,
    followUpReservations,
  ] = await Promise.all([
    canReadCustomers
      ? prisma.customer.count({ where: { tenantId, archivedAt: null } })
      : Promise.resolve(null),
    canReadSuppliers
      ? prisma.supplier.count({ where: { tenantId, archivedAt: null } })
      : Promise.resolve(null),
    canReadReservations
      ? prisma.reservation.count({ where: { tenantId, archivedAt: null } })
      : Promise.resolve(null),
    canReadReservations
      ? prisma.reservation.count({
          where: { tenantId, archivedAt: null, status: { in: [...followUpStatuses] } },
        })
      : Promise.resolve(null),
    canReadReservations
      ? prisma.reservation.count({
          where: { tenantId, archivedAt: null, status: { in: [...confirmedStatuses] } },
        })
      : Promise.resolve(null),
    canReadReservations
      ? prisma.reservation.groupBy({
          by: ["status"],
          where: { tenantId, archivedAt: null },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    canReadReservations
      ? prisma.reservation.findMany({
          where: { tenantId, archivedAt: null },
          orderBy: { updatedAt: "desc" },
          take: 8,
          include: { customer: { select: { name: true } } },
        })
      : Promise.resolve([]),
    canReadReservations
      ? prisma.reservation.findMany({
          where: {
            tenantId,
            archivedAt: null,
            status: { in: [...followUpStatuses] },
          },
          orderBy: [{ startDate: "asc" }, { updatedAt: "desc" }],
          take: 5,
          include: { customer: { select: { name: true } } },
        })
      : Promise.resolve([]),
  ]);

  const number = new Intl.NumberFormat(ar ? "ar-EG" : "en-US");
  const dateLocale = ar ? "ar-EG" : "en-US";
  const Arrow = ar ? ArrowUpLeft : ArrowUpRight;
  const groupedCounts = Object.fromEntries(
    statusGroups.map((group) => [group.status, group._count._all]),
  ) as Record<string, number>;
  const pipeline = [
    { code: "INQUIRY", label: ar ? "استفسارات" : "Inquiries" },
    { code: "QUOTATION", label: ar ? "عروض أسعار" : "Quotations" },
    { code: "PENDING", label: ar ? "بانتظار التأكيد" : "Pending confirmation" },
    { code: "ON_HOLD", label: ar ? "معلق" : "On hold" },
    { code: "CONFIRMED", label: ar ? "مؤكد" : "Confirmed" },
    { code: "PARTIALLY_PAID", label: ar ? "مدفوع جزئيًا" : "Part-paid" },
    { code: "FULLY_PAID", label: ar ? "مدفوع بالكامل" : "Paid" },
  ];
  const pipelineMax = Math.max(1, ...pipeline.map((item) => groupedCounts[item.code] ?? 0));
  const date = (value: Date | null) =>
    value
      ? new Intl.DateTimeFormat(dateLocale, { day: "2-digit", month: "short", year: "numeric" }).format(value)
      : "—";

  const stats = [
    {
      key: ar ? "إجمالي ملفات الحجز" : "Total booking files",
      value: reservations,
      hint: ar ? "كل الخدمات المسجلة في مساحة الشركة" : "All travel services recorded in this workspace",
      icon: CalendarDays,
      tone: "blue",
    },
    {
      key: ar ? "تحتاج متابعة" : "Needs follow-up",
      value: followUpCount,
      hint: ar ? "استفسارات وعروض وطلبات بانتظار الإجراء" : "Inquiries, quotes and pending confirmations",
      icon: CalendarClock,
      tone: "amber",
    },
    {
      key: ar ? "حجوزات مؤكدة" : "Confirmed bookings",
      value: confirmedCount,
      hint: ar ? "مؤكد أو مدفوع جزئيًا أو بالكامل" : "Confirmed or partially/fully paid",
      icon: CheckCircle2,
      tone: "green",
    },
    {
      key: ar ? "العملاء النشطون" : "Active customers",
      value: customers,
      hint: ar ? "سجلات العملاء غير المؤرشفة" : "Non-archived customer records",
      icon: Users,
      tone: "violet",
    },
    {
      key: ar ? "الموردون" : "Suppliers",
      value: suppliers,
      hint: ar ? "فنادق وشركات طيران ومقدمو خدمات" : "Hotels, airlines and service providers",
      icon: Hotel,
      tone: "slate",
    },
  ];

  return (
    <>
      <div className="ops-welcome">
        <div>
          <div className="eyebrow">{ar ? "NEW HOST · مركز تشغيل السفر" : "NEW HOST · TRAVEL OPERATIONS"}</div>
          <h1 className="page-title">{ar ? "مركز قيادة الشركة" : "Company control center"}</h1>
          <p className="page-description">
            {ar
              ? "متابعة الحجوزات والعملاء والموردين والعمليات التي تحتاج إلى إجراء، من شاشة واحدة."
              : "Monitor booking activity, customers, suppliers and work that needs attention from one operating view."}
          </p>
        </div>
        <div className="ops-welcome-actions">
          {canReadCustomers && (
            <Link className="btn btn-secondary" href="/customers">
              <Users size={16} />{ar ? "العملاء" : "Customers"}
            </Link>
          )}
          {hasPermission(membership.role, "reservations:write") && (
            <Link className="btn btn-primary" href="/reservations">
              <Plus size={16} />{ar ? "ملف حجز جديد" : "New booking file"}
            </Link>
          )}
        </div>
      </div>

      <section className="ops-stat-grid" aria-label={ar ? "مؤشرات التشغيل" : "Operating indicators"}>
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <article className={`ops-stat-card tone-${stat.tone}`} key={stat.key}>
              <div className="ops-stat-top">
                <span className="ops-stat-label">{stat.key}</span>
                <span className="ops-stat-icon"><Icon size={18} /></span>
              </div>
              <div className="ops-stat-value">{stat.value === null ? "—" : number.format(stat.value)}</div>
              <div className="ops-stat-hint">{stat.hint}</div>
            </article>
          );
        })}
      </section>

      <div className="ops-dashboard-grid">
        <section className="panel ops-panel">
          <div className="panel-header">
            <div>
              <div className="ops-section-kicker">{ar ? "RESERVATION PIPELINE" : "RESERVATION PIPELINE"}</div>
              <h2 className="panel-title">{ar ? "مسار الحجوزات" : "Booking pipeline"}</h2>
              <div className="panel-subtitle">
                {ar ? "توزيع ملفات الحجز حسب مرحلة العمل الحالية" : "Booking files grouped by their current workflow stage"}
              </div>
            </div>
            {canReadReservations && (
              <Link className="btn btn-secondary" href="/reservations">
                {ar ? "فتح الحجوزات" : "Open bookings"} <Arrow size={14} />
              </Link>
            )}
          </div>
          {!canReadReservations ? (
            <div className="empty-state">{t(locale, "accessDenied")}</div>
          ) : reservations === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><CalendarDays size={22} /></div>
              <div className="empty-title">{ar ? "لا توجد ملفات حجز بعد" : "No booking files yet"}</div>
              <p className="empty-copy">
                {ar ? "ابدأ بتسجيل استفسار أو طلب خدمة، ثم تابع انتقاله حتى التأكيد والتنفيذ." : "Create an inquiry or service request, then follow it through confirmation and delivery."}
              </p>
              {hasPermission(membership.role, "reservations:write") && (
                <Link className="btn btn-primary" style={{ marginTop: 16 }} href="/reservations">
                  <Plus size={15} />{ar ? "إنشاء أول ملف حجز" : "Create first booking"}
                </Link>
              )}
            </div>
          ) : (
            <div className="ops-pipeline">
              {pipeline.map((stage) => {
                const count = groupedCounts[stage.code] ?? 0;
                const state = statusLabels[stage.code];
                return (
                  <div className="ops-pipeline-row" key={stage.code}>
                    <span className={`ops-stage-dot ${state.className}`} />
                    <span className="ops-pipeline-label">{stage.label}</span>
                    <div className="ops-pipeline-track">
                      <span style={{ width: `${(count / pipelineMax) * 100}%` }} />
                    </div>
                    <strong className="ops-pipeline-count">{number.format(count)}</strong>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <aside className="panel ops-panel">
          <div className="panel-header">
            <div>
              <div className="ops-section-kicker">{ar ? "ACTION QUEUE" : "ACTION QUEUE"}</div>
              <h2 className="panel-title">{ar ? "قائمة المتابعة" : "Follow-up queue"}</h2>
              <div className="panel-subtitle">{ar ? "ملفات لم تصل إلى التأكيد النهائي" : "Files that still need a next action"}</div>
            </div>
            <span className="ops-queue-total">{number.format(followUpCount ?? 0)}</span>
          </div>
          {!canReadReservations ? (
            <div className="empty-state">{t(locale, "accessDenied")}</div>
          ) : followUpReservations.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><CheckCircle2 size={22} /></div>
              <div className="empty-title">{ar ? "لا توجد ملفات معلقة" : "Nothing waiting for follow-up"}</div>
              <p className="empty-copy">{ar ? "كل ملفات الحجز الحالية وصلت إلى مرحلة متقدمة." : "All current booking files have moved beyond the initial stages."}</p>
            </div>
          ) : (
            <div className="ops-queue-list">
              {followUpReservations.map((reservation) => {
                const status = statusLabels[reservation.status] ?? statusLabels.INQUIRY;
                const service = serviceLabels[reservation.serviceType] ?? serviceLabels.OTHER;
                return (
                  <Link className="ops-queue-item" href="/reservations" key={reservation.id}>
                    <span className="ops-queue-avatar"><ClipboardList size={16} /></span>
                    <span className="ops-queue-copy">
                      <strong>{reservation.customer.name}</strong>
                      <span>{reservation.reference} · {ar ? service.ar : service.en}</span>
                    </span>
                    <span className={`ops-status-pill ${status.className}`}>{ar ? status.ar : status.en}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </aside>
      </div>

      <section className="panel ops-recent-panel">
        <div className="panel-header">
          <div>
            <div className="ops-section-kicker">{ar ? "LATEST ACTIVITY" : "LATEST ACTIVITY"}</div>
            <h2 className="panel-title">{ar ? "آخر ملفات الحجز" : "Latest booking files"}</h2>
            <div className="panel-subtitle">{ar ? "آخر الملفات التي تم إنشاؤها أو تحديثها" : "Most recently created or updated booking files"}</div>
          </div>
          {canReadReservations && (
            <Link className="btn btn-secondary" href="/reservations">{ar ? "عرض الكل" : "View all"} <Arrow size={14} /></Link>
          )}
        </div>
        {!canReadReservations ? (
          <div className="empty-state">{t(locale, "accessDenied")}</div>
        ) : recentReservations.length === 0 ? (
          <div className="empty-state">{ar ? "ستظهر هنا آخر ملفات الحجز عند تسجيلها." : "Your latest booking files will appear here."}</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table ops-bookings-table">
              <thead>
                <tr>
                  <th>{ar ? "مرجع الحجز" : "Booking reference"}</th>
                  <th>{ar ? "العميل" : "Customer"}</th>
                  <th>{ar ? "نوع الخدمة" : "Service"}</th>
                  <th>{ar ? "الحالة" : "Status"}</th>
                  <th>{ar ? "بداية الخدمة" : "Service start"}</th>
                  <th>{ar ? "آخر تحديث" : "Last update"}</th>
                </tr>
              </thead>
              <tbody>
                {recentReservations.map((reservation) => {
                  const status = statusLabels[reservation.status] ?? statusLabels.INQUIRY;
                  const service = serviceLabels[reservation.serviceType] ?? serviceLabels.OTHER;
                  return (
                    <tr key={reservation.id}>
                      <td><strong className="ops-reference" dir="ltr">{reservation.reference}</strong></td>
                      <td><span className="customer-primary">{reservation.customer.name}</span></td>
                      <td>{ar ? service.ar : service.en}</td>
                      <td><span className={`ops-status-pill ${status.className}`}>{ar ? status.ar : status.en}</span></td>
                      <td>{date(reservation.startDate)}</td>
                      <td>{date(reservation.updatedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
