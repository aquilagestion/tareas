/**
 * Área personal de la web: las mismas operaciones que hace la APK sobre las
 * tareas propias (marcar hecha, asumir ajenas, avisar de falta de material),
 * con idénticos campos, porque las reglas de Firestore validan campo a campo.
 */
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { db } from "./admin.js";

export const TASK_STATUS_LABELS = {
  PENDING: "Por hacer",
  IN_REVIEW: "Pendiente de chequeo",
  COMPLETED: "Chequeada",
};

function mapDocs(snap) {
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Tareas en las que figuro como asignado. */
export function subscribeMyTasks(uid, onChange, onError) {
  const q = query(
    collection(db, "tasks"),
    where("assignedUserIds", "array-contains", uid),
    orderBy("taskDate", "desc")
  );
  return onSnapshot(q, (snap) => onChange(mapDocs(snap)), (e) => onError?.(e));
}

/** Tareas pendientes del resto del equipo, para asumirlas o chequearlas. */
export function subscribePendingTasks(onChange, onError) {
  const q = query(
    collection(db, "tasks"),
    where("status", "==", "PENDING"),
    orderBy("taskDate", "desc")
  );
  return onSnapshot(q, (snap) => onChange(mapDocs(snap)), (e) => onError?.(e));
}

/** Histórico de lo que he marcado como hecho. */
export function subscribeMyLogs(uid, onChange, onError) {
  const q = query(
    collection(db, "taskLogs"),
    where("completedByUserId", "==", uid),
    orderBy("completionDate", "desc")
  );
  return onSnapshot(q, (snap) => onChange(mapDocs(snap)), (e) => onError?.(e));
}

/** Aviso al responsable, sin tocar la tarea. */
async function enqueueMaterialShortage(task, profile, message) {
  await addDoc(collection(db, "notificationQueue"), {
    type: "MATERIAL_SHORTAGE",
    status: "PENDING",
    taskId: task.id,
    taskTitle: task.title || "",
    message: String(message || "").trim(),
    reportedBy: profile.uid,
    reportedByName: profile.fullName || "",
    createdAt: serverTimestamp(),
  });
}

async function pushNotification(data) {
  await addDoc(collection(db, "notifications"), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

/** Aviso en vivo a quien ya tenía la tarea asignada. */
async function notifyTaskTaken(task, actor) {
  const recipients = (task.assignedUserIds || []).filter((uid) => uid !== actor.uid);
  if (!recipients.length) return;
  await pushNotification({
    type: "TASK_TAKEN",
    audience: "USERS",
    recipients,
    taskId: task.id,
    taskTitle: task.title || "",
    actorUid: actor.uid,
    actorName: actor.fullName || "",
    message: `${actor.fullName} se ha autoasignado «${task.title}», que tenías asignada.`,
  });
}

/** Aviso general de tarea realizada. */
async function notifyTaskDone(task, actor) {
  await pushNotification({
    type: "TASK_DONE",
    audience: "ALL",
    recipients: [],
    taskId: task.id,
    taskTitle: task.title || "",
    actorUid: actor.uid,
    actorName: actor.fullName || "",
    message: `${actor.fullName} ha realizado «${task.title}».`,
  });
}

/**
 * Marca la tarea como hecha y deja el registro de auditoría. Los avisos van
 * después y no pueden tumbar la operación: la tarea ya quedó registrada.
 */
export async function completeTask(task, profile, wasAssigned, comments, material) {
  const notes = String(comments || "").trim();
  const materialText = String(material || "").trim();

  await updateDoc(doc(db, "tasks", task.id), {
    status: "IN_REVIEW",
    completedAt: serverTimestamp(),
    completedBy: profile.uid,
    completedByName: profile.fullName,
    completionNotes: notes || null,
    materialShortage: materialText || null,
  });

  await addDoc(collection(db, "taskLogs"), {
    taskId: task.id,
    completionDate: serverTimestamp(),
    assignedUsersList: (task.assignedUsersInfo || []).map((u) => ({
      uid: u.uid,
      fullName: u.fullName,
      dni: u.dni,
    })),
    completedByUserId: profile.uid,
    completedByName: profile.fullName,
    wasAssignedToHim: wasAssigned,
    comments: notes,
    materialShortage: materialText,
    taskTitle: task.title || "",
    taskDescription: task.description || "",
    taskScheduledDate: task.taskDate,
    taskStartTime: task.startTime || "",
    taskEndTime: task.endTime || "",
  });

  if (materialText && materialText !== String(task.materialShortage || "").trim()) {
    try {
      await enqueueMaterialShortage(task, profile, materialText);
    } catch {
      /* sin aviso de material */
    }
  }

  try {
    await notifyTaskDone(task, profile);
  } catch {
    /* sin aviso general */
  }
}

/** Me añado a los asignados de una tarea pendiente ajena. */
export async function assumeTask(task, profile) {
  if ((task.assignedUserIds || []).includes(profile.uid)) return;

  await updateDoc(doc(db, "tasks", task.id), {
    assignedUserIds: [...(task.assignedUserIds || []), profile.uid],
    assignedUsersInfo: [
      ...(task.assignedUsersInfo || []),
      {
        uid: profile.uid,
        fullName: profile.fullName,
        userType: profile.userType,
        dni: profile.dni,
      },
    ],
  });

  try {
    await notifyTaskTaken(task, profile);
  } catch {
    /* sin aviso */
  }
}

/** Falta de material sin dar la tarea por hecha. */
export async function reportMaterial(task, profile, message) {
  const text = String(message || "").trim();
  await updateDoc(doc(db, "tasks", task.id), { materialShortage: text });
  await enqueueMaterialShortage(task, profile, text);
}

export function formatStamp(ts) {
  if (!ts?.toDate) return "—";
  return ts.toDate().toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
}

/** «12/03/2026 · 09:00–14:00» a partir de los campos del registro. */
export function formatLogScheduled(log) {
  const ts = log.taskScheduledDate;
  const dateStr = ts?.toDate ? ts.toDate().toLocaleDateString("es-ES") : "—";
  const start = String(log.taskStartTime || "").trim();
  const end = String(log.taskEndTime || "").trim();
  if (start && end) return `${dateStr} · ${start}–${end}`;
  if (start) return `${dateStr} · ${start}`;
  return dateStr;
}
