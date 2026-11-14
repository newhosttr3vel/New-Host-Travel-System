import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { auth } from "../src/lib/auth";
import { prisma, withTenantRlsContext } from "../src/lib/prisma";
import { createWorkspaceForUser } from "../src/lib/workspace-onboarding";
import { GET as listCustomers } from "../src/app/api/customers/route";
import { PATCH as patchCustomer, DELETE as archiveCustomer } from "../src/app/api/customers/[id]/route";
import { GET as listSuppliers } from "../src/app/api/suppliers/route";
import { PATCH as patchSupplier, DELETE as archiveSupplier } from "../src/app/api/suppliers/[id]/route";
import { GET as listReservations } from "../src/app/api/reservations/route";
import { PATCH as patchReservation, DELETE as archiveReservation } from "../src/app/api/reservations/[id]/route";
import { GET as listFinanceAccounts } from "../src/app/api/finance/accounts/route";
import { GET as trialBalance } from "../src/app/api/finance/trial-balance/route";
import { GET as listBranches, POST as createBranch } from "../src/app/api/branches/route";
import { POST as assignBranchMember } from "../src/app/api/branches/[id]/members/route";

test("customer API denies cross-company read, update and archive attempts", {
  skip: process.env.RUN_DB_TESTS !== "true" || !process.env.APP_DATABASE_URL
}, async () => {
  const adminUrl = process.env.DATABASE_URL;
  if (!adminUrl) throw new Error("DATABASE_URL is required for API isolation test setup.");
  const admin = new PrismaClient({ adapter: new PrismaPg({ connectionString: adminUrl }) });
  const suffix = randomUUID().replaceAll("-", "").slice(0, 14).toLowerCase();
  const email = "api-isolation-" + suffix + "@example.test";
  const password = "ValidPassword123!";
  let userId: string | undefined;
  let tenantA: string | undefined;
  let applicationId: string | undefined;
  let tenantB: string | undefined;
  const previousSystemOwnerEmail = process.env.SYSTEM_OWNER_EMAIL;

  try {
    // The integration fixture is the platform owner for this isolated test user.
    // This exercises the real registration guard without weakening production policy.
    process.env.SYSTEM_OWNER_EMAIL = email;
    const signUp = await auth.handler(new Request("http://localhost:3000/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
      body: JSON.stringify({ name: "API Isolation Test", email, password })
    }));
    assert.equal(signUp.status, 200, await signUp.clone().text());
    const signupBody = await signUp.json() as { user?: { id?: string } };
    userId = signupBody.user?.id;
    assert.ok(userId, "Better Auth should create the test user");

    const application = await admin.platformCompanyApplication.create({
      data: {
        userId,
        companyName: "API Isolation Tenant A",
        country: "Egypt",
        city: "Cairo",
        phone: "+201000000000",
      },
    });
    applicationId = application.id;

    const cookies = signUp.headers.getSetCookie();
    const cookieHeader = cookies.map((value) => value.split(";")[0]).join("; ");
    assert.match(cookieHeader, /better-auth\.session_token=/);

    const workspace = await createWorkspaceForUser(prisma, {
      userId,
      companyName: "API Isolation Tenant A",
      defaultCurrency: "EGP",
      defaultLanguage: "ar",
      timeZone: "Africa/Cairo",
      applicationId,
      reviewedById: userId
    });
    assert.ok(workspace);
    tenantA = workspace.tenantId;

    const tenantBRecord = await admin.tenant.create({
      data: { name: "API Isolation Tenant B", slug: "api-b-" + suffix }
    });
    tenantB = tenantBRecord.id;
    const ownCustomer = await withTenantRlsContext({ userId, tenantId: tenantA }, () =>
      prisma.customer.create({ data: { tenantId: tenantA!, name: "Own tenant customer" } })
    );
    const foreignCustomer = await admin.customer.create({
      data: { tenantId: tenantB, name: "Foreign tenant customer" }
    });
    const foreignSupplier = await admin.supplier.create({
      data: { tenantId: tenantB, name: "Foreign tenant supplier", category: "OTHER" }
    });
    const foreignReservation = await admin.reservation.create({
      data: {
        tenantId: tenantB,
        customerId: foreignCustomer.id,
        reference: "FOREIGN-" + suffix,
        serviceType: "OTHER"
      }
    });
    const foreignAccount = await admin.ledgerAccount.create({
      data: {
        tenantId: tenantB,
        code: "TEST-" + suffix.slice(0, 8),
        name: "Foreign asset",
        nameEn: "Foreign asset",
        type: "ASSET"
      }
    });

    const request = (path: string, method = "GET", body?: unknown) => new Request("http://localhost:3000" + path, {
      method,
      headers: {
        Cookie: cookieHeader,
        Origin: "http://localhost:3000",
        ...(body === undefined ? {} : { "Content-Type": "application/json" })
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });

    const branchesResponse = await listBranches(request("/api/branches"));
    assert.equal(branchesResponse.status, 200);
    const branchBody = await branchesResponse.json() as {
      items: Array<{ id: string; slug: string }>;
      memberships: Array<{ id: string; role: string }>;
    };
    const mainBranch = branchBody.items.find((item) => item.slug === "main");
    const ownerMembership = branchBody.memberships.find((item) => item.role === "OWNER");
    assert.ok(mainBranch, "onboarding should provision a main branch");
    assert.ok(ownerMembership, "branch directory should include the owner's membership");

    const newBranchResponse = await createBranch(request("/api/branches", "POST", { name: "Integration Test Branch" }));
    assert.equal(newBranchResponse.status, 201, await newBranchResponse.clone().text());
    const newBranchBody = await newBranchResponse.json() as { item: { id: string } };
    const assignmentResponse = await assignBranchMember(
      request("/api/branches/" + newBranchBody.item.id + "/members", "POST", { membershipId: ownerMembership.id }),
      { params: Promise.resolve({ id: newBranchBody.item.id }) }
    );
    assert.equal(assignmentResponse.status, 201, await assignmentResponse.clone().text());

    const listResponse = await listCustomers(request("/api/customers"));
    assert.equal(listResponse.status, 200);
    const listBody = await listResponse.json() as { items: Array<{ id: string }> };
    assert.ok(listBody.items.some((item) => item.id === ownCustomer.id));
    assert.ok(!listBody.items.some((item) => item.id === foreignCustomer.id));

    const supplierList = await listSuppliers(request("/api/suppliers"));
    assert.equal(supplierList.status, 200);
    const supplierListBody = await supplierList.json() as { items: Array<{ id: string }> };
    assert.ok(!supplierListBody.items.some((item) => item.id === foreignSupplier.id));

    const reservationList = await listReservations(request("/api/reservations"));
    assert.equal(reservationList.status, 200);
    const reservationListBody = await reservationList.json() as { items: Array<{ id: string }> };
    assert.ok(!reservationListBody.items.some((item) => item.id === foreignReservation.id));

    const financeList = await listFinanceAccounts(request("/api/finance/accounts"));
    assert.equal(financeList.status, 200);
    const financeListBody = await financeList.json() as { items: Array<{ id: string }> };
    assert.ok(!financeListBody.items.some((item) => item.id === foreignAccount.id));

    const balanceResponse = await trialBalance(request("/api/finance/trial-balance"));
    assert.equal(balanceResponse.status, 200);
    const balanceBody = await balanceResponse.json() as { items: Array<{ id: string }> };
    assert.ok(!balanceBody.items.some((item) => item.id === foreignAccount.id));

    const customerContext = { params: Promise.resolve({ id: foreignCustomer.id }) };
    assert.equal((await patchCustomer(
      request("/api/customers/" + foreignCustomer.id, "PATCH", { name: "Attempted foreign update" }),
      customerContext
    )).status, 404);
    assert.equal((await archiveCustomer(
      request("/api/customers/" + foreignCustomer.id, "DELETE"),
      customerContext
    )).status, 404);

    const supplierContext = { params: Promise.resolve({ id: foreignSupplier.id }) };
    assert.equal((await patchSupplier(
      request("/api/suppliers/" + foreignSupplier.id, "PATCH", { name: "Attempted foreign supplier update" }),
      supplierContext
    )).status, 404);
    assert.equal((await archiveSupplier(
      request("/api/suppliers/" + foreignSupplier.id, "DELETE"),
      supplierContext
    )).status, 404);

    const reservationContext = { params: Promise.resolve({ id: foreignReservation.id }) };
    assert.equal((await patchReservation(
      request("/api/reservations/" + foreignReservation.id, "PATCH", { notes: "Attempted foreign reservation update" }),
      reservationContext
    )).status, 404);
    assert.equal((await archiveReservation(
      request("/api/reservations/" + foreignReservation.id, "DELETE"),
      reservationContext
    )).status, 404);

    const afterAttempt = await admin.customer.findUnique({ where: { id: foreignCustomer.id } });
    assert.equal(afterAttempt?.name, "Foreign tenant customer");
    assert.equal(afterAttempt?.archivedAt, null);
    const supplierAfterAttempt = await admin.supplier.findUnique({ where: { id: foreignSupplier.id } });
    assert.equal(supplierAfterAttempt?.name, "Foreign tenant supplier");
    assert.equal(supplierAfterAttempt?.archivedAt, null);
    const reservationAfterAttempt = await admin.reservation.findUnique({ where: { id: foreignReservation.id } });
    assert.equal(reservationAfterAttempt?.notes, null);
    assert.equal(reservationAfterAttempt?.archivedAt, null);
  } finally {
    if (tenantA) await admin.tenant.delete({ where: { id: tenantA } });
    if (tenantB) await admin.tenant.delete({ where: { id: tenantB } });
    if (userId) await admin.user.deleteMany({ where: { id: userId } });
    if (previousSystemOwnerEmail === undefined) delete process.env.SYSTEM_OWNER_EMAIL;
    else process.env.SYSTEM_OWNER_EMAIL = previousSystemOwnerEmail;
    await admin.$disconnect();
    await prisma.$disconnect();
  }
});
