"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Archive, Check, ChevronLeft, ChevronRight, Pencil, Plus, Search, Users, X } from "lucide-react";
import { t, type Locale } from "@/lib/messages";

type Customer = {
  id: string;
  type: "INDIVIDUAL" | "CORPORATE";
  name: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};
type CustomerForm = { name: string; type: "INDIVIDUAL" | "CORPORATE"; companyName: string; email: string; phone: string; notes: string };
const emptyForm: CustomerForm = { name: "", type: "INDIVIDUAL", companyName: "", email: "", phone: "", notes: "" };

export function CustomersClient({ locale, canWrite, canArchive }: { locale: Locale; canWrite: boolean; canArchive: boolean }) {
  const [items, setItems] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
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
        const response = await fetch(`/api/customers?${params.toString()}`, { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(response.status === 403 ? "FORBIDDEN" : result.error || "LOAD_FAILED");
        if (active) {
          setItems(result.items as Customer[]);
          setPages(Math.max(1, result.pagination.pages));
          setTotal(result.pagination.total);
        }
      } catch (reason) {
        if (active) setError(reason instanceof Error && reason.message === "FORBIDDEN" ? t(locale, "accessDenied") : t(locale, "genericError"));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [page, appliedSearch, refreshKey, locale]);

  function beginCreate() {
    setEditingId(null); setForm(emptyForm); setError(""); setSuccess(""); setShowForm(true);
  }
  function beginEdit(customer: Customer) {
    setEditingId(customer.id);
    setForm({ name: customer.name, type: customer.type, companyName: customer.companyName ?? "", email: customer.email ?? "", phone: customer.phone ?? "", notes: customer.notes ?? "" });
    setError(""); setSuccess(""); setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;
    setPending(true); setError(""); setSuccess("");
    try {
      const response = await fetch(editingId ? `/api/customers/${encodeURIComponent(editingId)}` : "/api/customers", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(), type: form.type,
          companyName: form.companyName.trim(), email: form.email.trim(),
          phone: form.phone.trim(), notes: form.notes.trim()
        })
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 403) throw new Error("FORBIDDEN");
        if (response.status === 400) throw new Error("VALIDATION");
        throw new Error(result.error || "SAVE_FAILED");
      }
      setSuccess(t(locale, "customerSaved"));
      setShowForm(false); setEditingId(null); setForm(emptyForm); setPage(1); setAppliedSearch("");
      setSearchText(""); setRefreshKey((value) => value + 1);
    } catch (reason) {
      setError(reason instanceof Error && reason.message === "FORBIDDEN" ? t(locale, "accessDenied") : t(locale, "genericError"));
    } finally { setPending(false); }
  }
  async function archiveCustomer(customer: Customer) {
    if (!canArchive || !window.confirm(t(locale, "confirmArchive"))) return;
    setError(""); setSuccess("");
    try {
      const response = await fetch(`/api/customers/${encodeURIComponent(customer.id)}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(response.status === 403 ? "FORBIDDEN" : result.error || "ARCHIVE_FAILED");
      setSuccess(t(locale, "customerArchived"));
      setRefreshKey((value) => value + 1);
    } catch (reason) {
      setError(reason instanceof Error && reason.message === "FORBIDDEN" ? t(locale, "accessDenied") : t(locale, "genericError"));
    }
  }
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPage(1); setAppliedSearch(searchText.trim());
  }

  return <div className="customer-layout">
    {error && <div className="alert" role="alert">{error}</div>}
    {success && <div className="alert success" role="status">{success}</div>}
    {showForm && canWrite && <section className="panel form-panel">
      <div className="panel-header"><div><h2 className="panel-title">{t(locale, editingId ? "editCustomer" : "createCustomer")}</h2><div className="panel-subtitle">{locale === "ar" ? "تُحفظ البيانات في مساحة شركتك فقط" : "Records are saved only inside your company workspace"}</div></div><button className="icon-button" type="button" onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }} aria-label={t(locale, "cancel")}><X size={16} /></button></div>
      <form className="panel-body auth-form" onSubmit={submit}>
        <div className="form-grid">
          <label className="field"><span className="field-label">{t(locale, "customerName")} *</span><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} maxLength={160} autoFocus /></label>
          <label className="field"><span className="field-label">{t(locale, "customerType")}</span><select className="select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as CustomerForm["type"] })}><option value="INDIVIDUAL">{t(locale, "individual")}</option><option value="CORPORATE">{t(locale, "corporate")}</option></select></label>
          <label className="field"><span className="field-label">{t(locale, "businessName")}</span><input className="input" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} maxLength={160} /></label>
          <label className="field"><span className="field-label">{t(locale, "phone")}</span><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={40} dir="ltr" /></label>
          <label className="field span-2"><span className="field-label">{t(locale, "email")}</span><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={254} dir="ltr" /></label>
          <label className="field span-2"><span className="field-label">{t(locale, "notes")}</span><textarea className="textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={2000} /></label>
        </div>
        <div className="form-footer"><button className="btn btn-secondary" type="button" onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }}>{t(locale, "cancel")}</button><button className="btn btn-primary" type="submit" disabled={pending}><Check size={15} />{pending ? t(locale, "creating") : t(locale, "save")}</button></div>
      </form>
    </section>}

    <section className="panel">
      <div className="table-toolbar">
        <form className="search-field" onSubmit={search}><Search size={16} /><input className="input" aria-label={t(locale, "search")} placeholder={t(locale, "search")} value={searchText} onChange={(e) => setSearchText(e.target.value)} /></form>
        <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap" }}>
          <span className="customer-secondary">{new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US").format(total)} {locale === "ar" ? "سجل" : "records"}</span>
          {canWrite && <button className="btn btn-primary" type="button" onClick={beginCreate}><Plus size={16} />{t(locale, "addCustomer")}</button>}
        </div>
      </div>
      {loading ? <div className="empty-state"><div className="empty-icon"><Users size={22} /></div><div>{t(locale, "loading")}</div></div> :
      items.length === 0 ? <div className="empty-state"><div className="empty-icon"><Users size={22} /></div><div className="empty-title">{appliedSearch ? t(locale, "emptySearch") : t(locale, "noCustomersYet")}</div><p className="empty-copy">{!appliedSearch && t(locale, "startWithCustomer")}</p>{canWrite && !appliedSearch && <button className="btn btn-primary" style={{ marginTop: 15 }} onClick={beginCreate} type="button"><Plus size={15} />{t(locale, "addCustomer")}</button>}</div> :
      <div className="table-wrap"><table className="data-table"><thead><tr><th>{t(locale, "customerName")}</th><th>{t(locale, "customerType")}</th><th>{t(locale, "phone")}</th><th>{t(locale, "createdAt")}</th><th>{t(locale, "actions")}</th></tr></thead><tbody>
        {items.map((customer) => <tr key={customer.id}>
          <td><div className="customer-primary">{customer.name}</div><div className="customer-secondary">{customer.companyName || customer.email || "—"}</div>{customer.email && customer.companyName && <div className="customer-secondary">{customer.email}</div>}</td>
          <td><span className="type-pill">{t(locale, customer.type === "CORPORATE" ? "corporate" : "individual")}</span></td>
          <td dir="ltr" style={{ textAlign: locale === "ar" ? "right" : "left" }}>{customer.phone || "—"}</td>
          <td>{new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", { dateStyle: "medium" }).format(new Date(customer.createdAt))}</td>
          <td><div className="row-actions">{canWrite && <button className="small-btn" type="button" onClick={() => beginEdit(customer)}><Pencil size={12} style={{ display: "inline", verticalAlign: "middle", marginInlineEnd: 4 }} />{t(locale, "edit")}</button>}{canArchive && <button className="small-btn danger" type="button" onClick={() => void archiveCustomer(customer)}><Archive size={12} style={{ display: "inline", verticalAlign: "middle", marginInlineEnd: 4 }} />{t(locale, "archive")}</button>}</div></td>
        </tr>)}
      </tbody></table></div>}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "13px 18px", borderTop: "1px solid var(--line)" }}>
        <span className="customer-secondary">{locale === "ar" ? `صفحة ${page} من ${pages}` : `Page ${page} of ${pages}`}</span>
        <div style={{ display: "flex", gap: 6 }}><button className="small-btn" type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} aria-label={locale === "ar" ? "الصفحة السابقة" : "Previous page"}><ChevronLeft size={15} /></button><button className="small-btn" type="button" disabled={page >= pages || loading} onClick={() => setPage((value) => value + 1)} aria-label={locale === "ar" ? "الصفحة التالية" : "Next page"}><ChevronRight size={15} /></button></div>
      </div>
    </section>
  </div>;
}
