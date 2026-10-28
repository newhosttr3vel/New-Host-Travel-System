import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Archive, ArrowDownToLine, ArrowLeft, ArrowRight, Building2, CalendarDays, Check,
  ChevronDown, CircleHelp, Clock3, Compass, FileCheck2, Globe2, LayoutDashboard,
  Pencil, Plus, Search, Settings2, ShieldCheck, UsersRound, WalletCards, X
} from "lucide-react";
import {
  archiveRecord, getBackupData, getStorageMode, listRecords, newId, saveRecord,
  type Customer, type Entity, type Reservation, type Supplier, type Table
} from "./lib/storage";

type Page = "dashboard" | "customers" | "suppliers" | "reservations" | "settings";
type ModalKind = "customer" | "supplier" | "reservation";
type Locale = "ar" | "en";

const text = {
  ar: {
    app: "نيو هوست ترافل", tagline: "إدارة أعمال السفر بذكاء", workspace: "مساحة العمل",
    dashboard: "لوحة التحكم", customers: "العملاء", suppliers: "الموردون", reservations: "الحجوزات", settings: "الإعدادات",
    overview: "نظرة عامة", welcome: "كل عملياتك في مكان واحد", subtitle: "تابع العملاء والموردين والحجوزات من مساحة عمل واضحة وسريعة.",
    totalCustomers: "إجمالي العملاء", totalSuppliers: "إجمالي الموردين", totalReservations: "الحجوزات النشطة",
    quickCreate: "إضافة سجل جديد", search: "ابحث في السجلات...", newCustomer: "عميل جديد", newSupplier: "مورد جديد", newReservation: "حجز جديد",
    recent: "أحدث الحجوزات", pipeline: "حالة الحجوزات", customer: "العميل", supplier: "المورد", reference: "رقم الحجز",
    service: "الخدمة", dates: "التواريخ", status: "الحالة", sale: "سعر البيع", cost: "التكلفة", margin: "الفرق التقديري",
    name: "الاسم", email: "البريد الإلكتروني", phone: "رقم الهاتف", nationality: "الجنسية", notes: "ملاحظات",
    category: "تصنيف المورد", contactName: "مسؤول التواصل", paymentTerms: "شروط الدفع", actions: "الإجراءات",
    created: "تاريخ الإضافة", add: "إضافة", save: "حفظ السجل", cancel: "إلغاء", edit: "تعديل", archive: "أرشفة",
    customerList: "قاعدة العملاء", customerDesc: "حفظ بيانات العملاء ومعلومات التواصل الخاصة بهم.",
    supplierList: "دليل الموردين", supplierDesc: "إدارة الفنادق وشركات الطيران والنقل ومقدمي الخدمات.",
    reservationList: "متابعة الحجوزات", reservationDesc: "متابعة الطلبات والتواريخ والحالة وسعر البيع والتكلفة.",
    noCustomers: "لا يوجد عملاء حتى الآن", noSuppliers: "لا يوجد موردون حتى الآن", noReservations: "لا توجد حجوزات حتى الآن",
    emptyHint: "ابدأ بإضافة أول سجل، وسيظهر هنا تلقائيًا.", customerNameRequired: "اسم العميل مطلوب.",
    supplierNameRequired: "اسم المورد مطلوب.", reservationRequired: "اختر العميل وحدد رقم الحجز والتواريخ.",
    dateError: "تاريخ النهاية لا يمكن أن يسبق تاريخ البداية.", archiveConfirm: "هل تريد أرشفة هذا السجل؟",
    saveOk: "تم حفظ البيانات بنجاح.", archiveOk: "تمت أرشفة السجل.", loadError: "تعذر تحميل البيانات. حاول مرة أخرى.",
    statusInquiry: "استفسار", statusPending: "قيد الانتظار", statusConfirmed: "مؤكد", statusCompleted: "مكتمل", statusCancelled: "ملغي",
    hotel: "فندق", flight: "طيران", visa: "تأشيرة", transport: "نقل", umrah: "عمرة", hajj: "حج", tour: "رحلة سياحية", other: "أخرى",
    hotelSupplier: "فندق", airlineSupplier: "شركة طيران", transportSupplier: "نقل ومواصلات", visaSupplier: "خدمات تأشيرات", tourSupplier: "منظم رحلات", otherSupplier: "أخرى",
    startDate: "تاريخ البداية", endDate: "تاريخ النهاية", currency: "العملة", serviceType: "نوع الخدمة",
    bookingValue: "قيمة الحجز", localFirst: "يعمل محليًا أولًا", localDesc: "بيانات هذا الإصدار محفوظة على نفس الجهاز. لا تتم مزامنتها تلقائيًا مع أجهزة الفريق.",
    dataAndBackup: "البيانات والنسخ الاحتياطي", exportBackup: "تصدير نسخة احتياطية", storage: "طريقة التخزين",
    sqlite: "قاعدة SQLite محلية", browserLocal: "تخزين محلي للمعاينة", security: "تنبيه أمان", securityDesc: "استخدم بيانات تجريبية فقط إلى أن تكتمل المزامنة والصلاحيات والنسخ الاحتياطي واختبارات الاستعادة.",
    backupDone: "تم تجهيز ملف النسخة الاحتياطية.", all: "الكل", searchEmpty: "لا توجد نتائج مطابقة.", serviceCount: "سجلات محفوظة",
    exportFailed: "تعذر إنشاء النسخة الاحتياطية.", profitNote: "الفرق المعروض تقديري لكل حجز وبنفس عملة الحجز.",
    menu: "القائمة", language: "English", loading: "جارٍ تجهيز مساحة العمل..."
  },
  en: {
    app: "New Host Travel", tagline: "Travel operations, thoughtfully managed", workspace: "Workspace",
    dashboard: "Dashboard", customers: "Customers", suppliers: "Suppliers", reservations: "Reservations", settings: "Settings",
    overview: "OVERVIEW", welcome: "Everything in one place", subtitle: "A clear, fast workspace for customers, suppliers, and travel reservations.",
    totalCustomers: "Total customers", totalSuppliers: "Total suppliers", totalReservations: "Active reservations",
    quickCreate: "Create a record", search: "Search records...", newCustomer: "New customer", newSupplier: "New supplier", newReservation: "New reservation",
    recent: "Recent reservations", pipeline: "Reservation status", customer: "Customer", supplier: "Supplier", reference: "Reference",
    service: "Service", dates: "Dates", status: "Status", sale: "Sale price", cost: "Supplier cost", margin: "Estimated difference",
    name: "Name", email: "Email", phone: "Phone", nationality: "Nationality", notes: "Notes",
    category: "Supplier category", contactName: "Contact person", paymentTerms: "Payment terms", actions: "Actions",
    created: "Created", add: "Add", save: "Save record", cancel: "Cancel", edit: "Edit", archive: "Archive",
    customerList: "Customer directory", customerDesc: "Store customer details and contact information.",
    supplierList: "Supplier directory", supplierDesc: "Manage hotels, airlines, transport providers and partners.",
    reservationList: "Reservation tracking", reservationDesc: "Track requests, dates, status, selling price, and supplier cost.",
    noCustomers: "No customers yet", noSuppliers: "No suppliers yet", noReservations: "No reservations yet",
    emptyHint: "Add your first record and it will appear here.", customerNameRequired: "Customer name is required.",
    supplierNameRequired: "Supplier name is required.", reservationRequired: "Choose a customer and complete the reference and dates.",
    dateError: "The end date cannot be before the start date.", archiveConfirm: "Archive this record?",
    saveOk: "Record saved successfully.", archiveOk: "Record archived.", loadError: "Could not load records. Please try again.",
    statusInquiry: "Inquiry", statusPending: "Pending", statusConfirmed: "Confirmed", statusCompleted: "Completed", statusCancelled: "Cancelled",
    hotel: "Hotel", flight: "Flight", visa: "Visa", transport: "Transport", umrah: "Umrah package", hajj: "Hajj package", tour: "Tour", other: "Other",
    hotelSupplier: "Hotel", airlineSupplier: "Airline", transportSupplier: "Transport", visaSupplier: "Visa services", tourSupplier: "Tour operator", otherSupplier: "Other",
    startDate: "Start date", endDate: "End date", currency: "Currency", serviceType: "Service type",
    bookingValue: "Booking value", localFirst: "Local-first operation", localDesc: "This version stores data on this device. It does not automatically sync with your team's devices.",
    dataAndBackup: "Data and backup", exportBackup: "Export backup", storage: "Storage mode",
    sqlite: "Local SQLite database", browserLocal: "Local browser storage for preview", security: "Security note", securityDesc: "Use sample data only until sync, permissions, backup/recovery, and restore testing are complete.",
    backupDone: "Backup file is ready.", all: "All", searchEmpty: "No matching results.", serviceCount: "Saved records",
    exportFailed: "Could not create backup.", profitNote: "The difference is an estimate for each reservation in its own currency.",
    menu: "Menu", language: "العربية", loading: "Preparing your workspace..."
  }
} as const;

