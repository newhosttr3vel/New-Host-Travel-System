"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, ChevronDown, FilePlus2, Plus, Receipt, RefreshCw, Save, X } from "lucide-react";
import type { Locale } from "@/lib/messages";

type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
type Account = { id: string; code: string; name: string; nameEn: string; type: AccountType; isActive: boolean };
type Customer = { id: string; name: string; type: string; email: string | null; phone: string | null };
type Reservation = { id: string; reference: string; customerId: string; status: string; currency: string; saleAmount: string };
type InvoiceLine = { id: string; description: string; quantity: string; unitPrice: string; amount: string; revenueAccount: { id: string; code: string; name: string; nameEn: string } };
type Payment = { id: string; receiptNumber: string; paymentDate: string; method: string; amount: string; currency: string; reference: string | null; notes: string | null; account: { id: string; code: string; name: string; nameEn: string }; journalReference: string };
type Invoice = { id: string; reference: string; issueDate: string; dueDate: string | null; status: "ISSUED" | "PARTIALLY_PAID" | "PAID" | "VOID"; currency: string; exchangeRate: string; subtotal: string; taxAmount: string; total: string; paidAmount: string; outstandingAmount: string; notes: string | null; customer: { id: string; name: string }; reservation: { id: string; reference: string } | null; journalEntry: { id: string; reference: string }; lines: InvoiceLine[]; payments: Payment[] };
type InvoiceLineDraft = { description: string; quantity: string; unitPrice: string; revenueAccountId: string };
type InvoiceDraft = { customerId: string; reservationId: string; issueDate: string; dueDate: string; currency: string; exchangeRate: string; taxAmount: string; notes: string };
type PaymentDraft = { invoiceId: string; paymentDate: string; amount: string; accountId: string; method: string; reference: string; notes: string };

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
const emptyInvoiceLine = (revenueAccountId = ""): InvoiceLineDraft => ({ description: "", quantity: "1.00", unitPrice: "0.00", revenueAccountId });
const newInvoiceDraft = (currency: string): InvoiceDraft => ({
  customerId: "", reservationId: "", issueDate: todayLocal(), dueDate: "",
  currency, exchangeRate: "1", taxAmount: "0.00", notes: ""
});

