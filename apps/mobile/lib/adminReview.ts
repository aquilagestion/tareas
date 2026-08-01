import { doc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { getDb } from "@grefa/firebase";
import type { TaskLog } from "@grefa/shared";

export async function approveTask(
  taskId: string,
  logId: string | undefined,
  adminUid: string
): Promise<void> {
  await updateDoc(doc(getDb(), "tasks", taskId), {
    status: "COMPLETED",
    auditedAt: serverTimestamp(),
    auditedBy: adminUid,
  });
  if (logId) {
    await updateDoc(doc(getDb(), "taskLogs", logId), {
      audited: true,
      auditedAt: serverTimestamp(),
      auditedBy: adminUid,
    });
  }
}

export async function returnTask(taskId: string, logId: string | undefined): Promise<void> {
  await updateDoc(doc(getDb(), "tasks", taskId), {
    status: "PENDING",
    completedAt: null,
    completedBy: null,
    completedByName: null,
    completionNotes: null,
    materialShortage: null,
    auditedAt: null,
    auditedBy: null,
  });
  if (logId) await deleteDoc(doc(getDb(), "taskLogs", logId));
}

/** Un log por tarea (prioriza el auditado). */
export function logsByTaskId(logs: TaskLog[]): Record<string, TaskLog> {
  const map: Record<string, TaskLog> = {};
  for (const log of logs) {
    if (!log.taskId) continue;
    const prev = map[log.taskId];
    if (!prev || (log.audited && !prev.audited)) {
      map[log.taskId] = log;
    }
  }
  return map;
}

export function formatTs(ts: unknown): string {
  if (ts && typeof ts === "object" && "toDate" in ts && typeof ts.toDate === "function") {
    return ts.toDate().toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
  }
  return "—";
}
