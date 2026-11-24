import { prisma } from "@/lib/prisma";
import { activateTenantRequestContext, requireTenantPermission } from "@/lib/api-auth";
import { branchScopeWhere } from "@/lib/branch-access";
import { hasPermission } from "@/lib/permissions";
import { bookingFileViewInclude, serializeBookingFile } from "@/lib/booking-file-view";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const access = await requireTenantPermission(request, "reservations:read");
  if (!access.ok) return access.response;
  activateTenantRequestContext(access);

  const { id } = await context.params;
  if (!id || id.length > 80) {
    return Response.json({ error: "INVALID_BOOKING_FILE_ID" }, { status: 400 });
  }

  const item = await prisma.bookingFile.findFirst({
    where: {
      id,
      tenantId: access.membership.tenantId,
      archivedAt: null,
      ...branchScopeWhere(access.membership)
    },
    include: bookingFileViewInclude
  });

  if (!item) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  const canReadCosts = hasPermission(access.membership.role, "finance:read");
  const canReadTravelDocuments = hasPermission(access.membership.role, "documents:read");
  return Response.json({ item: serializeBookingFile(item, canReadCosts, canReadTravelDocuments) });
}
