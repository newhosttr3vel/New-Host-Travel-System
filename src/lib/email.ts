type AuthEmailKind = "verify";

export async function sendAuthEmail(to: string, _kind: AuthEmailKind, url: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_EMAIL_FROM;
  if (!apiKey || !from) {
    throw new Error("Transactional email is not configured. Set RESEND_API_KEY and AUTH_EMAIL_FROM.");
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Verify your New Host Travel account",
      text: "Welcome to New Host Travel. Verify your email address using this secure link:\n\n" + url + "\n\nThis link expires in 60 minutes. If you did not create this account, ignore this message."
    })
  });
  if (!response.ok) {
    throw new Error("Transactional email delivery failed with status " + response.status + ".");
  }
}
