import type { AssigneeInput } from "./adminTasks";

export interface TaskShareInput {
  title: string;
  description: string;
  taskDate: string;
  startTime: string;
  endTime: string;
  assignees: AssigneeInput[];
  repeatDaily?: boolean;
  repeatUntil?: string;
  count?: number;
}

export function formatTaskShareText(data: TaskShareInput): string {
  const names = data.assignees.map((a) => a.fullName).join(", ");
  const schedule = [data.taskDate, data.startTime, data.endTime].filter(Boolean).join(" · ");
  const lines = [
    "GREFA Tareas — Asignación",
    "",
    `Título: ${data.title.trim()}`,
    `Fecha: ${data.taskDate}`,
  ];
  if (data.startTime || data.endTime) {
    lines.push(`Horario: ${data.startTime || "—"}${data.endTime ? ` – ${data.endTime}` : ""}`);
  }
  if (data.repeatDaily && data.repeatUntil) {
    lines.push(`Repetición: diaria hasta ${data.repeatUntil}`);
  }
  if (data.count && data.count > 1) {
    lines.push(`Tareas creadas: ${data.count}`);
  }
  lines.push(`Asignados: ${names}`);
  if (data.description.trim()) {
    lines.push("", "Descripción:", data.description.trim());
  }
  return lines.join("\n");
}

export function formatTaskShareHtml(data: TaskShareInput): string {
  const text = formatTaskShareText(data);
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"/>
<title>${esc(data.title.trim())}</title>
<style>body{font-family:Arial,sans-serif;padding:20px;line-height:1.5;color:#111}
h1{color:#2F6B3A;font-size:18px}pre{white-space:pre-wrap;font-family:Arial,sans-serif}</style>
</head><body>
<h1>GREFA Tareas — Asignación</h1>
<pre>${esc(text)}</pre>
</body></html>`;
}
