import { readFileSync } from "node:fs";

/**
 * Comprobación rápida de sintaxis de los <script type="module"> de las páginas
 * estáticas: no hay bundler que avise de un paréntesis suelto.
 */
const files = process.argv.slice(2);
let bad = 0;

for (const file of files) {
  const html = readFileSync(file, "utf8");
  const match = html.match(/<script type="module">([\s\S]*?)<\/script>/);
  if (!match) {
    console.log(`SIN SCRIPT  ${file}`);
    continue;
  }
  const body = match[1]
    .replace(/^\s*import[\s\S]*?from\s+["'][^"']+["'];\s*$/gm, "")
    .replace(/\bawait\b/g, "");
  try {
    new Function(body);
    console.log(`OK          ${file}`);
  } catch (e) {
    bad += 1;
    console.log(`ERROR       ${file}: ${e.message}`);
  }
}

process.exit(bad ? 1 : 0);
