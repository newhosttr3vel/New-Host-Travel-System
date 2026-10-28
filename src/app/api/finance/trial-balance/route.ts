import { prisma } from "@/lib/prisma";
import { requireTenantPermission } from "@/lib/api-auth";

function toCents(value: string): bigint {
  if (!/^\\d+(?:\\.\\d{1,2})?$/.test(value)) {
    throw new Error("Unexpected decimal aggregate from PostgreSQL.");
  }
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}

function amount(cents: bigint): string {
  const absolute = cents < 0n ? -cents : cents;
  return (cents < 0n ? "-" : "") + (absolute / 100n).toString() + "." + (absolute % 100n).toString().padStart(2, "0");
}

export async function GET(request: Request) {
  const access = await requireTenantPermission(request, "finance:read");
  if (!access.ok) return access.response;

  const tenantId = access.membership.tenantId;
  const [accounts, sums] = await Promise.all([
    prisma.ledgerAccount.findMany({
      where: { tenantId },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, nameEn: true, type: true, isActive: true }
    }),
    prisma.journalLine.groupBy({
      by: ["accountId"],
      where: { tenantId },
      _sum: { baseDebit: true, baseCredit: true }
    })
  ]);
  const totals = new Map(sums.map((item) => [
    item.accountId,
    {
      debit: toCents(item._sum.baseDebit?.toString() ?? "0"),
      credit: toCents(item._sum.baseCredit?.toString() ?? "0")
    }
  ]));

  let totalDebit = 0n;
  let totalCredit = 0n;
  const items = accounts.map((account) => {
    const accountTotals = totals.get(account.id) ?? { debit: 0n, credit: 0n };
    totalDebit += accountTotals.debit;
    totalCredit += accountTotals.credit;
    const isDebitNormal = account.type === "ASSET" || account.type === "EXPENSE";
    const signedBalance = isDebitNormal
      ? accountTotals.debit - accountTotals.credit
      : accountTotals.credit - accountTotals.debit;
    const balanceSide = signedBalance === 0n ? "ZERO" as const : signedBalance > 0n ? (isDebitNormal ? "DEBIT" as const : "CREDIT" as const) : (isDebitNormal ? "CREDIT" as const : "DEBIT" as const);
    const balanceMagnitude = signedBalance < 0n ? -signedBalance : signedBalance;

    return {
      ...account,
      totalDebit: amount(accountTotals.debit),
      totalCredit: amount(accountTotals.credit),
      balanceAmount: amount(balanceMagnitude),
      balanceSide
    };
  });

  return Response.json({
    baseCurrency: access.membership.tenant.defaultCurrency,
    items,
    summary: {
      totalDebit: amount(totalDebit),
      totalCredit: amount(totalCredit),
      balanced: totalDebit === totalCredit,
      accountCount: accounts.length
    }
  });
}
