/**
 * Envía avisos de programación para una tarea o procesa la cola notificationQueue.
 * Uso:
 *   node scripts/notify-task-assignees.js <taskId>
 *   node scripts/notify-task-assignees.js --queue
 */
const path = require("path");
const { createRequire } = require("module");
const admin = createRequire(path.join(__dirname, "../functions/package.json"))("firebase-admin");
const { notifyTaskAssignees } = require("./lib/notify-core");

const sa = require(path.join(__dirname, "../secrets/serviceAccount.json"));
admin.initializeApp({ credential: admin.credential.cert(sa), projectId: "grefa-tareas" });
const db = admin.firestore();

async function processQueue() {
  const snap = await db
    .collection("notificationQueue")
    .where("status", "==", "PENDING")
    .where("type", "==", "TASK_ASSIGNED")
    .get();
  if (snap.empty) {
    console.log("Cola vacía");
    return;
  }
  for (const doc of snap.docs) {
    const { taskId } = doc.data();
    console.log("Cola", doc.id, "→ tarea", taskId);
    const taskSnap = await db.collection("tasks").doc(taskId).get();
    if (!taskSnap.exists) {
      await doc.ref.update({ status: "FAILED", error: "Tarea no encontrada" });
      continue;
    }
    try {
      const results = await notifyTaskAssignees(db, admin, taskId, taskSnap.data());
      await doc.ref.update({ status: "SENT", results, processedAt: admin.firestore.FieldValue.serverTimestamp() });
      console.log("Cola procesada OK");
    } catch (e) {
      await doc.ref.update({
        status: "FAILED",
        error: e.message,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.error("Cola FAIL", e.message);
    }
  }
}

async function main() {
  const arg = process.argv[2];
  if (arg === "--queue") {
    await processQueue();
    process.exit(0);
  }
  if (!arg) {
    console.error("Uso: node scripts/notify-task-assignees.js <taskId>|--queue");
    process.exit(1);
  }
  const taskSnap = await db.collection("tasks").doc(arg).get();
  if (!taskSnap.exists) {
    console.error("Tarea no encontrada:", arg);
    process.exit(1);
  }
  console.log("Tarea:", taskSnap.data().title);
  await notifyTaskAssignees(db, admin, arg, taskSnap.data());
  console.log("Hecho");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
