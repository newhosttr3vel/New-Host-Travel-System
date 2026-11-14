"use client";
import { useState, type FormEvent } from "react";
import { UserPlus, Users, ShieldCheck, RefreshCw } from "lucide-react";
import type { Locale } from "@/lib/messages";

type Member = { id: string; role: string; createdAt: string; user: { id: string; name: string; email: string; emailVerified: boolean; createdAt: Date | string } };
const roles = [
  ["BRANCH_MANAGER","مدير فرع","Branch manager"],["RESERVATIONS_MANAGER","مدير الحجوزات","Reservations manager"],
  ["RESERVATIONS_AGENT","موظف حجوزات","Reservations agent"],["ACCOUNTANT","محاسب","Accountant"],
  ["SALES","مبيعات","Sales"],["VISA_OFFICER","مسؤول تأشيرات","Visa officer"],
  ["OPERATIONS","العمليات","Operations"],["AUDITOR","مراجع","Auditor"],["READ_ONLY","قراءة فقط","Read only"],
];
const labels: Record<string,[string,string]> = { OWNER:["مالك النظام","System owner"], ...Object.fromEntries(roles.map(([k,a,e])=>[k,[a,e]])) };
export function TeamManagement({ locale, initialMembers }: { locale: Locale; initialMembers: Member[] }) {
  const ar=locale==="ar";
  const [members,setMembers]=useState(initialMembers), [name,setName]=useState(""), [email,setEmail]=useState("");
  const [password,setPassword]=useState(""), [role,setRole]=useState("RESERVATIONS_AGENT");
  const [busy,setBusy]=useState(false), [error,setError]=useState(""), [success,setSuccess]=useState("");
  async function refreshMembers() {
    const response=await fetch("/api/team-members",{cache:"no-store"});
    if(response.ok) setMembers((await response.json()).members);
  }
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setSuccess("");
    try {
      const response=await fetch("/api/team-members",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,email,password,role})});
      const result=await response.json();
      if(!response.ok) { setError(result.error==="EMAIL_ALREADY_EXISTS"?(ar?"البريد الإلكتروني مستخدم بالفعل.":"This email is already in use."):(ar?"تعذر إنشاء الحساب. راجع البيانات وحاول مرة أخرى.":"Could not create the account. Check the details and try again.")); return; }
      await refreshMembers(); setName("");setEmail("");setPassword("");setRole("RESERVATIONS_AGENT");
      setSuccess(ar?"تم إنشاء حساب الموظف وإضافته إلى الشركة.":"Employee account created and added to the company.");
    } catch { setError(ar?"حدث خطأ في الاتصال. حاول مرة أخرى.":"A connection error occurred. Please try again."); }
    finally { setBusy(false); }
  }
  return <div dir={locale}>
    <div className="page-heading"><div><div className="eyebrow">{ar?"إدارة الوصول والصلاحيات":"ACCESS & PERMISSIONS"}</div><h1 className="page-title">{ar?"إدارة الموظفين":"Team management"}</h1><p className="page-description">{ar?"أضف أعضاء فريقك وحدد دور كل موظف. إنشاء الحسابات متاح لمالك النظام فقط.":"Add team members and assign their roles. Only the system owner can create accounts."}</p></div><div className="page-actions"><span className="btn btn-secondary"><ShieldCheck size={16}/>{ar?"إدارة المالك فقط":"Owner controlled"}</span></div></div>
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="panel"><div className="panel-header"><span className="empty-icon"><UserPlus size={20}/></span><div><h2>{ar?"إضافة موظف جديد":"Add an employee"}</h2><p>{ar?"بيانات الدخول والدور الوظيفي":"Login details and job role"}</p></div></div>
        <div className="panel-body"><form onSubmit={submit} className="form-grid" style={{ display: "grid", gap: 14 }}>
          <label className="field"><span className="field-label">{ar?"اسم الموظف":"Employee name"}</span><input className="input" value={name} onChange={e=>setName(e.target.value)} required minLength={2} maxLength={100} autoComplete="name"/></label>
          <label className="field"><span className="field-label">{ar?"البريد الإلكتروني (اسم الدخول)":"Email (login)"}</span><input className="input" type="email" dir="ltr" value={email} onChange={e=>setEmail(e.target.value)} required maxLength={254} autoComplete="off"/></label>
          <label className="field"><span className="field-label">{ar?"كلمة المرور المؤقتة":"Temporary password"}</span><input className="input" type="password" dir="ltr" value={password} onChange={e=>setPassword(e.target.value)} required minLength={12} maxLength={128} autoComplete="new-password"/><small className="customer-secondary">{ar?"12 حرفًا على الأقل. سلّمها للموظف بطريقة آمنة.":"At least 12 characters. Share it with the employee securely."}</small></label>
          <label className="field"><span className="field-label">{ar?"الدور الوظيفي":"Role"}</span><select className="input" value={role} onChange={e=>setRole(e.target.value)}>{roles.map(([v,a,e])=><option key={v} value={v}>{ar?a:e}</option>)}</select></label>
          {error&&<div role="alert" className="alert">{error}</div>}{success&&<div role="status" className="alert">{success}</div>}
          <button className="btn btn-primary" disabled={busy} type="submit"><UserPlus size={16}/>{busy?(ar?"جارٍ إنشاء الحساب...":"Creating account..."):(ar?"إنشاء حساب الموظف":"Create employee account")}</button>
        </form></div>
      </section>
      <section className="panel"><div className="panel-header"><span className="card-icon"><Users size={20}/></span><div><h2>{ar?"أعضاء الشركة":"Company members"}</h2><p>{members.length} {ar?"حساب":"accounts"}</p></div><button className="btn btn-secondary" type="button" onClick={refreshMembers} aria-label={ar?"تحديث":"Refresh"}><RefreshCw size={15}/></button></div>
        <div className="panel-body"><table><thead><tr><th>{ar?"الموظف":"Employee"}</th><th>{ar?"الدور":"Role"}</th></tr></thead><tbody>
          {members.map(m=><tr key={m.id}><td><strong>{m.user.name}</strong><div dir="ltr">{m.user.email}</div></td><td>{(labels[m.role]??[m.role,m.role])[ar?0:1]}</td></tr>)}
          {!members.length&&<tr><td colSpan={2}>{ar?"لا يوجد أعضاء بعد.":"No team members yet."}</td></tr>}
        </tbody></table></div>
      </section>
    </div>
  </div>;
}
