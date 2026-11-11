"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, FilePlus2, Plus, RefreshCw, X } from "lucide-react";
import type { Locale } from "@/lib/messages";

type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
type Account = { id: string; code: string; name: string; nameEn: string; type: AccountType; isActive: boolean };
type Supplier = { id: string; name: string; category: string };
type Reservation = { id: string; reference: string; supplierId: string | null; status: string; currency: string };
type Branch = { id: string; name: string; slug: string; isActive: boolean };
type BillStatus = "ISSUED" | "PARTIALLY_PAID" | "PAID" | "VOID";
type BillLine = { id: string; description: string; quantity: string; unitPrice: string; amount: string; expenseAccount: { id: string; code: string; name: string; nameEn: string } };
type BillPayment = {
  id: string; paymentNumber: string; paymentDate: string; method: string; amount: string; currency: string;
  reference: string | null; notes: string | null; account: { id: string; code: string; name: string; nameEn: string };
  journalReference: string;
};
type SupplierBill = {
  id: string; reference: string; supplierReference: string | null; billDate: string; dueDate: string | null;
  status: BillStatus; currency: string; exchangeRate: string; subtotal: string; taxAmount: string;
  total: string; paidAmount: string; outstandingAmount: string; notes: string | null;
  supplier: { id: string; name: string; email: string | null; phone: string | null };
  reservation: { id: string; reference: string } | null;
  journalEntry: { id: string; reference: string };
  lines: BillLine[]; payments: BillPayment[];
};
type BillLineDraft = { description: string; quantity: string; unitPrice: string; expenseAccountId: string };
type BillDraft = {
  supplierId: string; reservationId: string; branchId: string; billDate: string; dueDate: string;
  supplierReference: string; currency: string; exchangeRate: string; taxAmount: string; notes: string;
};
type PaymentDraft = {
  supplierBillId: string; paymentDate: string; amount: string; accountId: string;
  method: string; reference: string; notes: string;
};

const paymentMethods: { value: string; ar: string; en: string }[] = [
  { value: "CASH", ar: "نقدي", en: "Cash" },
  { value: "BANK_TRANSFER", ar: "تحويل بنكي", en: "Bank transfer" },
  { value: "CARD", ar: "بطاقة", en: "Card" },
  { value: "ELECTRONIC_WALLET", ar: "محفظة إلكترونية", en: "E-wallet" },
  { value: "THNDR", ar: "ثاندر", en: "Thndr" },
  { value: "OTHER", ar: "أخرى", en: "Other" }
];

const todayLocal = () => {
  const date = new Date();
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
};
const emptyLine = (expenseAccountId = ""): BillLineDraft => ({ description: "", quantity: "1.00", unitPrice: "0.00", expenseAccountId });

