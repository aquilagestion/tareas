import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  type Unsubscribe,
  type DocumentData,
} from "firebase/firestore";
import type { Task, User, TaskLog } from "@grefa/shared";
import { getDb } from "./firebase";

function mapDoc<T extends { id: string }>(id: string, data: DocumentData): T {
  return { id, ...data } as T;
}

/** Perfil del usuario autenticado */
export function subscribeUser(
  uid: string,
  onChange: (user: User | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(getDb(), "users", uid),
    (snap) => {
      if (!snap.exists()) {
        onChange(null);
        return;
      }
      onChange(mapDoc<User>(snap.id, snap.data()));
    },
    (err) => onError?.(err)
  );
}

/** Personal activo (ADMIN) */
export function subscribeActiveUsers(
  onChange: (users: User[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(collection(getDb(), "users"), where("active", "==", true));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => mapDoc<User>(d.id, d.data()))),
    (err) => onError?.(err)
  );
}

/** Tareas asignadas a un usuario (móvil) */
export function subscribeTasksForUser(
  uid: string,
  onChange: (tasks: Task[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(
    collection(getDb(), "tasks"),
    where("assignedUserIds", "array-contains", uid),
    orderBy("taskDate", "desc")
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => mapDoc<Task>(d.id, d.data()))),
    (err) => onError?.(err)
  );
}

/** Todas las tareas por estado (web admin) */
export function subscribeTasksByStatus(
  status: Task["status"],
  onChange: (tasks: Task[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(
    collection(getDb(), "tasks"),
    where("status", "==", status),
    orderBy("taskDate", "desc")
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => mapDoc<Task>(d.id, d.data()))),
    (err) => onError?.(err)
  );
}

/** Logs de auditoría (web admin) */
export function subscribeTaskLogs(
  onChange: (logs: TaskLog[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(collection(getDb(), "taskLogs"), orderBy("completionDate", "desc"));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => mapDoc<TaskLog>(d.id, d.data()))),
    (err) => onError?.(err)
  );
}
