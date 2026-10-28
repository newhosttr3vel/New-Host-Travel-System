"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BookOpen, Check, Plus, RefreshCw, Save, WalletCards, X } from "lucide-react";
import type { Locale } from "@/lib/messages";

type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
type LedgerAccount = { id: string; code: string; name: string; nameEn: string; type: AccountType; isSystem: boolean; isActive: boolean };
type JournalLine = { accountId: string; memo: string; debit: string; credit: string };
type JournalViewLine = { id: string; memo: string | null; debit: string; credit: string; baseDebit: string; baseCredit: string; account: { id: string; code: string; name: string; nameEn: string; type: string } };
type JournalEntry = { id: string; reference: string; entryDate: string; description: string; currency: string; exchangeRate: string; status: string; sourceType: string; reversalOfId: string | null; isReversed: boolean; createdAt: string; lines: JournalViewLine[] };
type TrialBalanceRow = { id: string; code: string; name: string; nameEn: string; type: AccountType; totalDebit: string; totalCredit: string; balanceAmount: string; balanceSide: "DEBIT" | "CREDIT" | "ZERO"; isActive: boolean };
type TrialBalance = { items: TrialBalanceRow[]; summary: { totalDebit: string; totalCredit: string; balanced: boolean; accountCount: number } };

const types: { value: AccountType; ar: string; en: string }[] = [
  { value: "ASSET", ar: "أصول", en: "Asset" },
  { value: "LIABILITY", ar: "التزامات", en: "Liability" },
  { value: "EQUITY", ar: "حقوق ملكية", en: "Equity" },
  { value: "REVENUE", ar: "إيرادات", en: "Revenue" },
  { value: "EXPENSE", ar: "مصروفات", en: "Expense" }
];
const accountTypeLabel = (type: AccountType, locale: Locale) => types.find((item) => item.value === type)?.[locale] ?? type;
const todayLocal = () => {
  const date = new Date();
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
};
const emptyLine = (): JournalLine => ({ accountId: "", memo: "", debit: "0.00", credit: "0.00" });

