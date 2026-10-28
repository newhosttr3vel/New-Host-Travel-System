"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Archive, Check, ChevronLeft, ChevronRight, Pencil, Plus, Search, Store, X } from "lucide-react";
import { t, type Locale } from "@/lib/messages";

type SupplierCategory = "HOTEL" | "AIRLINE" | "TRANSPORT" | "VISA_PROVIDER" | "TOUR_OPERATOR" | "OTHER";
type Supplier = {
  id: string; name: string; category: SupplierCategory; contactName: string | null;
  email: string | null; phone: string | null; paymentTerms: string | null; notes: string | null; createdAt: string;
};
type SupplierForm = { name: string; category: SupplierCategory; contactName: string; email: string; phone: string; paymentTerms: string; notes: string };
const emptyForm: SupplierForm = { name: "", category: "OTHER", contactName: "", email: "", phone: "", paymentTerms: "", notes: "" };
const categories: { value: SupplierCategory; key: "categoryHotel" | "categoryAirline" | "categoryTransport" | "categoryVisaProvider" | "categoryTourOperator" | "categoryOther" }[] = [
  { value: "HOTEL", key: "categoryHotel" }, { value: "AIRLINE", key: "categoryAirline" },
  { value: "TRANSPORT", key: "categoryTransport" }, { value: "VISA_PROVIDER", key: "categoryVisaProvider" },
  { value: "TOUR_OPERATOR", key: "categoryTourOperator" }, { value: "OTHER", key: "categoryOther" }
];