const statusValues = ["inquiry", "pending", "confirmed", "completed", "cancelled"];
const services = ["hotel", "flight", "visa", "transport", "umrah", "hajj", "tour", "other"];
const supplierCategories = ["hotel", "airline", "transport", "visa", "tour", "other"];

function asText(locale: Locale, key: keyof typeof text.ar): string {
  return text[locale][key] || text.en[key] || key;
}
function money(value: number, currency: string, locale: Locale): string {
  try {
    return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", { style: "currency", currency: currency || "EGP", maximumFractionDigits: 2 }).format(Number(value || 0));
  } catch {
    return Number(value || 0).toLocaleString(locale === "ar" ? "ar-EG" : "en-US") + " " + currency;
  }
}
function dateLabel(value: string, locale: Locale): string {
  if (!value) return "—";
  const parsed = new Date(value + (value.length === 10 ? "T12:00:00" : ""));
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "short", year: "numeric" }).format(parsed);
}
function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
function statusText(locale: Locale, status: string): string {
  const keys: Record<string, keyof typeof text.ar> = {
    inquiry: "statusInquiry", pending: "statusPending", confirmed: "statusConfirmed",
    completed: "statusCompleted", cancelled: "statusCancelled"
  };
  return asText(locale, keys[status] || "statusInquiry");
}
function serviceText(locale: Locale, service: string): string {
  const keys: Record<string, keyof typeof text.ar> = {
    hotel: "hotel", flight: "flight", visa: "visa", transport: "transport",
    umrah: "umrah", hajj: "hajj", tour: "tour", other: "other"
  };
  return asText(locale, keys[service] || "other");
}
function supplierCategoryText(locale: Locale, category: string): string {
  const keys: Record<string, keyof typeof text.ar> = {
    hotel: "hotelSupplier", airline: "airlineSupplier", transport: "transportSupplier",
    visa: "visaSupplier", tour: "tourSupplier", other: "otherSupplier"
  };
  return asText(locale, keys[category] || "otherSupplier");
}
function tableForModal(kind: ModalKind): Table {
  return kind === "customer" ? "customers" : kind === "supplier" ? "suppliers" : "reservations";
}

