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
  const body = match[1].replace(/^\s*import[\s\S]*?from\s+["'][^"']+["'];\s*$/gm, "");
  try {
    // Se envuelve en async en lugar de borrar los `await`: así se admite el
    // await de primer nivel y, a la vez, salta el que esté dentro de una
    // función que no es async, que es un error capaz de tumbar el módulo.
    new Function(`return (async () => {\n${body}\n});`);
    console.log(`OK          ${file}`);
  } catch (e) {
    bad += 1;
    console.log(`ERROR       ${file}: ${e.message}`);
  }
}

process.exit(bad ? 1 : 0);
