import { checkSheetsConnection } from "@/lib/sheets-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const timestamp = new Date().toISOString();
  try { await checkSheetsConnection(); return Response.json({ status: "ok", storage: "google_sheets", timestamp }); }
  catch { return Response.json({ status: "degraded", storage: "unavailable", timestamp }, { status: 503 }); }
}