export function SupplierBillingClient({ locale, canWrite }: { locale: Locale; canWrite: boolean }) {
  const ar = locale === "ar";
  const [bills, setBills] = useState<SupplierBill[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [baseCurrency, setBaseCurrency] = useState("EGP");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [showBillForm, setShowBillForm] = useState(false);
  const [billKey, setBillKey] = useState("");
  const [billDraft, setBillDraft] = useState<BillDraft>({
    supplierId: "", reservationId: "", branchId: "", billDate: todayLocal(), dueDate: "",
    supplierReference: "", currency: "EGP", exchangeRate: "1", taxAmount: "0.00", notes: ""
  });
  const [billLines, setBillLines] = useState<BillLineDraft[]>([emptyLine()]);
  const [paymentBillId, setPaymentBillId] = useState("");
  const [paymentKey, setPaymentKey] = useState("");
  const [paymentDraft, setPaymentDraft] = useState<PaymentDraft>({
    supplierBillId: "", paymentDate: todayLocal(), amount: "0.00", accountId: "",
    method: "CASH", reference: "", notes: ""
  });

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const responses = await Promise.all([
          fetch("/api/finance/supplier-bills?page=1&pageSize=100", { cache: "no-store" }),
          fetch("/api/finance/accounts", { cache: "no-store" }),
          fetch("/api/suppliers?page=1&pageSize=100", { cache: "no-store" }),
          fetch("/api/reservations?page=1&pageSize=100", { cache: "no-store" }),
          fetch("/api/branches", { cache: "no-store" })
        ]);
        const results = await Promise.all(responses.map((response) => response.json()));
        const failed = responses.findIndex((response) => !response.ok);
        if (failed !== -1) throw new Error("SUPPLIER_BILL_LOAD_FAILED");
        if (active) {
          const currency = results[0].baseCurrency || results[1].baseCurrency || "EGP";
          setBaseCurrency(currency);
          setBills(results[0].items as SupplierBill[]);
          setAccounts(results[1].items as Account[]);
          setSuppliers(results[2].items as Supplier[]);
          setReservations(results[3].items as Reservation[]);
          setBranches((results[4].items as Branch[]).filter((branch) => branch.isActive));
          setBillDraft((previous) => ({
            ...previous,
            currency: previous.currency === "EGP" ? currency : previous.currency,
            branchId: previous.branchId || (results[4].items as Branch[]).find((branch) => branch.isActive)?.id || ""
          }));
          setBillLines((previous) => previous.map((line, index) => index === 0 && !line.expenseAccountId
            ? { ...line, expenseAccountId: (results[1].items as Account[]).find((account) => account.type === "EXPENSE")?.id || "" }
            : line));
          setPaymentDraft((previous) => previous.accountId ? previous : {
            ...previous,
            accountId: (results[1].items as Account[]).find((account) => account.type === "ASSET" && account.code === "1000")?.id
              || (results[1].items as Account[]).find((account) => account.type === "ASSET")?.id || ""
          });
        }
      } catch {
        if (active) setError(ar
          ? "تعذر تحميل فواتير الموردين أو الحسابات أو الموردين. تأكد من صلاحياتك وحاول التحديث."
          : "Could not load supplier bills, accounts or suppliers. Check your access and try refreshing.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [refreshKey, ar]);

  const expenseAccounts = useMemo(() => accounts.filter((account) => account.type === "EXPENSE" && account.isActive), [accounts]);
  const assetAccounts = useMemo(() => accounts.filter((account) => account.type === "ASSET" && account.isActive), [accounts]);
  const availableReservations = useMemo(
    () => reservations.filter((reservation) => !billDraft.supplierId || !reservation.supplierId || reservation.supplierId === billDraft.supplierId),
    [reservations, billDraft.supplierId]
  );
  const openBills = useMemo(() => bills.filter((bill) => bill.status === "ISSUED" || bill.status === "PARTIALLY_PAID"), [bills]);
  const overdueBills = useMemo(() => openBills.filter((bill) => bill.dueDate && bill.dueDate.slice(0, 10) < todayLocal()), [openBills]);

  function formatMoney(value: string | number, currency = baseCurrency) {
    const number = Number(value || 0);
    const formatted = new Intl.NumberFormat(ar ? "ar-EG" : "en-US", {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    }).format(Number.isFinite(number) ? number : 0);
    return formatted + " " + currency;
  }
  function dateLabel(value: string) {
    return new Intl.DateTimeFormat(ar ? "ar-EG" : "en-US", { dateStyle: "medium" }).format(new Date(value));
  }
  function statusLabel(status: BillStatus) {
    const labels: Record<BillStatus, { ar: string; en: string }> = {
      ISSUED: { ar: "مستحقة", en: "Issued" },
      PARTIALLY_PAID: { ar: "مدفوعة جزئيًا", en: "Partially paid" },
      PAID: { ar: "مدفوعة", en: "Paid" },
      VOID: { ar: "ملغاة", en: "Void" }
    };
    return labels[status][locale];
  }
  function methodLabel(value: string) {
    return paymentMethods.find((item) => item.value === value)?.[locale] || value;
  }
  function openNewBill() {
    setError("");
    setSuccess("");
    setBillDraft({
      supplierId: "", reservationId: "", branchId: branches[0]?.id || "", billDate: todayLocal(), dueDate: "",
      supplierReference: "", currency: baseCurrency, exchangeRate: "1", taxAmount: "0.00", notes: ""
    });
    setBillLines([emptyLine(expenseAccounts[0]?.id || "")]);
    setBillKey(crypto.randomUUID());
    setShowBillForm(true);
    setPaymentBillId("");
  }
  function updateBillDraft<K extends keyof BillDraft>(field: K, value: BillDraft[K]) {
    setBillDraft((previous) => ({ ...previous, [field]: value }));
    setBillKey(crypto.randomUUID());
  }
  function updateBillLine(index: number, field: keyof BillLineDraft, value: string) {
    setBillLines((previous) => previous.map((line, current) => current === index ? { ...line, [field]: value } : line));
    setBillKey(crypto.randomUUID());
  }
  function addBillLine() {
    setBillLines((previous) => [...previous, emptyLine(expenseAccounts[0]?.id || "")]);
    setBillKey(crypto.randomUUID());
  }
  function removeBillLine(index: number) {
    setBillLines((previous) => previous.filter((_, current) => current !== index));
    setBillKey(crypto.randomUUID());
  }

  async function submitBill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/finance/supplier-bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...billDraft,
          branchId: billDraft.reservationId ? undefined : billDraft.branchId,
          idempotencyKey: billKey || crypto.randomUUID(),
          lines: billLines.map((line) => ({
            description: line.description.trim(), quantity: line.quantity,
            unitPrice: line.unitPrice, expenseAccountId: line.expenseAccountId
          }))
        })
      });
      const result = await response.json();
      if (!response.ok) {
        const messages: Record<string, string> = {
          SUPPLIER_NOT_FOUND: ar ? "المورد غير موجود أو مؤرشف." : "Supplier not found or archived.",
          RESERVATION_NOT_FOUND: ar ? "الحجز غير مرتبط بالمورد المختار أو غير متاح." : "The reservation is not linked to the selected supplier or is unavailable.",
          BRANCH_NOT_ASSIGNED: ar ? "ليس لديك صلاحية على الفرع المختار." : "You are not assigned to the selected branch.",
          BASE_CURRENCY_RATE_MUST_BE_ONE: ar ? "سعر صرف العملة الأساسية يجب أن يساوي 1." : "The base currency exchange rate must be 1.",
          PAYABLE_ACCOUNT_MISSING: ar ? "حساب الموردين 2000 غير موجود أو غير نشط." : "Accounts payable account 2000 is missing or inactive.",
          EXPENSE_ACCOUNT_INVALID: ar ? "اختر حساب مصروف نشطًا تابعًا للشركة." : "Choose an active expense account belonging to this company.",
          INPUT_VAT_ACCOUNT_MISSING: ar ? "حساب ضريبة المدخلات 1300 غير موجود." : "Input VAT account 1300 is missing.",
          IDEMPOTENCY_KEY_REUSED: ar ? "مفتاح الفاتورة مستخدم لبيانات مختلفة." : "This idempotency key was used for different bill data."
        };
        throw new Error(messages[result.error] || result.message || (ar ? "تعذر تسجيل فاتورة المورد." : "Could not post the supplier bill."));
      }
      setSuccess(ar ? "تم تسجيل فاتورة المورد وترحيل قيد المصروفات والمستحقات." : "Supplier bill posted with its expense and payable journal.");
      setShowBillForm(false);
      setBillKey("");
      setRefreshKey((value) => value + 1);
      window.dispatchEvent(new Event("nht:finance-refresh"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (ar ? "حدث خطأ غير متوقع." : "An unexpected error occurred."));
    } finally { setSaving(false); }
  }

  function openPayment(bill: SupplierBill) {
    const defaultAccount = assetAccounts.find((account) => account.code === "1000") || assetAccounts[0];
    setPaymentDraft({
      supplierBillId: bill.id, paymentDate: todayLocal(), amount: bill.outstandingAmount,
      accountId: defaultAccount?.id || "", method: "CASH", reference: "", notes: ""
    });
    setPaymentKey(crypto.randomUUID());
    setPaymentBillId(bill.id);
    setShowBillForm(false);
    setError(""); setSuccess("");
  }
  function updatePaymentDraft<K extends keyof PaymentDraft>(field: K, value: PaymentDraft[K]) {
    setPaymentDraft((previous) => ({ ...previous, [field]: value }));
    setPaymentKey(crypto.randomUUID());
  }
  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/finance/supplier-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...paymentDraft, idempotencyKey: paymentKey || crypto.randomUUID() })
      });
      const result = await response.json();
      if (!response.ok) {
        const messages: Record<string, string> = {
          SUPPLIER_BILL_NOT_FOUND: ar ? "فاتورة المورد غير موجودة." : "Supplier bill not found.",
          SUPPLIER_BILL_VOID: ar ? "لا يمكن دفع فاتورة ملغاة." : "A void supplier bill cannot be paid.",
          SUPPLIER_BILL_ALREADY_PAID: ar ? "الفاتورة مدفوعة بالكامل بالفعل." : "This supplier bill is already fully paid.",
          PAYMENT_EXCEEDS_BALANCE: ar ? "المبلغ أكبر من المستحق. المتبقي " + (result.outstanding || "") : "Payment exceeds the outstanding amount: " + (result.outstanding || ""),
          PAYMENT_ACCOUNT_INVALID: ar ? "اختر حساب نقدية أو بنك نشطًا." : "Choose an active cash or bank asset account.",
          PAYABLE_ACCOUNT_MISSING: ar ? "حساب الموردين 2000 غير موجود أو غير نشط." : "Accounts payable account 2000 is missing or inactive.",
          IDEMPOTENCY_KEY_REUSED: ar ? "مفتاح السداد مستخدم لبيانات مختلفة." : "This idempotency key was used for different payment data."
        };
        throw new Error(messages[result.error] || result.message || (ar ? "تعذر تسجيل دفعة المورد." : "Could not post the supplier payment."));
      }
      setSuccess(ar ? "تم تسجيل دفعة المورد وترحيل قيد السداد." : "Supplier payment posted and journal recorded.");
      setPaymentBillId("");
      setPaymentKey("");
      setRefreshKey((value) => value + 1);
      window.dispatchEvent(new Event("nht:finance-refresh"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (ar ? "حدث خطأ غير متوقع." : "An unexpected error occurred."));
    } finally { setSaving(false); }
  }

  return (
    <div className="customer-layout supplier-billing">
      {error && <div className="alert" role="alert">{error}</div>}
      {success && <div className="alert success" role="status">{success}</div>}

      <div className="stat-grid supplier-bill-stats">
        <div className="stat-card">
          <div className="stat-top"><span className="stat-label">{ar ? "فواتير الموردين" : "Supplier bills"}</span><span className="stat-icon"><FilePlus2 size={17} /></span></div>
          <div className="stat-value">{bills.length}</div>
          <div className="stat-hint">{ar ? "الفواتير المسجلة للشركة" : "Bills recorded for this company"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-top"><span className="stat-label">{ar ? "مستحقات مفتوحة" : "Open payables"}</span><span className="stat-icon"><RefreshCw size={17} /></span></div>
          <div className="stat-value">{openBills.length}</div>
          <div className="stat-hint">{ar ? "تحتاج إلى سداد كلي أو جزئي" : "Awaiting full or partial payment"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-top"><span className="stat-label">{ar ? "متأخرة" : "Overdue"}</span><span className="stat-icon"><FilePlus2 size={17} /></span></div>
          <div className="stat-value">{overdueBills.length}</div>
          <div className="stat-hint">{ar ? "تجاوزت تاريخ الاستحقاق" : "Past their due date"}</div>
        </div>
      </div>

      <section className="panel">
        <div className="panel-header finance-panel-header">
          <div>
            <h2 className="panel-title">{ar ? "فواتير الموردين والمدفوعات" : "Supplier bills & payments"}</h2>
            <div className="panel-subtitle">{ar ? "اربط تكلفة الخدمة بالمورد والحجز، ثم سجّل السداد الجزئي أو الكامل مع قيد محاسبي تلقائي." : "Link service costs to suppliers and bookings, then post partial or full payments with an automatic journal."}</div>
          </div>
          <div className="row-actions">
            <button className="icon-button" type="button" onClick={() => setRefreshKey((value) => value + 1)} aria-label={ar ? "تحديث" : "Refresh"}><RefreshCw size={15} /></button>
            {canWrite && <button className="btn btn-primary" type="button" onClick={openNewBill}><Plus size={15} />{ar ? "فاتورة مورد جديدة" : "New supplier bill"}</button>}
          </div>
        </div>

        {showBillForm && canWrite && (
          <form className="panel-body auth-form billing-form" onSubmit={submitBill}>
            <div className="billing-section-title">
              <h3>{ar ? "بيانات فاتورة المورد" : "Supplier bill details"}</h3>
              <button className="icon-button" type="button" aria-label={ar ? "إغلاق" : "Close"} onClick={() => setShowBillForm(false)}><X size={16} /></button>
            </div>
            <div className="form-grid">
              <label className="field">
                <span className="field-label">{ar ? "المورد" : "Supplier"}</span>
                <select className="select" value={billDraft.supplierId} onChange={(event) => { updateBillDraft("supplierId", event.target.value); setBillDraft((previous) => ({ ...previous, supplierId: event.target.value, reservationId: "" })); }} required>
                  <option value="">{ar ? "اختر المورد" : "Select supplier"}</option>
                  {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                </select>
              </label>
              <label className="field">
                <span className="field-label">{ar ? "ربط بالحجز (اختياري)" : "Link reservation (optional)"}</span>
                <select className="select" value={billDraft.reservationId} onChange={(event) => updateBillDraft("reservationId", event.target.value)} disabled={!billDraft.supplierId}>
                  <option value="">{ar ? "بدون حجز" : "No reservation"}</option>
                  {availableReservations.map((reservation) => <option key={reservation.id} value={reservation.id}>{reservation.reference} · {reservation.status}</option>)}
                </select>
              </label>
              <label className="field">
                <span className="field-label">{ar ? "الفرع" : "Branch"}</span>
                <select className="select" value={billDraft.branchId} onChange={(event) => updateBillDraft("branchId", event.target.value)} disabled={!!billDraft.reservationId || branches.length === 0} required={!billDraft.reservationId}>
                  <option value="">{ar ? "اختر الفرع" : "Select branch"}</option>
                  {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </select>
                {billDraft.reservationId && <span className="customer-secondary">{ar ? "سيتم استخدام فرع الحجز تلقائيًا." : "The reservation's branch will be used automatically."}</span>}
              </label>
              <label className="field">
                <span className="field-label">{ar ? "رقم فاتورة المورد" : "Supplier invoice reference"}</span>
                <input className="input" value={billDraft.supplierReference} onChange={(event) => updateBillDraft("supplierReference", event.target.value)} maxLength={120} />
              </label>
              <label className="field">
                <span className="field-label">{ar ? "تاريخ الفاتورة" : "Bill date"}</span>
                <input className="input" type="date" value={billDraft.billDate} onChange={(event) => updateBillDraft("billDate", event.target.value)} required />
              </label>
              <label className="field">
                <span className="field-label">{ar ? "تاريخ الاستحقاق" : "Due date"}</span>
                <input className="input" type="date" min={billDraft.billDate} value={billDraft.dueDate} onChange={(event) => updateBillDraft("dueDate", event.target.value)} />
              </label>
              <label className="field">
                <span className="field-label">{ar ? "العملة" : "Currency"}</span>
                <select className="select" value={billDraft.currency} onChange={(event) => { updateBillDraft("currency", event.target.value); if (event.target.value === baseCurrency) setBillDraft((previous) => ({ ...previous, currency: event.target.value, exchangeRate: "1" })); }}>
                  <option value={baseCurrency}>{baseCurrency} · {ar ? "عملة الأساس" : "Base currency"}</option>
                  {["EGP", "SAR", "USD"].filter((currency) => currency !== baseCurrency).map((currency) => <option key={currency} value={currency}>{currency}</option>)}
                </select>
              </label>
              <label className="field">
                <span className="field-label">{ar ? "سعر الصرف إلى عملة الأساس" : "Exchange rate to base"}</span>
                <input className="input" type="number" inputMode="decimal" min="0.00000001" step="0.00000001" value={billDraft.exchangeRate} onChange={(event) => updateBillDraft("exchangeRate", event.target.value)} disabled={billDraft.currency === baseCurrency} required />
              </label>
              <label className="field">
                <span className="field-label">{ar ? "ضريبة المدخلات (مبلغ)" : "Input VAT amount"}</span>
                <input className="input" type="number" min="0" step="0.01" value={billDraft.taxAmount} onChange={(event) => updateBillDraft("taxAmount", event.target.value)} required />
              </label>
              <label className="field span-2">
                <span className="field-label">{ar ? "ملاحظات" : "Notes"}</span>
                <input className="input" value={billDraft.notes} onChange={(event) => updateBillDraft("notes", event.target.value)} maxLength={2000} />
              </label>
            </div>

            <div className="journal-lines-heading">
              <h3>{ar ? "بنود التكلفة وحساب المصروف" : "Cost lines & expense accounts"}</h3>
              <button className="small-btn" type="button" onClick={addBillLine}><Plus size={13} />{ar ? "إضافة بند" : "Add line"}</button>
            </div>
            <div className="supplier-bill-lines">
              {billLines.map((line, index) => (
                <div className="supplier-bill-line" key={index}>
                  <label className="field">
                    <span className="field-label">{ar ? "وصف التكلفة" : "Cost description"}</span>
                    <input className="input" value={line.description} onChange={(event) => updateBillLine(index, "description", event.target.value)} minLength={2} maxLength={240} required />
                  </label>
                  <label className="field">
                    <span className="field-label">{ar ? "الكمية" : "Qty"}</span>
                    <input className="input" type="number" min="0" step="0.01" value={line.quantity} onChange={(event) => updateBillLine(index, "quantity", event.target.value)} required />
                  </label>
                  <label className="field">
                    <span className="field-label">{ar ? "سعر الوحدة" : "Unit price"}</span>
                    <input className="input" type="number" min="0" step="0.01" value={line.unitPrice} onChange={(event) => updateBillLine(index, "unitPrice", event.target.value)} required />
                  </label>
                  <label className="field">
                    <span className="field-label">{ar ? "حساب المصروف" : "Expense account"}</span>
                    <select className="select" value={line.expenseAccountId} onChange={(event) => updateBillLine(index, "expenseAccountId", event.target.value)} required>
                      <option value="">{ar ? "اختر الحساب" : "Select account"}</option>
                      {expenseAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {ar ? account.name : account.nameEn}</option>)}
                    </select>
                  </label>
                  <button className="icon-button remove-line" type="button" aria-label={ar ? "حذف البند" : "Remove line"} onClick={() => removeBillLine(index)} disabled={billLines.length === 1}><X size={15} /></button>
                </div>
              ))}
            </div>
            <div className="form-footer">
              <button className="btn btn-secondary" type="button" onClick={() => setShowBillForm(false)}>{ar ? "إلغاء" : "Cancel"}</button>
              <button className="btn btn-primary" type="submit" disabled={saving || !suppliers.length || !expenseAccounts.length || (!billDraft.reservationId && !billDraft.branchId)}>
                <Check size={15} />{saving ? (ar ? "جارٍ الترحيل..." : "Posting...") : (ar ? "حفظ الفاتورة وترحيل القيد" : "Save bill & post journal")}
              </button>
            </div>
            {branches.length === 0 && !billDraft.reservationId && <div className="customer-secondary">{ar ? "لا يوجد فرع متاح لإسناد الفاتورة إليه." : "No branch is available for this bill."}</div>}
          </form>
        )}

        {paymentBillId && canWrite && (
          <form className="panel-body auth-form billing-form" onSubmit={submitPayment}>
            <div className="billing-section-title">
              <h3>{ar ? "تسجيل دفعة للمورد" : "Record supplier payment"}</h3>
              <button className="icon-button" type="button" aria-label={ar ? "إغلاق" : "Close"} onClick={() => setPaymentBillId("")}><X size={16} /></button>
            </div>
            <div className="form-grid">
              <label className="field">
                <span className="field-label">{ar ? "تاريخ السداد" : "Payment date"}</span>
                <input className="input" type="date" value={paymentDraft.paymentDate} onChange={(event) => updatePaymentDraft("paymentDate", event.target.value)} required />
              </label>
              <label className="field">
                <span className="field-label">{ar ? "المبلغ" : "Amount"}</span>
                <input className="input" type="number" min="0.01" step="0.01" value={paymentDraft.amount} onChange={(event) => updatePaymentDraft("amount", event.target.value)} required />
              </label>
              <label className="field">
                <span className="field-label">{ar ? "حساب السداد" : "Payment account"}</span>
                <select className="select" value={paymentDraft.accountId} onChange={(event) => updatePaymentDraft("accountId", event.target.value)} required>
                  <option value="">{ar ? "اختر حساب النقدية أو البنك" : "Select cash or bank account"}</option>
                  {assetAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {ar ? account.name : account.nameEn}</option>)}
                </select>
              </label>
              <label className="field">
                <span className="field-label">{ar ? "طريقة السداد" : "Payment method"}</span>
                <select className="select" value={paymentDraft.method} onChange={(event) => updatePaymentDraft("method", event.target.value)}>
                  {paymentMethods.map((method) => <option key={method.value} value={method.value}>{method[locale]}</option>)}
                </select>
              </label>
              <label className="field span-2">
                <span className="field-label">{ar ? "مرجع التحويل / الإيصال" : "Transfer / receipt reference"}</span>
                <input className="input" value={paymentDraft.reference} onChange={(event) => updatePaymentDraft("reference", event.target.value)} maxLength={120} />
              </label>
              <label className="field span-2">
                <span className="field-label">{ar ? "ملاحظات" : "Notes"}</span>
                <input className="input" value={paymentDraft.notes} onChange={(event) => updatePaymentDraft("notes", event.target.value)} maxLength={1000} />
              </label>
            </div>
            <div className="form-footer">
              <button className="btn btn-secondary" type="button" onClick={() => setPaymentBillId("")}>{ar ? "إلغاء" : "Cancel"}</button>
              <button className="btn btn-primary" type="submit" disabled={saving || !assetAccounts.length}><Check size={15} />{saving ? (ar ? "جارٍ التسجيل..." : "Recording...") : (ar ? "تسجيل الدفعة والقيد" : "Record payment & journal")}</button>
            </div>
          </form>
        )}

        <div className="table-wrap">
          <table className="data-table billing-table supplier-billing-table">
            <thead>
              <tr>
                <th>{ar ? "المورد / الفاتورة" : "Supplier / bill"}</th>
                <th>{ar ? "التاريخ" : "Bill date"}</th>
                <th>{ar ? "الاستحقاق" : "Due date"}</th>
                <th>{ar ? "الإجمالي" : "Total"}</th>
                <th>{ar ? "المسدّد" : "Paid"}</th>
                <th>{ar ? "المتبقي" : "Outstanding"}</th>
                <th>{ar ? "الحالة" : "Status"}</th>
                <th>{ar ? "الإجراء" : "Action"}</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => (
                <tr key={bill.id}>
                  <td>
                    <div className="customer-primary">{bill.supplier.name}</div>
                    <div className="customer-secondary" dir="ltr">{bill.reference}</div>
                    {bill.supplierReference && <div className="customer-secondary" dir="ltr">{ar ? "مرجع المورد: " : "Supplier ref: "}{bill.supplierReference}</div>}
                    <details className="invoice-detail supplier-bill-detail">
                      <summary>{ar ? "تفاصيل التكلفة والمدفوعات" : "Cost & payment details"}</summary>
                      <div className="invoice-detail-content">
                        <strong>{ar ? "بنود التكلفة" : "Cost lines"}</strong>
                        {bill.lines.map((line) => (
                          <div className="invoice-detail-row" key={line.id}>
                            <span>{line.description} · {line.quantity} × {formatMoney(line.unitPrice, bill.currency)}</span>
                            <strong>{formatMoney(line.amount, bill.currency)}</strong>
                          </div>
                        ))}
                        <div className="invoice-detail-row"><span>{ar ? "ضريبة المدخلات" : "Input VAT"}</span><strong>{formatMoney(bill.taxAmount, bill.currency)}</strong></div>
                        <div className="invoice-detail-row"><span>{ar ? "سعر الصرف" : "Exchange rate"}</span><strong dir="ltr">{bill.exchangeRate}</strong></div>
                        <div className="invoice-detail-row"><span>{ar ? "الحجز المرتبط" : "Linked reservation"}</span><strong dir="ltr">{bill.reservation?.reference || "—"}</strong></div>
                        <div className="invoice-detail-row"><span>{ar ? "القيد المحاسبي" : "Journal entry"}</span><strong dir="ltr">{bill.journalEntry.reference}</strong></div>
                        <div className="invoice-payments-heading">{ar ? "مدفوعات المورد" : "Supplier payments"}</div>
                        {bill.payments.length ? bill.payments.map((payment) => (
                          <div className="invoice-payment-row" key={payment.id}>
                            <div>
                              <strong dir="ltr">{payment.paymentNumber}</strong>
                              <span>{dateLabel(payment.paymentDate)} · {methodLabel(payment.method)} · {ar ? payment.account.name : payment.account.nameEn}</span>
                              <span className="customer-secondary">{ar ? "القيد" : "Journal"}: {payment.journalReference}</span>
                            </div>
                            <strong>{formatMoney(payment.amount, payment.currency)}</strong>
                          </div>
                        )) : <div className="customer-secondary">{ar ? "لا توجد مدفوعات بعد." : "No payments yet."}</div>}
                      </div>
                    </details>
                  </td>
                  <td>{dateLabel(bill.billDate)}</td>
                  <td>{bill.dueDate ? dateLabel(bill.dueDate) : "—"}</td>
                  <td className="numeric-cell" dir="ltr">{formatMoney(bill.total, bill.currency)}</td>
                  <td className="numeric-cell" dir="ltr">{formatMoney(bill.paidAmount, bill.currency)}</td>
                  <td className="numeric-cell" dir="ltr"><strong>{formatMoney(bill.outstandingAmount, bill.currency)}</strong></td>
                  <td><span className={"type-pill invoice-status-" + bill.status.toLowerCase()}>{statusLabel(bill.status)}</span></td>
                  <td>{canWrite && bill.status !== "PAID" && bill.status !== "VOID"
                    ? <button className="small-btn" type="button" onClick={() => openPayment(bill)}>{ar ? "سداد" : "Pay"}</button>
                    : <span className="customer-secondary">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loading && <div className="empty-state">{ar ? "جارٍ تحميل فواتير الموردين..." : "Loading supplier bills..."}</div>}
        {!loading && bills.length === 0 && <div className="empty-state">{ar ? "لا توجد فواتير موردين حتى الآن." : "No supplier bills yet."}</div>}
      </section>
    </div>
  );
}
