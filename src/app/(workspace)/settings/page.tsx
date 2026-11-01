import { Settings2 } from "lucide-react";
import { currentLocale } from "@/lib/i18n";
import { getTenantContext } from "@/lib/tenant-context";
import { hasPermission } from "@/lib/permissions";
import { SettingsDirectories } from "@/components/settings-directories";

export default async function SettingsPage() {
  const locale = await currentLocale();
  const { membership } = await getTenantContext();
  const role = membership?.role ?? "READ_ONLY";
  return <>
    <div className="page-heading">
      <div>
        <div className="eyebrow">{locale === "ar" ? "إدارة البيانات الأساسية" : "MASTER DATA MANAGEMENT"}</div>
        <h1 className="page-title">{locale === "ar" ? "الإعدادات" : "Settings"}</h1>
        <p className="page-description">{locale === "ar" ? "إدارة الفنادق وشركات الموردين وشركات العملاء التي تتعامل معها شركتك من مكان واحد." : "Manage hotels, supplier companies and B2B client companies from one place."}</p>
      </div>
      <div className="page-actions"><span className="btn btn-secondary"><Settings2 size={16} />{locale === "ar" ? "القوائم الرئيسية" : "Master directories"}</span></div>
    </div>
    <SettingsDirectories
      locale={locale}
      canManageHotels={hasPermission(role, "suppliers:write")}
      canManageSuppliers={hasPermission(role, "suppliers:write")}
      canManageClients={hasPermission(role, "customers:write")}
      canArchiveClients={hasPermission(role, "customers:archive")}
    />
  </>;
}
