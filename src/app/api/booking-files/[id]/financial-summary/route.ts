import { prisma } from "@/lib/prisma";
import { activateTenantRequestContext, requireTenantPermission } from "@/lib/api-auth";
import { branchScopeWhere } from "@/lib/branch-access";
import { summarizeBookingFileFinancials } from "@/lib/booking-file-financial-summary";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const access = await requireTenantPermission(request, "finance:read");
  if (!access.ok) return access.response;
  activateTenantRequestContext(access);

  const { id } = await context.params;
  if (!id || id.length > 80) {
    return Response.json({ error: "INVALID_BOOKING_FILE_ID" }, { status: 400 });
  }

  const tenantId = access.membership.tenantId;
  const branchScope = branchScopeWhere(access.membership);
  const item = await prisma.bookingFile.findFirst({
    where: {
      id,
      tenantId,
      archivedAt: null,
      ...branchScope
    },
    select: {
      id: true,
      reference: true,
      createdAt: true,
      customer: {
        select: { id: true, name: true, companyName: true }
      },
      reservations: {
        where: { tenantId, ...branchScope },
        orderBy: [{ createdAt: "asc" }, { reference: "asc" }],
        select: {
          id: true,
          reference: true,
          serviceType: true,
          status: true,
          currency: true,
          saleAmount: true,
          costAmount: true,
          archivedAt: true,
          invoices: {
            where: { tenantId, ...branchScope },
            orderBy: [{ issueDate: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              reference: true,
              status: true,
              currency: true,
              issueDate: true,
              dueDate: true,
              total: true,
              paidAmount: true,
              payments: {
                where: { tenantId, ...branchScope },
                orderBy: [{ paymentDate: "asc" }, { createdAt: "asc" }],
                select: {
                  id: true,
                  receiptNumber: true,
                  paymentDate: true,
                  method: true,
                  amount: true,
                  currency: true,
                  reference: true,
                  journalEntry: { select: { reference: true } }
                }
              }
            }
          },
          supplierBills: {
            where: { tenantId, ...branchScope },
            orderBy: [{ billDate: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              reference: true,
              status: true,
              currency: true,
              billDate: true,
              dueDate: true,
              total: true,
              paidAmount: true,
              supplier: {
                select: { id: true, name: true }
              },
              payments: {
                where: { tenantId, ...branchScope },
                orderBy: [{ paymentDate: "asc" }, { createdAt: "asc" }],
                select: {
                  id: true,
                  paymentNumber: true,
                  paymentDate: true,
                  method: true,
                  amount: true,
                  currency: true,
                  reference: true,
                  journalEntry: { select: { reference: true } }
                }
              }
            }
          }
        }
      }
    }
  });

  if (!item) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  return Response.json({ item: summarizeBookingFileFinancials(item) });
}
