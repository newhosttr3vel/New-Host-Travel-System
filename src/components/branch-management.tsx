"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Building2, Plus, UserPlus, Users, RefreshCw } from "lucide-react";
import type { Locale } from "@/lib/messages";

type BranchItem = { id: string; name: string; slug: string; isActive: boolean; memberships?: { membershipId: string }[] };
type MemberItem = { id: string; role: string; user: { id: string; name: string; email: string } };

export function BranchManagement({ locale }: { locale: Locale }) {
  const ar = locale === "ar";
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [name, setName] = useState("");
  const [memberIds, setMemberIds] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/branches", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "LOAD_FAILED");
      setBranches(data.items ?? []);
      setMembers(data.memberships ?? []);
    } catch {
      setError(ar ? "تعذر تحميل بيانات الفروع." : "Could not load branches.");
    } finally {
      setLoading(false);
    }
  }, [ar]);

  useEffect(() => { void load(); }, [load]);

  async function createBranch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "CREATE_FAILED");
      setName("");
      setNotice(ar ? "تم إنشاء الفرع." : "Branch created.");
      await load();
    } catch {
      setError(ar ? "تعذر إنشاء الفرع." : "Could not create branch.");
    } finally {
      setSaving(false);
    }
  }

  async function assign(branchId: string) {
    const membershipId = memberIds[branchId];
    if (!membershipId) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/branches/" + encodeURIComponent(branchId) + "/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "ASSIGN_FAILED");
      setNotice(ar ? "تم ربط الموظف بالفرع." : "Employee assigned to branch.");
      setMemberIds((current) => ({ ...current, [branchId]: "" }));
      await load();
    } catch {
      setError(ar ? "تعذر ربط الموظف بالفرع." : "Could not assign employee.");
    } finally {
      setSaving(false);
    }
  }

  async function unassign(branchId: string, membershipId: string) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/branches/" + encodeURIComponent(branchId) + "/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "REMOVE_FAILED");
      setNotice(ar ? "تم إلغاء ربط الموظف بالفرع." : "Employee removed from branch.");
      await load();
    } catch {
      setError(ar ? "تعذر إلغاء الربط." : "Could not remove employee assignment.");
    } finally {
      setSaving(false);
    }
  }

  return <section className="panel" style={{ marginTop: 24, padding: 20 }}>
    <div className="panel-heading" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div>
        <div className="eyebrow">{ar ? "صلاحيات الوصول" : "ACCESS CONTROL"}</div>
        <h2 className="section-title">{ar ? "إدارة الفروع والموظفين" : "Branches & team access"}</h2>
        <p className="page-description">{ar ? "الحجوزات والمستندات تظهر فقط لموظفي الفروع المعيّنين." : "Reservations and documents are visible only to employees assigned to their branches."}</p>
      </div>
      <button type="button" className="btn btn-secondary" onClick={() => void load()} disabled={loading || saving}><RefreshCw size={15} />{ar ? "تحديث" : "Refresh"}</button>
    </div>

    {error && <div className="alert" role="alert">{error}</div>}
    {notice && <div className="alert" role="status">{notice}</div>}

    <form onSubmit={createBranch} className="form-grid" style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 18 }}>
      <label className="field" style={{ flex: "1 1 260px" }}>
        <span className="field-label">{ar ? "اسم الفرع الجديد" : "New branch name"}</span>
        <input className="input" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={100} required />
      </label>
      <button className="btn btn-primary" type="submit" disabled={saving || !name.trim()} style={{ alignSelf: "end" }}><Plus size={16} />{ar ? "إضافة فرع" : "Add branch"}</button>
    </form>

    {loading ? <p className="customer-secondary">{ar ? "جارٍ التحميل..." : "Loading..."}</p> :
      branches.length === 0 ? <p className="customer-secondary">{ar ? "لا توجد فروع." : "No branches found."}</p> :
      <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
        {branches.map((branch) => {
          const assigned = new Set((branch.memberships ?? []).map((item) => item.membershipId));
          const options = members.filter((member) => !assigned.has(member.id));
          return <article key={branch.id} className="settings-directory-intro" style={{ display: "block" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <Building2 size={18} />
              <strong>{branch.name}</strong>
              <span className="badge">{branch.slug === "main" ? (ar ? "الفرع الرئيسي" : "Main branch") : branch.slug}</span>
            </div>
            <div style={{ display: "flex", alignItems: "end", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
              <label className="field" style={{ flex: "1 1 250px" }}>
                <span className="field-label">{ar ? "إضافة موظف لهذا الفرع" : "Assign employee to branch"}</span>
                <select className="input" value={memberIds[branch.id] ?? ""} onChange={(event) => setMemberIds((current) => ({ ...current, [branch.id]: event.target.value }))}>
                  <option value="">{ar ? "اختر موظفًا" : "Select an employee"}</option>
                  {options.map((member) => <option key={member.id} value={member.id}>{member.user.name} — {member.user.email} ({member.role})</option>)}
                </select>
              </label>
              <button type="button" className="btn btn-secondary" disabled={saving || !memberIds[branch.id]} onClick={() => void assign(branch.id)}><UserPlus size={15} />{ar ? "تعيين" : "Assign"}</button>
            </div>
            <div style={{ marginTop: 12 }}>
              <div className="field-label" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}><Users size={14} />{ar ? "الموظفون المعيّنون" : "Assigned employees"}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {members.filter((member) => assigned.has(member.id)).map((member) =>
                  <span key={member.id} className="badge" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    {member.user.name}
                    <button type="button" onClick={() => void unassign(branch.id, member.id)} disabled={saving} aria-label={ar ? "إزالة الموظف من الفرع" : "Remove employee from branch"}>×</button>
                  </span>
                )}
                {assigned.size === 0 && <span className="customer-secondary">{ar ? "لا يوجد موظفون مرتبطون." : "No assigned employees."}</span>}
              </div>
            </div>
          </article>;
        })}
      </div>}
  </section>;
}
