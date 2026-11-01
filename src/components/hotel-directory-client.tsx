"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Archive, Check, ChevronLeft, ChevronRight, Hotel, Pencil, Plus, Search, X } from "lucide-react";
import type { Locale } from "@/lib/messages";

type HotelRecord = { id: string; name: string; city: string | null; country: string | null; notes: string | null; createdAt: string };
type HotelForm = { name: string; city: string; country: string; notes: string };
const emptyForm: HotelForm = { name: "", city: "", country: "", notes: "" };

export function HotelDirectoryClient({ locale, canWrite }: { locale: Locale; canWrite: boolean }) {
  const ar = locale === "ar";
  const [items, setItems] = useState<HotelRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<HotelForm>(emptyForm);
  const [searchText, setSearchText] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ page: String(page), pageSize: "25" });
        if (appliedSearch) params.set("search", appliedSearch);
        const response = await fetch(`/api/hotels?${params.toString()}`, { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(response.status === 403 ? "FORBIDDEN" : result.error || "LOAD_FAILED");
        if (active) {
          setItems(result.items as HotelRecord[]);
          setPages(Math.max(1, result.pagination.pages));
          setTotal(result.pagination.total);
        }
      } catch (reason) {
        if (active) setError(reason instanceof Error && reason.message === "FORBIDDEN" ? (ar ? "ليس لديك صلاحية لعرض الفنادق." : "You do not have permission to view hotels.") : (ar ? "تعذر تحميل الفنادق." : "Could not load hotels."));
      } finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [page, appliedSearch, refreshKey, ar]);

  function beginCreate() {
    setEditingId(null); setForm(emptyForm); setError(""); setSuccess(""); setShowForm(true);
  }
  function beginEdit(item: HotelRecord) {
    setEditingId(item.id);
    setForm({ name: item.name, city: item.city ?? "", country: item.country ?? "", notes: item.notes ?? "" });
    setError(""); setSuccess(""); setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;
    setPending(true); setError(""); setSuccess("");
    try {
      const response = await fetch(editingId ? `/api/hotels/${encodeURIComponent(editingId)}` : "/api/hotels", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name.trim(), city: form.city.trim(), country: form.country.trim(), notes: form.notes.trim() })
      });
      const result = await response.json();
      if (!response.ok) {
        if (result.error === "HOTEL_NAME_EXISTS") throw new Error("DUPLICATE");
        if (response.status === 403) throw new Error("FORBIDDEN");
        throw new Error("SAVE_FAILED");
      }
      setSuccess(ar ? (editingId ? "تم تحديث بيانات الفندق." : "تمت إضافة الفندق للقائمة.") : (editingId ? "Hotel updated." : "Hotel added to the directory."));
      setShowForm(false); setEditingId(null); setForm(emptyForm); setPage(1); setAppliedSearch(""); setSearchText(""); setRefreshKey((v) => v + 1);
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : "";
      setError(code === "DUPLICATE" ? (ar ? "اسم الفندق مسجل بالفعل." : "This hotel name already exists.") : code === "FORBIDDEN" ? (ar ? "ليس لديك صلاحية التعديل." : "You do not have permission to edit hotels.") : (ar ? "تعذر حفظ الفندق. راجع البيانات وحاول مرة أخرى." : "Could not save the hotel. Check the details and try again."));
    } finally { setPending(false); }
  }
  async function archiveHotel(item: HotelRecord) {
    if (!canWrite || !window.confirm(ar ? `هل تريد أرشفة فندق «${item.name}»؟ سيظل ظاهرًا في الحجوزات القديمة.` : `Archive “${item.name}”? It will remain on historical reservations.`)) return;
    setError(""); setSuccess("");
    try {
      const response = await fetch(`/api/hotels/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error(response.status === 403 ? "FORBIDDEN" : "ARCHIVE_FAILED");
      setSuccess(ar ? "تمت أرشفة الفندق." : "Hotel archived.");
      setRefreshKey((v) => v + 1);
    } catch (reason) {
      setError(reason instanceof Error && reason.message === "FORBIDDEN" ? (ar ? "ليس لديك صلاحية الأرشفة." : "You do not have permission to archive hotels.") : (ar ? "تعذرت أرشفة الفندق." : "Could not archive the hotel."));
    }
  }
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPage(1); setAppliedSearch(searchText.trim());
  }

  return <div className="customer-layout">
    {error && <div className="alert" role="alert">{error}</div>}
    {success && <div className="alert success" role="status">{success}</div>}
    {showForm && canWrite && <section className="panel form-panel">
      <div className="panel-header">
        <div><h2 className="panel-title">{ar ? (editingId ? "تعديل بيانات الفندق" : "إضافة فندق جديد") : (editingId ? "Edit hotel" : "Add a hotel")}</h2><div className="panel-subtitle">{ar ? "سجّل اسم الفندق هنا ليظهر في قائمة اختيار الفندق داخل الحجز." : "Add a hotel here so it appears in the hotel selector on reservations."}</div></div>
        <button className="icon-button" type="button" onClick={() => setShowForm(false)} aria-label={ar ? "إغلاق" : "Close"}><X size={16} /></button>
      </div>
      <form className="panel-body auth-form" onSubmit={submit}>
        <div className="form-grid">
          <label className="field"><span className="field-label">{ar ? "اسم الفندق" : "Hotel name"} *</span><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} maxLength={160} autoFocus /></label>
          <label className="field"><span className="field-label">{ar ? "المدينة" : "City"}</span><input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} maxLength={120} /></label>
          <label className="field"><span className="field-label">{ar ? "الدولة" : "Country"}</span><input className="input" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} maxLength={120} /></label>
          <label className="field span-2"><span className="field-label">{ar ? "ملاحظات" : "Notes"}</span><textarea className="textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={2000} /></label>
        </div>
        <div className="form-footer"><button className="btn btn-secondary" type="button" onClick={() => setShowForm(false)}>{ar ? "إلغاء" : "Cancel"}</button><button className="btn btn-primary" type="submit" disabled={pending}><Check size={15} />{pending ? (ar ? "جارٍ الحفظ..." : "Saving...") : (ar ? "حفظ الفندق" : "Save hotel")}</button></div>
      </form>
    </section>}
    <section className="panel">
      <div className="table-toolbar">
        <form className="search-field" onSubmit={search}><Search size={16} /><input className="input" aria-label={ar ? "بحث" : "Search"} placeholder={ar ? "ابحث باسم الفندق أو المدينة..." : "Search hotel or city..."} value={searchText} onChange={(e) => setSearchText(e.target.value)} /></form>
        <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap" }}>
          <span className="customer-secondary">{new Intl.NumberFormat(ar ? "ar-EG" : "en-US").format(total)} {ar ? "فندق" : "hotels"}</span>
          {canWrite && <button className="btn btn-primary" type="button" onClick={beginCreate}><Plus size={16} />{ar ? "إضافة فندق" : "Add hotel"}</button>}
        </div>
      </div>
      {loading ? <div className="empty-state"><div className="empty-icon"><Hotel size={22} /></div><div>{ar ? "جارٍ تحميل الفنادق..." : "Loading hotels..."}</div></div> :
      items.length === 0 ? <div className="empty-state"><div className="empty-icon"><Hotel size={22} /></div><div className="empty-title">{appliedSearch ? (ar ? "لا توجد نتائج" : "No results") : (ar ? "قائمة الفنادق فارغة" : "No hotels yet")}</div><p className="empty-copy">{ar ? "أضف أسماء الفنادق التي تتعامل معها. هذه القائمة مستقلة عن شركات الموردين." : "Add the hotels you work with. This directory is separate from supplier companies."}</p>{canWrite && !appliedSearch && <button className="btn btn-primary" style={{ marginTop: 15 }} onClick={beginCreate} type="button"><Plus size={15} />{ar ? "إضافة أول فندق" : "Add your first hotel"}</button>}</div> :
      <div className="table-wrap"><table className="data-table"><thead><tr><th>{ar ? "اسم الفندق" : "Hotel"}</th><th>{ar ? "الموقع" : "Location"}</th><th>{ar ? "ملاحظات" : "Notes"}</th><th>{ar ? "الإجراءات" : "Actions"}</th></tr></thead><tbody>
        {items.map((item) => <tr key={item.id}>
          <td><div className="customer-primary">{item.name}</div></td>
          <td><div className="customer-secondary">{[item.city, item.country].filter(Boolean).join("، ") || "—"}</div></td>
          <td><div className="customer-secondary">{item.notes || "—"}</div></td>
          <td><div className="row-actions">{canWrite && <><button className="small-btn" type="button" onClick={() => beginEdit(item)}><Pencil size={12} style={{ display: "inline", verticalAlign: "middle", marginInlineEnd: 4 }} />{ar ? "تعديل" : "Edit"}</button><button className="small-btn danger" type="button" onClick={() => void archiveHotel(item)}><Archive size={12} style={{ display: "inline", verticalAlign: "middle", marginInlineEnd: 4 }} />{ar ? "أرشفة" : "Archive"}</button></>}</div></td>
        </tr>)}
      </tbody></table></div>}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "13px 18px", borderTop: "1px solid var(--line)" }}>
        <span className="customer-secondary">{ar ? `صفحة ${page} من ${pages}` : `Page ${page} of ${pages}`}</span>
        <div style={{ display: "flex", gap: 6 }}><button className="small-btn" type="button" disabled={page <= 1 || loading} onClick={() => setPage((v) => Math.max(1, v - 1))} aria-label={ar ? "السابق" : "Previous"}><ChevronLeft size={15} /></button><button className="small-btn" type="button" disabled={page >= pages || loading} onClick={() => setPage((v) => v + 1)} aria-label={ar ? "التالي" : "Next"}><ChevronRight size={15} /></button></div>
      </div>
    </section>
  </div>;
}
