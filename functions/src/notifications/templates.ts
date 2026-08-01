/** Plantillas de aviso de programación de tareas (agrupadas por trabajador). */
export const SCHEDULE_SUBJECT_NEW = "GREFA Tareas — Tus tareas programadas";
export const SCHEDULE_SUBJECT_DAILY = "GREFA Tareas — Recordatorio: tareas de hoy";

export interface ScheduleTaskLine {
  title: string;
  when: string;
  description?: string;
  assignedToAll?: boolean;
}

const ALL_STAFF_LABEL = "Asignada a TODO el personal";

export function buildScheduleEmailHtml(params: {
  fullName: string;
  tasks: ScheduleTaskLine[];
}): string {
  const rows = params.tasks.map((t) => formatTaskRowHtml(t)).join("");
  const hasAll = params.tasks.some((t) => t.assignedToAll);
  const intro =
    params.tasks.length === 1
      ? "Esta es tu tarea pendiente:"
      : `Tienes ${params.tasks.length} tareas pendientes:`;
  const allNote = hasAll
    ? `<p style="color:#92400e;font-weight:600">Incluye tarea(s) marcadas como <strong>${escape(ALL_STAFF_LABEL)}</strong>.</p>`
    : "";
  return `<p>Hola ${escape(params.fullName)},</p>
<p>${intro}</p>
${allNote}
<ul>${rows}</ul>
<p>Consulta la app <strong>GREFA Tareas</strong> para ver el detalle y marcarlas como hechas.</p>
<p>— GREFA · Majadahonda</p>`;
}

export function buildScheduleSmsText(params: {
  fullName: string;
  tasks: ScheduleTaskLine[];
}): string {
  const hasAll = params.tasks.some((t) => t.assignedToAll);
  const lines = params.tasks.map((t) => formatTaskRowText(t)).join("\n");
  const header =
    params.tasks.length === 1
      ? "Tu tarea pendiente:"
      : `Tus ${params.tasks.length} tareas pendientes:`;
  const allNote = hasAll ? `\n⚠ Incluye tarea(s): ${ALL_STAFF_LABEL}\n` : "";
  return `GREFA Tareas — Hola ${params.fullName}:\n\n${header}${allNote}\n${lines}\n\nConsulta la app GREFA Tareas.`;
}

function formatTaskRowHtml(t: ScheduleTaskLine): string {
  const badge = t.assignedToAll
    ? ` <span style="color:#92400e;font-weight:700">[${escape(ALL_STAFF_LABEL)}]</span>`
    : "";
  let row = `<li><strong>${escape(t.title)}</strong>${badge} — ${escape(t.when)}`;
  if (t.description) row += `<br/><span style="color:#57534e">${escape(t.description)}</span>`;
  return row + "</li>";
}

function formatTaskRowText(t: ScheduleTaskLine): string {
  const badge = t.assignedToAll ? ` [${ALL_STAFF_LABEL}]` : "";
  let line = `• ${t.title}${badge} (${t.when})`;
  if (t.description) line += `\n  ${t.description.slice(0, 120)}`;
  return line;
}

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
