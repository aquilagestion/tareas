const fs = require("fs");
const path = require("path");
const os = require("os");

async function token() {
  const tokens = JSON.parse(
    fs.readFileSync(path.join(os.homedir(), ".config", "configstore", "firebase-tools.json"), "utf8")
  ).tokens;
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

(async () => {
  const accessToken = await token();
  const projectId = "grefa-tareas";
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "X-Goog-User-Project": projectId,
  };

  // Endpoint usado por la consola para "Get started" de Auth
  const attempts = [
    {
      name: "firebaseauth defaultConfig",
      method: "POST",
      url: `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`,
      body: JSON.stringify({
        signIn: {
          email: { enabled: true, passwordRequired: true },
        },
      }),
    },
    {
      name: "tooling initialize",
      method: "POST",
      url: `https://firebase.clients6.google.com/v1alpha1/projects/${projectId}/identityProviders?alt=json`,
      body: JSON.stringify({ providerId: "password", enabled: true }),
    },
    {
      name: "gcp identitytoolkit init",
      method: "POST",
      url: `https://identitytoolkit.googleapis.com/v2/projects/${projectId}/defaultSupportedIdpConfigs?idpId=password`,
      body: JSON.stringify({ enabled: true, name: `projects/${projectId}/defaultSupportedIdpConfigs/password` }),
    },
  ];

  for (const a of attempts) {
    const res = await fetch(a.url, { method: a.method, headers, body: a.body });
    console.log(a.name, res.status, (await res.text()).slice(0, 350));
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
