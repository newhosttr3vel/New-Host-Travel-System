import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import {
  createWorkspaceForUser,
  CompanyApplicationReviewConflict,
} from "@/lib/workspace-onboarding";

export async function GET(request: Request) {
  if (!await requirePlatformAdmin(request.headers)) {
    return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const applications = await prisma.platformCompanyApplication.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    include: {
      user: {
        select: { id: true, name: true, email: true, emailVerified: true },
      },
    },
  });

  return Response.json({ applications });
}

const schema = z.object({
  applicationId: z.string().min(1),
  decision: z.enum(["approve", "reject"]),
  rejectionReason: z.string().trim().max(1000).optional(),
});

export async function POST(request: Request) {
  const admin = await requirePlatformAdmin(request.headers);
  if (!admin) {
    return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "VALIDATION_ERROR" }, { status: 400 });
  }

  if (
    parsed.data.decision === "reject" &&
    !parsed.data.rejectionReason?.trim()
  ) {
    return Response.json(
      { error: "REJECTION_REASON_REQUIRED" },
      { status: 400 }
    );
  }

  const application = await prisma.platformCompanyApplication.findUnique({
    where: { id: parsed.data.applicationId },
    include: { user: { select: { emailVerified: true } } },
  });

  if (!application) {
    return Response.json({ error: "APPLICATION_NOT_FOUND" }, { status: 404 });
  }

  if (application.status !== "PENDING") {
    return Response.json(
      { error: "APPLICATION_ALREADY_REVIEWED" },
      { status: 409 }
    );
  }

  if (parsed.data.decision === "reject") {
    // Conditional update makes rejection safe against simultaneous reviews.
    const updated = await prisma.platformCompanyApplication.updateMany({
      where: { id: application.id, status: "PENDING" },
      data: {
        status: "REJECTED",
        rejectionReason: parsed.data.rejectionReason!.trim(),
        reviewedById: admin.user.id,
        reviewedAt: new Date(),
      },
    });

    if (updated.count !== 1) {
      return Response.json(
        { error: "APPLICATION_ALREADY_REVIEWED" },
        { status: 409 }
      );
    }

    return Response.json({
      ok: true,
      application: { id: application.id, status: "REJECTED" },
    });
  }

  // Enforce email verification on the server, not only in the admin UI.
  if (!application.user.emailVerified) {
    return Response.json({ error: "EMAIL_NOT_VERIFIED" }, { status: 409 });
  }

  try {
    const workspace = await createWorkspaceForUser(prisma, {
      userId: application.userId,
      companyName: application.companyName,
      defaultCurrency: application.defaultCurrency as "EGP" | "SAR" | "USD",
      defaultLanguage: application.defaultLanguage as "ar" | "en",
      timeZone: "Africa/Cairo",
      applicationId: application.id,
      reviewedById: admin.user.id,
    });

    if (!workspace) {
      return Response.json(
        { error: "USER_ALREADY_HAS_COMPANY" },
        { status: 409 }
      );
    }

    return Response.json({
      ok: true,
      application: { id: application.id, status: "APPROVED" },
      tenantId: workspace.tenantId,
    });
  } catch (error) {
    if (error instanceof CompanyApplicationReviewConflict) {
      return Response.json(
        { error: "APPLICATION_ALREADY_REVIEWED" },
        { status: 409 }
      );
    }
    throw error;
  }
}
