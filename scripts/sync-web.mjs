import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * La web que sirve Firebase Hosting es `apps/web/out`, pero las páginas se
 * editan en `apps/web/static-hosting`. Sin esta copia el deploy publica la
 * versión anterior sin avisar.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "apps", "web", "static-hosting");
const to = join(root, "apps", "web", "out");

if (!existsSync(from)) {
  console.error(`No existe ${from}`);
  process.exit(1);
}
mkdirSync(to, { recursive: true });
cpSync(from, to, { recursive: true, force: true });
console.log(`Web sincronizada: static-hosting → out`);
