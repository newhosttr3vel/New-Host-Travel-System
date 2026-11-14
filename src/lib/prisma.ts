import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

export type TenantRlsContext = { userId: string; tenantId?: string };
type RlsState = { userId?: string; tenantId?: string };
type AnyRecord = Record<string, unknown>;

const contextStorage = new AsyncLocalStorage<TenantRlsContext>();
const modelDelegates = new Set([
  "user", "session", "account", "verification", "rateLimit", "tenant", "tenantMembership",
  "branch", "branchMembership", "customer", "hotel", "supplier", "reservation",
  "hotelReservationDetail", "hotelReservationRoom", "hotelReservationNightRate", "auditEvent",
  "document", "ledgerAccount", "journalEntry", "journalLine", "invoice", "invoiceLine",
  "customerPayment", "supplierBill", "supplierBillLine", "supplierPayment", "platformCompanyApplication"
]);
const tenantModels = new Set([
  "Tenant", "TenantMembership", "Branch", "BranchMembership", "Customer", "Hotel", "Supplier",
  "Reservation", "HotelReservationDetail", "HotelReservationRoom", "HotelReservationNightRate",
  "AuditEvent", "Document", "LedgerAccount", "JournalEntry", "JournalLine", "Invoice",
  "InvoiceLine", "CustomerPayment", "SupplierBill", "SupplierBillLine", "SupplierPayment"
]);

function collectStrings(value: unknown, key: string, out = new Set<string>(), depth = 0): Set<string> {
  if (depth > 12 || value === null || value === undefined) return out;
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, key, out, depth + 1);
    return out;
  }
  if (typeof value !== "object" || value instanceof Date) return out;
  for (const [name, child] of Object.entries(value as AnyRecord)) {
    if (name === key && typeof child === "string" && child) out.add(child);
    else if (child && typeof child === "object") collectStrings(child, key, out, depth + 1);
  }
  return out;
}
function onlyValue(values: Set<string>, key: string): string | undefined {
  if (values.size > 1) throw new Error("A scoped query cannot span multiple " + key + " values.");
  return values.values().next().value;
}
async function writeRlsSettings(tx: AnyRecord, state: RlsState) {
  const queryRaw = (tx.$queryRaw as (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>).bind(tx);
  await queryRaw`SELECT
    set_config('app.user_id', ${state.userId ?? ""}, true),
    set_config('app.tenant_id', ${state.tenantId ?? ""}, true)
  `;
}
async function applyQueryScope(tx: AnyRecord, state: RlsState, model: string, args: unknown, operation: string) {
  const tenantIds = collectStrings(args, "tenantId");
  const userIds = collectStrings(args, "userId");
  const tenantId = onlyValue(tenantIds, "tenant");
  const userId = onlyValue(userIds, "user");
  if (userId && state.userId && userId !== state.userId &&
      !((model === "TenantMembership" && operation === "create" && tenantId === state.tenantId) ||
        (model === "Account" && operation === "create"))) {
    throw new Error("RLS blocked an operation for a different user.");
  }
  if (tenantId && state.tenantId && tenantId !== state.tenantId) {
    throw new Error("RLS blocked an attempt to switch company context.");
  }
  if (userId && !state.userId) state.userId = userId;
  if (tenantId && !state.tenantId) state.tenantId = tenantId;
  if (model === "Tenant") {
    const ids = collectStrings(args, "id");
    const targetId = onlyValue(ids, "tenant id");
    if (targetId && state.tenantId && targetId !== state.tenantId) {
      throw new Error("RLS blocked an attempt to switch company context.");
    }
    if (targetId && !state.tenantId) state.tenantId = targetId;
  }
  if (tenantModels.has(model) && !state.userId) {
    throw new Error("Authenticated user context is required for tenant data.");
  }
  if (tenantModels.has(model) && model !== "TenantMembership" && !state.tenantId) {
    throw new Error("Company context is required for tenant data.");
  }
  await writeRlsSettings(tx, state);
}
function wrapTransactionClient(tx: AnyRecord, state: RlsState): AnyRecord {
  return new Proxy(tx, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof property !== "string" || !modelDelegates.has(property) || !value || typeof value !== "object") {
        return typeof value === "function" ? value.bind(target) : value;
      }
      return new Proxy(value, {
        get(delegate, operation, delegateReceiver) {
          const method = Reflect.get(delegate, operation, delegateReceiver);
          if (typeof operation !== "string" || typeof method !== "function") return method;
          return async (...args: unknown[]) => {
            const model = property[0]!.toUpperCase() + property.slice(1);
            await applyQueryScope(target, state, model, args[0], operation);
            return Reflect.apply(method, delegate, args);
          };
        }
      });
    }
  });
}

