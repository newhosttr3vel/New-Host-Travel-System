import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma, setTenantRlsContext } from "@/lib/prisma";

const schema = z.object({
  companyName: z.string().trim().min(2).max(120),
  legalName: z.string().trim().max(160).optional().or(z.literal("")),
  country: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(7).max(30),
  defaultCurrency: z.enum(["EGP", "SAR", "USD"]),
  defaultLanguage: z.enum(["ar", "en"]),
});

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "INVALID_JSON" }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 });

  setTenantRlsContext({ userId: session.user.id });
  const membership = await prisma.tenantMembership.findFirst({ where: { userId: session.user.id }, select: { id: true } });
  if (membership) return Response.json({ error: "COMPANY_ALREADY_ACTIVE" }, { status: 409 });
  const existing = await prisma.platformCompanyApplication.findUnique({ where: { userId: session.user.id } });
  if (existing?.status === "PENDING" || existing?.status === "APPROVED") return Response.json({ error: "APPLICATION_ALREADY_SUBMITTED" }, { status: 409 });

  const data = { ...parsed.data, legalName: parsed.data.legalName || null, status: "PENDING" as const };
  const application = existing
    ? await prisma.platformCompanyApplication.update({ where: { id: existing.id }, data: { ...data, rejectionReason: null, reviewedAt: null, reviewedById: null } })
    : await prisma.platformCompanyApplication.create({ data: { userId: session.user.id, ...data } });
  return Response.json({ ok: true, application: { id: application.id, status: application.status } }, { status: 201 });
}
