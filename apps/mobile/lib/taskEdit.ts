import { doc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { getDb } from "@grefa/firebase";
import type { Task } from "@grefa/shared";

function parseDateInput(value: string): Timestamp {
  const v = value.trim();
  const [y, m, d] = v.split("-").map(Number);
  if (!y || !m || !d) return Timestamp.now();
  return Timestamp.fromDate(new Date(y, m - 1, d, 12, 0, 0));
}

export function taskToDateInput(task: Task): string {
  const ts = task.taskDate as { toDate?: () => Date } | undefined;
  if (!ts?.toDate) return "";
  const d = ts.toDate();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export async function updateTaskFields(
  taskId: string,
  data: {
    title: string;
    description: string;
    taskDate: string;
    startTime: string;
    endTime: string;
    materialShortage: string;
    completionNotes: string;
  }
): Promise<void> {
  await updateDoc(doc(getDb(), "tasks", taskId), {
    title: data.title.trim(),
    description: data.description.trim(),
    taskDate: parseDateInput(data.taskDate),
    startTime: data.startTime.trim(),
    endTime: data.endTime.trim(),
    materialShortage: data.materialShortage.trim() || null,
    completionNotes: data.completionNotes.trim() || null,
    updatedAt: serverTimestamp(),
  });
}
