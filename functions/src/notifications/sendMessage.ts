import { logger } from "firebase-functions";

export async function sendEmail(params: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "GREFA Tareas <onboarding@resend.dev>";
  if (!key) throw new Error("RESEND_API_KEY no configurada");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: params.subject,
      text: params.text,
      html: params.html,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { message?: string; id?: string };
  if (!res.ok) throw new Error(data.message || `Resend ${res.status}`);
  logger.info("Email enviado", params.to, data.id);
}

export async function sendWhatsApp(params: { toPhoneE164: string; body: string }): Promise<void> {
  if (process.env.WHATSAPP_ENABLED !== "true") {
    logger.info("WhatsApp desactivado (WHATSAPP_ENABLED != true)");
    return;
  }
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";
  if (!sid || !token) throw new Error("Twilio no configurado");
  const phone = params.toPhoneE164.startsWith("+") ? params.toPhoneE164 : `+${params.toPhoneE164}`;
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const body = new URLSearchParams({
    From: from.startsWith("whatsapp:") ? from : `whatsapp:${from}`,
    To: `whatsapp:${phone}`,
    Body: params.body,
  });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = (await res.json().catch(() => ({}))) as { message?: string; sid?: string };
  if (!res.ok) throw new Error(data.message || `Twilio ${res.status}`);
  logger.info("WhatsApp enviado", phone, data.sid);
}
