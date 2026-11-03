import { prisma } from "@/lib/prisma";
import { requireTenantPermission } from "@/lib/api-auth";
import { branchScopeWhere } from "@/lib/branch-access";
import { signPrivateDocumentDownload, isPrivateDocumentStorageConfigured } from "@/lib/document-storage";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const access = await requireTenantPermission(request, "reservations:read");
  if (!access.ok) return access.response;
  if (!isPrivateDocumentStorageConfigured()) {
    return Response.json({ error: "DOCUMENT_STORAGE_NOT_CONFIGURED" }, { status: 503 });
  }
  const { id } = await context.params;
  const item = await prisma.document.findFirst({
    where: { id, tenantId: access.membership.tenantId, ...branchScopeWhere(access.membership) },
    select: { id: true, objectKey: true, originalName: true }
  });
  if (!item) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  try {
    const url = await signPrivateDocumentDownload(item.objectKey);
    return Response.json({ url, fileName: item.originalName, expiresInSeconds: 60 });
  } catch {
    return Response.json({ error: "DOCUMENT_STORAGE_UNAVAILABLE" }, { status: 503 });
  }
}
