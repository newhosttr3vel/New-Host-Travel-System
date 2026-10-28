import { Store } from "lucide-react";
import { currentLocale } from "@/lib/i18n";
import { t } from "@/lib/messages";
import { getTenantContext } from "@/lib/tenant-context";
import { hasPermission } from "@/lib/permissions";
import { SuppliersClient } from "@/components/suppliers-client";

export default async function SuppliersPage() {
  const locale = await currentLocale();
  const { membership } = await getTenantContext();
  const role = membership?.role ?? "READ_ONLY";
  return <>
    <div className="page-heading">
      <div><div className="eyebrow">{locale === "ar" ? "إدارة شبكة الموردين" : "SUPPLIER RELATIONSHIPS"}</div><h1 className="page-title">{t(locale, "suppliers")}</h1><p className="page-description">{t(locale, "suppliersSubtitle")}</p></div>
      <div className="page-actions"><span className="btn btn-secondary"><Store size={16} />{locale === "ar" ? "بيانات الشركة" : "Company records"}</span></div>
    </div>
    <SuppliersClient locale={locale} canWrite={hasPermission(role, "suppliers:write")} />
  </>;
}