const connectionString = process.env.APP_DATABASE_URL ??
  (process.env.NODE_ENV === "production" ? undefined : process.env.DATABASE_URL);
if (!connectionString) {
  throw new Error("APP_DATABASE_URL is required in production and must use a non-owner PostgreSQL login.");
}
const globalForPrisma = globalThis as unknown as { prismaRaw?: PrismaClient };
const rawPrisma = globalForPrisma.prismaRaw ?? new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
});
if (process.env.NODE_ENV !== "production") globalForPrisma.prismaRaw = rawPrisma;

export const prisma = new Proxy(rawPrisma, {
  get(target, property, receiver) {
    if (property === "$transaction") {
      return (callback: unknown, options?: unknown) => {
        if (typeof callback !== "function") {
          // Better Auth uses Prisma array transactions for user/session records that are not tenant-owned.
          // Tenant-scoped application code must run with an explicit request context and use callbacks.
          const current = contextStorage.getStore();
          if (Array.isArray(callback) && !current?.userId && !current?.tenantId) {
            return rawPrisma.$transaction(callback as never, options as never);
          }
          throw new Error("Tenant RLS requires interactive transactions for tenant-scoped operations.");
        }
        return rawPrisma.$transaction(async (tx) => {
          const current = contextStorage.getStore();
          const state: RlsState = { userId: current?.userId, tenantId: current?.tenantId };
          await writeRlsSettings(tx as unknown as AnyRecord, state);
          return (callback as (client: unknown) => Promise<unknown>)(wrapTransactionClient(tx as unknown as AnyRecord, state));
        }, options as never);
      };
    }
    if (typeof property === "string" && modelDelegates.has(property)) {
      const delegate = Reflect.get(target, property, target);
      if (delegate && typeof delegate === "object") {
        return new Proxy(delegate, {
          get(inner, operation, delegateReceiver) {
            const method = Reflect.get(inner, operation, delegateReceiver);
            if (typeof operation !== "string" || typeof method !== "function") return method;
            return async (...args: unknown[]) => rawPrisma.$transaction(async (tx) => {
              const current = contextStorage.getStore();
              const state: RlsState = { userId: current?.userId, tenantId: current?.tenantId };
              await writeRlsSettings(tx as unknown as AnyRecord, state);
              const scoped = wrapTransactionClient(tx as unknown as AnyRecord, state);
              const scopedDelegate = scoped[property] as AnyRecord;
              const scopedMethod = scopedDelegate[operation];
              if (typeof scopedMethod !== "function") {
                throw new Error("Unsupported Prisma model operation: " + operation);
              }
              return Reflect.apply(scopedMethod, scopedDelegate, args);
            });
          }
        });
      }
    }
    const value = Reflect.get(target, property, receiver);
    return typeof value === "function" ? value.bind(target) : value;
  }
}) as PrismaClient;

export function setTenantRlsContext(context: TenantRlsContext) {
  contextStorage.enterWith(context);
}
export function withTenantRlsContext<T>(context: TenantRlsContext, callback: () => Promise<T>): Promise<T> {
  return contextStorage.run(context, callback);
}
