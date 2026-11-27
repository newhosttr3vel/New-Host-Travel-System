import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { auth } from "../src/lib/auth";
import { prisma } from "../src/lib/prisma";
import { createWorkspaceForUser } from "../src/lib/workspace-onboarding";
import { GET as getFinancialSummary } from "../src/app/api/booking-files/[id]/financial-summary/route";

test("booking-file financial summary API enforces finance permission, tenant isolation and branch scope", {
  skip: process.env.RUN_DB_TESTS !== "true" || !process.env.APP_DATABASE_URL
}, async () => {
  const adminUrl = process.env.DATABASE_URL;
  if (!adminUrl) throw new Error("DATABASE_URL is required for booking-file financial-summary API tests.");

  const admin = new PrismaClient({ adapter: new PrismaPg({ connectionString: adminUrl }) });
  const suffix = randomUUID().replaceAll("-", "").slice(0, 14).toLowerCase();
  const email = "booking-finance-api-" + suffix + "@example.test";
  const password = "ValidPassword123!";
  let userId: string | undefined;
  let tenantId: string | undefined;
  let foreignTenantId: string | undefined;

  try {
    const signUp = await auth.handler(new Request("http://localhost:3000/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
      body: JSON.stringify({ name: "Booking Finance API Test", email, password })
    }));
    assert.equal(signUp.status, 200, await signUp.clone().text());
    const signupBody = await signUp.json() as { user?: { id?: string } };
    userId = signupBody.user?.id;
    assert.ok(userId, "Better Auth should create the test user");

    const cookieHeader = signUp.headers.getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    assert.match(cookieHeader, /better-auth\.session_token=/);

    const workspace = await createWorkspaceForUser(prisma, {
      userId,
      companyName: "Booking Finance API Tenant " + suffix,
      defaultCurrency: "EGP",
      defaultLanguage: "en",
      timeZone: "Africa/Cairo"
    });
    assert.ok(workspace);
    tenantId = workspace.tenantId;

    const membership = await admin.tenantMembership.findFirst({
      where: { tenantId, userId },
      select: { id: true }
    });
    assert.ok(membership, "Workspace onboarding should create an owner membership");

    const [branchA, branchB] = await Promise.all([
      admin.branch.create({
        data: { tenantId, name: "Finance API Branch A", slug: "finance-a-" + suffix }
      }),
      admin.branch.create({
        data: { tenantId, name: "Finance API Branch B", slug: "finance-b-" + suffix }
      })
    ]);

    await admin.branchMembership.deleteMany({ where: { tenantId, membershipId: membership.id } });
    await admin.branchMembership.create({
      data: { tenantId, branchId: branchA.id, membershipId: membership.id }
    });
    await admin.tenantMembership.update({
      where: { id: membership.id },
      data: { role: "BRANCH_MANAGER" }
    });

    const customer = await admin.customer.create({
      data: { tenantId, type: "CORPORATE", name: "Finance API B2B Customer" }
    });
    const visibleFile = await admin.bookingFile.create({
      data: {
        tenantId,
        branchId: branchA.id,
        customerId: customer.id,
        reference: "NHT-FIN-A-" + suffix
      }
    });
    const hiddenBranchFile = await admin.bookingFile.create({
      data: {
        tenantId,
        branchId: branchB.id,
        customerId: customer.id,
        reference: "NHT-FIN-B-" + suffix
      }
    });

    const [visibleReservation, hiddenBranchReservation] = await Promise.all([
      admin.reservation.create({
        data: {
          tenantId,
          branchId: branchA.id,
          customerId: customer.id,
          bookingFileId: visibleFile.id,
          reference: "NHT-FIN-SVC-A-" + suffix,
          serviceType: "HOTEL",
          currency: "EGP",
          saleAmount: "1200.50",
          costAmount: "900.25"
        }
      }),
      admin.reservation.create({
        data: {
          tenantId,
          branchId: branchB.id,
          customerId: customer.id,
          bookingFileId: visibleFile.id,
          reference: "NHT-FIN-SVC-B-" + suffix,
          serviceType: "FLIGHT",
          currency: "EGP",
          saleAmount: "5000.00",
          costAmount: "4500.00"
        }
      })
    ]);

    const foreignTenant = await admin.tenant.create({
      data: { name: "Foreign Finance API Tenant " + suffix, slug: "foreign-fin-" + suffix }
    });
    foreignTenantId = foreignTenant.id;
    const foreignCustomer = await admin.customer.create({
      data: { tenantId: foreignTenantId, name: "Foreign Finance Customer" }
    });
    const foreignFile = await admin.bookingFile.create({
      data: {
        tenantId: foreignTenantId,
        customerId: foreignCustomer.id,
        reference: "NHT-FIN-FOREIGN-" + suffix
      }
    });

    // Seed linked financial documents directly so the read API is tested against
    // both valid branch-A records and deliberately mismatched branch-B child rows.
    const cashAccount = await admin.ledgerAccount.create({
      data: {
        tenantId,
        code: "CASH-FIN-API-" + suffix,
        name: "نقدية اختبار",
        nameEn: "Finance API test cash",
        type: "ASSET"
      }
    });
    const revenueAccount = await admin.ledgerAccount.create({
      data: {
        tenantId,
        code: "REV-FIN-API-" + suffix,
        name: "إيرادات اختبار",
        nameEn: "Finance API test revenue",
        type: "REVENUE"
      }
    });
    const supplier = await admin.supplier.create({
      data: {
        tenantId,
        name: "Finance API Test Supplier",
        category: "HOTEL"
      }
    });
    const documentDate = new Date("2026-11-27T12:00:00.000Z");
    const createJournal = (branchId: string, reference: string, sourceType: "INVOICE" | "CUSTOMER_PAYMENT" | "SUPPLIER_BILL" | "SUPPLIER_PAYMENT") =>
      admin.$transaction(async (tx) => {
        const journal = await tx.journalEntry.create({
          data: {
            tenantId: workspace.tenantId,
            branchId,
            reference,
            entryDate: documentDate,
            description: "Financial summary API branch-scope fixture",
            currency: "EGP",
            exchangeRate: "1",
            sourceType
          }
        });
        await tx.journalLine.createMany({
          data: [
            {
              tenantId: workspace.tenantId,
              journalEntryId: journal.id,
              accountId: cashAccount.id,
              debit: "1.00",
              credit: "0.00",
              baseDebit: "1.00",
              baseCredit: "0.00"
            },
            {
              tenantId: workspace.tenantId,
              journalEntryId: journal.id,
              accountId: revenueAccount.id,
              debit: "0.00",
              credit: "1.00",
              baseDebit: "0.00",
              baseCredit: "1.00"
            }
          ]
        });
        return journal;
      });

    const [
      invoiceJournal,
      hiddenInvoiceJournal,
      receiptJournal,
      hiddenReceiptJournal,
      billJournal,
      hiddenBillJournal,
      supplierPaymentJournal,
      hiddenSupplierPaymentJournal
    ] = await Promise.all([
      createJournal(branchA.id, "NHT-FIN-INV-A-" + suffix, "INVOICE"),
      createJournal(branchB.id, "NHT-FIN-INV-B-" + suffix, "INVOICE"),
      createJournal(branchA.id, "NHT-FIN-RCT-A-" + suffix, "CUSTOMER_PAYMENT"),
      createJournal(branchB.id, "NHT-FIN-RCT-B-" + suffix, "CUSTOMER_PAYMENT"),
      createJournal(branchA.id, "NHT-FIN-BILL-A-" + suffix, "SUPPLIER_BILL"),
      createJournal(branchB.id, "NHT-FIN-BILL-B-" + suffix, "SUPPLIER_BILL"),
      createJournal(branchA.id, "NHT-FIN-PAY-A-" + suffix, "SUPPLIER_PAYMENT"),
      createJournal(branchB.id, "NHT-FIN-PAY-B-" + suffix, "SUPPLIER_PAYMENT")
    ]);

    const [visibleInvoice, hiddenBranchInvoice] = await Promise.all([
      admin.invoice.create({
        data: {
          tenantId,
          branchId: branchA.id,
          customerId: customer.id,
          reservationId: visibleReservation.id,
          journalEntryId: invoiceJournal.id,
          reference: "NHT-FIN-INVOICE-A-" + suffix,
          issueDate: documentDate,
          status: "ISSUED",
          currency: "EGP",
          exchangeRate: "1",
          subtotal: "1000.00",
          taxAmount: "0.00",
          total: "1000.00",
          paidAmount: "40.00",
          idempotencyKey: "finance-api-invoice-a-" + suffix,
          requestHash: "finance-api-invoice-a-hash-" + suffix
        }
      }),
      admin.invoice.create({
        data: {
          tenantId,
          branchId: branchB.id,
          customerId: customer.id,
          reservationId: visibleReservation.id,
          journalEntryId: hiddenInvoiceJournal.id,
          reference: "NHT-FIN-INVOICE-B-" + suffix,
          issueDate: documentDate,
          status: "ISSUED",
          currency: "EGP",
          exchangeRate: "1",
          subtotal: "500.00",
          taxAmount: "0.00",
          total: "500.00",
          paidAmount: "0.00",
          idempotencyKey: "finance-api-invoice-b-" + suffix,
          requestHash: "finance-api-invoice-b-hash-" + suffix
        }
      })
    ]);

    const [visibleReceipt, hiddenBranchReceipt] = await Promise.all([
      admin.customerPayment.create({
        data: {
          tenantId,
          branchId: branchA.id,
          invoiceId: visibleInvoice.id,
          accountId: cashAccount.id,
          journalEntryId: receiptJournal.id,
          receiptNumber: "NHT-FIN-RECEIPT-A-" + suffix,
          paymentDate: documentDate,
          method: "CASH",
          amount: "40.00",
          currency: "EGP",
          exchangeRate: "1",
          idempotencyKey: "finance-api-receipt-a-" + suffix,
          requestHash: "finance-api-receipt-a-hash-" + suffix
        }
      }),
      admin.customerPayment.create({
        data: {
          tenantId,
          branchId: branchB.id,
          invoiceId: visibleInvoice.id,
          accountId: cashAccount.id,
          journalEntryId: hiddenReceiptJournal.id,
          receiptNumber: "NHT-FIN-RECEIPT-B-" + suffix,
          paymentDate: documentDate,
          method: "CASH",
          amount: "5.00",
          currency: "EGP",
          exchangeRate: "1",
          idempotencyKey: "finance-api-receipt-b-" + suffix,
          requestHash: "finance-api-receipt-b-hash-" + suffix
        }
      })
    ]);

    const [visibleSupplierBill, hiddenBranchSupplierBill] = await Promise.all([
      admin.supplierBill.create({
        data: {
          tenantId,
          branchId: branchA.id,
          supplierId: supplier.id,
          reservationId: visibleReservation.id,
          journalEntryId: billJournal.id,
          reference: "NHT-FIN-SUPPLIER-BILL-A-" + suffix,
          billDate: documentDate,
          status: "ISSUED",
          currency: "EGP",
          exchangeRate: "1",
          subtotal: "700.00",
          taxAmount: "0.00",
          total: "700.00",
          paidAmount: "100.00",
          idempotencyKey: "finance-api-bill-a-" + suffix,
          requestHash: "finance-api-bill-a-hash-" + suffix
        }
      }),
      admin.supplierBill.create({
        data: {
          tenantId,
          branchId: branchB.id,
          supplierId: supplier.id,
          reservationId: visibleReservation.id,
          journalEntryId: hiddenBillJournal.id,
          reference: "NHT-FIN-SUPPLIER-BILL-B-" + suffix,
          billDate: documentDate,
          status: "ISSUED",
          currency: "EGP",
          exchangeRate: "1",
          subtotal: "300.00",
          taxAmount: "0.00",
          total: "300.00",
          paidAmount: "0.00",
          idempotencyKey: "finance-api-bill-b-" + suffix,
          requestHash: "finance-api-bill-b-hash-" + suffix
        }
      })
    ]);

    const [visibleSupplierPayment, hiddenBranchSupplierPayment] = await Promise.all([
      admin.supplierPayment.create({
        data: {
          tenantId,
          branchId: branchA.id,
          supplierBillId: visibleSupplierBill.id,
          accountId: cashAccount.id,
          journalEntryId: supplierPaymentJournal.id,
          paymentNumber: "NHT-FIN-PAYMENT-A-" + suffix,
          paymentDate: documentDate,
          method: "CASH",
          amount: "100.00",
          currency: "EGP",
          exchangeRate: "1",
          idempotencyKey: "finance-api-supplier-payment-a-" + suffix,
          requestHash: "finance-api-supplier-payment-a-hash-" + suffix
        }
      }),
      admin.supplierPayment.create({
        data: {
          tenantId,
          branchId: branchB.id,
          supplierBillId: visibleSupplierBill.id,
          accountId: cashAccount.id,
          journalEntryId: hiddenSupplierPaymentJournal.id,
          paymentNumber: "NHT-FIN-PAYMENT-B-" + suffix,
          paymentDate: documentDate,
          method: "CASH",
          amount: "10.00",
          currency: "EGP",
          exchangeRate: "1",
          idempotencyKey: "finance-api-supplier-payment-b-" + suffix,
          requestHash: "finance-api-supplier-payment-b-hash-" + suffix
        }
      })
    ]);

    const request = (path: string, includeSession = true) => new Request("http://localhost:3000" + path, {
      headers: {
        ...(includeSession ? { Cookie: cookieHeader } : {}),
        Origin: "http://localhost:3000"
      }
    });
    const context = (id: string) => ({ params: Promise.resolve({ id }) });

    const ownResponse = await getFinancialSummary(
      request("/api/booking-files/" + visibleFile.id + "/financial-summary"),
      context(visibleFile.id)
    );
    assert.equal(ownResponse.status, 200, await ownResponse.clone().text());
    const ownBody = await ownResponse.json() as {
      item: {
        reservations: Array<{
          id: string;
          invoices: Array<{ id: string; payments: Array<{ id: string; number: string | null }> }>;
          supplierBills: Array<{ id: string; payments: Array<{ id: string; number: string | null }> }>;
        }>;
        currencySummaries: Array<{
          currency: string;
          estimates: { sales: string; costs: string; grossMargin: string };
          receivables: { invoiced: string; collected: string; outstanding: string };
          payables: { billed: string; paid: string; outstanding: string };
        }>;
      };
    };
    assert.deepEqual(ownBody.item.reservations.map((item) => item.id), [visibleReservation.id]);
    assert.ok(!ownBody.item.reservations.some((item) => item.id === hiddenBranchReservation.id));

    const visibleReservationSummary = ownBody.item.reservations[0];
    assert.deepEqual(visibleReservationSummary.invoices.map((item) => item.id), [visibleInvoice.id]);
    assert.deepEqual(visibleReservationSummary.invoices[0].payments.map((item) => item.id), [visibleReceipt.id]);
    assert.ok(!visibleReservationSummary.invoices[0].payments.some((item) => item.id === hiddenBranchReceipt.id));

    assert.deepEqual(visibleReservationSummary.supplierBills.map((item) => item.id), [visibleSupplierBill.id]);
    assert.deepEqual(visibleReservationSummary.supplierBills[0].payments.map((item) => item.id), [visibleSupplierPayment.id]);
    assert.ok(!visibleReservationSummary.supplierBills[0].payments.some((item) => item.id === hiddenBranchSupplierPayment.id));
    assert.ok(!visibleReservationSummary.supplierBills.some((item) => item.id === hiddenBranchSupplierBill.id));

    assert.deepEqual(ownBody.item.currencySummaries, [{
      currency: "EGP",
      estimates: { sales: "1200.50", costs: "900.25", grossMargin: "300.25" },
      receivables: { invoiced: "1000.00", collected: "40.00", outstanding: "960.00" },
      payables: { billed: "700.00", paid: "100.00", outstanding: "600.00" }
    }]);

    const hiddenBranchResponse = await getFinancialSummary(
      request("/api/booking-files/" + hiddenBranchFile.id + "/financial-summary"),
      context(hiddenBranchFile.id)
    );
    assert.equal(hiddenBranchResponse.status, 404);

    const foreignResponse = await getFinancialSummary(
      request("/api/booking-files/" + foreignFile.id + "/financial-summary"),
      context(foreignFile.id)
    );
    assert.equal(foreignResponse.status, 404);

    const invalidIdResponse = await getFinancialSummary(request("/api/booking-files/invalid"), context("x".repeat(81)));
    assert.equal(invalidIdResponse.status, 400);

    const unauthenticatedResponse = await getFinancialSummary(
      request("/api/booking-files/" + visibleFile.id + "/financial-summary", false),
      context(visibleFile.id)
    );
    assert.equal(unauthenticatedResponse.status, 401);

    await admin.tenantMembership.update({
      where: { id: membership.id },
      data: { role: "SALES" }
    });
    const forbiddenResponse = await getFinancialSummary(
      request("/api/booking-files/" + visibleFile.id + "/financial-summary"),
      context(visibleFile.id)
    );
    assert.equal(forbiddenResponse.status, 403);
  } finally {
    if (tenantId) {
      // Remove documents before their referenced journals/accounts. Journal lines
      // intentionally restrict account deletion, so deleting the tenant directly
      // would fail while those references are still present.
      await admin.customerPayment.deleteMany({ where: { tenantId } });
      await admin.supplierPayment.deleteMany({ where: { tenantId } });
      await admin.invoice.deleteMany({ where: { tenantId } });
      await admin.supplierBill.deleteMany({ where: { tenantId } });
      await admin.journalEntry.deleteMany({ where: { tenantId } });
      await admin.ledgerAccount.deleteMany({ where: { tenantId } });
      await admin.supplier.deleteMany({ where: { tenantId } });
      await admin.tenant.delete({ where: { id: tenantId } });
    }
    if (foreignTenantId) await admin.tenant.delete({ where: { id: foreignTenantId } });
    if (userId) await admin.user.deleteMany({ where: { id: userId } });
    await admin.$disconnect();
    await prisma.$disconnect();
  }
});
