/**
 * Recordatorio diario manual (mismo contenido que dailyTasksReminder).
 * Uso: node scripts/send-daily-reminders.js
 */
const path = require("path");
const { createRequire } = require("module");
const admin = createRequire(path.join(__dirname, "../functions/package.json"))("firebase-admin");
const { formatTaskWhen, notifyUser } = require("./lib/notify-core");

const sa = require(path.join(__dirname, "../secrets/serviceAccount.json"));
admin.initializeApp({ credential: admin.credential.cert(sa), projectId: "grefa-tareas" });
const db = admin.firestore();

async function main() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const snap = await db
    .collection("tasks")
    .where("status", "==", "PENDING")
    .where("taskDate", ">=", admin.firestore.Timestamp.fromDate(start))
    .where("taskDate", "<", admin.firestore.Timestamp.fromDate(end))
    .get();

  const byUser = new Map();
  for (const doc of snap.docs) {
    const data = doc.data();
    const item = {
      title: data.title || "Tarea",
      when: formatTaskWhen(data),
      description: data.description || "",
    };
    for (const uid of data.assignedUserIds || []) {
      const list = byUser.get(uid) || [];
      list.push(item);
      byUser.set(uid, list);
    }
  }

  if (!byUser.size) {
    console.log("Sin tareas PENDING hoy");
    return;
  }

  for (const [uid, tasks] of byUser) {
    console.log("Recordatorio →", uid, `(${tasks.length} tareas)`);
    await notifyUser(db, admin, uid, tasks, "daily");
  }
  console.log("Recordatorios enviados a", byUser.size, "usuarios");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
