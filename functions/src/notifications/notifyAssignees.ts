import type { Firestore, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { formatTaskWhen, normalizePhoneE164, type TaskScheduleFields } from "./formatTaskWhen";
import {
  buildScheduleEmailHtml,
  buildScheduleSmsText,
  SCHEDULE_SUBJECT_NEW,
  SCHEDULE_SUBJECT_DAILY,
  type ScheduleTaskLine,
} from "./templates";
import { sendEmail, sendWhatsApp } from "./sendMessage";

export interface TaskNotifyData {
  title?: string;
  description?: string;
  taskDate?: unknown;
  startTime?: string;
  endTime?: string;
  assignedUserIds?: string[];
  assignedToAll?: boolean;
}

export interface NotifyChannelResult {
  uid: string;
  fullName: string;
  taskCount?: number;
  email?: { ok: boolean; error?: string };
  whatsapp?: { ok: boolean; error?: string };
}

function docToScheduleLine(data: FirebaseFirestore.DocumentData): ScheduleTaskLine {
  return {
    title: (data.title as string) || "Tarea",
    when: formatTaskWhen(data as TaskScheduleFields),
    description: ((data.description as string) || "").trim() || undefined,
    assignedToAll: data.assignedToAll === true,
  };
}

function sortByDate(
  a: QueryDocumentSnapshot,
  b: QueryDocumentSnapshot
): number {
  const ta = a.data().taskDate?.toMillis?.() ?? 0;
  const tb = b.data().taskDate?.toMillis?.() ?? 0;
  return ta - tb;
}

/** Todas las tareas PENDING asignadas a un trabajador (incluye «asignadas a todos»). */
export async function fetchPendingTasksForUser(
  db: Firestore,
  uid: string
): Promise<ScheduleTaskLine[]> {
  const snap = await db
    .collection("tasks")
    .where("assignedUserIds", "array-contains", uid)
    .where("status", "==", "PENDING")
    .get();
  return snap.docs.sort(sortByDate).map((d) => docToScheduleLine(d.data()));
}

export async function notifyUserTasks(
  db: Firestore,
  uid: string,
  tasks: ScheduleTaskLine[],
  kind: "new" | "daily"
): Promise<NotifyChannelResult> {
  const userSnap = await db.collection("users").doc(uid).get();
  const result: NotifyChannelResult = { uid, fullName: "", taskCount: tasks.length };
  if (!userSnap.exists) {
    result.email = { ok: false, error: "Usuario no encontrado" };
    return result;
  }
  if (!tasks.length) {
    result.email = { ok: false, error: "Sin tareas pendientes" };
    result.whatsapp = { ok: false, error: "Sin tareas pendientes" };
    return result;
  }
  const u = userSnap.data()!;
  const fullName = (u.fullName as string) || "Trabajador";
  result.fullName = fullName;
  const email = (u.email as string) || "";
  const phone = normalizePhoneE164((u.phone as string) || "");
  const subject = kind === "daily" ? SCHEDULE_SUBJECT_DAILY : SCHEDULE_SUBJECT_NEW;
  const text = buildScheduleSmsText({ fullName, tasks });
  const html = buildScheduleEmailHtml({ fullName, tasks });

  if (email) {
    try {
      await sendEmail({ to: email, subject, text, html });
      result.email = { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.warn("Email falló", uid, msg);
      result.email = { ok: false, error: msg };
    }
  } else {
    result.email = { ok: false, error: "Sin email en ficha" };
  }

  if (phone && process.env.WHATSAPP_ENABLED === "true") {
    try {
      await sendWhatsApp({ toPhoneE164: phone, body: text });
      result.whatsapp = { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.warn("WhatsApp falló", uid, msg);
      result.whatsapp = { ok: false, error: msg };
    }
  } else {
    result.whatsapp = { ok: false, error: phone ? "WhatsApp desactivado" : "Sin teléfono válido en ficha" };
  }

  return result;
}

/** Un aviso agrupado por trabajador con TODAS sus tareas pendientes. */
export async function notifyTaskAssignees(
  db: Firestore,
  taskId: string,
  task: TaskNotifyData
): Promise<NotifyChannelResult[]> {
  const uids = [...new Set(task.assignedUserIds ?? [])];
  const results: NotifyChannelResult[] = [];
  for (const uid of uids) {
    const tasks = await fetchPendingTasksForUser(db, uid);
    const r = await notifyUserTasks(db, uid, tasks, "new");
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
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  return results;
}
