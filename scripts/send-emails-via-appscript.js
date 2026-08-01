/**
 * Envía emails agrupados vía Apps Script (desde Node, con respuesta JSON).
 * Uso: node scripts/send-emails-via-appscript.js [--taskId=xxx]
 */
const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");
const admin = createRequire(path.join(__dirname, "../functions/package.json"))("firebase-admin");

const sa = require(path.join(__dirname, "../secrets/serviceAccount.json"));
admin.initializeApp({ credential: admin.credential.cert(sa), projectId: "grefa-tareas" });
const db = admin.firestore();

function loadConfig() {
  const cfg = { appsScriptUrl: "", notifySecret: "" };
  const envPath = path.join(__dirname, "../secrets/notifications.env");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 1) continue;
      cfg[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
  }
  return cfg;
}

function formatTaskWhen(task) {
  let dateStr = "";
  const td = task.taskDate;
  if (td?.toDate) {
    dateStr = td.toDate().toLocaleDateString("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  const start = (task.startTime || "").trim();
  const end = (task.endTime || "").trim();
  if (!dateStr && !start) return "Sin fecha programada";
  let s = dateStr;
  if (start) s += (s ? " · " : "") + start;
  if (end) s += "–" + end;
  return s;
}

async function fetchPendingForUser(uid) {
  const snap = await db
    .collection("tasks")
    .where("assignedUserIds", "array-contains", uid)
    .where("status", "==", "PENDING")
    .get();
  return snap.docs
    .map((d) => {
      const data = d.data();
      return {
        title: data.title || "Tarea",
        when: formatTaskWhen(data),
        description: (data.description || "").trim(),
        assignedToAll: data.assignedToAll === true,
      };
    })
    .sort((a, b) => a.when.localeCompare(b.when, "es"));
}

async function main() {
  const cfg = loadConfig();
  if (!cfg.APPS_SCRIPT_URL || !cfg.NOTIFY_SECRET) {
    console.error("Configura en secrets/notifications.env:");
    console.error("  APPS_SCRIPT_URL=https://script.google.com/macros/s/.../exec");
    console.error("  NOTIFY_SECRET=tu-clave-secreta");
    process.exit(1);
  }

  const taskIdArg = process.argv.find((a) => a.startsWith("--taskId="));
  const taskId = taskIdArg ? taskIdArg.split("=")[1] : null;

  let uids;
  if (taskId) {
    const t = await db.collection("tasks").doc(taskId).get();
    if (!t.exists) throw new Error("Tarea no encontrada");
    uids = t.data().assignedUserIds || [];
  } else {
    const users = await db.collection("users").where("active", "==", true).where("role", "==", "WORKER").get();
    uids = users.docs.map((d) => d.id);
  }

  const notifications = [];
  for (const uid of uids) {
    const u = await db.collection("users").doc(uid).get();
    if (!u.exists || !u.data().email) continue;
    const tasks = await fetchPendingForUser(uid);
    if (!tasks.length) continue;
    notifications.push({
      email: u.data().email,
      fullName: u.data().fullName || "",
      tasks,
    });
  }

  if (!notifications.length) {
    console.log("Nada que enviar");
    return;
  }

  const res = await fetch(cfg.APPS_SCRIPT_URL, {
    method: "POST",
    redirect: "follow",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      secret: cfg.NOTIFY_SECRET,
      senderEmail: cfg.SENDER_EMAIL || "aquilagestion@grefa.org",
      senderName: cfg.SENDER_NAME || "Administración GREFA",
      notifications,
    }),
  });
  const text = await res.text();
  console.log("Respuesta:", text);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
