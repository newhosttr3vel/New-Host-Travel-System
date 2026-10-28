import { ClipboardList } from "lucide-react";
import { currentLocale } from "@/lib/i18n";
import { t } from "@/lib/messages";
import { getTenantContext } from "@/lib/tenant-context";
import { hasPermission } from "@/lib/permissions";
import { ReservationsClient } from "@/components/reservations-client";

export default async function ReservationsPage() {
  const locale = await currentLocale();
  const { membership } = await getTenantContext();
  const role = membership?.role ?? "READ_ONLY";
  return <>
    <div className="page-heading">
      <div><div className="eyebrow">{locale === "ar" ? "إدارة عمليات السفر" : "TRAVEL OPERATIONS"}</div><h1 className="page-title">{t(locale, "reservations")}</h1><p className="page-description">{t(locale, "reservationsSubtitle")}</p></div>
      <div className="page-actions"><span className="btn btn-secondary"><ClipboardList size={16} />{locale === "ar" ? "مسار عمل موثق" : "Workflow controlled"}</span></div>
    </div>
    <ReservationsClient locale={locale} canWrite={hasPermission(role, "reservations:write")} canReadCosts={hasPermission(role, "finance:read")} />
  </>;
}
