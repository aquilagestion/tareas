import type { Task } from "@grefa/shared";

export function taskDayKey(task: Task): string {
  const ts = task.taskDate as { toDate?: () => Date } | undefined;
  if (!ts?.toDate) return "";
  return ts.toDate().toISOString().slice(0, 10);
}

export function formatScheduled(task: Task): string {
  let dateStr = "";
  const td = task.taskDate as { toDate?: () => Date } | undefined;
  if (td?.toDate) dateStr = td.toDate().toLocaleDateString("es-ES");
  const start = task.startTime || "";
  const end = task.endTime || "";
  if (!dateStr && !start) return "Sin fecha programada";
  let s = dateStr;
  if (start) s += (s ? " · " : "") + start;
  if (end) s += "–" + end;
  return s;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function mondayOf(d: Date): Date {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}
