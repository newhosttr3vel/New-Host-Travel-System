import { randomUUID } from "node:crypto";
import { google, type sheets_v4 } from "googleapis";

export const SHEET_COLUMNS = {
  Tenants: ["id", "name", "slug", "status", "defaultLanguage", "defaultCurrency", "timeZone", "createdAt", "updatedAt"],
  Memberships: ["id", "tenantId", "userId", "userEmail", "userName", "role", "createdAt", "updatedAt"],
  Branches: ["id", "tenantId", "name", "slug", "isActive", "createdAt", "updatedAt"],
  Customers: ["id", "tenantId", "type", "name", "companyName", "email", "phone", "nationality", "notes", "createdAt", "updatedAt", "archivedAt"],
  Suppliers: ["id", "tenantId", "name", "category", "contactName", "email", "phone", "paymentTerms", "notes", "createdAt", "updatedAt", "archivedAt"],
  Reservations: ["id", "tenantId", "customerId", "supplierId", "supplierTenantId", "reference", "serviceType", "status", "startDate", "endDate", "currency", "saleAmount", "costAmount", "notes", "createdAt", "updatedAt", "archivedAt"],
  AuditEvents: ["id", "tenantId", "userId", "action", "entityType", "entityId", "metadata", "ipAddress", "userAgent", "createdAt"]
} as const;
export type SheetTable = keyof typeof SHEET_COLUMNS;
export type SheetRow = Record<string, string>;
type SheetsClient = sheets_v4.Sheets;
let client: SheetsClient | undefined;
let clientFingerprint = "";
let initialization: Promise<void> | undefined;

function config() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID?.trim();
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  if (!spreadsheetId || !email || !privateKey) throw new Error("Google Sheets is not configured. Set GOOGLE_SHEETS_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY.");
  return { spreadsheetId, email, privateKey };
}
function getClient(): SheetsClient {
  const { spreadsheetId, email, privateKey } = config();
  const fingerprint = [spreadsheetId, email, privateKey].join("|");
  if (!client || clientFingerprint !== fingerprint) {
    const auth = new google.auth.JWT({ email, key: privateKey, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
    client = google.sheets({ version: "v4", auth });
    clientFingerprint = fingerprint;
    initialization = undefined;
  }
  return client;
}
function columnLetter(index: number): string {
  let value = index + 1, result = "";
  while (value > 0) { const rem = (value - 1) % 26; result = String.fromCharCode(65 + rem) + result; value = Math.floor((value - rem - 1) / 26); }
  return result;
}
function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
function decodeRow(table: SheetTable, values: unknown[]): SheetRow {
  const row: SheetRow = {};
  SHEET_COLUMNS[table].forEach((column, index) => { row[column] = cell(values[index]); });
  return row;
}
function encodeValues(table: SheetTable, row: Record<string, unknown>): string[] {
  return SHEET_COLUMNS[table].map((column) => cell(row[column]));
}
async function initialize(): Promise<void> {
  const { spreadsheetId } = config();
  const sheets = getClient();
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets(properties(title))" });
  const titles = new Set((metadata.data.sheets ?? []).map((sheet) => sheet.properties?.title ?? ""));
  const missing = Object.keys(SHEET_COLUMNS).filter((title) => !titles.has(title));
  if (missing.length) await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: missing.map((title) => ({ addSheet: { properties: { title } } })) }
  });
  const data = Object.entries(SHEET_COLUMNS).map(([table, columns]) => ({
    range: table + "!A1:" + columnLetter(columns.length - 1) + "1", values: [Array.from(columns)]
  }));
  await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: "RAW", data } });
}
async function ready(): Promise<void> {
  getClient();
  if (!initialization) initialization = initialize().catch((error) => { initialization = undefined; throw error; });
  await initialization;
}
export async function listRows(table: SheetTable): Promise<SheetRow[]> {
  await ready();
  const { spreadsheetId } = config();
  const response = await getClient().spreadsheets.values.get({
    spreadsheetId, range: table + "!A2:" + columnLetter(SHEET_COLUMNS[table].length - 1), valueRenderOption: "UNFORMATTED_VALUE"
  });
  return (response.data.values ?? []).map((row) => decodeRow(table, row));
}
export async function insertRow(table: SheetTable, data: Record<string, unknown>): Promise<SheetRow> {
  await ready();
  const { spreadsheetId } = config();
  const normalized = decodeRow(table, encodeValues(table, data));
  await getClient().spreadsheets.values.append({
    spreadsheetId, range: table + "!A1:" + columnLetter(SHEET_COLUMNS[table].length - 1),
    valueInputOption: "RAW", insertDataOption: "INSERT_ROWS", requestBody: { values: [encodeValues(table, normalized)] }
  });
  return normalized;
}
export async function updateRow(table: SheetTable, predicate: (row: SheetRow) => boolean, changes: Record<string, unknown>): Promise<SheetRow | null> {
  await ready();
  const { spreadsheetId } = config();
  const lastColumn = columnLetter(SHEET_COLUMNS[table].length - 1);
  const response = await getClient().spreadsheets.values.get({ spreadsheetId, range: table + "!A2:" + lastColumn, valueRenderOption: "UNFORMATTED_VALUE" });
  const values = response.data.values ?? [];
  for (let index = 0; index < values.length; index += 1) {
    const current = decodeRow(table, values[index]);
    if (!predicate(current)) continue;
    const updated = { ...current, ...Object.fromEntries(Object.entries(changes).map(([key, value]) => [key, cell(value)])) };
    await getClient().spreadsheets.values.update({
      spreadsheetId, range: table + "!A" + (index + 2) + ":" + lastColumn + (index + 2),
      valueInputOption: "RAW", requestBody: { values: [encodeValues(table, updated)] }
    });
    return updated;
  }
  return null;
}
export async function logAudit(input: { tenantId: string; userId?: string | null; action: string; entityType: string; entityId: string; metadata?: unknown; ipAddress?: string | null; userAgent?: string | null }): Promise<void> {
  await insertRow("AuditEvents", {
    id: randomUUID(), tenantId: input.tenantId, userId: input.userId ?? "", action: input.action,
    entityType: input.entityType, entityId: input.entityId, metadata: input.metadata === undefined ? "" : JSON.stringify(input.metadata),
    ipAddress: input.ipAddress ?? "", userAgent: input.userAgent ?? "", createdAt: new Date().toISOString()
  });
}
export async function checkSheetsConnection(): Promise<void> {
  await ready();
  const { spreadsheetId } = config();
  await getClient().spreadsheets.get({ spreadsheetId, fields: "spreadsheetId,properties.title" });
}
