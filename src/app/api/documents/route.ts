import { randomUUID, createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireTenantPermission } from "@/lib/api-auth";
import { branchScopeWhere, canAccessBranch } from "@/lib/branch-access";
import { deletePrivateDocument, isPrivateDocumentStorageConfigured, putPrivateDocument } from "@/lib/document-storage";
import { detectAllowedDocumentMime, MAX_DOCUMENT_BYTES, safeOriginalDocumentName } from "@/lib/document-validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await requireTenantPermission(request, "reservations:read");
  if (!access.ok) return access.response;
  const reservationId = new URL(request.url).searchParams.get("reservationId");
  const items = await prisma.document.findMany({
    where: {
      tenantId: access.membership.tenantId,
      ...branchScopeWhere(access.membership),
      ...(reservationId ? { reservationId } : {})
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, reservationId: true, branchId: true, originalName: true, mimeType: true, size: true, createdAt: true }
  });
  return Response.json({ items });
}

export async function POST(request: Request) {
  const access = await requireTenantPermission(request, "reservations:write");
  if (!access.ok) return access.response;
  if (!isPrivateDocumentStorageConfigured()) {
    return Response.json({ error: "DOCUMENT_STORAGE_NOT_CONFIGURED" }, { status: 503 });
  }

  let form: FormData;
  try { form = await request.formData(); }
  catch { return Response.json({ error: "INVALID_MULTIPART_FORM" }, { status: 400 }); }
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "FILE_REQUIRED" }, { status: 400 });
  if (file.size < 1 || file.size > MAX_DOCUMENT_BYTES) {
    return Response.json({ error: "FILE_SIZE_LIMIT", maxBytes: MAX_DOCUMENT_BYTES }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = detectAllowedDocumentMime(buffer, file.type);
  if (!mimeType) {
    return Response.json({ error: "UNSUPPORTED_FILE_CONTENT", allowed: ["application/pdf", "image/jpeg", "image/png"] }, { status: 415 });
  }
  const originalName = safeOriginalDocumentName(file.name);
  const formReservationId = form.get("reservationId");
  const reservationId = typeof formReservationId === "string" && formReservationId.trim() ? formReservationId.trim() : null;
  const formBranchId = form.get("branchId");
  const requestedBranchId = typeof formBranchId === "string" && formBranchId.trim() ? formBranchId.trim() : undefined;

  let branchId: string | null = null;
  if (reservationId) {
    const reservation = await prisma.reservation.findFirst({
      where: {
        id: reservationId,
        tenantId: access.membership.tenantId,
        archivedAt: null,
        ...branchScopeWhere(access.membership)
      },
      select: { id: true, branchId: true }
    });
    if (!reservation) return Response.json({ error: "RESERVATION_NOT_FOUND" }, { status: 404 });
    branchId = reservation.branchId;
  } else {
    const assigned = access.membership.branchAssignments.map((item) => item.branchId);
    const selectedId = requestedBranchId ??
      (access.membership.role === "OWNER" || access.membership.role === "ADMINISTRATOR" ? undefined : assigned[0]);
    const branch = selectedId
      ? await prisma.branch.findFirst({ where: { id: selectedId, tenantId: access.membership.tenantId, isActive: true }, select: { id: true } })
      : await prisma.branch.findFirst({ where: { tenantId: access.membership.tenantId, slug: "main", isActive: true }, select: { id: true } });
    if (!branch) return Response.json({ error: "BRANCH_NOT_FOUND" }, { status: 404 });
    if (!canAccessBranch(access.membership, branch.id)) return Response.json({ error: "BRANCH_NOT_ASSIGNED" }, { status: 403 });
    branchId = branch.id;
  }

  const objectKey = access.membership.tenantId + "/" + randomUUID();
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  try {
    await putPrivateDocument({ key: objectKey, body: buffer, contentType: mimeType });
  } catch {
    return Response.json({ error: "DOCUMENT_STORAGE_UNAVAILABLE" }, { status: 503 });
  }

  try {
    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.document.create({
        data: {
          tenantId: access.membership.tenantId,
          branchId,
          reservationId,
          uploadedById: access.session.user.id,
          objectKey,
          originalName,
          mimeType,
          size: buffer.length,
          sha256
        },
        select: { id: true, reservationId: true, branchId: true, originalName: true, mimeType: true, size: true, createdAt: true }
      });
      await tx.auditEvent.create({
        data: {
          tenantId: access.membership.tenantId,
          userId: access.session.user.id,
          action: "TRAVEL_DOCUMENT_UPLOADED",
          entityType: "Document",
          entityId: created.id,
          metadata: { reservationId, branchId, mimeType, size: buffer.length, sha256 }
        }
      });
      return created;
    });
    return Response.json({ item }, { status: 201 });
  } catch (error) {
    await deletePrivateDocument(objectKey).catch(() => undefined);
    throw error;
  }
}
