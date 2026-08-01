import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Utilidades para localizar el proyecto de Apps Script de los avisos.
 * Reutiliza las credenciales de `clasp login`: no imprime ningún token.
 *
 *   node scripts/find-apps-script.mjs                → lista proyectos sueltos
 *   node scripts/find-apps-script.mjs <fileId>       → ficha de un archivo de Drive
 */
const rc = JSON.parse(readFileSync(join(homedir(), ".clasprc.json"), "utf8"));
const creds = rc.tokens?.default ?? rc.tokens ?? rc;

const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id: creds.client_id,
    client_secret: creds.client_secret,
    refresh_token: creds.refresh_token,
    grant_type: "refresh_token",
  }).toString(),
});
const { access_token: token, error_description: tokenError } = await tokenRes.json();
if (!token) {
  console.error("No se pudo renovar el acceso:", tokenError);
  process.exit(1);
}
const auth = { Authorization: `Bearer ${token}` };

const fileId = process.argv[2];

if (fileId) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,owners(emailAddress),capabilities(canEdit)&supportsAllDrives=true`,
    { headers: auth }
  );
  const f = await res.json();
  if (f.error) {
    console.log(`Drive: ${f.error.message}`);
  } else {
    console.log(`Nombre : ${f.name}`);
    console.log(`Tipo   : ${f.mimeType}`);
    console.log(`Dueño  : ${f.owners?.[0]?.emailAddress ?? "?"}`);
    console.log(`Editable: ${f.capabilities?.canEdit}`);
  }

  const kids = await fetch(
    `https://www.googleapis.com/drive/v3/files?${new URLSearchParams({
      q: `'${fileId}' in parents and trashed=false`,
      fields: "files(id,name,mimeType)",
      includeItemsFromAllDrives: "true",
      supportsAllDrives: "true",
    })}`,
    { headers: auth }
  ).then((r) => r.json());
  console.log(`Hijos en Drive: ${(kids.files ?? []).length}`);
  for (const k of kids.files ?? []) console.log(`  ${k.id}  ${k.mimeType}  ${k.name}`);

  // Los proyectos incrustados en una hoja tienen id propio, pero se prueba por si acaso.
  const asRes = await fetch(`https://script.googleapis.com/v1/projects/${fileId}`, {
    headers: auth,
  });
  const as = await asRes.json();
  console.log(
    as.error
      ? `Apps Script con ese id: no (${as.error.message})`
      : `Apps Script con ese id: sí → ${as.title}`
  );
  process.exit(0);
}

const query = new URLSearchParams({
  q: "mimeType='application/vnd.google-apps.script' and trashed=false",
  fields: "files(id,name,owners(emailAddress),modifiedTime)",
  pageSize: "100",
  includeItemsFromAllDrives: "true",
  supportsAllDrives: "true",
  corpora: "allDrives",
});
const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files?${query}`, {
  headers: auth,
});
const driveJson = await driveRes.json();
for (const f of driveJson.files ?? []) {
  console.log(
    `${f.id}  ${f.modifiedTime.slice(0, 10)}  ${f.owners?.[0]?.emailAddress ?? "?"}  ${f.name}`
  );
}
console.log(`Total: ${(driveJson.files ?? []).length}`);
