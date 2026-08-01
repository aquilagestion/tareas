const fs = require("fs");
const path = require("path");
const os = require("os");

function loadTokens() {
  const p = path.join(os.homedir(), ".config", "configstore", "firebase-tools.json");
  return JSON.parse(fs.readFileSync(p, "utf8")).tokens;
}

async function accessToken() {
  const tokens = loadTokens();
  if (tokens.expires_at && Date.now() < tokens.expires_at - 60_000) return tokens.access_token;
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
  if (!res.ok) throw new Error(JSON.stringify(json));
  return json.access_token;
}

async function main() {
  const projectId = "grefa-tareas";
  const token = await accessToken();
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-Goog-User-Project": projectId,
  };

  // 1) GET config
  let res = await fetch(
    `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`,
    { headers }
  );
  console.log("GET config", res.status, (await res.text()).slice(0, 500));

  // 2) Initialize Identity Platform (if needed)
  res = await fetch(
    `https://identitytoolkit.googleapis.com/v2/projects/${projectId}/identityPlatform:initializeAuth`,
    { method: "POST", headers, body: "{}" }
  );
  console.log("initializeAuth", res.status, (await res.text()).slice(0, 500));

  // 3) Enable email/password
  res = await fetch(
    `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config?updateMask=signIn.email`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        signIn: { email: { enabled: true, passwordRequired: true } },
      }),
    }
  );
  console.log("PATCH email", res.status, (await res.text()).slice(0, 500));

  // 4) Alternative: Firebase Auth config via Management (legacy)
  res = await fetch(
    `https://identitytoolkit.googleapis.com/v2/projects/${projectId}/config?updateMask=signIn`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        signIn: {
          email: { enabled: true, passwordRequired: true },
          allowDuplicateEmails: false,
        },
      }),
    }
  );
  console.log("PATCH v2 config", res.status, (await res.text()).slice(0, 500));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