export default function App() {
  const [locale, setLocale] = useState<Locale>("ar");
  const [page, setPage] = useState<Page>("dashboard");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<ModalKind | null>(null);
  const [editing, setEditing] = useState<Entity | null>(null);
  const [storageMode, setStorageMode] = useState<"sqlite" | "browser-local">("browser-local");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const t = (key: keyof typeof text.ar) => asText(locale, key);
  const refresh = useCallback(async () => {
    setError("");
    try {
      const [customerRows, supplierRows, reservationRows, mode] = await Promise.all([
        listRecords("customers"), listRecords("suppliers"), listRecords("reservations"), getStorageMode()
      ]);
      setCustomers(customerRows);
      setSuppliers(supplierRows);
      setReservations(reservationRows);
      setStorageMode(mode);
    } catch {
      setError(t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => { void refresh(); }, [refresh]);

  const filteredCustomers = useMemo(() => customers.filter((row) =>
    [row.name, row.email, row.phone, row.nationality].some((value) => value.toLowerCase().includes(search.toLowerCase()))
  ), [customers, search]);
  const filteredSuppliers = useMemo(() => suppliers.filter((row) =>
    [row.name, row.email, row.phone, row.contactName, row.category].some((value) => value.toLowerCase().includes(search.toLowerCase()))
  ), [suppliers, search]);
  const customerName = (id: string) => customers.find((row) => row.id === id)?.name || "—";
  const supplierName = (id: string) => suppliers.find((row) => row.id === id)?.name || "—";
  const sortedReservations = useMemo(() => [...reservations].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [reservations]);
  const filteredReservations = useMemo(() => sortedReservations.filter((row) =>
    [row.reference, customerName(row.customerId), supplierName(row.supplierId), row.status, row.serviceType].some((value) => value.toLowerCase().includes(search.toLowerCase()))
  ), [sortedReservations, search, customers, suppliers]);

  function openCreate(kind: ModalKind) {
    setEditing(null);
    setDialog(kind);
    setError("");
  }
  function openEdit(kind: ModalKind, record: Entity) {
    setEditing(record);
    setDialog(kind);
    setError("");
  }
  async function archive(kind: ModalKind, id: string) {
    if (!window.confirm(t("archiveConfirm"))) return;
    try {
      await archiveRecord(tableForModal(kind), id);
      await refresh();
      setNotice(t("archiveOk"));
    } catch {
      setError(t("loadError"));
    }
  }
  async function submitRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dialog) return;
    const data = new FormData(event.currentTarget);
    const value = (field: string) => String(data.get(field) ?? "").trim();
    const id = editing?.id || newId();
    const createdAt = editing?.createdAt || new Date().toISOString();
    const base = { id, createdAt, archivedAt: null };
    try {
      if (dialog === "customer") {
        const name = value("name");
        if (!name) { setError(t("customerNameRequired")); return; }
        const record: Customer = {
          ...base, name, email: value("email"), phone: value("phone"), nationality: value("nationality"), notes: value("notes")
        };
        await saveRecord("customers", record, Boolean(editing));
      } else if (dialog === "supplier") {
        const name = value("name");
        if (!name) { setError(t("supplierNameRequired")); return; }
        const record: Supplier = {
          ...base, name, category: value("category") || "other", contactName: value("contactName"),
          email: value("email"), phone: value("phone"), paymentTerms: value("paymentTerms"), notes: value("notes")
        };
        await saveRecord("suppliers", record, Boolean(editing));
      } else {
        const reference = value("reference");
        const customerId = value("customerId");
        const startDate = value("startDate");
        const endDate = value("endDate");
        if (!reference || !customerId || !startDate || !endDate) { setError(t("reservationRequired")); return; }
        if (endDate < startDate) { setError(t("dateError")); return; }
        const record: Reservation = {
          ...base, reference, customerId, supplierId: value("supplierId"), serviceType: value("serviceType") || "other",
          status: value("status") || "inquiry", startDate, endDate, currency: value("currency") || "EGP",
          saleAmount: Number(value("saleAmount") || 0), costAmount: Number(value("costAmount") || 0), notes: value("notes")
        };
        await saveRecord("reservations", record, Boolean(editing));
      }
      setDialog(null);
      setEditing(null);
      setError("");
      await refresh();
      setNotice(t("saveOk"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("loadError"));
    }
  }

  async function exportBackup() {
    try {
      const backup = await getBackupData();
      downloadJson("new-host-travel-backup-" + new Date().toISOString().slice(0, 10) + ".json", backup);
      setNotice(t("backupDone"));
    } catch {
      setError(t("exportFailed"));
    }
  }

  const nav: { id: Page; label: keyof typeof text.ar; icon: typeof LayoutDashboard }[] = [
    { id: "dashboard", label: "dashboard", icon: LayoutDashboard },
    { id: "customers", label: "customers", icon: UsersRound },
    { id: "suppliers", label: "suppliers", icon: Building2 },
    { id: "reservations", label: "reservations", icon: CalendarDays },
    { id: "settings", label: "settings", icon: Settings2 }
  ];
  const pageTitle = page === "dashboard" ? t("dashboard") : page === "customers" ? t("customers") : page === "suppliers" ? t("suppliers") : page === "reservations" ? t("reservations") : t("settings");
  const primaryAction = page === "customers" ? () => openCreate("customer") : page === "suppliers" ? () => openCreate("supplier") : page === "reservations" ? () => openCreate("reservation") : undefined;
  const primaryLabel = page === "customers" ? t("newCustomer") : page === "suppliers" ? t("newSupplier") : t("newReservation");
  const customerForEdit = editing as Customer | null;
  const supplierForEdit = editing as Supplier | null;
  const reservationForEdit = editing as Reservation | null;

  const activeCount = reservations.filter((row) => !["cancelled", "completed"].includes(row.status)).length;
  const pipeline = statusValues.map((status) => ({ status, count: reservations.filter((row) => row.status === status).length }));
  const maxPipeline = Math.max(1, ...pipeline.map((item) => item.count));

  function heading(): ReactNode {
    const subtitle = page === "customers" ? t("customerDesc") : page === "suppliers" ? t("supplierDesc") : page === "reservations" ? t("reservationDesc") : page === "settings" ? t("localDesc") : t("subtitle");
    return (
      <div className="page-heading">
        <div>
          <div className="eyebrow">{page === "dashboard" ? t("overview") : t("workspace")}</div>
          <h1>{page === "dashboard" ? t("welcome") : pageTitle}</h1>
          <p>{subtitle}</p>
        </div>
        {primaryAction && <button className="button button-primary" onClick={primaryAction}><Plus size={17} />{primaryLabel}</button>}
      </div>
    );
  }

  function reservationTable(rows: Reservation[], showActions = true): ReactNode {
    if (!rows.length) return <EmptyState title={t("noReservations")} hint={t("emptyHint")} />;
    return (
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>{t("reference")}</th><th>{t("customer")}</th><th>{t("service")}</th><th>{t("dates")}</th><th>{t("status")}</th><th>{t("sale")}</th>{showActions && <th>{t("actions")}</th>}</tr></thead>
          <tbody>
            {rows.map((row) => <tr key={row.id}>
              <td><span className="primary-cell">{row.reference}</span><span className="secondary-cell">{row.currency}</span></td>
              <td>{customerName(row.customerId)}<span className="secondary-cell">{supplierName(row.supplierId)}</span></td>
              <td>{serviceText(locale, row.serviceType)}</td>
              <td><span className="date-pair">{dateLabel(row.startDate, locale)}</span><span className="secondary-cell">{dateLabel(row.endDate, locale)}</span></td>
              <td><span className={"status-pill status-" + row.status}><span className="status-dot" />{statusText(locale, row.status)}</span></td>
              <td><span className="primary-cell">{money(row.saleAmount, row.currency, locale)}</span><span className="secondary-cell">{t("margin")}: {money(row.saleAmount - row.costAmount, row.currency, locale)}</span></td>
              {showActions && <td><div className="row-actions"><button aria-label={t("edit")} title={t("edit")} className="icon-button" onClick={() => openEdit("reservation", row)}><Pencil size={15} /></button><button aria-label={t("archive")} title={t("archive")} className="icon-button" onClick={() => void archive("reservation", row.id)}><Archive size={15} /></button></div></td>}
            </tr>)}
          </tbody>
        </table>
      </div>
    );
  }

  function customerTable(rows: Customer[]): ReactNode {
    if (!rows.length) return <EmptyState title={t("noCustomers")} hint={t("emptyHint")} />;
    return <div className="table-scroll"><table className="data-table">
      <thead><tr><th>{t("name")}</th><th>{t("phone")}</th><th>{t("email")}</th><th>{t("created")}</th><th>{t("actions")}</th></tr></thead>
      <tbody>{rows.map((row) => <tr key={row.id}><td><span className="primary-cell">{row.name}</span><span className="secondary-cell">{row.nationality || "—"}</span></td><td>{row.phone || "—"}</td><td>{row.email || "—"}</td><td>{dateLabel(row.createdAt.slice(0, 10), locale)}</td><td><div className="row-actions"><button aria-label={t("edit")} title={t("edit")} className="icon-button" onClick={() => openEdit("customer", row)}><Pencil size={15} /></button><button aria-label={t("archive")} title={t("archive")} className="icon-button" onClick={() => void archive("customer", row.id)}><Archive size={15} /></button></div></td></tr>)}</tbody>
    </table></div>;
  }

  function supplierTable(rows: Supplier[]): ReactNode {
    if (!rows.length) return <EmptyState title={t("noSuppliers")} hint={t("emptyHint")} />;
    return <div className="table-scroll"><table className="data-table">
      <thead><tr><th>{t("name")}</th><th>{t("category")}</th><th>{t("contactName")}</th><th>{t("phone")}</th><th>{t("actions")}</th></tr></thead>
      <tbody>{rows.map((row) => <tr key={row.id}><td><span className="primary-cell">{row.name}</span><span className="secondary-cell">{row.email || "—"}</span></td><td>{supplierCategoryText(locale, row.category)}</td><td>{row.contactName || "—"}</td><td>{row.phone || "—"}</td><td><div className="row-actions"><button aria-label={t("edit")} title={t("edit")} className="icon-button" onClick={() => openEdit("supplier", row)}><Pencil size={15} /></button><button aria-label={t("archive")} title={t("archive")} className="icon-button" onClick={() => void archive("supplier", row.id)}><Archive size={15} /></button></div></td></tr>)}</tbody>
    </table></div>;
  }

  if (loading) return <div className="app-loading"><div className="brand-mark">NH</div><strong>{t("app")}</strong><span>{t("loading")}</span></div>;

  return (
    <div className={"app-shell " + (locale === "ar" ? "is-rtl" : "is-ltr")} dir={locale === "ar" ? "rtl" : "ltr"}>
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">NH</div>
          <div className="brand-copy"><strong>{t("app")}</strong><span>{t("tagline")}</span></div>
        </div>
        <div className="sidebar-label">{t("workspace")}</div>
        <nav className="nav-list" aria-label={t("menu")}>
          {nav.map((item) => {
            const Icon = item.icon;
            return <button key={item.id} className={"nav-item " + (page === item.id ? "active" : "")} onClick={() => { setPage(item.id); setSearch(""); }}>
              <Icon size={18} strokeWidth={page === item.id ? 2.3 : 1.8} /><span>{t(item.label)}</span>{page === item.id && <span className="nav-active-dot" />}
            </button>;
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="offline-card"><span className="online-dot" /><div><strong>{t("localFirst")}</strong><span>{storageMode === "sqlite" ? t("sqlite") : t("browserLocal")}</span></div></div>
          <button className="profile-row" onClick={() => setPage("settings")}><div className="profile-avatar">NH</div><div className="profile-info"><strong>New Host Travel</strong><span>{locale === "ar" ? "مساحة محلية" : "Local workspace"}</span></div><ChevronDown size={15} /></button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="mobile-brand"><div className="brand-mark">NH</div><strong>{t("app")}</strong></div>
          <div className="topbar-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("search")} aria-label={t("search")} /></div>
          <div className="topbar-actions">
            <button className="language-button" onClick={() => setLocale(locale === "ar" ? "en" : "ar")}><Globe2 size={16} /><span>{t("language")}</span></button>
            <span className="topbar-divider" />
            <button className="help-button" title={t("settings")} onClick={() => setPage("settings")}><CircleHelp size={18} /></button>
            <div className="profile-avatar top-avatar">NH</div>
          </div>
        </header>

        <div className="page-content">
          {heading()}
          {error && <div className="alert alert-error" role="alert"><X size={16} />{error}<button onClick={() => setError("")} aria-label="Close"><X size={14} /></button></div>}
          {notice && <div className="alert alert-success" role="status"><Check size={16} />{notice}<button onClick={() => setNotice("")} aria-label="Close"><X size={14} /></button></div>}

          {page === "dashboard" && <>
            <section className="stat-grid">
              <StatCard icon={<UsersRound size={19} />} label={t("totalCustomers")} value={customers.length.toLocaleString(locale === "ar" ? "ar-EG" : "en-US")} trend={locale === "ar" ? "سجلات العملاء المحفوظة" : "Saved customer records"} tone="green" />
              <StatCard icon={<Building2 size={19} />} label={t("totalSuppliers")} value={suppliers.length.toLocaleString(locale === "ar" ? "ar-EG" : "en-US")} trend={locale === "ar" ? "شركاء ومقدمو خدمات" : "Service providers and partners"} tone="blue" />
              <StatCard icon={<CalendarDays size={19} />} label={t("totalReservations")} value={activeCount.toLocaleString(locale === "ar" ? "ar-EG" : "en-US")} trend={locale === "ar" ? "لا تشمل الحجوزات المكتملة أو الملغاة" : "Excludes completed and cancelled"} tone="amber" />
            </section>
            <section className="dashboard-grid">
              <article className="panel recent-panel">
                <div className="panel-heading"><div><div className="panel-title">{t("recent")}</div><div className="panel-subtitle">{t("reservationDesc")}</div></div><button className="button button-quiet" onClick={() => setPage("reservations")}>{t("reservations")}{locale === "ar" ? <ArrowLeft size={15} /> : <ArrowRight size={15} />}</button></div>
                {reservationTable(sortedReservations.slice(0, 5), false)}
              </article>
              <article className="panel pipeline-panel">
                <div className="panel-heading"><div><div className="panel-title">{t("pipeline")}</div><div className="panel-subtitle">{t("serviceCount")}: {reservations.length.toLocaleString(locale === "ar" ? "ar-EG" : "en-US")}</div></div><div className="panel-icon"><WalletCards size={20} /></div></div>
                <div className="pipeline-list">
                  {pipeline.map((item) => <div className="pipeline-item" key={item.status}><div className="pipeline-label"><span>{statusText(locale, item.status)}</span><strong>{item.count.toLocaleString(locale === "ar" ? "ar-EG" : "en-US")}</strong></div><div className="progress-track"><span className={"progress-fill fill-" + item.status} style={{ width: (item.count / maxPipeline * 100) + "%" }} /></div></div>)}
                </div>
                <div className="pipeline-foot"><span><Clock3 size={15} />{locale === "ar" ? "ملخص محدث من سجلات الجهاز" : "Updated from records on this device"}</span><span className="active-label"><span className="online-dot" />{locale === "ar" ? "محلي" : "Local"}</span></div>
              </article>
            </section>
            <section className="feature-strip"><div className="feature-icon"><ShieldCheck size={21} /></div><div><strong>{t("localFirst")}</strong><p>{t("localDesc")}</p></div><button className="button button-secondary" onClick={() => setPage("settings")}>{t("settings")}<ArrowLeft size={15} /></button></section>
          </>}

          {page === "customers" && <section className="panel full-panel"><div className="panel-heading"><div><div className="panel-title">{t("customerList")}</div><div className="panel-subtitle">{filteredCustomers.length} {t("serviceCount")}</div></div><button className="button button-primary" onClick={() => openCreate("customer")}><Plus size={16} />{t("newCustomer")}</button></div>{customerTable(filteredCustomers)}</section>}
          {page === "suppliers" && <section className="panel full-panel"><div className="panel-heading"><div><div className="panel-title">{t("supplierList")}</div><div className="panel-subtitle">{filteredSuppliers.length} {t("serviceCount")}</div></div><button className="button button-primary" onClick={() => openCreate("supplier")}><Plus size={16} />{t("newSupplier")}</button></div>{supplierTable(filteredSuppliers)}</section>}
          {page === "reservations" && <section className="panel full-panel"><div className="panel-heading"><div><div className="panel-title">{t("reservationList")}</div><div className="panel-subtitle">{filteredReservations.length} {t("serviceCount")} · {t("profitNote")}</div></div><button className="button button-primary" onClick={() => openCreate("reservation")}><Plus size={16} />{t("newReservation")}</button></div>{reservationTable(filteredReservations)}</section>}

          {page === "settings" && <div className="settings-grid">
            <section className="panel settings-panel"><div className="panel-heading"><div><div className="panel-title">{t("dataAndBackup")}</div><div className="panel-subtitle">{t("localDesc")}</div></div><div className="panel-icon"><FileCheck2 size={20} /></div></div>
              <div className="settings-row"><div className="settings-icon"><WalletCards size={18} /></div><div className="settings-copy"><strong>{t("storage")}</strong><span>{storageMode === "sqlite" ? t("sqlite") : t("browserLocal")}</span></div><span className="storage-badge">{storageMode === "sqlite" ? "SQLite" : "Local"}</span></div>
              <button className="button button-primary backup-button" onClick={() => void exportBackup()}><ArrowDownToLine size={17} />{t("exportBackup")}</button>
              <div className="notice-card"><ShieldCheck size={17} /><div><strong>{t("security")}</strong><p>{t("securityDesc")}</p></div></div>
            </section>
            <section className="panel settings-panel"><div className="panel-heading"><div><div className="panel-title">{t("app")}</div><div className="panel-subtitle">{t("tagline")}</div></div><div className="brand-mark settings-brand">NH</div></div>
              <div className="settings-row"><div className="settings-icon"><Globe2 size={18} /></div><div className="settings-copy"><strong>{locale === "ar" ? "لغة الواجهة" : "Interface language"}</strong><span>{locale === "ar" ? "العربية" : "English"}</span></div><button className="button button-secondary" onClick={() => setLocale(locale === "ar" ? "en" : "ar")}>{t("language")}</button></div>
              <div className="settings-row"><div className="settings-icon"><Compass size={18} /></div><div className="settings-copy"><strong>{t("localFirst")}</strong><span>{t("localDesc")}</span></div></div>
              <div className="notice-card notice-neutral"><CircleHelp size={17} /><div><strong>{locale === "ar" ? "المرحلة الأولى" : "First implementation phase"}</strong><p>{locale === "ar" ? "تم فصل تطبيق سطح المكتب والموبايل عن تطبيق الويب القديم للحفاظ عليه. مزامنة الفريق تحتاج خدمة آمنة مشتركة في مرحلة لاحقة." : "The desktop/mobile app is separated from the existing web app to preserve it. Team sync needs a secure shared service in a later phase."}</p></div></div>
            </section>
          </div>}
          <footer className="page-footer"><span>© {new Date().getFullYear()} New Host Travel</span><span><span className="online-dot" />{storageMode === "sqlite" ? t("sqlite") : t("browserLocal")}</span></footer>
        </div>
      </main>

      {dialog && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setDialog(null); setEditing(null); setError(""); } }}>
        <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="modal-heading"><div><div className="eyebrow">{t("workspace")}</div><h2 id="modal-title">{dialog === "customer" ? (editing ? t("edit") + " · " + t("customers") : t("newCustomer")) : dialog === "supplier" ? (editing ? t("edit") + " · " + t("suppliers") : t("newSupplier")) : (editing ? t("edit") + " · " + t("reservations") : t("newReservation"))}</h2></div><button className="icon-button close-button" onClick={() => { setDialog(null); setEditing(null); setError(""); }} aria-label={t("cancel")}><X size={18} /></button></div>
          {error && <div className="alert alert-error modal-error">{error}<button onClick={() => setError("")}><X size={14} /></button></div>}
          <form className="record-form" onSubmit={(event) => void submitRecord(event)} key={dialog + ":" + (editing?.id || "new")}>
            {dialog === "customer" && <>
              <Field label={t("name")} required><input name="name" required defaultValue={customerForEdit?.name || ""} autoFocus /></Field>
              <div className="form-row"><Field label={t("phone")}><input name="phone" type="tel" defaultValue={customerForEdit?.phone || ""} /></Field><Field label={t("email")}><input name="email" type="email" defaultValue={customerForEdit?.email || ""} /></Field></div>
              <Field label={t("nationality")}><input name="nationality" defaultValue={customerForEdit?.nationality || ""} /></Field>
              <Field label={t("notes")}><textarea name="notes" rows={3} defaultValue={customerForEdit?.notes || ""} /></Field>
            </>}
            {dialog === "supplier" && <>
              <Field label={t("name")} required><input name="name" required defaultValue={supplierForEdit?.name || ""} autoFocus /></Field>
              <Field label={t("category")}><select name="category" defaultValue={supplierForEdit?.category || "hotel"}>{supplierCategories.map((category) => <option key={category} value={category}>{supplierCategoryText(locale, category)}</option>)}</select></Field>
              <div className="form-row"><Field label={t("contactName")}><input name="contactName" defaultValue={supplierForEdit?.contactName || ""} /></Field><Field label={t("phone")}><input name="phone" type="tel" defaultValue={supplierForEdit?.phone || ""} /></Field></div>
              <div className="form-row"><Field label={t("email")}><input name="email" type="email" defaultValue={supplierForEdit?.email || ""} /></Field><Field label={t("paymentTerms")}><input name="paymentTerms" defaultValue={supplierForEdit?.paymentTerms || ""} /></Field></div>
              <Field label={t("notes")}><textarea name="notes" rows={3} defaultValue={supplierForEdit?.notes || ""} /></Field>
            </>}
            {dialog === "reservation" && <>
              <div className="form-row"><Field label={t("reference")} required><input name="reference" required defaultValue={reservationForEdit?.reference || ""} autoFocus /></Field><Field label={t("status")}><select name="status" defaultValue={reservationForEdit?.status || "inquiry"}>{statusValues.map((status) => <option key={status} value={status}>{statusText(locale, status)}</option>)}</select></Field></div>
              <Field label={t("customer")} required><select name="customerId" required defaultValue={reservationForEdit?.customerId || ""}><option value="">{locale === "ar" ? "اختر العميل" : "Select customer"}</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></Field>
              <Field label={t("supplier")}><select name="supplierId" defaultValue={reservationForEdit?.supplierId || ""}><option value="">{locale === "ar" ? "بدون مورد" : "No supplier"}</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></Field>
              <div className="form-row"><Field label={t("serviceType")}><select name="serviceType" defaultValue={reservationForEdit?.serviceType || "hotel"}>{services.map((service) => <option key={service} value={service}>{serviceText(locale, service)}</option>)}</select></Field><Field label={t("currency")}><select name="currency" defaultValue={reservationForEdit?.currency || "EGP"}><option value="EGP">EGP · جنيه مصري</option><option value="SAR">SAR · ريال سعودي</option><option value="USD">USD · US Dollar</option></select></Field></div>
              <div className="form-row"><Field label={t("startDate")} required><input name="startDate" type="date" required defaultValue={reservationForEdit?.startDate || ""} /></Field><Field label={t("endDate")} required><input name="endDate" type="date" required defaultValue={reservationForEdit?.endDate || ""} /></Field></div>
              <div className="form-row"><Field label={t("sale")}><input name="saleAmount" type="number" min="0" step="0.01" defaultValue={reservationForEdit?.saleAmount ?? 0} /></Field><Field label={t("cost")}><input name="costAmount" type="number" min="0" step="0.01" defaultValue={reservationForEdit?.costAmount ?? 0} /></Field></div>
              <Field label={t("notes")}><textarea name="notes" rows={2} defaultValue={reservationForEdit?.notes || ""} /></Field>
            </>}
            <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => { setDialog(null); setEditing(null); setError(""); }}>{t("cancel")}</button><button type="submit" className="button button-primary"><Check size={16} />{t("save")}</button></div>
          </form>
        </section>
      </div>}
    </div>
  );
}

function Field({ label, children, required = false }: { label: string; children: ReactNode; required?: boolean }) {
  return <label className="form-field"><span>{label}{required && <i aria-hidden="true"> *</i>}</span>{children}</label>;
}
function StatCard({ icon, label, value, trend, tone }: { icon: ReactNode; label: string; value: string; trend: string; tone: string }) {
  return <article className="stat-card"><div className={"stat-icon tone-" + tone}>{icon}</div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-trend">{trend}</div><div className={"stat-orb orb-" + tone} /></article>;
}
function EmptyState({ title, hint }: { title: string; hint: string }) {
  return <div className="empty-state"><div className="empty-symbol"><CalendarDays size={22} /></div><strong>{title}</strong><p>{hint}</p></div>;
}