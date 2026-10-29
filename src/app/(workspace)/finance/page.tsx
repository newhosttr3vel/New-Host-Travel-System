import { WalletCards } from "lucide-react";
import { currentLocale } from "@/lib/i18n";
import { getTenantContext } from "@/lib/tenant-context";
import { hasPermission } from "@/lib/permissions";
import { FinanceClient } from "@/components/finance-client";
import { BillingClient } from "@/components/billing-client";

export default async function FinancePage() {
  const locale = await currentLocale();
  const { membership } = await getTenantContext();
  const role = membership?.role ?? "READ_ONLY";
  const canRead = hasPermission(role, "finance:read");
  const canWrite = hasPermission(role, "finance:write");

  return <>
    <div className="page-heading">
      <div>
        <div className="eyebrow">{locale === "ar" ? "النظام المحاسبي" : "ACCOUNTING WORKSPACE"}</div>
        <h1 className="page-title">{locale === "ar" ? "المالية والمحاسبة" : "Finance & Accounting"}</h1>
        <p className="page-description">
          {locale === "ar"
            ? "الفواتير والتحصيل ودليل الحسابات وقيود يومية متوازنة محفوظة في قاعدة البيانات المحلية."
            : "Invoices, customer collections, chart of accounts and balanced journal entries on your local database."}
        </p>
      </div>
      <div className="page-actions"><span className="btn btn-secondary"><WalletCards size={16} />{locale === "ar" ? "القيد المزدوج" : "Double-entry ledger"}</span></div>
    </div>
    {!canRead
      ? <div className="alert" role="alert">{locale === "ar" ? "ليست لديك صلاحية لعرض البيانات المالية." : "You do not have permission to view financial data."}</div>
      : <>
          <BillingClient locale={locale} canWrite={canWrite} />
          <FinanceClient locale={locale} canWrite={canWrite} />
        </>}
  </>;
}
