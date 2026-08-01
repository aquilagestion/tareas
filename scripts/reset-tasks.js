/**
 * Borra TODAS las tareas y su historial para dejar el sistema limpio.
 * NO toca usuarios ni Authentication.
 *
 * Colecciones afectadas: tasks, taskLogs, notificationQueue, notificationLogs
 *
 * Uso:
 *   node scripts/reset-tasks.js            → solo muestra qué se borraría
 *   node scripts/reset-tasks.js --confirm  → borra de verdad
 */
const { createRequire } = require("module");
const path = require("path");
const fs = require("fs");
const admin = createRequire(path.join(__dirname, "../functions/package.json"))("firebase-admin");

const root = path.join(__dirname, "..");
const saPath = path.join(root, "secrets/serviceAccount.json");
if (!fs.existsSync(saPath)) {
  console.error("Falta secrets/serviceAccount.json");
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(require(saPath)), projectId: "grefa-tareas" });
const db = admin.firestore();

const COLLECTIONS = ["tasks", "taskLogs", "notificationQueue", "notificationLogs"];
const CONFIRMED = process.argv.includes("--confirm");
const BATCH_SIZE = 400;

async function countCollection(name) {
  const snap = await db.collection(name).count().get();
  return snap.data().count;
}

async function deleteCollection(name) {
  let total = 0;
  for (;;) {
    const snap = await db.collection(name).limit(BATCH_SIZE).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += snap.size;
    process.stdout.write(`  ${name}: ${total} borrados\r`);
  }
  console.log(`  ${name}: ${total} borrados          `);
  return total;
}

(async () => {
  console.log("\nEstado actual:");
  const counts = {};
  for (const name of COLLECTIONS) {
    counts[name] = await countCollection(name);
    console.log(`  ${name}: ${counts[name]} documentos`);
  }

  const users = await countCollection("users");
  console.log(`  users: ${users} documentos (NO se tocan)`);

  const totalToDelete = Object.values(counts).reduce((a, b) => a + b, 0);
  if (!totalToDelete) {
    console.log("\nNo hay nada que borrar. El sistema ya está limpio.");
    process.exit(0);
  }

  if (!CONFIRMED) {
    console.log(
      `\nSimulación: se borrarían ${totalToDelete} documentos.` +
        "\nPara ejecutarlo de verdad:\n  node scripts/reset-tasks.js --confirm\n"
    );
    process.exit(0);
  }

  console.log("\nBorrando…");
  let deleted = 0;
  for (const name of COLLECTIONS) {
    deleted += await deleteCollection(name);
  }
  console.log(`\nListo: ${deleted} documentos borrados. Usuarios intactos (${users}).`);
  process.exit(0);
})().catch((e) => {
  console.error("\nERROR:", e.message || e);
  process.exit(1);
});
