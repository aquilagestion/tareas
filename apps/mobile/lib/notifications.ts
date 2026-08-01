import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { getDb } from "@grefa/firebase";
import type { Task, User } from "@grefa/shared";

export type AppNotificationType = "TASK_TAKEN" | "TASK_DONE";

export interface AppNotification {
  id: string;
  type: AppNotificationType;
  /** ALL = aviso general al personal; USERS = solo a los uid de `recipients`. */
  audience: "ALL" | "USERS";
  recipients: string[];
  taskId: string;
  taskTitle: string;
  actorUid: string;
  actorName: string;
  message: string;
  createdAt?: { toDate?: () => Date; seconds?: number };
}

async function pushNotification(
  data: Omit<AppNotification, "id" | "createdAt">
): Promise<void> {
  await addDoc(collection(getDb(), "notifications"), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

/** Avisa a quienes ya tenían la tarea de que otra persona se la ha autoasignado. */
export async function notifyTaskTaken(task: Task, actor: User): Promise<void> {
  const recipients = (task.assignedUserIds ?? []).filter((uid) => uid !== actor.uid);
  if (!recipients.length) return;
  await pushNotification({
    type: "TASK_TAKEN",
    audience: "USERS",
    recipients,
    taskId: task.id,
    taskTitle: task.title,
    actorUid: actor.uid,
    actorName: actor.fullName,
    message: `${actor.fullName} se ha autoasignado «${task.title}», que tenías asignada.`,
  });
}

/** Aviso general: una tarea acaba de marcarse como hecha. */
export async function notifyTaskDone(task: Task, actor: User): Promise<void> {
  await pushNotification({
    type: "TASK_DONE",
    audience: "ALL",
    recipients: [],
    taskId: task.id,
    taskTitle: task.title,
    actorUid: actor.uid,
    actorName: actor.fullName,
    message: `${actor.fullName} ha realizado «${task.title}».`,
  });
}

export function subscribeNotifications(
  onChange: (list: AppNotification[]) => void,
  onError?: (e: Error) => void
): () => void {
  const q = query(
    collection(getDb(), "notifications"),
    orderBy("createdAt", "desc"),
    limit(25)
  );
  return onSnapshot(
    q,
    (snap) => {
      onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AppNotification));
    },
    (e) => onError?.(e)
  );
}

export function notificationDate(n: AppNotification): Date | null {
  const ts = n.createdAt;
  if (!ts) return null;
  if (typeof ts.toDate === "function") return ts.toDate();
  if (typeof ts.seconds === "number") return new Date(ts.seconds * 1000);
  return null;
}

/** Avisos nuevos dirigidos a este usuario, generados después de `since`. */
export function relevantNotifications(
  list: AppNotification[],
  uid: string,
  since: Date,
  dismissed: Set<string>
): AppNotification[] {
  return list.filter((n) => {
    if (dismissed.has(n.id)) return false;
    if (n.actorUid === uid) return false;
    if (n.audience === "USERS" && !(n.recipients ?? []).includes(uid)) return false;
    const at = notificationDate(n);
    return at !== null && at.getTime() > since.getTime();
  });
}
