/** Limpia campos de gastos/texto legal obsoletos en Firestore. */
const { createRequire } = require("module");
const path = require("path");
const admin = createRequire(path.join(__dirname, "../functions/package.json"))("firebase-admin");

const root = path.join(__dirname, "..");
const sa = require(path.join(root, "secrets/serviceAccount.json"));

admin.initializeApp({ credential: admin.credential.cert(sa), projectId: "grefa-tareas" });
const db = admin.firestore();

const STRIP = ["totalAmount", "concatenatedText", "locationDateText"];

async function stripCollection(name) {
  const snap = await db.collection(name).get();
  let n = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    const patch = {};
    for (const k of STRIP) {
      if (k in data) patch[k] = admin.firestore.FieldValue.delete();
    }
    if (Object.keys(patch).length) {
      await doc.ref.update(patch);
      n++;
    }
  }
  console.log(`${name}: ${n} documentos actualizados`);
}

async function syncAudited() {
  const tasks = await db.collection("tasks").where("status", "==", "COMPLETED").get();
  let n = 0;
  for (const t of tasks.docs) {
    const data = t.data();
    if (data.auditedAt) continue;
    const logs = await db.collection("taskLogs").where("taskId", "==", t.id).limit(1).get();
    const log = logs.docs[0]?.data();
    if (log?.auditedAt) {
      await t.ref.update({
        auditedAt: log.auditedAt,
        auditedBy: log.auditedBy || null,
        completedAt: data.completedAt || log.completionDate || null,
        completedByName: data.completedByName || log.completedByName || null,
      });
      n++;
    }
  }
  console.log(`tasks COMPLETED: ${n} sincronizados con logs`);
}

(async () => {
  await stripCollection("tasks");
  await stripCollection("taskLogs");
  await syncAudited();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
