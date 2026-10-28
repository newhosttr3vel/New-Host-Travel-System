import { isTauri } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";

export type Table = "customers" | "suppliers" | "reservations";
export type Customer = {
  id: string; name: string; email: string; phone: string; nationality: string;
  notes: string; createdAt: string; archivedAt: string | null;
};
export type Supplier = {
  id: string; name: string; category: string; contactName: string; email: string;
  phone: string; paymentTerms: string; notes: string; createdAt: string; archivedAt: string | null;
};
export type Reservation = {
  id: string; reference: string; customerId: string; supplierId: string; serviceType: string;
  status: string; startDate: string; endDate: string; currency: string; saleAmount: number;
  costAmount: number; notes: string; createdAt: string; archivedAt: string | null;
};
export type Entity = Customer | Supplier | Reservation;
type TableMap = { customers: Customer; suppliers: Supplier; reservations: Reservation };

const columns: Record<Table, string[]> = {
  customers: ["id", "name", "email", "phone", "nationality", "notes", "created_at", "archived_at"],
  suppliers: ["id", "name", "category", "contact_name", "email", "phone", "payment_terms", "notes", "created_at", "archived_at"],
  reservations: ["id", "reference", "customer_id", "supplier_id", "service_type", "status", "start_date", "end_date", "currency", "sale_amount", "cost_amount", "notes", "created_at", "archived_at"]
};
const localKey = (table: Table) => "new-host-travel:" + table;
let dbPromise: Promise<Database> | undefined;

function camelCase(value: string): string {
  return value.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}
function fromSqlRow<T extends Entity>(row: Record<string, unknown>): T {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [camelCase(key), value])) as T;
}
function readLocal<T extends Entity>(table: Table): T[] {
  if (typeof window === "undefined") return [];
  try {
    const value = window.localStorage.getItem(localKey(table));
    return value ? JSON.parse(value) as T[] : [];
  } catch {
    return [];
  }
}
function writeLocal<T extends Entity>(table: Table, records: T[]): void {
  if (typeof window === "undefined") throw new Error("Local storage is not available in this environment.");
  window.localStorage.setItem(localKey(table), JSON.stringify(records));
}

async function nativeDb(): Promise<Database | null> {
  if (!isTauri()) return null;
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await Database.load("sqlite:newhost-travel.db");
      await db.execute("PRAGMA foreign_keys = ON");
      await db.execute("CREATE TABLE IF NOT EXISTS customers (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', nationality TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, archived_at TEXT)");
      await db.execute("CREATE TABLE IF NOT EXISTS suppliers (id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'other', contact_name TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', payment_terms TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, archived_at TEXT)");
      await db.execute("CREATE TABLE IF NOT EXISTS reservations (id TEXT PRIMARY KEY, reference TEXT NOT NULL UNIQUE, customer_id TEXT NOT NULL REFERENCES customers(id), supplier_id TEXT REFERENCES suppliers(id), service_type TEXT NOT NULL DEFAULT 'other', status TEXT NOT NULL DEFAULT 'inquiry', start_date TEXT NOT NULL, end_date TEXT NOT NULL, currency TEXT NOT NULL DEFAULT 'EGP', sale_amount REAL NOT NULL DEFAULT 0, cost_amount REAL NOT NULL DEFAULT 0, notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, archived_at TEXT)");
      await db.execute("CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at)");
      await db.execute("CREATE INDEX IF NOT EXISTS idx_reservations_start_date ON reservations(start_date)");
      return db;
    })();
  }
  return dbPromise;
}

export async function listRecords<K extends Table>(table: K): Promise<TableMap[K][]> {
  const db = await nativeDb();
  if (db) {
    const rows = await db.select<Record<string, unknown>[]>(
      "SELECT * FROM " + table + " WHERE archived_at IS NULL ORDER BY created_at DESC"
    );
    return rows.map((row) => fromSqlRow<TableMap[K]>(row));
  }
  return readLocal<TableMap[K]>(table)
    .filter((row) => !row.archivedAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveRecord<K extends Table>(table: K, record: TableMap[K], isUpdate: boolean): Promise<void> {
  const db = await nativeDb();
  if (db) {
    const tableColumns = columns[table];
    const writableColumns = isUpdate ? tableColumns.filter((column) => column !== "id") : tableColumns;
    const values = writableColumns.map((column) => {
      const property = camelCase(column);
      const value = (record as unknown as Record<string, unknown>)[property];
      if (column === "supplier_id" && value === "") return null;
      return value === undefined ? null : value;
    });
    if (isUpdate) {
      const assignments = writableColumns.map((column, index) => column + " = $" + (index + 1)).join(", ");
      values.push(record.id);
      await db.execute("UPDATE " + table + " SET " + assignments + " WHERE id = $" + values.length, values);
    } else {
      const placeholders = writableColumns.map((_column, index) => "$" + (index + 1)).join(", ");
      await db.execute("INSERT INTO " + table + " (" + writableColumns.join(", ") + ") VALUES (" + placeholders + ")", values);
    }
    return;
  }
  const current = readLocal<TableMap[K]>(table);
  if (isUpdate) writeLocal(table, current.map((row) => row.id === record.id ? record : row));
  else writeLocal(table, [record, ...current]);
}

export async function archiveRecord(table: Table, id: string): Promise<void> {
  const archivedAt = new Date().toISOString();
  const db = await nativeDb();
  if (db) {
    await db.execute("UPDATE " + table + " SET archived_at = $1 WHERE id = $2", [archivedAt, id]);
    return;
  }
  const current = readLocal(table);
  writeLocal(table, current.map((row) => row.id === id ? { ...row, archivedAt } as Entity : row));
}

export async function getBackupData(): Promise<{ format: string; exportedAt: string; data: Record<Table, Entity[]> }> {
  const db = await nativeDb();
  const data = {} as Record<Table, Entity[]>;
  for (const table of Object.keys(columns) as Table[]) {
    if (db) {
      const rows = await db.select<Record<string, unknown>[]>("SELECT * FROM " + table + " ORDER BY created_at DESC");
      data[table] = rows.map((row) => fromSqlRow<Entity>(row));
    } else data[table] = readLocal(table);
  }
  return { format: "new-host-travel-backup-v1", exportedAt: new Date().toISOString(), data };
}
export async function getStorageMode(): Promise<"sqlite" | "browser-local"> {
  return isTauri() ? "sqlite" : "browser-local";
}
export function newId(): string {
  return crypto.randomUUID();
}