export function SuppliersClient({ locale, canWrite }: { locale: Locale; canWrite: boolean }) {
  const [items, setItems] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SupplierForm>(emptyForm);
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
        const response = await fetch(`/api/suppliers?${params.toString()}`, { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(response.status === 403 ? "FORBIDDEN" : result.error || "LOAD_FAILED");
        if (active) { setItems(result.items as Supplier[]); setPages(Math.max(1, result.pagination.pages)); setTotal(result.pagination.total); }
      } catch (reason) {
        if (active) setError(reason instanceof Error && reason.message === "FORBIDDEN" ? t(locale, "accessDenied") : t(locale, "genericError"));
      } finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [page, appliedSearch, refreshKey, locale]);

  function beginCreate() { setEditingId(null); setForm(emptyForm); setError(""); setSuccess(""); setShowForm(true); }
  function beginEdit(item: Supplier) {
    setEditingId(item.id);
    setForm({ name: item.name, category: item.category, contactName: item.contactName ?? "", email: item.email ?? "", phone: item.phone ?? "", paymentTerms: item.paymentTerms ?? "", notes: item.notes ?? "" });
    setError(""); setSuccess(""); setShowForm(true); window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!canWrite) return;
    setPending(true); setError(""); setSuccess("");
    try {
      const response = await fetch(editingId ? `/api/suppliers/${encodeURIComponent(editingId)}` : "/api/suppliers", {
        method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(), category: form.category, contactName: form.contactName.trim(),
          email: form.email.trim(), phone: form.phone.trim(), paymentTerms: form.paymentTerms.trim(), notes: form.notes.trim()
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(response.status === 403 ? "FORBIDDEN" : result.error || "SAVE_FAILED");
      setSuccess(t(locale, "supplierSaved")); setShowForm(false); setEditingId(null); setForm(emptyForm);
      setPage(1); setAppliedSearch(""); setSearchText(""); setRefreshKey((v) => v + 1);
    } catch (reason) {
      setError(reason instanceof Error && reason.message === "FORBIDDEN" ? t(locale, "accessDenied") : t(locale, "genericError"));
    } finally { setPending(false); }
  }
  async function archiveSupplier(item: Supplier) {
    if (!canWrite || !window.confirm(t(locale, "archiveSupplierConfirmation"))) return;
    setError(""); setSuccess("");
    try {
      const response = await fetch(`/api/suppliers/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(response.status === 403 ? "FORBIDDEN" : result.error || "ARCHIVE_FAILED");
      setSuccess(t(locale, "supplierArchived")); setRefreshKey((v) => v + 1);
    } catch (reason) {
      setError(reason instanceof Error && reason.message === "FORBIDDEN" ? t(locale, "accessDenied") : t(locale, "genericError"));
    }
  }
  function search(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setPage(1); setAppliedSearch(searchText.trim()); }

  return <div className="customer-layout">
    {error && <div className="alert" role="alert">{error}</div>}
    {success && <div className="alert success" role="status">{success}</div>}
    {showForm && canWrite && <section className="panel form-panel">
      <div className="panel-header"><div><h2 className="panel-title">{t(locale, editingId ? "editSupplier" : "createSupplier")}</h2><div className="panel-subtitle">{locale === "ar" ? "بيانات المورد وشروط التعامل التجاري" : "Supplier contact and commercial terms"}</div></div><button className="icon-button" type="button" onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }} aria-label={t(locale, "cancel")}><X size={16} /></button></div>
      <form className="panel-body auth-form" onSubmit={submit}>
        <div className="form-grid">
          <label className="field"><span className="field-label">{t(locale, "supplierName")} *</span><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} maxLength={160} autoFocus /></label>
          <label className="field"><span className="field-label">{t(locale, "supplierCategory")}</span><select className="select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as SupplierCategory })}>{categories.map((c) => <option key={c.value} value={c.value}>{t(locale, c.key)}</option>)}</select></label>
          <label className="field"><span className="field-label">{t(locale, "supplierContact")}</span><input className="input" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} maxLength={120} /></label>
          <label className="field"><span className="field-label">{t(locale, "phone")}</span><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={40} dir="ltr" /></label>
          <label className="field span-2"><span className="field-label">{t(locale, "email")}</span><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={254} dir="ltr" /></label>
          <label className="field span-2"><span className="field-label">{t(locale, "paymentTerms")}</span><input className="input" value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} maxLength={500} /></label>
          <label className="field span-2"><span className="field-label">{t(locale, "notes")}</span><textarea className="textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={2000} /></label>
        </div>
        <div className="form-footer"><button className="btn btn-secondary" type="button" onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }}>{t(locale, "cancel")}</button><button className="btn btn-primary" type="submit" disabled={pending}><Check size={15} />{pending ? t(locale, "creating") : t(locale, "save")}</button></div>
      </form>
    </section>}

    <section className="panel">
      <div className="table-toolbar">
        <form className="search-field" onSubmit={search}><Search size={16} /><input className="input" aria-label={t(locale, "search")} placeholder={t(locale, "search")} value={searchText} onChange={(e) => setSearchText(e.target.value)} /></form>
        <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap" }}><span className="customer-secondary">{new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US").format(total)} {locale === "ar" ? "سجل" : "records"}</span>{canWrite && <button className="btn btn-primary" type="button" onClick={beginCreate}><Plus size={16} />{t(locale, "addSupplier")}</button>}</div>
      </div>
      {loading ? <div className="empty-state"><div className="empty-icon"><Store size={22} /></div><div>{t(locale, "loading")}</div></div> :
      items.length === 0 ? <div className="empty-state"><div className="empty-icon"><Store size={22} /></div><div className="empty-title">{appliedSearch ? t(locale, "emptySearch") : t(locale, "noSuppliersYet")}</div><p className="empty-copy">{!appliedSearch && (locale === "ar" ? "أضف الفنادق وشركات الطيران ومقدمي الخدمات الذين تتعامل معهم." : "Add the hotels, airlines and service providers you work with.")}</p>{canWrite && !appliedSearch && <button className="btn btn-primary" style={{ marginTop: 15 }} onClick={beginCreate} type="button"><Plus size={15} />{t(locale, "addSupplier")}</button>}</div> :
      <div className="table-wrap"><table className="data-table"><thead><tr><th>{t(locale, "supplierName")}</th><th>{t(locale, "supplierCategory")}</th><th>{t(locale, "supplierContact")}</th><th>{t(locale, "phone")}</th><th>{t(locale, "paymentTerms")}</th><th>{t(locale, "actions")}</th></tr></thead><tbody>
        {items.map((item) => <tr key={item.id}><td><div className="customer-primary">{item.name}</div><div className="customer-secondary">{item.email || "—"}</div></td><td><span className="type-pill">{t(locale, categories.find((c) => c.value === item.category)?.key ?? "categoryOther")}</span></td><td>{item.contactName || "—"}</td><td dir="ltr" style={{ textAlign: locale === "ar" ? "right" : "left" }}>{item.phone || "—"}</td><td>{item.paymentTerms || "—"}</td><td><div className="row-actions">{canWrite && <><button className="small-btn" type="button" onClick={() => beginEdit(item)}><Pencil size={12} style={{ display: "inline", verticalAlign: "middle", marginInlineEnd: 4 }} />{t(locale, "edit")}</button><button className="small-btn danger" type="button" onClick={() => void archiveSupplier(item)}><Archive size={12} style={{ display: "inline", verticalAlign: "middle", marginInlineEnd: 4 }} />{t(locale, "archive")}</button></>}</div></td></tr>)}
      </tbody></table></div>}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "13px 18px", borderTop: "1px solid var(--line)" }}><span className="customer-secondary">{locale === "ar" ? `صفحة ${page} من ${pages}` : `Page ${page} of ${pages}`}</span><div style={{ display: "flex", gap: 6 }}><button className="small-btn" type="button" disabled={page <= 1 || loading} onClick={() => setPage((v) => Math.max(1, v - 1))} aria-label={locale === "ar" ? "الصفحة السابقة" : "Previous page"}><ChevronLeft size={15} /></button><button className="small-btn" type="button" disabled={page >= pages || loading} onClick={() => setPage((v) => v + 1)} aria-label={locale === "ar" ? "الصفحة التالية" : "Next page"}><ChevronRight size={15} /></button></div></div>
    </section>
  </div>;
}
