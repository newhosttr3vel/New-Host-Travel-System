import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { createWorkspaceForUser } from "@/lib/workspace-onboarding";

export async function GET(request: Request) {
  if (!await requirePlatformAdmin(request.headers)) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const applications = await prisma.platformCompanyApplication.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    include: { user: { select: { id: true, name: true, email: true, emailVerified: true } } },
  });
  return Response.json({ applications });
}

const schema = z.object({ applicationId: z.string().min(1), decision: z.enum(["approve", "reject"]), rejectionReason: z.string().trim().max(1000).optional() });
export async function POST(request: Request) {
  const admin = await requirePlatformAdmin(request.headers);
  if (!admin) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "INVALID_JSON" }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "VALIDATION_ERROR" }, { status: 400 });
  const application = await prisma.platformCompanyApplication.findUnique({ where: { id: parsed.data.applicationId } });
  if (!application) return Response.json({ error: "APPLICATION_NOT_FOUND" }, { status: 404 });
  if (application.status !== "PENDING") return Response.json({ error: "APPLICATION_ALREADY_REVIEWED" }, { status: 409 });

  if (parsed.data.decision === "reject") {
    const updated = await prisma.platformCompanyApplication.update({
      where: { id: application.id },
      data: { status: "REJECTED", rejectionReason: parsed.data.rejectionReason?.trim() || "لم تستوفِ البيانات متطلبات التسجيل.", reviewedById: admin.user.id, reviewedAt: new Date() },
      select: { id: true, status: true },
    });
    return Response.json({ ok: true, application: updated });
  }

  const workspace = await createWorkspaceForUser(prisma, {
    userId: application.userId,
    companyName: application.companyName,
    defaultCurrency: application.defaultCurrency as "EGP" | "SAR" | "USD",
    defaultLanguage: application.defaultLanguage as "ar" | "en",
    timeZone: "Africa/Cairo",
  });
  if (!workspace) return Response.json({ error: "USER_ALREADY_HAS_COMPANY" }, { status: 409 });
  const updated = await prisma.platformCompanyApplication.update({
    where: { id: application.id },
    data: { status: "APPROVED", rejectionReason: null, reviewedById: admin.user.id, reviewedAt: new Date() },
    select: { id: true, status: true },
  });
  return Response.json({ ok: true, application: updated, tenantId: workspace.tenantId });
}
