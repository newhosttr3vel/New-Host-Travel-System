import { Users, UserPlus } from "lucide-react";
import { currentLocale, t } from "@/lib/i18n";
import { CustomersClient } from "@/components/customers-client";

export default async function CustomersPage() {
  const locale = await currentLocale();
  return <>
    <div className="page-heading">
      <div><div className="eyebrow">{locale === "ar" ? "إدارة علاقات العملاء" : "CUSTOMER RELATIONSHIP MANAGEMENT"}</div><h1 className="page-title">{t(locale, "customers")}</h1><p className="page-description">{t(locale, "customersSubtitle")}</p></div>
      <div className="page-actions"><span className="btn btn-secondary"><Users size={16} />{locale === "ar" ? "سجلات محفوظة" : "Persisted records"}</span></div>
    </div>
    <CustomersClient locale={locale} />
  </>;
}
