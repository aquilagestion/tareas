import type { Timestamp } from "firebase-admin/firestore";

export interface TaskScheduleFields {
  taskDate?: Timestamp | { toDate?: () => Date };
  startTime?: string;
  endTime?: string;
}

export function formatTaskWhen(task: TaskScheduleFields): string {
  let dateStr = "";
  const td = task.taskDate as { toDate?: () => Date } | undefined;
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

/** Teléfono móvil español → E.164 sin + (ej. 620325488 → 34620325488). */
export function normalizePhoneE164(raw: string): string | null {
  const d = String(raw || "").replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("34") && d.length >= 11) return d;
  if (d.length === 9 && /^[67]/.test(d)) return "34" + d;
  if (d.length >= 10) return d;
  return null;
}
