/**
 * Envía email y WhatsApp de prueba (programación de tareas).
 * Variables: RESEND_API_KEY, EMAIL_FROM, TWILIO_*, CALLMEBOT_API_KEY
 * Uso: node scripts/send-test-notifications.js
 */
const fs = require("fs");
const path = require("path");

const TEST_EMAIL = "monteromiguel@gmail.com";
const TEST_PHONE = "34620325488";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnvFile(path.join(__dirname, "../secrets/notifications.env"));
loadEnvFile(path.join(__dirname, "../apps/web/.env.local"));

const SUBJECT = "GREFA Tareas — Nueva tarea programada";
const BODY_TEXT = `GREFA Tareas — Hola:

Se ha programado una nueva tarea para ti (aviso de prueba).

• Revisión recinto (Mañana 09:00–12:00)
  Consulta la app GREFA Tareas para ver el detalle.

— GREFA · Majadahonda`;

async function sendEmailResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY no configurada");
  const from = process.env.EMAIL_FROM || "GREFA Tareas <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [TEST_EMAIL],
      subject: SUBJECT,
      text: BODY_TEXT,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Resend HTTP ${res.status}`);
  console.log("Email OK (Resend):", TEST_EMAIL, data.id || "");
}

async function sendEmailFirebase() {
  const mobileEnv = path.join(__dirname, "../apps/mobile/.env");
  if (!fs.existsSync(mobileEnv)) throw new Error("Falta apps/mobile/.env");
  const cfg = {};
  for (const line of fs.readFileSync(mobileEnv, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    cfg[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  const { initializeApp } = await import("firebase/app");
  const { getAuth, sendPasswordResetEmail } = await import("firebase/auth");
  const app = initializeApp({
    apiKey: cfg.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: cfg.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: cfg.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  });
  await sendPasswordResetEmail(getAuth(app), TEST_EMAIL, {
    url: "https://grefa-tareas.web.app/login/",
    handleCodeInApp: false,
  });
  console.log("Email OK (Firebase Auth — plantilla recuperación):", TEST_EMAIL);
}

async function sendEmailSmtp() {
  const nodemailer = require("nodemailer");
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) throw new Error("SMTP no configurado");
  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  });
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || user,
    to: TEST_EMAIL,
    subject: SUBJECT,
    text: BODY_TEXT,
  });
  console.log("Email OK (SMTP):", TEST_EMAIL);
}

async function sendWhatsAppTwilio() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";
  if (!sid || !token) throw new Error("Twilio no configurado");
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const body = new URLSearchParams({
    From: from.startsWith("whatsapp:") ? from : `whatsapp:${from}`,
    To: `whatsapp:+${TEST_PHONE}`,
    Body: BODY_TEXT,
  });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Twilio HTTP ${res.status}`);
  console.log("WhatsApp OK (Twilio):", TEST_PHONE, data.sid || "");
}

async function sendWhatsAppCallMeBot() {
  const apikey = process.env.CALLMEBOT_API_KEY;
  if (!apikey) throw new Error("CALLMEBOT_API_KEY no configurada");
  const url =
    "https://api.callmebot.com/whatsapp.php?" +
    new URLSearchParams({
      phone: `+${TEST_PHONE}`,
      text: BODY_TEXT,
      apikey,
    });
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok || /error/i.test(text)) throw new Error(text || `CallMeBot HTTP ${res.status}`);
  console.log("WhatsApp OK (CallMeBot):", TEST_PHONE);
}

async function main() {
  let emailOk = false;
  let waOk = false;

  for (const fn of [sendEmailResend, sendEmailSmtp, sendEmailFirebase]) {
    try {
      await fn();
      emailOk = true;
      break;
    } catch (e) {
      console.warn("Email:", e.message);
    }
  }

  for (const fn of [sendWhatsAppTwilio, sendWhatsAppCallMeBot]) {
    try {
      await fn();
      waOk = true;
      break;
    } catch (e) {
      console.warn("WhatsApp:", e.message);
    }
  }

  if (!emailOk || !waOk) {
    console.error("\nFaltan credenciales. Crea secrets/notifications.env con:");
    console.error("  RESEND_API_KEY=...  EMAIL_FROM=GREFA <noreply@tudominio.com>");
    console.error("  TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... TWILIO_WHATSAPP_FROM=whatsapp:+...");
    console.error("  (alternativa WhatsApp) CALLMEBOT_API_KEY=...");
    process.exit(emailOk && waOk ? 0 : 1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