export function BillingClient({ locale, canWrite }: { locale: Locale; canWrite: boolean }) {
  const ar = locale === "ar";
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [baseCurrency, setBaseCurrency] = useState("EGP");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [invoiceDraft, setInvoiceDraft] = useState<InvoiceDraft>(newInvoiceDraft("EGP"));
  const [invoiceLines, setInvoiceLines] = useState<InvoiceLineDraft[]>([emptyInvoiceLine()]);
  const [invoiceKey, setInvoiceKey] = useState("");
  const [paymentInvoiceId, setPaymentInvoiceId] = useState("");
  const [paymentDraft, setPaymentDraft] = useState<PaymentDraft>({
    invoiceId: "", paymentDate: todayLocal(), amount: "0.00", accountId: "", method: "CASH", reference: "", notes: ""
  });
  const [paymentKey, setPaymentKey] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [invoiceResponse, accountResponse, customerResponse, reservationResponse] = await Promise.all([
          fetch("/api/finance/invoices?page=1&pageSize=100", { cache: "no-store" }),
          fetch("/api/finance/accounts", { cache: "no-store" }),
          fetch("/api/customers?page=1&pageSize=100", { cache: "no-store" }),
          fetch("/api/reservations?page=1&pageSize=100", { cache: "no-store" })
        ]);
        const [invoiceResult, accountResult, customerResult, reservationResult] = await Promise.all([
          invoiceResponse.json(), accountResponse.json(), customerResponse.json(), reservationResponse.json()
        ]);
        if (!invoiceResponse.ok) throw new Error(invoiceResult.message || invoiceResult.error || "INVOICE_LOAD_FAILED");
        if (!accountResponse.ok) throw new Error(accountResult.error || "ACCOUNT_LOAD_FAILED");
        if (!customerResponse.ok) throw new Error(customerResponse.error || "CUSTOMER_LOAD_FAILED");
        if (!reservationResponse.ok) throw new Error(reservationResult.error || "RESERVATION_LOAD_FAILED");
        if (active) {
          const currency = accountResult.baseCurrency || invoiceResult.baseCurrency || "EGP";
          setBaseCurrency(currency);
          setAccounts(accountResult.items as Account[]);
          setCustomers(customerResult.items as Customer[]);
          setReservations(reservationResult.items as Reservation[]);
          setInvoices(invoiceResult.items as Invoice[]);
          setInvoiceDraft((previous) => previous.currency === "EGP" && currency !== "EGP" && !showInvoiceForm
            ? { ...previous, currency, exchangeRate: "1" }
            : previous);
          setInvoiceLines((previous) => previous.map((line, index) => index === 0 && !line.revenueAccountId
            ? { ...line, revenueAccountId: (accountResult.items as Account[]).find((account) => account.code === "4000" && account.type === "REVENUE")?.id ?? "" }
            : line));
          setPaymentDraft((previous) => previous.accountId ? previous : {
            ...previous,
            accountId: (accountResult.items as Account[]).find((account) => account.type === "ASSET" && account.code === "1000")?.id
              ?? (accountResult.items as Account[]).find((account) => account.type === "ASSET")?.id ?? ""
          });
        }
      } catch {
        if (active) setError(ar
          ? "تعذر تحميل الفواتير أو العملاء أو الحجوزات. تأكد من تسجيل الدخول وصلاحيات الحساب."
          : "Could not load invoices, customers, or reservations. Check that you are signed in and have access.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [refreshKey, ar, showInvoiceForm]);

  const revenueAccounts = useMemo(() => accounts.filter((account) => account.type === "REVENUE" && account.isActive), [accounts]);
  const assetAccounts = useMemo(() => accounts.filter((account) => account.type === "ASSET" && account.isActive), [accounts]);
  const availableReservations = useMemo(
    () => reservations.filter((reservation) => !invoiceDraft.customerId || reservation.customerId === invoiceDraft.customerId),
    [reservations, invoiceDraft.customerId]
  );
  const invoicePreview = useMemo(() => {
    const subtotal = invoiceLines.reduce((sum, line) => {
      const quantity = Number(line.quantity || 0);
      const price = Number(line.unitPrice || 0);
      return sum + (Number.isFinite(quantity * price) ? quantity * price : 0);
    }, 0);
    const tax = Number(invoiceDraft.taxAmount || 0);
    return { subtotal, tax, total: subtotal + (Number.isFinite(tax) ? tax : 0) };
  }, [invoiceLines, invoiceDraft.taxAmount]);

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
  function invoiceStatus(status: Invoice["status"]) {
    const labels: Record<Invoice["status"], { ar: string; en: string }> = {
      ISSUED: { ar: "صادرة", en: "Issued" },
      PARTIALLY_PAID: { ar: "مدفوعة جزئيًا", en: "Partially paid" },
      PAID: { ar: "مدفوعة بالكامل", en: "Paid" },
      VOID: { ar: "ملغاة", en: "Void" }
    };
    return labels[status][locale];
  }
  function rotateInvoiceKey() { setInvoiceKey(crypto.randomUUID()); }
  function updateInvoiceDraft<K extends keyof InvoiceDraft>(field: K, value: InvoiceDraft[K]) {
    setInvoiceDraft((previous) => ({ ...previous, [field]: value }));
    rotateInvoiceKey();
  }
  function updateInvoiceLine(index: number, field: keyof InvoiceLineDraft, value: string) {
    setInvoiceLines((previous) => previous.map((line, current) => current === index ? { ...line, [field]: value } : line));
    rotateInvoiceKey();
  }
  function openInvoiceForm() {
    setError("");
    setSuccess("");
    setInvoiceDraft(newInvoiceDraft(baseCurrency));
    setInvoiceLines([emptyInvoiceLine(revenueAccounts.find((account) => account.code === "4000")?.id ?? revenueAccounts[0]?.id ?? "")]);
    setInvoiceKey(crypto.randomUUID());
    setShowInvoiceForm((previous) => !previous);
    setPaymentInvoiceId("");
  }

  async function submitInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/finance/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...invoiceDraft,
          idempotencyKey: invoiceKey || crypto.randomUUID(),
          lines: invoiceLines.map((line) => ({
            description: line.description.trim(),
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            revenueAccountId: line.revenueAccountId
          }))
        })
      });
      const result = await response.json();
      if (!response.ok) {
        const messages: Record<string, string> = {
          CUSTOMER_NOT_FOUND: ar ? "العميل غير موجود أو مؤرشف." : "Customer not found or archived.",
          RESERVATION_NOT_FOUND: ar ? "الحجز لا يتبع العميل المختار." : "The reservation does not belong to the selected customer.",
          BASE_CURRENCY_RATE_MUST_BE_ONE: ar ? "سعر صرف العملة الأساسية يجب أن يساوي 1." : "The base currency exchange rate must be 1.",
          RECEIVABLE_ACCOUNT_MISSING: ar ? "حساب العملاء 1100 غير موجود أو غير نشط." : "Receivables account 1100 is missing or inactive.",
          REVENUE_ACCOUNT_INVALID: ar ? "اختر حساب إيراد نشطًا تابعًا للشركة." : "Choose an active revenue account belonging to this company.",
          VAT_ACCOUNT_MISSING: ar ? "حساب ضريبة القيمة المضافة 2200 غير موجود." : "VAT payable account 2200 is missing.",
          IDEMPOTENCY_KEY_REUSED: ar ? "مفتاح الفاتورة مستخدم لبيانات مختلفة." : "This idempotency key was used for different invoice data."
        };
        throw new Error(messages[result.error] || result.message || (ar ? "تعذر إصدار الفاتورة." : "Could not issue the invoice."));
      }
      setSuccess(ar ? `تم إصدار الفاتورة ${result.item.reference} وترحيل قيدها المحاسبي.` : `Invoice ${result.item.reference} issued and journal posted.`);
      setShowInvoiceForm(false);
      setInvoiceKey("");
      setRefreshKey((value) => value + 1);
      window.dispatchEvent(new Event("nht:finance-refresh"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (ar ? "حدث خطأ غير متوقع." : "An unexpected error occurred."));
    } finally { setSaving(false); }
  }

  function openPayment(invoice: Invoice) {
    const defaultAccount = assetAccounts.find((account) => account.code === "1000") ?? assetAccounts[0];
    setPaymentDraft({
      invoiceId: invoice.id,
      paymentDate: todayLocal(),
      amount: invoice.outstandingAmount,
      accountId: defaultAccount?.id ?? "",
      method: "CASH",
      reference: "",
      notes: ""
    });
    setPaymentKey(crypto.randomUUID());
    setPaymentInvoiceId(invoice.id);
    setShowInvoiceForm(false);
    setError("");
    setSuccess("");
  }
  function updatePaymentDraft<K extends keyof PaymentDraft>(field: K, value: PaymentDraft[K]) {
    setPaymentDraft((previous) => ({ ...previous, [field]: value }));
    setPaymentKey(crypto.randomUUID());
  }
  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/finance/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...paymentDraft,
          idempotencyKey: paymentKey || crypto.randomUUID()
        })
      });
      const result = await response.json();
      if (!response.ok) {
        const messages: Record<string, string> = {
          INVOICE_NOT_FOUND: ar ? "الفاتورة غير موجودة." : "Invoice not found.",
          INVOICE_VOID: ar ? "لا يمكن تحصيل فاتورة ملغاة." : "Cannot collect a void invoice.",
          INVOICE_ALREADY_PAID: ar ? "الفاتورة مدفوعة بالكامل بالفعل." : "This invoice is already fully paid.",
          PAYMENT_EXCEEDS_BALANCE: ar ? `المبلغ أكبر من المتبقي. المتبقي ${result.outstanding ?? ""}` : `Payment exceeds the outstanding balance: ${result.outstanding ?? ""}`,
          PAYMENT_ACCOUNT_INVALID: ar ? "اختر حساب نقدية أو بنك نشطًا." : "Choose an active cash or bank asset account.",
          RECEIVABLE_ACCOUNT_MISSING: ar ? "حساب العملاء 1100 غير موجود أو غير نشط." : "Receivables account 1100 is missing or inactive.",
          IDEMPOTENCY_KEY_REUSED: ar ? "مفتاح الإيصال مستخدم لبيانات مختلفة." : "This idempotency key was used for different receipt data.",
          INVOICE_BALANCE_CHANGED: ar ? "تم تغيير رصيد الفاتورة. حدّث الشاشة وأعد المحاولة." : "Invoice balance changed. Refresh and try again."
        };
        throw new Error(messages[result.error] || result.message || (ar ? "تعذر تسجيل التحصيل." : "Could not record the payment."));
      }
      setSuccess(ar ? `تم تسجيل إيصال التحصيل ${result.item.receiptNumber} وترحيل القيد.` : `Receipt ${result.item.receiptNumber} recorded and journal posted.`);
      setPaymentInvoiceId("");
      setPaymentKey("");
      setRefreshKey((value) => value + 1);
      window.dispatchEvent(new Event("nht:finance-refresh"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (ar ? "حدث خطأ غير متوقع." : "An unexpected error occurred."));
    } finally { setSaving(false); }
  }

  const methodLabel = (value: string) => paymentMethods.find((item) => item.value === value)?.[locale] ?? value;
  const customerOptions = customers;

  return <div className="customer-layout">
    {error && <div className="alert" role="alert">{error}</div>}
    {success && <div className="alert success" role="status">{success}</div>}

    <div className="stat-grid">
      <div className="stat-card"><div className="stat-top"><span className="stat-label">{ar ? "عدد الفواتير" : "Invoices"}</span><span className="stat-icon"><FilePlus2 size={17} /></span></div><div className="stat-value">{invoices.length}</div><div className="stat-hint">{ar ? "الفواتير المسجلة محليًا" : "Invoices stored locally"}</div></div>
      <div className="stat-card"><div className="stat-top"><span className="stat-label">{ar ? "المبالغ المحصلة" : "Collected"}</span><span className="stat-icon"><Receipt size={17} /></span></div><div className="stat-value" style={{ fontSize: 20 }}>{formatMoney(invoices.reduce((sum, invoice) => sum + Number(invoice.paidAmount || 0), 0))}</div><div className="stat-hint">{ar ? "حسب عملة الأساس للعرض فقط" : "Display total; invoices may use different currencies"}</div></div>
      <div className="stat-card"><div className="stat-top"><span className="stat-label">{ar ? "إجمالي المتبقي" : "Outstanding"}</span><span className="stat-icon"><RefreshCw size={17} /></span></div><div className="stat-value" style={{ fontSize: 20 }}>{formatMoney(invoices.reduce((sum, invoice) => sum + Number(invoice.outstandingAmount || 0), 0))}</div><div className="stat-hint">{ar ? "للمتابعة والتحصيل" : "Pending customer collections"}</div></div>
    </div>
    <div className="alert billing-currency-note">
      {ar
        ? "تنبيه: إجمالي المبالغ في البطاقات يعرض الأرقام المجمعة لأغراض المتابعة فقط؛ لا تجمع عملات مختلفة كإجمالي محاسبي. ميزان المراجعة يحول الأرصدة إلى عملة الأساس."
        : "Note: Summary cards add displayed amounts for quick follow-up only; do not treat mixed currencies as a consolidated accounting total. The trial balance uses the base currency."}
    </div>

    <section className="panel">
      <div className="panel-header finance-panel-header">
        <div><h2 className="panel-title">{ar ? "فواتير العملاء والتحصيل" : "Customer invoices & collections"}</h2><div className="panel-subtitle">{ar ? "إصدار الفاتورة يرحّل المدين للعملاء والدائن للإيراد والضريبة، والتحصيل ينشئ إيصالًا وقيدًا تلقائيًا." : "Invoice issuance posts receivables against revenue/tax; collections create receipts and journals automatically."}</div></div>
        {canWrite && <button className="btn btn-primary" type="button" onClick={openInvoiceForm}><Plus size={15} />{ar ? "فاتورة جديدة" : "New invoice"}</button>}
      </div>

      {showInvoiceForm && canWrite && <form className="panel-body auth-form billing-form" onSubmit={submitInvoice}>
        <div className="billing-section-title"><h3>{ar ? "بيانات الفاتورة" : "Invoice details"}</h3><button className="icon-button" type="button" aria-label={ar ? "إغلاق" : "Close"} onClick={() => setShowInvoiceForm(false)}><X size={16} /></button></div>
        <div className="form-grid">
          <label className="field"><span className="field-label">{ar ? "العميل" : "Customer"}</span><select className="select" value={invoiceDraft.customerId} onChange={(event) => { updateInvoiceDraft("customerId", event.target.value); setInvoiceDraft((previous) => ({ ...previous, customerId: event.target.value, reservationId: "" })); }} required><option value="">{ar ? "اختر العميل" : "Select customer"}</option>{customerOptions.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
          <label className="field"><span className="field-label">{ar ? "ربط بالحجز (اختياري)" : "Link reservation (optional)"}</span><select className="select" value={invoiceDraft.reservationId} onChange={(event) => updateInvoiceDraft("reservationId", event.target.value)}><option value="">{ar ? "بدون حجز" : "No reservation"}</option>{availableReservations.map((reservation) => <option key={reservation.id} value={reservation.id}>{reservation.reference} · {reservation.status}</option>)}</select></label>
          <label className="field"><span className="field-label">{ar ? "تاريخ الإصدار" : "Issue date"}</span><input className="input" type="date" value={invoiceDraft.issueDate} onChange={(event) => updateInvoiceDraft("issueDate", event.target.value)} required /></label>
          <label className="field"><span className="field-label">{ar ? "تاريخ الاستحقاق" : "Due date"}</span><input className="input" type="date" min={invoiceDraft.issueDate} value={invoiceDraft.dueDate} onChange={(event) => updateInvoiceDraft("dueDate", event.target.value)} /></label>
          <label className="field"><span className="field-label">{ar ? "العملة" : "Currency"}</span><select className="select" value={invoiceDraft.currency} onChange={(event) => { updateInvoiceDraft("currency", event.target.value); if (event.target.value === baseCurrency) setInvoiceDraft((previous) => ({ ...previous, currency: event.target.value, exchangeRate: "1" })); }}><option value={baseCurrency}>{baseCurrency} · {ar ? "عملة الأساس" : "Base currency"}</option>{["EGP", "SAR", "USD"].filter((currency) => currency !== baseCurrency).map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select></label>
          <label className="field"><span className="field-label">{ar ? "سعر الصرف إلى عملة الأساس" : "Exchange rate to base"}</span><input className="input" type="number" inputMode="decimal" min="0.00000001" step="0.00000001" value={invoiceDraft.exchangeRate} onChange={(event) => updateInvoiceDraft("exchangeRate", event.target.value)} disabled={invoiceDraft.currency === baseCurrency} required /></label>
          <label className="field"><span className="field-label">{ar ? "ضريبة القيمة المضافة (مبلغ)" : "VAT amount"}</span><input className="input" type="number" min="0" step="0.01" value={invoiceDraft.taxAmount} onChange={(event) => updateInvoiceDraft("taxAmount", event.target.value)} required /></label>
          <label className="field span-2"><span className="field-label">{ar ? "ملاحظات" : "Notes"}</span><input className="input" value={invoiceDraft.notes} onChange={(event) => updateInvoiceDraft("notes", event.target.value)} maxLength={2000} /></label>
        </div>
        <div className="billing-section-title billing-lines-title"><h3>{ar ? "بنود الفاتورة" : "Invoice line items"}</h3><button className="btn btn-secondary" type="button" onClick={() => { setInvoiceLines((previous) => [...previous, emptyInvoiceLine(revenueAccounts.find((account) => account.code === "4000")?.id ?? revenueAccounts[0]?.id ?? "")]); rotateInvoiceKey(); }} disabled={invoiceLines.length >= 100}><Plus size={14} />{ar ? "إضافة بند" : "Add line"}</button></div>
        <div className="billing-lines">
          {invoiceLines.map((line, index) => <div className="billing-line" key={index}>
            <label className="field billing-description"><span className="field-label">{ar ? "الوصف" : "Description"}</span><input className="input" value={line.description} onChange={(event) => updateInvoiceLine(index, "description", event.target.value)} required minLength={2} maxLength={240} /></label>
            <label className="field"><span className="field-label">{ar ? "الكمية" : "Quantity"}</span><input className="input" type="number" min="0.01" step="0.01" value={line.quantity} onChange={(event) => updateInvoiceLine(index, "quantity", event.target.value)} required /></label>
            <label className="field"><span className="field-label">{ar ? "سعر الوحدة" : "Unit price"}</span><input className="input" type="number" min="0.01" step="0.01" value={line.unitPrice} onChange={(event) => updateInvoiceLine(index, "unitPrice", event.target.value)} required /></label>
            <label className="field billing-revenue"><span className="field-label">{ar ? "حساب الإيراد" : "Revenue account"}</span><select className="select" value={line.revenueAccountId} onChange={(event) => updateInvoiceLine(index, "revenueAccountId", event.target.value)} required><option value="">{ar ? "اختر الحساب" : "Select account"}</option>{revenueAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {ar ? account.name : account.nameEn}</option>)}</select></label>
            <div className="billing-line-total"><span className="field-label">{ar ? "الإجمالي" : "Line total"}</span><strong>{formatMoney(Number(line.quantity || 0) * Number(line.unitPrice || 0), invoiceDraft.currency)}</strong></div>
            <button className="icon-button remove-line" type="button" disabled={invoiceLines.length <= 1} onClick={() => { setInvoiceLines((previous) => previous.filter((_, row) => row !== index)); rotateInvoiceKey(); }} aria-label={ar ? "حذف البند" : "Remove line"}><X size={15} /></button>
          </div>)}
        </div>
        <div className="billing-total-panel">
          <div><span>{ar ? "الإجمالي الفرعي" : "Subtotal"}</span><strong>{formatMoney(invoicePreview.subtotal, invoiceDraft.currency)}</strong></div>
          <div><span>{ar ? "الضريبة" : "Tax"}</span><strong>{formatMoney(invoicePreview.tax, invoiceDraft.currency)}</strong></div>
          <div className="billing-grand-total"><span>{ar ? "إجمالي الفاتورة" : "Invoice total"}</span><strong>{formatMoney(invoicePreview.total, invoiceDraft.currency)}</strong></div>
        </div>
        <div className="form-footer"><button className="btn btn-secondary" type="button" onClick={() => setShowInvoiceForm(false)}>{ar ? "إلغاء" : "Cancel"}</button><button className="btn btn-primary" type="submit" disabled={saving || !customers.length || !revenueAccounts.length}><Save size={15} />{saving ? (ar ? "جارٍ الإصدار..." : "Issuing...") : (ar ? "إصدار الفاتورة وترحيلها" : "Issue invoice & post")}</button></div>
      </form>}

      {paymentInvoiceId && canWrite && <form className="panel-body auth-form billing-payment-form" onSubmit={submitPayment}>
        <div className="billing-section-title"><div><h3>{ar ? "إيصال تحصيل" : "Customer receipt"}</h3><p>{ar ? "سيتم إنشاء قيد مدين لحساب النقدية/البنك ودائن لحساب العملاء." : "Posts debit to the selected cash/bank account and credit to receivables."}</p></div><button className="icon-button" type="button" aria-label={ar ? "إغلاق" : "Close"} onClick={() => setPaymentInvoiceId("")}><X size={16} /></button></div>
        <div className="form-grid">
          <label className="field"><span className="field-label">{ar ? "الفاتورة" : "Invoice"}</span><input className="input" value={invoices.find((invoice) => invoice.id === paymentInvoiceId)?.reference ?? ""} readOnly /></label>
          <label className="field"><span className="field-label">{ar ? "تاريخ التحصيل" : "Payment date"}</span><input className="input" type="date" value={paymentDraft.paymentDate} onChange={(event) => updatePaymentDraft("paymentDate", event.target.value)} required /></label>
          <label className="field"><span className="field-label">{ar ? "مبلغ التحصيل" : "Amount received"}</span><input className="input" type="number" min="0.01" step="0.01" value={paymentDraft.amount} onChange={(event) => updatePaymentDraft("amount", event.target.value)} required /><span className="customer-secondary">{ar ? "يمكن تسجيل تحصيل جزئي، ولا يسمح بتجاوز المتبقي." : "Partial receipts are allowed; over-collection is blocked."}</span></label>
          <label className="field"><span className="field-label">{ar ? "الحساب المستلم" : "Deposit account"}</span><select className="select" value={paymentDraft.accountId} onChange={(event) => updatePaymentDraft("accountId", event.target.value)} required><option value="">{ar ? "اختر الحساب" : "Select account"}</option>{assetAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {ar ? account.name : account.nameEn}</option>)}</select></label>
          <label className="field"><span className="field-label">{ar ? "طريقة التحصيل" : "Payment method"}</span><select className="select" value={paymentDraft.method} onChange={(event) => updatePaymentDraft("method", event.target.value)}>{paymentMethods.map((method) => <option key={method.value} value={method.value}>{method[locale]}</option>)}</select></label>
          <label className="field"><span className="field-label">{ar ? "رقم مرجعي (اختياري)" : "Reference (optional)"}</span><input className="input" value={paymentDraft.reference} onChange={(event) => updatePaymentDraft("reference", event.target.value)} maxLength={120} /></label>
          <label className="field span-2"><span className="field-label">{ar ? "ملاحظات الإيصال" : "Receipt notes"}</span><input className="input" value={paymentDraft.notes} onChange={(event) => updatePaymentDraft("notes", event.target.value)} maxLength={1000} /></label>
        </div>
        <div className="form-footer"><button className="btn btn-secondary" type="button" onClick={() => setPaymentInvoiceId("")}>{ar ? "إلغاء" : "Cancel"}</button><button className="btn btn-primary" type="submit" disabled={saving || !assetAccounts.length}><Check size={15} />{saving ? (ar ? "جارٍ التسجيل..." : "Recording...") : (ar ? "تسجيل الإيصال والقيد" : "Record receipt & journal")}</button></div>
      </form>}

      <div className="table-wrap">
        <table className="data-table billing-table">
          <thead><tr><th>{ar ? "الفاتورة" : "Invoice"}</th><th>{ar ? "العميل / الحجز" : "Customer / reservation"}</th><th>{ar ? "التاريخ" : "Date"}</th><th>{ar ? "الإجمالي" : "Total"}</th><th>{ar ? "المحصّل" : "Paid"}</th><th>{ar ? "المتبقي" : "Outstanding"}</th><th>{ar ? "الحالة" : "Status"}</th><th>{ar ? "الإجراء" : "Action"}</th></tr></thead>
          <tbody>{invoices.map((invoice) => <tr key={invoice.id}>
            <td><div className="customer-primary" dir="ltr">{invoice.reference}</div><div className="customer-secondary" dir="ltr">{invoice.journalEntry.reference}</div></td>
            <td><div className="customer-primary">{invoice.customer.name}</div><div className="customer-secondary">{invoice.reservation?.reference ?? (ar ? "بدون حجز" : "No reservation")}</div><details className="invoice-detail"><summary><ChevronDown size={12} />{ar ? "تفاصيل البنود والإيصالات" : "Lines & receipts"}</summary><div className="invoice-detail-content"><strong>{ar ? "بنود الفاتورة" : "Invoice lines"}</strong>{invoice.lines.map((line) => <div className="invoice-detail-row" key={line.id}><span>{line.description} · {line.quantity} × {formatMoney(line.unitPrice, invoice.currency)}</span><strong>{formatMoney(line.amount, invoice.currency)}</strong></div>)}<div className="invoice-detail-row"><span>{ar ? "الضريبة" : "Tax"}</span><strong>{formatMoney(invoice.taxAmount, invoice.currency)}</strong></div><div className="invoice-detail-row"><span>{ar ? "سعر الصرف" : "Exchange rate"}</span><strong dir="ltr">{invoice.exchangeRate}</strong></div><div className="invoice-payments-heading">{ar ? "إيصالات التحصيل" : "Receipts"}</div>{invoice.payments.length ? invoice.payments.map((payment) => <div className="invoice-payment-row" key={payment.id}><div><strong dir="ltr">{payment.receiptNumber}</strong><span>{dateLabel(payment.paymentDate)} · {methodLabel(payment.method)} · {ar ? payment.account.name : payment.account.nameEn}</span><span className="customer-secondary">{ar ? "القيد" : "Journal"}: {payment.journalReference}</span></div><strong>{formatMoney(payment.amount, payment.currency)}</strong></div>) : <div className="customer-secondary">{ar ? "لا توجد إيصالات بعد." : "No receipts yet."}</div>}</div></details></td>
            <td>{dateLabel(invoice.issueDate)}</td>
            <td className="numeric-cell" dir="ltr">{formatMoney(invoice.total, invoice.currency)}</td>
            <td className="numeric-cell" dir="ltr">{formatMoney(invoice.paidAmount, invoice.currency)}</td>
            <td className="numeric-cell" dir="ltr"><strong>{formatMoney(invoice.outstandingAmount, invoice.currency)}</strong></td>
            <td><span className={"type-pill invoice-status-" + invoice.status.toLowerCase()}>{invoiceStatus(invoice.status)}</span></td>
            <td>{canWrite && invoice.status !== "PAID" && invoice.status !== "VOID" ? <button className="small-btn" type="button" onClick={() => openPayment(invoice)}>{ar ? "تحصيل" : "Collect"}</button> : <span className="customer-secondary">—</span>}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {loading && <div className="empty-state">{ar ? "جارٍ تحميل الفواتير..." : "Loading invoices..."}</div>}
      {!loading && invoices.length === 0 && <div className="empty-state">{ar ? "لا توجد فواتير حتى الآن. ابدأ بإصدار أول فاتورة." : "No invoices yet. Issue your first invoice to get started."}</div>}
    </section>
  </div>;
}
