/** Lógica compartida de avisos (scripts locales, espejo de Cloud Functions). */
const fs = require("fs");
const path = require("path");

function loadEnv() {
  for (const f of [
    path.join(__dirname, "../../secrets/notifications.env"),
    path.join(__dirname, "../../functions/.env"),
    path.join(__dirname, "../../apps/web/.env.local"),
  ]) {
    if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 1) continue;
      const k = t.slice(0, i).trim();
      if (!process.env[k]) process.env[k] = t.slice(i + 1).trim();
    }
  }
}

loadEnv();

const ALL_STAFF_LABEL = "Asignada a TODO el personal";

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
  } else if (td instanceof Date) {
    dateStr = td.toLocaleDateString("es-ES", {
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

function normalizePhoneE164(raw) {
  const d = String(raw || "").replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("34") && d.length >= 11) return d;
  if (d.length === 9 && /^[67]/.test(d)) return "34" + d;
  if (d.length >= 10) return d;
  return null;
}

function docToLine(data) {
  return {
    title: data.title || "Tarea",
    when: formatTaskWhen(data),
    description: (data.description || "").trim() || undefined,
    assignedToAll: data.assignedToAll === true,
  };
}

function buildScheduleSmsText({ fullName, tasks }) {
  const hasAll = tasks.some((t) => t.assignedToAll);
  const lines = tasks
    .map((t) => {
      const badge = t.assignedToAll ? ` [${ALL_STAFF_LABEL}]` : "";
      let line = `• ${t.title}${badge} (${t.when})`;
      if (t.description) line += `\n  ${t.description.slice(0, 120)}`;
      return line;
    })
    .join("\n");
  const header =
    tasks.length === 1 ? "Tu tarea pendiente:" : `Tus ${tasks.length} tareas pendientes:`;
  const allNote = hasAll ? `\n⚠ Incluye tarea(s): ${ALL_STAFF_LABEL}\n` : "";
  return `GREFA Tareas — Hola ${fullName}:\n\n${header}${allNote}\n${lines}\n\nConsulta la app GREFA Tareas.`;
}

function buildScheduleEmailHtml({ fullName, tasks }) {
  const esc = (s) =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const hasAll = tasks.some((t) => t.assignedToAll);
  const rows = tasks
    .map((t) => {
      const badge = t.assignedToAll
        ? ` <span style="color:#92400e;font-weight:700">[${esc(ALL_STAFF_LABEL)}]</span>`
        : "";
      let row = `<li><strong>${esc(t.title)}</strong>${badge} — ${esc(t.when)}`;
      if (t.description) row += `<br/><span style="color:#57534e">${esc(t.description)}</span>`;
      return row + "</li>";
    })
    .join("");
  const intro =
    tasks.length === 1 ? "Esta es tu tarea pendiente:" : `Tienes ${tasks.length} tareas pendientes:`;
  const allNote = hasAll
    ? `<p style="color:#92400e;font-weight:600">Incluye tarea(s) marcadas como <strong>${esc(ALL_STAFF_LABEL)}</strong>.</p>`
    : "";
  return `<p>Hola ${esc(fullName)},</p><p>${intro}</p>${allNote}<ul>${rows}</ul>
<p>Consulta la app <strong>GREFA Tareas</strong>.</p><p>— GREFA · Majadahonda</p>`;
}

async function sendEmail({ to, subject, text, html }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY no configurada");
  const from = process.env.EMAIL_FROM || "GREFA Tareas <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, text, html }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Resend ${res.status}`);
}

async function sendWhatsApp({ toPhoneE164, body }) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";
  if (!sid || !token) throw new Error("Twilio no configurado");
  const phone = toPhoneE164.startsWith("+") ? toPhoneE164 : `+${toPhoneE164}`;
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const params = new URLSearchParams({
    From: from.startsWith("whatsapp:") ? from : `whatsapp:${from}`,
    To: `whatsapp:${phone}`,
    Body: body,
  });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Twilio ${res.status}`);
}

async function fetchPendingTasksForUser(db, uid) {
  const snap = await db
    .collection("tasks")
    .where("assignedUserIds", "array-contains", uid)
    .where("status", "==", "PENDING")
    .get();
  return snap.docs
    .sort((a, b) => {
      const ta = a.data().taskDate?.toMillis?.() ?? 0;
      const tb = b.data().taskDate?.toMillis?.() ?? 0;
      return ta - tb;
    })
    .map((d) => docToLine(d.data()));
}

async function notifyUser(db, admin, uid, tasks, kind) {
  const userSnap = await db.collection("users").doc(uid).get();
  const result = { uid, fullName: "", taskCount: tasks.length, email: null, whatsapp: null };
  if (!userSnap.exists || !tasks.length) return result;
  const u = userSnap.data();
  result.fullName = u.fullName || "";
  const subject =
    kind === "daily"
      ? "GREFA Tareas — Recordatorio: tareas de hoy"
      : "GREFA Tareas — Tus tareas programadas";
  const text = buildScheduleSmsText({ fullName: result.fullName, tasks });
  const html = buildScheduleEmailHtml({ fullName: result.fullName, tasks });

  if (u.email) {
    try {
      await sendEmail({ to: u.email, subject, text, html });
      result.email = { ok: true };
      console.log("  Email OK →", u.email, `(${tasks.length} tareas)`);
    } catch (e) {
      result.email = { ok: false, error: e.message };
      console.warn("  Email FAIL →", u.email, e.message);
    }
  }
  const phone = normalizePhoneE164(u.phone);
  if (phone) {
    if (process.env.WHATSAPP_ENABLED === "true") {
      try {
        await sendWhatsApp({ toPhoneE164: phone, body: text });
        result.whatsapp = { ok: true };
      } catch (e) {
        result.whatsapp = { ok: false, error: e.message };
        console.warn("  WhatsApp FAIL →", phone, e.message);
      }
    } else {
      result.whatsapp = { ok: false, error: "WhatsApp desactivado" };
    }
  }
  return result;
}

/** Un mensaje agrupado por trabajador con todas sus tareas pendientes. */
async function notifyTaskAssignees(db, admin, taskId, task) {
  const uids = [...new Set(task.assignedUserIds || [])];
  const results = [];
  for (const uid of uids) {
    const tasks = await fetchPendingTasksForUser(db, uid);
    console.log("Avisando a", uid, "→", tasks.length, "tarea(s) pendientes");
    const r = await notifyUser(db, admin, uid, tasks, "new");
    results.push(r);
    await db.collection("notificationLogs").add({
      taskId,
      uid,
      fullName: r.fullName,
      kind: "TASK_ASSIGNED_GROUPED",
      taskCount: tasks.length,
      emailOk: r.email?.ok ?? false,
      whatsappOk: r.whatsapp?.ok ?? false,
      emailError: r.email?.error ?? null,
      whatsappError: r.whatsapp?.error ?? null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  return results;
}

module.exports = {
  formatTaskWhen,
  fetchPendingTasksForUser,
  notifyTaskAssignees,
  notifyUser,
  buildScheduleSmsText,
};
