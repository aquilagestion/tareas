import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from "firebase/firestore";
import { getDb } from "@grefa/firebase";
import { enumerateLocalDates, MAX_RECURRING_DAYS, USER_TYPE_ORDER } from "@grefa/shared";
import type { User } from "@grefa/shared";
import { APPS_SCRIPT_URL, requireNotifySecret } from "../constants/notifications";
import { formatScheduled } from "../utils/taskFormat";
import type { Task } from "@grefa/shared";

export interface AssigneeInput {
  uid: string;
  fullName: string;
  dni: string;
  userType: string;
}

/** Hermes no expone el global `crypto`, así que no se puede usar randomUUID. */
function makeRecurrenceId(): string {
  const rand = () => Math.random().toString(36).slice(2, 10);
  return `rec-${Date.now().toString(36)}-${rand()}${rand()}`;
}

function parseDateInput(value: string): Timestamp {
  const v = value.trim();
  const [y, m, d] = v.split("-").map(Number);
  if (!y || !m || !d) return Timestamp.now();
  return Timestamp.fromDate(new Date(y, m - 1, d, 12, 0, 0));
}

export async function createTaskDoc(data: {
  title: string;
  description: string;
  taskDate: string;
  startTime: string;
  endTime: string;
  assignees: AssigneeInput[];
  assignedToAll: boolean;
  createdBy: string;
  repeatDaily?: boolean;
  repeatUntil?: string;
}): Promise<string[]> {
  if (!data.assignees.length) throw new Error("Selecciona al menos un asignado.");
  let dateKeys = [data.taskDate.trim()];
  if (data.repeatDaily) {
    const until = String(data.repeatUntil || "").trim();
    if (!until) throw new Error("Indica hasta qué fecha debe repetirse la tarea.");
    dateKeys = enumerateLocalDates(dateKeys[0], until);
    if (!dateKeys.length) {
      throw new Error("La fecha «hasta» debe ser igual o posterior a la fecha de la tarea.");
    }
    if (dateKeys.length > MAX_RECURRING_DAYS) {
      throw new Error(`Máximo ${MAX_RECURRING_DAYS} días de repetición.`);
    }
  }
  const recurrenceId = dateKeys.length > 1 ? makeRecurrenceId() : null;
  const ids: string[] = [];
  for (const dateStr of dateKeys) {
    const ref = await addDoc(collection(getDb(), "tasks"), {
      title: data.title.trim(),
      description: (data.description || "").trim(),
      createdBy: data.createdBy,
      assignedUserIds: data.assignees.map((a) => a.uid),
      assignedUsersInfo: data.assignees.map((a) => ({
        uid: a.uid,
        fullName: a.fullName,
        userType: a.userType,
        dni: a.dni,
      })),
      assignedToAll: data.assignedToAll,
      status: "PENDING",
      taskDate: parseDateInput(dateStr),
      startTime: data.startTime.trim(),
      endTime: data.endTime.trim(),
      recurrenceId,
      createdAt: serverTimestamp(),
    });
    ids.push(ref.id);
  }
  return ids;
}

async function fetchPendingLinesForUser(uid: string) {
  const snap = await getDocs(
    query(
      collection(getDb(), "tasks"),
      where("assignedUserIds", "array-contains", uid),
      where("status", "==", "PENDING")
    )
  );
  return snap.docs
    .map((d) => {
      const t = { id: d.id, ...d.data() } as Task;
      return {
        title: t.title,
        when: formatScheduled(t),
        description: t.description || "",
        assignedToAll: t.assignedToAll === true,
      };
    })
    .sort((a, b) => a.when.localeCompare(b.when, "es"));
}

export async function sendGroupedTaskEmails(
  assigneeUids: string[],
  users: User[],
  sender: { email: string; fullName: string }
) {
  const notifications = [];
  for (const uid of assigneeUids) {
    const user = users.find((u) => u.uid === uid);
    if (!user?.email) continue;
    const tasks = await fetchPendingLinesForUser(uid);
    if (!tasks.length) continue;
    notifications.push({
      email: user.email.trim(),
      fullName: user.fullName,
      tasks,
    });
  }
  if (!notifications.length) throw new Error("Sin destinatarios con email");

  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      secret: requireNotifySecret(),
      senderEmail: sender.email.trim(),
      senderName: sender.fullName.trim() || sender.email,
      notifications,
    }),
  });
  const text = await res.text();
  try {
    const json = JSON.parse(text) as { ok?: boolean; error?: string };
    if (json.ok === false) throw new Error(json.error || "Error Apps Script");
  } catch (e) {
    if (e instanceof Error && e.message !== "Error Apps Script") {
      /* respuesta no JSON pero puede haberse enviado */
    } else if (e instanceof Error) throw e;
  }
  return notifications.length;
}

export function sortUsersForAssign(users: User[]): User[] {
  const roleOrder = { ADMIN: 0, WORKER: 1 };
  return [...users].sort((a, b) => {
    const ra = roleOrder[a.role] ?? 9;
    const rb = roleOrder[b.role] ?? 9;
    if (ra !== rb) return ra - rb;
    const ta = USER_TYPE_ORDER[a.userType] ?? 9;
    const tb = USER_TYPE_ORDER[b.userType] ?? 9;
    if (ta !== tb) return ta - tb;
    return a.fullName.localeCompare(b.fullName, "es");
  });
}

export function todayDateInput(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
