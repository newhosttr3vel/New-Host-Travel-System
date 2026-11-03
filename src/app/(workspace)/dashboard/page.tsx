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
import { prisma, setTenantRlsContext } from "@/lib/prisma";
import { getTenantContext } from "@/lib/tenant-context";
import { currentLocale } from "@/lib/i18n";
import { t } from "@/lib/messages";
import { hasPermission } from "@/lib/permissions";
import { sumBaseCents, sumOutstandingBaseCents } from "@/lib/dashboard-finance";
import { branchScopeWhere } from "@/lib/branch-access";

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
  setTenantRlsContext({ userId: session.user.id, tenantId: membership.tenantId });

  const locale = await currentLocale();
  const ar = locale === "ar";
  const tenantId = membership.tenantId;
  const canReadCustomers = hasPermission(membership.role, "customers:read");
  const canReadSuppliers = hasPermission(membership.role, "suppliers:read");
  const canReadReservations = hasPermission(membership.role, "reservations:read");
  const canReadFinance = hasPermission(membership.role, "finance:read");

  const now = new Date();
  const dateParts = new Intl.DateTimeFormat("en-US", {
    timeZone: membership.tenant.timeZone || "Africa/Cairo",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const localYear = Number(dateParts.find((part) => part.type === "year")?.value);
  const localMonth = Number(dateParts.find((part) => part.type === "month")?.value);
  const localDay = Number(dateParts.find((part) => part.type === "day")?.value);
  // Date-only finance fields are stored at 12:00 UTC; these bounds follow the tenant calendar.
  const monthStart = new Date(Date.UTC(localYear, localMonth - 1, 1, 12));
  const todayEnd = new Date(Date.UTC(localYear, localMonth - 1, localDay + 1, 12));
  const monthRange = { gte: monthStart, lt: todayEnd };

  const [
    customers,
    suppliers,
    reservations,
    followUpCount,
    confirmedCount,
    statusGroups,
    recentReservations,
    followUpReservations,
    invoiceSalesGroups,
    supplierCostGroups,
    openInvoiceGroups,
    openSupplierBillGroups,
    customerReceiptGroups,
    supplierPaymentGroups,
  ] = await Promise.all([
    canReadCustomers
      ? prisma.customer.count({ where: { tenantId, ...branchScopeWhere(membership), archivedAt: null } })
      : Promise.resolve(null),
    canReadSuppliers
      ? prisma.supplier.count({ where: { tenantId, ...branchScopeWhere(membership), archivedAt: null } })
      : Promise.resolve(null),
    canReadReservations
      ? prisma.reservation.count({ where: { tenantId, ...branchScopeWhere(membership), archivedAt: null } })
      : Promise.resolve(null),
    canReadReservations
      ? prisma.reservation.count({
          where: { tenantId, ...branchScopeWhere(membership), archivedAt: null, status: { in: [...followUpStatuses] } },
        })
      : Promise.resolve(null),
    canReadReservations
      ? prisma.reservation.count({
          where: { tenantId, ...branchScopeWhere(membership), archivedAt: null, status: { in: [...confirmedStatuses] } },
        })
      : Promise.resolve(null),
    canReadReservations
      ? prisma.reservation.groupBy({
          by: ["status"],
          where: { tenantId, ...branchScopeWhere(membership), archivedAt: null },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    canReadReservations
      ? prisma.reservation.findMany({
          where: { tenantId, ...branchScopeWhere(membership), archivedAt: null },
          orderBy: { updatedAt: "desc" },
          take: 8,
          include: { customer: { select: { name: true } } },
        })
      : Promise.resolve([]),
    canReadReservations
      ? prisma.reservation.findMany({
          where: {
            tenantId,
            ...branchScopeWhere(membership),
            archivedAt: null,
            status: { in: [...followUpStatuses] },
          },
          orderBy: [{ startDate: "asc" }, { updatedAt: "desc" }],
          take: 5,
          include: { customer: { select: { name: true } } },
        })
      : Promise.resolve([]),
    canReadFinance
      ? prisma.invoice.groupBy({
          by: ["currency", "exchangeRate"],
          where: { tenantId, ...branchScopeWhere(membership), issueDate: monthRange, status: { not: "VOID" } },
          _sum: { subtotal: true },
        })
      : Promise.resolve([]),
    canReadFinance
      ? prisma.supplierBill.groupBy({
          by: ["currency", "exchangeRate"],
          where: { tenantId, ...branchScopeWhere(membership), billDate: monthRange, status: { not: "VOID" } },
          _sum: { subtotal: true },
        })
      : Promise.resolve([]),
    canReadFinance
      ? prisma.invoice.groupBy({
          by: ["currency", "exchangeRate"],
          where: { tenantId, ...branchScopeWhere(membership), status: { in: ["ISSUED", "PARTIALLY_PAID"] } },
          _sum: { total: true, paidAmount: true },
        })
      : Promise.resolve([]),
    canReadFinance
      ? prisma.supplierBill.groupBy({
          by: ["currency", "exchangeRate"],
          where: { tenantId, ...branchScopeWhere(membership), status: { in: ["ISSUED", "PARTIALLY_PAID"] } },
          _sum: { total: true, paidAmount: true },
        })
      : Promise.resolve([]),
    canReadFinance
      ? prisma.customerPayment.groupBy({
          by: ["currency", "exchangeRate"],
          where: { tenantId, ...branchScopeWhere(membership), paymentDate: monthRange },
          _sum: { amount: true },
        })
      : Promise.resolve([]),
    canReadFinance
      ? prisma.supplierPayment.groupBy({
          by: ["currency", "exchangeRate"],
          where: { tenantId, ...branchScopeWhere(membership), paymentDate: monthRange },
          _sum: { amount: true },
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

  const salesBaseCents = sumBaseCents(invoiceSalesGroups.map((group) => ({
    amount: group._sum.subtotal,
    exchangeRate: group.exchangeRate.toFixed(8),
  })));
  const supplierCostsBaseCents = sumBaseCents(supplierCostGroups.map((group) => ({
    amount: group._sum.subtotal,
    exchangeRate: group.exchangeRate.toFixed(8),
  })));
  const receiptsBaseCents = sumBaseCents(customerReceiptGroups.map((group) => ({
    amount: group._sum.amount,
    exchangeRate: group.exchangeRate.toFixed(8),
  })));
  const supplierPaymentsBaseCents = sumBaseCents(supplierPaymentGroups.map((group) => ({
    amount: group._sum.amount,
    exchangeRate: group.exchangeRate.toFixed(8),
  })));
  const receivablesBaseCents = sumOutstandingBaseCents(openInvoiceGroups.map((group) => ({
    total: group._sum.total,
    paidAmount: group._sum.paidAmount,
    exchangeRate: group.exchangeRate.toFixed(8),
  })));
  const payablesBaseCents = sumOutstandingBaseCents(openSupplierBillGroups.map((group) => ({
    total: group._sum.total,
    paidAmount: group._sum.paidAmount,
    exchangeRate: group.exchangeRate.toFixed(8),
  })));
  const billedSpreadBaseCents = salesBaseCents - supplierCostsBaseCents;
  const baseCurrency = membership.tenant.defaultCurrency || "EGP";
  const formatCurrency = (cents: bigint) => {
    const value = Number(cents) / 100;
    try {
      return new Intl.NumberFormat(dateLocale, {
        style: "currency", currency: baseCurrency, maximumFractionDigits: 2,
      }).format(value);
    } catch {
      return `${new Intl.NumberFormat(dateLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} ${baseCurrency}`;
    }
  };
  const monthLabel = new Intl.DateTimeFormat(dateLocale, {
    month: "long", year: "numeric", timeZone: membership.tenant.timeZone || "Africa/Cairo",
  }).format(now);

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

      {canReadFinance && (
        <section className="finance-overview" aria-label={ar ? "المؤشرات المالية" : "Financial overview"}>
          <div className="finance-overview-heading">
            <div>
              <div className="ops-section-kicker">{ar ? "FINANCE SNAPSHOT" : "FINANCE SNAPSHOT"}</div>
              <h2 className="panel-title">{ar ? "المؤشرات المالية" : "Financial overview"}</h2>
              <p className="panel-subtitle">
                {ar ? `حركة الشهر الحالي · ${monthLabel} · جميع القيم بعملة الشركة الأساسية ${baseCurrency}` : `Current month · ${monthLabel} · All values in the company base currency (${baseCurrency})`}
              </p>
            </div>
            <Link className="btn btn-secondary" href="/finance">{ar ? "فتح الإدارة المالية" : "Open finance"}</Link>
          </div>
          <div className="finance-metric-grid">
            <article className="finance-metric-card tone-blue">
              <span>{ar ? "مبيعات الفواتير" : "Invoiced sales"}</span>
              <strong dir="auto">{formatCurrency(salesBaseCents)}</strong>
              <small>{ar ? "إجمالي البنود قبل الضريبة — هذا الشهر" : "Invoice line subtotal before tax · month to date"}</small>
            </article>
            <article className="finance-metric-card tone-amber">
              <span>{ar ? "تكلفة فواتير الموردين" : "Supplier bill costs"}</span>
              <strong dir="auto">{formatCurrency(supplierCostsBaseCents)}</strong>
              <small>{ar ? "بنود فواتير الموردين قبل الضريبة — هذا الشهر" : "Supplier bill line subtotal before tax · month to date"}</small>
            </article>
            <article className="finance-metric-card tone-green">
              <span>{ar ? "الفرق المسجل مبدئيًا" : "Preliminary billed spread"}</span>
              <strong dir="auto">{formatCurrency(billedSpreadBaseCents)}</strong>
              <small>{ar ? "المبيعات ناقص تكاليف الموردين، قبل المصروفات التشغيلية والتسويات" : "Sales less supplier bills, before operating expenses and adjustments"}</small>
            </article>
            <article className="finance-metric-card tone-violet">
              <span>{ar ? "تحصيلات العملاء" : "Customer collections"}</span>
              <strong dir="auto">{formatCurrency(receiptsBaseCents)}</strong>
              <small>{ar ? "إيصالات العملاء المسجلة — هذا الشهر" : "Customer receipts recorded · month to date"}</small>
            </article>
            <article className="finance-metric-card tone-blue">
              <span>{ar ? "مديونيات العملاء" : "Customer receivables"}</span>
              <strong dir="auto">{formatCurrency(receivablesBaseCents)}</strong>
              <small>{ar ? "الرصيد المفتوح على الفواتير غير الملغاة" : "Outstanding balance on non-void invoices"}</small>
            </article>
            <article className="finance-metric-card tone-amber">
              <span>{ar ? "مستحقات الموردين" : "Supplier payables"}</span>
              <strong dir="auto">{formatCurrency(payablesBaseCents)}</strong>
              <small>{ar ? "الرصيد المفتوح على فواتير الموردين" : "Outstanding supplier bill balances"}</small>
            </article>
            <article className="finance-metric-card tone-slate">
              <span>{ar ? "مدفوعات الموردين" : "Supplier payments"}</span>
              <strong dir="auto">{formatCurrency(supplierPaymentsBaseCents)}</strong>
              <small>{ar ? "مدفوعات الموردين المسجلة — هذا الشهر" : "Supplier payments recorded · month to date"}</small>
            </article>
          </div>
          <p className="finance-overview-note">
            {ar
              ? "ملاحظة محاسبية: الفرق المسجل ليس صافي ربح الشركة؛ لا يشمل المصروفات التشغيلية أو التسويات أو الاعتراف المحاسبي خارج الفواتير المعروضة. تم تحويل العملات باستخدام سعر الصرف المحفوظ مع كل مستند، دون تغيير الأسعار التاريخية."
              : "Accounting note: the billed spread is not company net profit. It excludes operating expenses, adjustments and accounting recognition outside these invoices. Foreign amounts use each document's stored exchange-rate snapshot; historical rates are never overwritten."}
          </p>
        </section>
      )}

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
