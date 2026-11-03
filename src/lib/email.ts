type AuthEmailKind = "verify" | "reset";

function emailCopy(kind: AuthEmailKind, url: string) {
  if (kind === "verify") {
    return {
      subject: "Verify your New Host Travel account",
      text: "Welcome to New Host Travel. Verify your email address using this secure link:\n\n" + url + "\n\nThis link expires in 60 minutes. If you did not create this account, ignore this message."
    };
  }
  return {
    subject: "Reset your New Host Travel password",
    text: "A password reset was requested for your New Host Travel account. Use this one-time link to choose a new password:\n\n" + url + "\n\nThis link expires in 60 minutes. If you did not request a reset, ignore this message."
  };
}

export async function sendAuthEmail(to: string, kind: AuthEmailKind, url: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_EMAIL_FROM;
  if (!apiKey || !from) {
    throw new Error("Transactional email is not configured. Set RESEND_API_KEY and AUTH_EMAIL_FROM.");
  }
  const copy = emailCopy(kind, url);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ from, to: [to], subject: copy.subject, text: copy.text })
  });
  if (!response.ok) {
    const status = response.status;
    throw new Error("Transactional email delivery failed with status " + status + ".");
  }
}