export function FinanceClient({ locale, canWrite }: { locale: Locale; canWrite: boolean }) {
  const ar = locale === "ar";
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [trialBalance, setTrialBalance] = useState<TrialBalance | null>(null);
  const [baseCurrency, setBaseCurrency] = useState("EGP");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [showJournalForm, setShowJournalForm] = useState(false);
  const [journalIdempotencyKey, setJournalIdempotencyKey] = useState("");
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [accountForm, setAccountForm] = useState({ code: "", name: "", nameEn: "", type: "EXPENSE" as AccountType });
  const [entryDate, setEntryDate] = useState(todayLocal());
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("EGP");
  const [exchangeRate, setExchangeRate] = useState("1");
  const [lines, setLines] = useState<JournalLine[]>([emptyLine(), { ...emptyLine(), credit: "0.00" }]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [totalEntries, setTotalEntries] = useState(0);

  useEffect(() => {
    const refreshFinance = () => setRefreshKey((value) => value + 1);
    window.addEventListener("nht:finance-refresh", refreshFinance);
    return () => window.removeEventListener("nht:finance-refresh", refreshFinance);
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true); setError("");
      try {
        const [accountsResponse, journalsResponse, trialBalanceResponse] = await Promise.all([
          fetch("/api/finance/accounts", { cache: "no-store" }),
          fetch("/api/finance/journals?page=" + page + "&pageSize=20", { cache: "no-store" }),
          fetch("/api/finance/trial-balance", { cache: "no-store" })
        ]);
        const [accountsResult, journalsResult, trialBalanceResult] = await Promise.all([
          accountsResponse.json(), journalsResponse.json(), trialBalanceResponse.json()
        ]);
        if (!accountsResponse.ok) throw new Error(accountsResponse.status === 403 ? "FORBIDDEN" : accountsResult.error || "LOAD_FAILED");
        if (!journalsResponse.ok) throw new Error(journalsResponse.status === 403 ? "FORBIDDEN" : journalsResult.error || "LOAD_FAILED");
        if (!trialBalanceResponse.ok) throw new Error(trialBalanceResult.error || "LOAD_FAILED");
        if (active) {
          setAccounts(accountsResult.items as LedgerAccount[]);
          setBaseCurrency(accountsResult.baseCurrency || journalsResult.baseCurrency || "EGP");
          setEntries(journalsResult.items as JournalEntry[]);
          setTrialBalance(trialBalanceResult as TrialBalance);
          setPages(Math.max(1, journalsResult.pagination.pages));
          setTotalEntries(journalsResult.pagination.total);
          setCurrency(accountsResult.baseCurrency || "EGP");
        }
      } catch (reason) {
        if (active) setError(reason instanceof Error && reason.message === "FORBIDDEN"
          ? (ar ? "لا تملك صلاحية عرض البيانات المالية." : "You do not have permission to view finance data.")
          : (ar ? "تعذر تحميل البيانات المالية." : "Could not load finance data."));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [page, refreshKey, ar]);

  const totals = useMemo(() => lines.reduce((result, line) => {
    const debit = Number(line.debit || 0);
    const credit = Number(line.credit || 0);
    return { debit: result.debit + (Number.isFinite(debit) ? debit : 0), credit: result.credit + (Number.isFinite(credit) ? credit : 0) };
  }, { debit: 0, credit: 0 }), [lines]);
  const balancedForDisplay = Math.round(totals.debit * 100) === Math.round(totals.credit * 100);

  function changeLine(index: number, field: keyof JournalLine, value: string) {
    setLines((previous) => previous.map((line, current) => current === index ? { ...line, [field]: value } : line));
    setJournalIdempotencyKey(crypto.randomUUID());
  }
  function resetJournalForm() {
    setEntryDate(todayLocal()); setDescription(""); setCurrency(baseCurrency); setExchangeRate("1");
    setLines([emptyLine(), { ...emptyLine(), credit: "0.00" }]); setJournalIdempotencyKey(""); setShowJournalForm(false);
  }
  async function submitJournal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/finance/journals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryDate, description: description.trim(), currency, exchangeRate,
          idempotencyKey: journalIdempotencyKey || crypto.randomUUID(),
          lines: lines.map((line) => ({ ...line, memo: line.memo.trim() }))
        })
      });
      const result = await response.json();
      if (!response.ok) {
        const reasons: Record<string, string> = {
          UNBALANCED_JOURNAL: ar ? (result.message || "إجمالي المدين يجب أن يساوي إجمالي الدائن.") : (result.message || "Total debits must equal total credits."),
          ACCOUNT_NOT_FOUND: ar ? "يوجد حساب غير نشط أو غير تابع لهذه الشركة." : "A selected account is inactive or does not belong to this company.",
          BASE_CURRENCY_RATE_MUST_BE_ONE: ar ? "سعر صرف العملة الأساسية يجب أن يكون 1." : "The base currency exchange rate must be 1.",
          IDEMPOTENCY_KEY_REUSED: ar ? "مفتاح الطلب مستخدم لبيانات مختلفة؛ أعد المحاولة." : "The idempotency key was already used for different data."
        };
        throw new Error(reasons[result.error] || (ar ? "تعذر حفظ القيد المحاسبي." : "Could not post the journal entry."));
      }
      setSuccess(ar ? "تم ترحيل القيد المحاسبي بنجاح." : "Journal entry posted successfully.");
      resetJournalForm(); setPage(1); setRefreshKey((value) => value + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (ar ? "حدث خطأ غير متوقع." : "An unexpected error occurred."));
    } finally { setSaving(false); }
  }

  async function reverseJournal(entry: JournalEntry) {
    if (!canWrite || entry.isReversed) return;
    const confirmation = ar
      ? `سيتم إنشاء قيد عكسي جديد للقيد ${entry.reference}. القيد الأصلي لن يُحذف. هل تريد المتابعة؟`
      : `A new reversing entry will be posted for ${entry.reference}. The original will remain unchanged. Continue?`;
    if (!window.confirm(confirmation)) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const response = await fetch(`/api/finance/journals/${encodeURIComponent(entry.id)}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idempotencyKey: crypto.randomUUID() })
      });
      const result = await response.json();
      if (!response.ok) {
        if (result.error === "ALREADY_REVERSED") {
          throw new Error(ar ? "تم عكس هذا القيد بالفعل." : "This entry has already been reversed.");
        }
        throw new Error(ar ? "تعذر إنشاء القيد العكسي." : "Could not create the reversing entry.");
      }
      setSuccess(ar ? "تم ترحيل القيد العكسي مع الاحتفاظ بالقيد الأصلي." : "Reversing entry posted; the original entry was retained.");
      setRefreshKey((value) => value + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (ar ? "حدث خطأ غير متوقع." : "Unexpected error."));
    } finally { setSaving(false); }
  }

  async function submitAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/finance/accounts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accountForm)
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error === "ACCOUNT_CODE_EXISTS"
          ? (ar ? "كود الحساب مستخدم بالفعل." : "This account code already exists.")
          : (ar ? "تعذر إنشاء الحساب." : "Could not create account."));
      }
      setSuccess(ar ? "تم إنشاء الحساب." : "Account created.");
      setAccountForm({ code: "", name: "", nameEn: "", type: "EXPENSE" }); setShowAccountForm(false); setRefreshKey((value) => value + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (ar ? "حدث خطأ غير متوقع." : "Unexpected error."));
    } finally { setSaving(false); }
  }

  const money = (value: string, cur = baseCurrency) => new Intl.NumberFormat(ar ? "ar-EG" : "en-US", {
    style: "currency", currency: cur, maximumFractionDigits: 2, minimumFractionDigits: 2
  }).format(Number(value || 0));
  const accountName = (account: LedgerAccount) => ar ? account.name : account.nameEn;

  return <div className="customer-layout">
    {error && <div className="alert" role="alert">{error}</div>}
    {success && <div className="alert success" role="status">{success}</div>}

    <div className="stat-grid">
      <div className="stat-card"><div className="stat-top"><span className="stat-label">{ar ? "دليل الحسابات" : "Chart of accounts"}</span><span className="stat-icon"><BookOpen size={17} /></span></div><div className="stat-value">{accounts.length}</div><div className="stat-hint">{ar ? "حسابات الشركة النشطة" : "Active company accounts"}</div></div>
      <div className="stat-card"><div className="stat-top"><span className="stat-label">{ar ? "القيود المرحلة" : "Posted journals"}</span><span className="stat-icon"><WalletCards size={17} /></span></div><div className="stat-value">{totalEntries}</div><div className="stat-hint">{ar ? "سجل القيود المزدوجة" : "Double-entry journal records"}</div></div>
      <div className="stat-card"><div className="stat-top"><span className="stat-label">{ar ? "العملة الأساسية" : "Base currency"}</span><span className="stat-icon"><RefreshCw size={17} /></span></div><div className="stat-value" style={{ fontSize: 27 }}>{baseCurrency}</div><div className="stat-hint">{ar ? "محددة في إعداد الشركة" : "Defined in workspace settings"}</div></div>
    </div>

    <section className="panel">
      <div className="panel-header finance-panel-header">
        <div><h2 className="panel-title">{ar ? "دليل الحسابات" : "Chart of accounts"}</h2><div className="panel-subtitle">{ar ? "الحسابات الافتراضية قابلة للتوسعة بحسابات خاصة بالشركة." : "Default accounts plus company-specific accounts."}</div></div>
        {canWrite && <button className="btn btn-primary" type="button" onClick={() => { setShowAccountForm((value) => !value); setShowJournalForm(false); }}><Plus size={15} />{ar ? "حساب جديد" : "New account"}</button>}
      </div>
      {showAccountForm && canWrite && <form className="panel-body auth-form" onSubmit={submitAccount}>
        <div className="form-grid">
          <label className="field"><span className="field-label">{ar ? "كود الحساب" : "Account code"}</span><input className="input" value={accountForm.code} onChange={(event) => setAccountForm({ ...accountForm, code: event.target.value })} required maxLength={20} pattern="[A-Za-z0-9._-]+" /></label>
          <label className="field"><span className="field-label">{ar ? "تصنيف الحساب" : "Account type"}</span><select className="select" value={accountForm.type} onChange={(event) => setAccountForm({ ...accountForm, type: event.target.value as AccountType })}>{types.map((item) => <option key={item.value} value={item.value}>{item[locale]}</option>)}</select></label>
          <label className="field"><span className="field-label">{ar ? "اسم الحساب بالعربية" : "Arabic account name"}</span><input className="input" dir="auto" value={accountForm.name} onChange={(event) => setAccountForm({ ...accountForm, name: event.target.value })} required maxLength={120} /></label>
          <label className="field"><span className="field-label">{ar ? "اسم الحساب بالإنجليزية" : "English account name"}</span><input className="input" dir="auto" value={accountForm.nameEn} onChange={(event) => setAccountForm({ ...accountForm, nameEn: event.target.value })} required maxLength={120} /></label>
        </div>
        <div className="form-footer"><button className="btn btn-secondary" type="button" onClick={() => setShowAccountForm(false)}>{ar ? "إلغاء" : "Cancel"}</button><button className="btn btn-primary" type="submit" disabled={saving}><Save size={15} />{ar ? "حفظ الحساب" : "Save account"}</button></div>
      </form>}
      <div className="table-wrap"><table className="data-table">
        <thead><tr><th>{ar ? "الكود" : "Code"}</th><th>{ar ? "الحساب" : "Account"}</th><th>{ar ? "النوع" : "Type"}</th><th>{ar ? "المصدر" : "Source"}</th></tr></thead>
        <tbody>{accounts.map((account) => <tr key={account.id}><td dir="ltr">{account.code}</td><td><div className="customer-primary">{accountName(account)}</div><div className="customer-secondary">{ar ? account.nameEn : account.name}</div></td><td><span className="type-pill">{accountTypeLabel(account.type, locale)}</span></td><td>{account.isSystem ? (ar ? "افتراضي" : "Default") : (ar ? "مخصص" : "Custom")}</td></tr>)}</tbody>
      </table></div>
      {!loading && accounts.length === 0 && <div className="empty-state">{ar ? "لا توجد حسابات." : "No accounts yet."}</div>}
      {loading && <div className="empty-state">{ar ? "جارٍ التحميل..." : "Loading..."}</div>}
    </section>

    <section className="panel">
      <div className="panel-header finance-panel-header">
        <div><h2 className="panel-title">{ar ? "ميزان المراجعة" : "Trial balance"}</h2><div className="panel-subtitle">{ar ? "إجماليات الحسابات بالعملة الأساسية من القيود المرحلة فقط." : "Account totals in base currency from posted journals only."}</div></div>
        {trialBalance && <span className={"type-pill " + (trialBalance.summary.balanced ? "trial-balanced" : "trial-unbalanced")}>{trialBalance.summary.balanced ? (ar ? "متوازن" : "Balanced") : (ar ? "غير متوازن" : "Out of balance")}</span>}
      </div>
      <div className="trial-summary">
        <div><span>{ar ? "إجمالي المدين" : "Total debits"}</span><strong>{money(trialBalance?.summary.totalDebit ?? "0", baseCurrency)}</strong></div>
        <div><span>{ar ? "إجمالي الدائن" : "Total credits"}</span><strong>{money(trialBalance?.summary.totalCredit ?? "0", baseCurrency)}</strong></div>
      </div>
      <div className="table-wrap"><table className="data-table trial-balance-table">
        <thead><tr><th>{ar ? "الكود" : "Code"}</th><th>{ar ? "الحساب" : "Account"}</th><th>{ar ? "مدين" : "Debit"}</th><th>{ar ? "دائن" : "Credit"}</th><th>{ar ? "الرصيد الطبيعي" : "Normal balance"}</th></tr></thead>
        <tbody>{trialBalance?.items.map((row) => <tr key={row.id}>
          <td dir="ltr">{row.code}</td>
          <td><div className="customer-primary">{ar ? row.name : row.nameEn}</div><div className="customer-secondary">{accountTypeLabel(row.type, locale)}{!row.isActive ? " · " + (ar ? "غير نشط" : "Inactive") : ""}</div></td>
          <td className="numeric-cell" dir="ltr">{money(row.totalDebit, baseCurrency)}</td>
          <td className="numeric-cell" dir="ltr">{money(row.totalCredit, baseCurrency)}</td>
          <td className="numeric-cell" dir="ltr">{row.balanceSide === "ZERO" ? "—" : (row.balanceSide === "DEBIT" ? (ar ? "مدين " : "Dr ") : (ar ? "دائن " : "Cr ")) + money(row.balanceAmount, baseCurrency)}</td>
        </tr>)}</tbody>
      </table></div>
      {loading && <div className="empty-state">{ar ? "جارٍ حساب ميزان المراجعة..." : "Calculating trial balance..."}</div>}
      {!loading && trialBalance?.items.length === 0 && <div className="empty-state">{ar ? "لا توجد حسابات." : "No accounts found."}</div>}
    </section>

    <section className="panel">
      <div className="panel-header finance-panel-header">
        <div><h2 className="panel-title">{ar ? "دفتر اليومية" : "Journal entries"}</h2><div className="panel-subtitle">{ar ? "القيود المرحلة غير قابلة للحذف المباشر؛ التصحيح يكون بقيد عكسي." : "Posted entries cannot be deleted; corrections should use reversing entries."}</div></div>
        {canWrite && <button className="btn btn-primary" type="button" onClick={() => {
          const opening = !showJournalForm;
          setShowJournalForm(opening); setShowAccountForm(false); setError("");
          if (opening) setJournalIdempotencyKey(crypto.randomUUID());
        }}><Plus size={15} />{ar ? "قيد جديد" : "New journal"}</button>}
      </div>
      {showJournalForm && canWrite && <form className="panel-body auth-form" onSubmit={submitJournal}>
        <div className="form-grid">
          <label className="field"><span className="field-label">{ar ? "تاريخ القيد" : "Entry date"}</span><input className="input" type="date" value={entryDate} onChange={(event) => { setEntryDate(event.target.value); setJournalIdempotencyKey(crypto.randomUUID()); }} required /></label>
          <label className="field"><span className="field-label">{ar ? "عملة القيد" : "Entry currency"}</span><select className="select" value={currency} onChange={(event) => { setCurrency(event.target.value); if (event.target.value === baseCurrency) setExchangeRate("1"); setJournalIdempotencyKey(crypto.randomUUID()); }}><option value={baseCurrency}>{baseCurrency} ({ar ? "العملة الأساسية" : "base"})</option>{["EGP", "SAR", "USD"].filter((item) => item !== baseCurrency).map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label className="field"><span className="field-label">{ar ? "سعر الصرف إلى العملة الأساسية" : "Rate to base currency"}</span><input className="input" inputMode="decimal" type="number" min="0.00000001" max="9999999999.99999999" step="0.00000001" value={exchangeRate} onChange={(event) => { setExchangeRate(event.target.value); setJournalIdempotencyKey(crypto.randomUUID()); }} disabled={currency === baseCurrency} required /><span className="customer-secondary">{ar ? "قيمة عملة الشركة الأساسية لكل وحدة من عملة القيد." : "Base-currency units for one unit of the journal currency."}</span></label>
          <label className="field span-2"><span className="field-label">{ar ? "البيان" : "Description"}</span><input className="input" value={description} onChange={(event) => { setDescription(event.target.value); setJournalIdempotencyKey(crypto.randomUUID()); }} required minLength={3} maxLength={500} /></label>
        </div>

        <div className="journal-lines-heading"><h3>{ar ? "تفاصيل القيد" : "Journal lines"}</h3><button className="btn btn-secondary" type="button" onClick={() => { setLines((value) => [...value, emptyLine()]); setJournalIdempotencyKey(crypto.randomUUID()); }} disabled={lines.length >= 100}><Plus size={14} />{ar ? "إضافة سطر" : "Add line"}</button></div>
        <div className="journal-lines">
          {lines.map((line, index) => <div className="journal-line" key={index}>
            <label className="field account-field"><span className="field-label">{ar ? "الحساب" : "Account"}</span><select className="select" value={line.accountId} onChange={(event) => changeLine(index, "accountId", event.target.value)} required><option value="">{ar ? "اختر الحساب" : "Select account"}</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.code} — {accountName(account)}</option>)}</select></label>
            <label className="field"><span className="field-label">{ar ? "مدين" : "Debit"}</span><input className="input money-field" type="number" min="0" step="0.01" value={line.debit} onChange={(event) => { changeLine(index, "debit", event.target.value); if (Number(event.target.value) > 0) changeLine(index, "credit", "0"); }} required /></label>
            <label className="field"><span className="field-label">{ar ? "دائن" : "Credit"}</span><input className="input money-field" type="number" min="0" step="0.01" value={line.credit} onChange={(event) => { changeLine(index, "credit", event.target.value); if (Number(event.target.value) > 0) changeLine(index, "debit", "0"); }} required /></label>
            <label className="field memo-field"><span className="field-label">{ar ? "بيان السطر" : "Line memo"}</span><input className="input" value={line.memo} maxLength={200} onChange={(event) => changeLine(index, "memo", event.target.value)} /></label>
            <button className="icon-button remove-line" type="button" onClick={() => { setLines((value) => value.filter((_, row) => row !== index)); setJournalIdempotencyKey(crypto.randomUUID()); }} disabled={lines.length <= 2} aria-label={ar ? "حذف السطر" : "Remove line"}><X size={15} /></button>
          </div>)}
        </div>

        <div className={"journal-balance " + (balancedForDisplay ? "is-balanced" : "is-unbalanced")}>
          <span>{ar ? "إجمالي المدين" : "Total debit"}: <strong>{money(totals.debit.toFixed(2), currency)}</strong></span>
          <span>{ar ? "إجمالي الدائن" : "Total credit"}: <strong>{money(totals.credit.toFixed(2), currency)}</strong></span>
          <span className="balance-status">{balancedForDisplay ? (ar ? "متوازن مبدئيًا" : "Looks balanced") : (ar ? "غير متوازن" : "Out of balance")}</span>
        </div>
        <div className="form-footer"><button className="btn btn-secondary" type="button" onClick={resetJournalForm}>{ar ? "إلغاء" : "Cancel"}</button><button className="btn btn-primary" type="submit" disabled={saving || accounts.length === 0 || !balancedForDisplay}><Check size={15} />{saving ? (ar ? "جارٍ الترحيل..." : "Posting...") : (ar ? "ترحيل القيد" : "Post journal")}</button></div>
      </form>}

      <div className="table-wrap"><table className="data-table">
        <thead><tr><th>{ar ? "رقم القيد" : "Reference"}</th><th>{ar ? "التاريخ" : "Date"}</th><th>{ar ? "البيان" : "Description"}</th><th>{ar ? "العملة" : "Currency"}</th><th>{ar ? "السطور" : "Lines"}</th><th>{ar ? "الحالة / إجراء" : "Status / action"}</th></tr></thead>
        <tbody>{entries.map((entry) => <tr key={entry.id}><td dir="ltr"><div className="customer-primary">{entry.reference}</div></td><td>{new Intl.DateTimeFormat(ar ? "ar-EG" : "en-US", { dateStyle: "medium" }).format(new Date(entry.entryDate))}</td><td><div className="customer-primary">{entry.description}</div><div className="customer-secondary">{entry.lines.map((line) => line.account.code).join(" · ")}</div></td><td dir="ltr">{entry.currency}</td><td>{entry.lines.length}</td><td><div className="row-actions">{entry.sourceType === "REVERSAL" && <span className="type-pill">{ar ? "قيد عكسي" : "Reversal"}</span>}{entry.isReversed ? <span className="type-pill">{ar ? "تم عكسه" : "Reversed"}</span> : (entry.sourceType === "INVOICE" || entry.sourceType === "CUSTOMER_PAYMENT") ? <span className="customer-secondary">{ar ? "من المستند" : "Document-linked"}</span> : canWrite && <button className="small-btn danger" type="button" disabled={saving} onClick={() => void reverseJournal(entry)}>{ar ? "عكس القيد" : "Reverse"}</button>}</div></td></tr>)}</tbody>
      </table></div>
      {!loading && entries.length === 0 && <div className="empty-state">{ar ? "لم يتم ترحيل أي قيود بعد." : "No journal entries have been posted yet."}</div>}
      <div className="finance-pagination"><span className="customer-secondary">{ar ? `صفحة ${page} من ${pages} · ${totalEntries} قيدًا` : `Page ${page} of ${pages} · ${totalEntries} entries`}</span><div className="finance-pagination-buttons"><button className="small-btn" type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>{ar ? "السابق" : "Previous"}</button><button className="small-btn" type="button" disabled={page >= pages || loading} onClick={() => setPage((value) => value + 1)}>{ar ? "التالي" : "Next"}</button></div></div>
    </section>
  </div>;
}
