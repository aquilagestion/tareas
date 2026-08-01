/** Regenera js/grefa-logo-data.js desde img/grefa-logo.png */
const fs = require("fs");
const path = require("path");

const pngPath = path.join(__dirname, "../apps/web/static-hosting/img/grefa-logo.png");
const outPath = path.join(__dirname, "../apps/web/static-hosting/js/grefa-logo-data.js");
const b64 = fs.readFileSync(pngPath).toString("base64");
const uri = `data:image/png;base64,${b64}`;
fs.writeFileSync(
  outPath,
  `/** Logo GREFA incrustado para impresión fiable. Regenerar: node scripts/embed-grefa-logo.js */\nexport const GREFA_LOGO_DATA_URI = ${JSON.stringify(uri)};\n`,
  "utf8"
);
console.log("OK", outPath, `${Math.round(uri.length / 1024)} KB`);
