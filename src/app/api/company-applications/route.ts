export async function POST() {
  return Response.json(
    {
      error: "COMPANY_REGISTRATION_DISABLED",
      message: "This installation is reserved for New Host Travel. External company registration is disabled.",
    },
    { status: 410 },
  );
}
