export async function sendEmail(params: {
  to: string;
  subject: string;
  text: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();

  if (!apiKey || !from) {
    console.warn("[resendClient] Brak RESEND_API_KEY lub RESEND_FROM_EMAIL — e-mail nie zostanie wysłany.");
    return { sent: false, reason: "missing_config" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [params.to], subject: params.subject, text: params.text }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[resendClient] Błąd Resend:", res.status, err);
    return { sent: false, reason: `resend_error_${res.status}` };
  }

  console.info("[resendClient] E-mail wysłany do:", params.to);
  return { sent: true };
}
