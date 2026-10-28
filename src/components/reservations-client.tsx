"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Archive, CalendarDays, Check, ChevronLeft, ChevronRight, ClipboardList, Pencil, Plus, Search, X } from "lucide-react";
import { t, type Locale } from "@/lib/messages";

type ServiceType = "HOTEL" | "FLIGHT" | "VISA" | "TRANSPORT" | "UMRAH_PACKAGE" | "HAJJ_PACKAGE" | "TOUR" | "OTHER";
type Status = "INQUIRY" | "QUOTATION" | "PENDING" | "ON_HOLD" | "CONFIRMED" | "PARTIALLY_PAID" | "FULLY_PAID" | "COMPLETED" | "CANCELLED" | "REFUNDED";
type CustomerOption = { id: string; name: string; type: "INDIVIDUAL" | "CORPORATE" };
type SupplierOption = { id: string; name: string; category: string };
type Reservation = {
  id: string; reference: string; serviceType: ServiceType; status: Status; startDate: string | null; endDate: string | null;
  currency: string; saleAmount: string; costAmount: string; notes: string | null;
  customer: { id: string; name: string; type?: string };
  supplier: { id: string; name: string } | null;
  createdAt: string;
};
type ReservationForm = {
  customerId: string; supplierId: string; serviceType: ServiceType; startDate: string; endDate: string;
  currency: string; saleAmount: string; costAmount: string; notes: string;
};
const emptyForm: ReservationForm = { customerId: "", supplierId: "", serviceType: "HOTEL", startDate: "", endDate: "", currency: "EGP", saleAmount: "0.00", costAmount: "0.00", notes: "" };
const serviceTypes: { value: ServiceType; key: "serviceHotel" | "serviceFlight" | "serviceVisa" | "serviceTransport" | "serviceUmrah" | "serviceHajj" | "serviceTour" | "serviceOther" }[] = [
  { value: "HOTEL", key: "serviceHotel" }, { value: "FLIGHT", key: "serviceFlight" }, { value: "VISA", key: "serviceVisa" },
  { value: "TRANSPORT", key: "serviceTransport" }, { value: "UMRAH_PACKAGE", key: "serviceUmrah" },
  { value: "HAJJ_PACKAGE", key: "serviceHajj" }, { value: "TOUR", key: "serviceTour" }, { value: "OTHER", key: "serviceOther" }
];
const statuses: { value: Status; key: "statusInquiry" | "statusQuotation" | "statusPending" | "statusOnHold" | "statusConfirmed" | "statusPartiallyPaid" | "statusFullyPaid" | "statusCompleted" | "statusCancelled" | "statusRefunded" }[] = [
  { value: "INQUIRY", key: "statusInquiry" }, { value: "QUOTATION", key: "statusQuotation" }, { value: "PENDING", key: "statusPending" },
  { value: "ON_HOLD", key: "statusOnHold" }, { value: "CONFIRMED", key: "statusConfirmed" }, { value: "PARTIALLY_PAID", key: "statusPartiallyPaid" },
  { value: "FULLY_PAID", key: "statusFullyPaid" }, { value: "COMPLETED", key: "statusCompleted" },
  { value: "CANCELLED", key: "statusCancelled" }, { value: "REFUNDED", key: "statusRefunded" }
];
const allowedNext: Record<Status, Status[]> = {
  INQUIRY: ["QUOTATION", "PENDING", "CANCELLED"],
  QUOTATION: ["PENDING", "ON_HOLD", "CANCELLED"],
  PENDING: ["ON_HOLD", "CONFIRMED", "CANCELLED"],
  ON_HOLD: ["PENDING", "CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PARTIALLY_PAID", "FULLY_PAID", "COMPLETED", "CANCELLED"],
  PARTIALLY_PAID: ["FULLY_PAID", "COMPLETED", "CANCELLED", "REFUNDED"],
  FULLY_PAID: ["COMPLETED", "CANCELLED", "REFUNDED"],
  COMPLETED: ["REFUNDED"], CANCELLED: ["REFUNDED"], REFUNDED: []
};

