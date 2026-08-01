/**
 * Lista dominios autorizados de Firebase Auth.
 * Uso: node scripts/list-auth-domains.js
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const PROJECT_ID = "grefa-tareas";
const saPath = path.join(__dirname, "..", "secrets", "serviceAccount.json");
const sa = require(saPath);

function b64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function getAccessToken() {
  return new Promise((resolve, reject) => {
    const now = Math.floor(Date.now() / 1000);
    const unsigned =
      b64url(JSON.stringify({ alg: "RS256", typ: "JWT" })) +
      "." +
      b64url(
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
    const sign = crypto.createSign("RSA-SHA256");
    sign.update(unsigned);
    sign.end();
    const jwt = unsigned + "." + b64url(sign.sign(sa.private_key));
    const body = `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`;
    const req = https.request(
      {
        hostname: "oauth2.googleapis.com",
        path: "/token",
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          const json = JSON.parse(data);
          if (!json.access_token) reject(new Error(data));
          else resolve(json.access_token);
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function getConfig(token) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "identitytoolkit.googleapis.com",
        path: `/admin/v2/projects/${PROJECT_ID}/config`,
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode, data }));
      }
    );
    req.on("error", reject);
    req.end();
  });
}

function patchConfig(token, domains) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ authorizedDomains: domains });
    const pathStr = `/admin/v2/projects/${PROJECT_ID}/config?updateMask=authorizedDomains`;
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
  const token = await getAccessToken();
  const res = await getConfig(token);
  console.log("HTTP", res.status);
  const cfg = JSON.parse(res.data);
  let domains = cfg.authorizedDomains || [];
  console.log("Dominios actuales:", domains.join(", ") || "(ninguno)");

  const required = [
    "localhost",
    "grefa-tareas.firebaseapp.com",
    "grefa-tareas.web.app",
  ];
  const missing = required.filter((d) => !domains.includes(d));
  for (const d of required) {
    console.log((domains.includes(d) ? "✓" : "✗") + " " + d);
  }

  if (missing.length && process.argv.includes("--fix")) {
    const merged = [...new Set([...domains, ...missing])];
    const patch = await patchConfig(token, merged);
    console.log("PATCH HTTP", patch.status);
    console.log(patch.data.slice(0, 500));
  } else if (missing.length) {
    console.log("\nFaltan:", missing.join(", "));
    console.log("Ejecuta: node scripts/list-auth-domains.js --fix");
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
