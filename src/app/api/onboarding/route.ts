export async function POST() {
  return Response.json(
    { error: "COMPANY_APPROVAL_REQUIRED", message: "Company workspaces are created only after platform approval." },
    { status: 410 },
  );
}
