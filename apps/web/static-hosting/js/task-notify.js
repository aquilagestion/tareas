/**
 * Avisos agrupados por trabajador vía Google Apps Script (Gmail, gratis).
 */
import { db } from "./admin.js";
import { formatTaskWhen } from "./admin.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

const ALL_STAFF = "Asignada a TODO el personal";

let config = { appsScriptUrl: "", notifySecret: "", whatsappEnabled: false };

try {
  const mod = await import("./notifications-config.js");
  if (mod.NOTIFY_CONFIG) config = { ...config, ...mod.NOTIFY_CONFIG };
} catch {
  /* usar notifications-config.example.js como plantilla */
}

function taskToLine(t) {
  return {
    title: t.title || "Tarea",
    when: formatTaskWhen(t),
    description: (t.description || "").trim(),
    assignedToAll: t.assignedToAll === true,
  };
}

/** Todas las tareas PENDING de un trabajador (agrupadas). */
export async function fetchPendingTasksForUser(uid) {
  const q = query(
    collection(db, "tasks"),
    where("assignedUserIds", "array-contains", uid),
    where("status", "==", "PENDING")
  );
  const snap = await getDocs(q);
  const tasks = snap.docs.map((d) => taskToLine({ id: d.id, ...d.data() }));
  tasks.sort((a, b) => String(a.when).localeCompare(String(b.when), "es"));
  return tasks;
}

/** Construye payload agrupado para cada uid. usersMap: uid → { email, fullName } */
export async function buildGroupedEmailPayload(assigneeUids, usersMap) {
  const notifications = [];
  for (const uid of assigneeUids) {
    const user = usersMap.get(uid);
    if (!user?.email) continue;
    const tasks = await fetchPendingTasksForUser(uid);
    if (!tasks.length) continue;
    notifications.push({
      email: user.email.trim(),
      fullName: user.fullName || "",
      tasks,
    });
  }
  return notifications;
}

/**
 * Envía emails vía Apps Script Web App.
 * @param {{ email: string, fullName: string }} sender — administrador logueado
 */
export async function sendEmailsViaAppsScript(notifications, sender) {
  const url = (config.appsScriptUrl || "").trim();
  const secret = (config.notifySecret || "").trim();
  if (!url) throw new Error("Configura appsScriptUrl en js/notifications-config.js");
  if (!secret) throw new Error("Configura notifySecret en js/notifications-config.js");
  if (!notifications.length) throw new Error("Sin destinatarios con email");
  if (!sender?.email) throw new Error("Sin email del administrador en sesión");

  const body = JSON.stringify({
    secret,
    senderEmail: sender.email.trim(),
    senderName: (sender.fullName || "").trim() || sender.email,
    notifications,
  });
  await fetch(url, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body,
  });
  return { sent: notifications.length, channel: "apps-script" };
}

/**
 * Envía el cuadrante semanal a cada destinatario con sus turnos destacados.
 *
 * Se intenta leer la respuesta para poder avisar si el script de Google aún no
 * entiende los cuadrantes; si el navegador bloquea la lectura se reenvía sin
 * CORS y el envío queda sin confirmar.
 */
export async function sendRosterEmails(roster, sender) {
  const url = (config.appsScriptUrl || "").trim();
  const secret = (config.notifySecret || "").trim();
  if (!url) throw new Error("Configura appsScriptUrl en js/notifications-config.js");
  if (!secret) throw new Error("Configura notifySecret en js/notifications-config.js");
  if (!roster?.recipients?.length) throw new Error("Nadie tiene turnos esta semana");
  if (!sender?.email) throw new Error("Sin email del administrador en sesión");

  const body = JSON.stringify({
    secret,
    senderEmail: sender.email.trim(),
    senderName: (sender.fullName || "").trim() || sender.email,
    roster,
  });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body,
    });
    const json = JSON.parse(await res.text());
    if (!json.ok) {
      if (/Sin notificaciones/i.test(json.error || "")) {
        throw new Error(
          "El script de correo de Google todavía no sabe enviar cuadrantes: hay que actualizarlo y volver a publicarlo."
        );
      }
      throw new Error(json.error || "No se pudo enviar el cuadrante");
    }
    return { sent: json.sent || 0, errors: json.errors || [], verified: true };
  } catch (e) {
    if (e instanceof Error && /script de correo|No se pudo enviar/i.test(e.message)) throw e;
    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body,
    });
    return { sent: roster.recipients.length, errors: [], verified: false };
  }
}

export function isEmailNotifyConfigured() {
  const url = (config.appsScriptUrl || "").trim();
  return Boolean(url && url.startsWith("http") && (config.notifySecret || "").trim());
}

export { ALL_STAFF };
