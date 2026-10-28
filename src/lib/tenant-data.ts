import type { SheetRow } from "@/lib/sheets-store";

export function activeRowsForTenant<T extends SheetRow>(rows: T[], tenantId: string): T[] {
  return rows.filter((row) => row.tenantId === tenantId && !row.archivedAt);
}
