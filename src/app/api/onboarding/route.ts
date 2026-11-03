import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createWorkspaceForUser } from "@/lib/workspace-onboarding";

const onboardingSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  defaultCurrency: z.enum(["EGP", "SAR", "USD"]),
  defaultLanguage: z.enum(["ar", "en"]).default("ar"),
  timeZone: z.string().trim().min(3).max(80).default("Africa/Cairo")
});


export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "INVALID_JSON" }, { status: 400 }); }
  const parsed = onboardingSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 });

  const data = parsed.data;
  const workspace = await createWorkspaceForUser(prisma, {
    userId: session.user.id,
    companyName: data.companyName,
    defaultCurrency: data.defaultCurrency,
    defaultLanguage: data.defaultLanguage,
    timeZone: data.timeZone,
  });
  if (!workspace) return Response.json({ error: "WORKSPACE_ALREADY_EXISTS" }, { status: 409 });

  return Response.json({ ok: true, tenantId: workspace.tenantId }, { status: 201 });
}
