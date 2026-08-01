/**
 * Genera notifications-config.js tras configurar Apps Script.
 * Uso: node scripts/setup-email-config.js SPREADSHEET_ID APPS_SCRIPT_URL NOTIFY_SECRET
 */
const fs = require("fs");
const path = require("path");

const [, , sheetId, appsScriptUrl, notifySecret] = process.argv;

if (!appsScriptUrl || !notifySecret) {
  console.log(`Uso:
  node scripts/setup-email-config.js [SPREADSHEET_ID] APPS_SCRIPT_URL NOTIFY_SECRET

Ejemplo:
  node scripts/setup-email-config.js 1abcXYZ... https://script.google.com/macros/s/.../exec MiClaveSecreta
`);
  process.exit(1);
}

const webConfig = `/** Generado por setup-email-config.js — no subir NOTIFY_SECRET a git público */
export const NOTIFY_CONFIG = {
  appsScriptUrl: "${appsScriptUrl.replace(/"/g, "")}",
  notifySecret: "${notifySecret.replace(/"/g, "")}",
  spreadsheetId: ${sheetId ? `"${sheetId.replace(/"/g, "")}"` : '""'},
  whatsappEnabled: false,
};
`;

const secrets = `# Generado por setup-email-config.js
APPS_SCRIPT_URL=${appsScriptUrl}
NOTIFY_SECRET=${notifySecret}
${sheetId ? `SPREADSHEET_ID=${sheetId}` : "# SPREADSHEET_ID="}
`;

const webPath = path.join(__dirname, "../apps/web/static-hosting/js/notifications-config.js");
const secretsPath = path.join(__dirname, "../secrets/notifications.env");

fs.writeFileSync(webPath, webConfig, "utf8");
fs.mkdirSync(path.dirname(secretsPath), { recursive: true });
fs.writeFileSync(secretsPath, secrets, "utf8");

console.log("Escrito:", webPath);
console.log("Escrito:", secretsPath);
console.log("\nSiguiente paso (solo una vez en script.google.com):");
console.log("  1. Pegar scripts/apps-script/grefa-task-emails.gs");
if (sheetId) console.log("  2. Propiedad SPREADSHEET_ID =", sheetId);
console.log("  3. Propiedad NOTIFY_SECRET = (la misma clave)");
console.log("  4. Ejecutar setupSpreadsheet() si usas registro en Sheet");
console.log("  5. Implementar como Web App → copiar URL si cambió");