export function ReservationsClient({ locale, canWrite }: { locale: Locale; canWrite: boolean }) {
  const [items, setItems] = useState<Reservation[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ReservationForm>(emptyForm);
  const [searchText, setSearchText] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true); setError("");
      try {
        const params = new URLSearchParams({ page: String(page), pageSize: "25" });
        if (appliedSearch) params.set("search", appliedSearch);
        const [reservationResponse, customerResponse, supplierResponse] = await Promise.all([
          fetch(`/api/reservations?${params.toString()}`, { cache: "no-store" }),
          fetch("/api/customers?page=1&pageSize=100", { cache: "no-store" }),
          fetch("/api/suppliers?page=1&pageSize=100", { cache: "no-store" })
        ]);
        const [reservationResult, customerResult, supplierResult] = await Promise.all([
          reservationResponse.json(), customerResponse.json(), supplierResponse.json()
        ]);
        if (!reservationResponse.ok) throw new Error(reservationResponse.status === 403 ? "FORBIDDEN" : reservationResult.error || "LOAD_FAILED");
        if (active) {
          setItems(reservationResult.items as Reservation[]);
          setPages(Math.max(1, reservationResult.pagination.pages));
          setTotal(reservationResult.pagination.total);
          setCustomers(customerResponse.ok ? (customerResult.items as CustomerOption[]) : []);
          setSuppliers(supplierResponse.ok ? (supplierResult.items as SupplierOption[]) : []);
        }
      } catch (reason) {
        if (active) setError(reason instanceof Error && reason.message === "FORBIDDEN" ? t(locale, "accessDenied") : t(locale, "genericError"));
      } finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [page, appliedSearch, refreshKey, locale]);

  function beginCreate() {
    setEditingId(null); setForm({ ...emptyForm, currency: "EGP" }); setError(""); setSuccess(""); setShowForm(true);
  }
  function beginEdit(item: Reservation) {
    setEditingId(item.id);
    setForm({
      customerId: item.customer.id, supplierId: item.supplier?.id ?? "", serviceType: item.serviceType,
      startDate: item.startDate ? new Date(item.startDate).toISOString().slice(0, 10) : "",
      endDate: item.endDate ? new Date(item.endDate).toISOString().slice(0, 10) : "",
      currency: item.currency, saleAmount: item.saleAmount, costAmount: item.costAmount, notes: item.notes ?? ""
    });
    setError(""); setSuccess(""); setShowForm(true); window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;
    setPending(true); setError(""); setSuccess("");
    try {
      const response = await fetch(editingId ? `/api/reservations/${encodeURIComponent(editingId)}` : "/api/reservations", {
        method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: form.customerId, supplierId: form.supplierId, serviceType: form.serviceType,
          startDate: form.startDate, endDate: form.endDate, currency: form.currency,
          saleAmount: form.saleAmount || "0", costAmount: form.costAmount || "0", notes: form.notes.trim()
        })
      });
      const result = await response.json();
      if (!response.ok) {
        if (result.error === "INVALID_DATE_RANGE") throw new Error("DATE_RANGE");
        if (result.error === "INVALID_STATUS_TRANSITION") throw new Error("STATUS_FLOW");
        throw new Error(response.status === 403 ? "FORBIDDEN" : result.error || "SAVE_FAILED");
      }
      setSuccess(t(locale, editingId ? "reservationSaved" : "reservationSaved"));
      setShowForm(false); setEditingId(null); setForm(emptyForm); setPage(1); setAppliedSearch(""); setSearchText(""); setRefreshKey((v) => v + 1);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "";
      setError(message === "FORBIDDEN" ? t(locale, "accessDenied") : message === "DATE_RANGE" ? t(locale, "invalidDateRange") : message === "STATUS_FLOW" ? t(locale, "reservationFlowHint") : t(locale, "genericError"));
    } finally { setPending(false); }
  }
  async function changeStatus(item: Reservation, status: Status) {
    if (!canWrite || status === item.status) return;
    setBusyId(item.id); setError(""); setSuccess("");
    try {
      const response = await fetch(`/api/reservations/${encodeURIComponent(item.id)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(response.status === 409 ? "STATUS_FLOW" : response.status === 403 ? "FORBIDDEN" : result.error || "UPDATE_FAILED");
      setSuccess(t(locale, "reservationStatusUpdated")); setRefreshKey((v) => v + 1);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "";
      setError(message === "STATUS_FLOW" ? t(locale, "reservationFlowHint") : message === "FORBIDDEN" ? t(locale, "accessDenied") : t(locale, "genericError"));
    } finally { setBusyId(null); }
  }
  async function archiveReservation(item: Reservation) {
    if (!canWrite || !window.confirm(locale === "ar" ? "هل تريد أرشفة الحجز؟" : "Archive this reservation?")) return;
    setBusyId(item.id); setError(""); setSuccess("");
    try {
      const response = await fetch(`/api/reservations/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error(response.status === 403 ? "FORBIDDEN" : "ARCHIVE_FAILED");
      setSuccess(locale === "ar" ? "تمت أرشفة الحجز." : "Reservation archived."); setRefreshKey((v) => v + 1);
    } catch (reason) { setError(reason instanceof Error && reason.message === "FORBIDDEN" ? t(locale, "accessDenied") : t(locale, "genericError")); }
    finally { setBusyId(null); }
  }
  function search(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setPage(1); setAppliedSearch(searchText.trim()); }

  return <div className="customer-layout">
    {error && <div className="alert" role="alert">{error}</div>}
    {success && <div className="alert success" role="status">{success}</div>}
    {showForm && canWrite && <section className="panel form-panel">
      <div className="panel-header"><div><h2 className="panel-title">{t(locale, editingId ? "editReservation" : "createReservation")}</h2><div className="panel-subtitle">{locale === "ar" ? "تُحفظ تفاصيل الخدمة والعميل والسعر في قاعدة البيانات" : "Service, customer and pricing details are saved in the database"}</div></div><button className="icon-button" type="button" onClick={() => { setShowForm(false); setEditingId(null); }} aria-label={t(locale, "cancel")}><X size={16} /></button></div>
      <form className="panel-body auth-form" onSubmit={submit}>
        {customers.length === 0 && <div className="alert">{locale === "ar" ? "يجب إضافة عميل واحد على الأقل قبل إنشاء الحجز." : "Add at least one customer before creating a reservation."}</div>}
        <div className="form-grid">
          <label className="field"><span className="field-label">{t(locale, "customerLabel")} *</span><select className="select" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} required><option value="">{t(locale, "selectCustomer")}</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className="field"><span className="field-label">{t(locale, "supplierLabel")}</span><select className="select" value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}><option value="">{t(locale, "selectSupplier")}</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label className="field"><span className="field-label">{t(locale, "serviceTypeLabel")} *</span><select className="select" value={form.serviceType} onChange={(e) => setForm({ ...form, serviceType: e.target.value as ServiceType })}>{serviceTypes.map((s) => <option key={s.value} value={s.value}>{t(locale, s.key)}</option>)}</select></label>
          <label className="field"><span className="field-label">{t(locale, "defaultCurrency")}</span><select className="select" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}><option value="EGP">EGP — {t(locale, "currencyEGP")}</option><option value="SAR">SAR — {t(locale, "currencySAR")}</option><option value="USD">USD — {t(locale, "currencyUSD")}</option></select></label>
          <label className="field"><span className="field-label">{t(locale, "startDate")}</span><input className="input" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></label>
          <label className="field"><span className="field-label">{t(locale, "endDate")}</span><input className="input" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} min={form.startDate || undefined} /></label>
          <label className="field"><span className="field-label">{t(locale, "saleAmount")}</span><input className="input" type="number" inputMode="decimal" min="0" step="0.01" value={form.saleAmount} onChange={(e) => setForm({ ...form, saleAmount: e.target.value })} required /></label>
          <label className="field"><span className="field-label">{t(locale, "costAmount")}</span><input className="input" type="number" inputMode="decimal" min="0" step="0.01" value={form.costAmount} onChange={(e) => setForm({ ...form, costAmount: e.target.value })} required /></label>
          <label className="field span-2"><span className="field-label">{t(locale, "notes")}</span><textarea className="textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={2000} /></label>
        </div>
        {editingId && <p className="customer-secondary">{t(locale, "reservationFlowHint")}</p>}
        <div className="form-footer"><button className="btn btn-secondary" type="button" onClick={() => { setShowForm(false); setEditingId(null); }}>{t(locale, "cancel")}</button><button className="btn btn-primary" type="submit" disabled={pending || customers.length === 0}><Check size={15} />{pending ? t(locale, "creating") : t(locale, "save")}</button></div>
      </form>
    </section>}

    <section className="panel">
      <div className="table-toolbar">
        <form className="search-field" onSubmit={search}><Search size={16} /><input className="input" aria-label={t(locale, "search")} placeholder={t(locale, "search")} value={searchText} onChange={(e) => setSearchText(e.target.value)} /></form>
        <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap" }}><span className="customer-secondary">{new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US").format(total)} {locale === "ar" ? "حجز" : "reservations"}</span>{canWrite && <button className="btn btn-primary" type="button" onClick={beginCreate}><Plus size={16} />{t(locale, "addReservation")}</button>}</div>
      </div>
      {loading ? <div className="empty-state"><div className="empty-icon"><ClipboardList size={22} /></div><div>{t(locale, "loading")}</div></div> :
      items.length === 0 ? <div className="empty-state"><div className="empty-icon"><CalendarDays size={22} /></div><div className="empty-title">{appliedSearch ? t(locale, "emptySearch") : t(locale, "noReservationsYet")}</div><p className="empty-copy">{locale === "ar" ? "أنشئ الحجز الأول لربط العميل بالخدمة وتكلفتها وسعر البيع." : "Create your first reservation to connect a customer with a service and its selling price and cost."}</p>{canWrite && !appliedSearch && customers.length > 0 && <button className="btn btn-primary" style={{ marginTop: 15 }} onClick={beginCreate} type="button"><Plus size={15} />{t(locale, "addReservation")}</button>}</div> :
      <div className="table-wrap"><table className="data-table"><thead><tr><th>{t(locale, "reservationReference")}</th><th>{t(locale, "customerLabel")}</th><th>{t(locale, "serviceTypeLabel")}</th><th>{t(locale, "reservationStatusLabel")}</th><th>{t(locale, "startDate")}</th><th>{t(locale, "saleAmount")}</th><th>{t(locale, "actions")}</th></tr></thead><tbody>
        {items.map((item) => <tr key={item.id}>
          <td><div className="customer-primary" dir="ltr">{item.reference}</div><div className="customer-secondary">{item.supplier?.name || "—"}</div></td>
          <td><div className="customer-primary">{item.customer.name}</div></td>
          <td>{t(locale, serviceTypes.find((x) => x.value === item.serviceType)?.key ?? "serviceOther")}</td>
          <td>{canWrite ? <select className="select" style={{ minWidth: 135, padding: "6px 8px", fontSize: 11 }} aria-label={t(locale, "reservationStatusLabel")} value={item.status} disabled={busyId === item.id} onChange={(e) => void changeStatus(item, e.target.value as Status)}>{[item.status, ...allowedNext[item.status]].filter((v, i, all) => all.indexOf(v) === i).map((value) => <option key={value} value={value}>{t(locale, statuses.find((s) => s.value === value)?.key ?? "statusInquiry")}</option>)}</select> : <span className="type-pill">{t(locale, statuses.find((s) => s.value === item.status)?.key ?? "statusInquiry")}</span>}</td>
          <td>{item.startDate ? new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", { dateStyle: "medium" }).format(new Date(item.startDate)) : "—"}</td>
          <td><div className="customer-primary" dir="ltr">{new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(item.saleAmount))} {item.currency}</div><div className="customer-secondary">{t(locale, "costAmount")}: {new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(item.costAmount))}</div></td>
          <td><div className="row-actions">{canWrite && <><button className="small-btn" type="button" disabled={busyId === item.id} onClick={() => beginEdit(item)}><Pencil size={12} style={{ display: "inline", verticalAlign: "middle", marginInlineEnd: 4 }} />{t(locale, "edit")}</button><button className="small-btn danger" type="button" disabled={busyId === item.id} onClick={() => void archiveReservation(item)}><Archive size={12} style={{ display: "inline", verticalAlign: "middle", marginInlineEnd: 4 }} />{t(locale, "archive")}</button></>}</div></td>
        </tr>)}
      </tbody></table></div>}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "13px 18px", borderTop: "1px solid var(--line)" }}><span className="customer-secondary">{locale === "ar" ? `صفحة ${page} من ${pages}` : `Page ${page} of ${pages}`}</span><div style={{ display: "flex", gap: 6 }}><button className="small-btn" type="button" disabled={page <= 1 || loading} onClick={() => setPage((v) => Math.max(1, v - 1))} aria-label={locale === "ar" ? "الصفحة السابقة" : "Previous page"}><ChevronLeft size={15} /></button><button className="small-btn" type="button" disabled={page >= pages || loading} onClick={() => setPage((v) => v + 1)} aria-label={locale === "ar" ? "الصفحة التالية" : "Next page"}><ChevronRight size={15} /></button></div></div>
    </section>
  </div>;
}
