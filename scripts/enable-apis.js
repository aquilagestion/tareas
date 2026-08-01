/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const os = require("os");

function loadFirebaseTokens() {
  const p = path.join(os.homedir(), ".config", "configstore", "firebase-tools.json");
  const raw = JSON.parse(fs.readFileSync(p, "utf8"));
  if (!raw.tokens?.access_token) {
    throw new Error("No hay access_token en firebase-tools.json. Ejecuta: firebase login");
  }
  return raw.tokens;
}

async function refreshIfNeeded(tokens) {
  if (tokens.expires_at && Date.now() < tokens.expires_at - 60_000) {
    return tokens.access_token;
  }
  const body = new URLSearchParams({
    client_id: "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com",
    client_secret: "jQRIEVAzyqotvyRKhVhQDLmP",
    refresh_token: tokens.refresh_token,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Refresh token failed: ${JSON.stringify(json)}`);
  return json.access_token;
}

async function enableApis(projectId, accessToken, apis) {
  for (const api of apis) {
    const url = `https://serviceusage.googleapis.com/v1/projects/${projectId}/services/${api}:enable`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    const text = await res.text();
    console.log(`${api} -> HTTP ${res.status}`);
    if (!res.ok && res.status !== 409) {
      console.log(text.slice(0, 300));
    }
  }
}

async function createFirestore(projectId, accessToken) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases?databaseId=(default)`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      locationId: "europe-west1",
      type: "FIRESTORE_NATIVE",
      concurrencyMode: "PESSIMISTIC",
    }),
  });
  const text = await res.text();
  console.log(`Firestore create -> HTTP ${res.status}`);
  console.log(text.slice(0, 400));
}

async function enableEmailPassword(projectId, accessToken) {
  // Identity Platform / Identity Toolkit config
  const url = `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config?updateMask=signIn.email`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Goog-User-Project": projectId,
    },
    body: JSON.stringify({
      signIn: {
        email: {
          enabled: true,
          passwordRequired: true,
        },
      },
    }),
  });
  const text = await res.text();
  console.log(`Email/Password Auth -> HTTP ${res.status}`);
  console.log(text.slice(0, 400));
}

(async () => {
  const projectId = process.argv[2] || "grefa-tareas";
  const tokens = loadFirebaseTokens();
  const accessToken = await refreshIfNeeded(tokens);
  await enableApis(projectId, accessToken, [
    "firestore.googleapis.com",
    "identitytoolkit.googleapis.com",
    "firebase.googleapis.com",
    "cloudfunctions.googleapis.com",
    "cloudscheduler.googleapis.com",
    "fcm.googleapis.com",
    "securetoken.googleapis.com",
    "cloudresourcemanager.googleapis.com",
  ]);
  // Dar unos segundos a la propagación
  await new Promise((r) => setTimeout(r, 8000));
  await createFirestore(projectId, accessToken);
  await enableEmailPassword(projectId, accessToken);
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
