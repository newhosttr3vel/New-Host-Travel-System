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
        reservations: Array<{ id: string }>;
        currencySummaries: Array<{ currency: string; estimates: { sales: string; costs: string } }>;
      };
    };
    assert.deepEqual(ownBody.item.reservations.map((item) => item.id), [visibleReservation.id]);
    assert.ok(!ownBody.item.reservations.some((item) => item.id === hiddenBranchReservation.id));
    assert.deepEqual(ownBody.item.currencySummaries, [{
      currency: "EGP",
      estimates: { sales: "1200.50", costs: "900.25", grossMargin: "300.25" },
      receivables: { invoiced: "0.00", collected: "0.00", outstanding: "0.00" },
      payables: { billed: "0.00", paid: "0.00", outstanding: "0.00" }
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
    if (tenantId) await admin.tenant.delete({ where: { id: tenantId } });
    if (foreignTenantId) await admin.tenant.delete({ where: { id: foreignTenantId } });
    if (userId) await admin.user.deleteMany({ where: { id: userId } });
    await admin.$disconnect();
    await prisma.$disconnect();
  }
});
