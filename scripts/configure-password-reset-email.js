/**
 * Configura asunto y cuerpo del email de restablecimiento de contraseña Firebase Auth.
 * Uso: node scripts/configure-password-reset-email.js
 */
const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");
const https = require("https");

const PROJECT_ID = "grefa-tareas";
const SUBJECT = "Ha solicitado cambiar su contraseña de acceso en el gestor de tareas.";
const BODY = `Hola,

Ha solicitado restablecer la contraseña de acceso al gestor de tareas GREFA.

Use este enlace para elegir una contraseña nueva:
%LINK%

Si no ha sido usted, ignore este correo.

GREFA · Majadahonda`;

const saPath = path.join(__dirname, "..", "secrets", "serviceAccount.json");
if (!fs.existsSync(saPath)) {
  console.error("Falta secrets/serviceAccount.json");
  process.exit(1);
}

const sa = require(saPath);

function b64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signJwt() {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      iss: sa.client_email,
      sub: sa.client_email,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
      scope: "https://www.googleapis.com/auth/cloud-platform",
    })
  );
  const crypto = require("crypto");
  const unsigned = `${header}.${payload}`;
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(unsigned);
  sign.end();
  const signature = b64url(sign.sign(sa.private_key));
  return `${unsigned}.${signature}`;
}

function postForm(url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(body) },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode, data }));
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function patchConfig(token, updateMask, configBody) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(configBody);
    const pathStr = `/admin/v2/projects/${PROJECT_ID}/config?updateMask=${encodeURIComponent(updateMask)}`;
    const req = https.request(
      {
        hostname: "identitytoolkit.googleapis.com",
        path: pathStr,
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode, data }));
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  const jwt = signJwt();
  const tokenRes = await postForm(
    "https://oauth2.googleapis.com/token",
    `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  );
  const tokenJson = JSON.parse(tokenRes.data);
  if (!tokenJson.access_token) {
    console.error("No access_token:", tokenRes.data);
    process.exit(1);
  }
  const token = tokenJson.access_token;

  const configBody = {
    notification: {
      sendEmail: {
        resetPasswordTemplate: {
          subject: SUBJECT,
          body: BODY,
          senderDisplayName: "GREFA Tareas",
        },
        legacyResetPasswordTemplate: {
          subject: SUBJECT,
          body: BODY,
          senderDisplayName: "GREFA Tareas",
        },
      },
    },
  };

  const mask =
    "notification.sendEmail.resetPasswordTemplate.subject," +
    "notification.sendEmail.resetPasswordTemplate.body," +
    "notification.sendEmail.resetPasswordTemplate.senderDisplayName," +
    "notification.sendEmail.legacyResetPasswordTemplate.subject," +
    "notification.sendEmail.legacyResetPasswordTemplate.body," +
    "notification.sendEmail.legacyResetPasswordTemplate.senderDisplayName";

  const res = await patchConfig(token, mask, configBody);
  console.log("HTTP", res.status);
  console.log(res.data.slice(0, 800));
  if (res.status >= 200 && res.status < 300) {
    console.log("\nOK — Asunto configurado:", SUBJECT);
    process.exit(0);
  }
  console.error("\nError al configurar plantilla. Configura manualmente en Firebase Console → Authentication → Templates.");
  process.exit(1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
