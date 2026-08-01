import { enumerateLocalDates } from "./dates";
import type { Task, TaskLog } from "./types";

const ROWS_PER_PAGE = 10;
const DEFAULT_LOGO_URL = "https://grefa-tareas.web.app/img/grefa-logo.png";

export type LogsByTask = Record<string, TaskLog>;

interface ReportRow {
  description: string;
  performedBy: string;
  comments: string;
  material: string;
  hecha: boolean;
  pendiente: boolean;
  revisado: boolean;
  sortKey: number;
  empty: boolean;
}

function formatReportDateShort(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

function toDateFromFirestore(ts: unknown): Date | null {
  if (!ts) return null;
  if (typeof ts === "object" && "toDate" in ts) {
    const toDate = (ts as { toDate?: unknown }).toDate;
    if (typeof toDate === "function") return toDate.call(ts);
  }
  if (typeof ts === "object" && "seconds" in ts) {
    const sec = (ts as { seconds: number }).seconds;
    if (typeof sec === "number") return new Date(sec * 1000);
  }
  return null;
}

function sameCalendarDay(ts: unknown, dateStr: string): boolean {
  const d = toDateFromFirestore(ts);
  if (!d) return false;
  const [y, m, day] = dateStr.split("-").map(Number);
  return d.getFullYear() === y && d.getMonth() === m - 1 && d.getDate() === day;
}

function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function uniqueNames(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of list) {
    const n = String(name || "").trim();
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

function formatCompletionTime(ts: unknown): string {
  const d = toDateFromFirestore(ts);
  if (!d) return "";
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function buildDescription(title: string, desc: string, completedTs: unknown): string {
  const time = formatCompletionTime(completedTs);
  const head = time ? `${time} — ${title}` : title;
  const body = (desc || "").trim();
  if (body && body !== title) return `${head}\n${body}`;
  return head;
}

function isNoiseMaterial(value: unknown): boolean {
  const v = String(value || "").trim();
  if (!v) return true;
  if (/^https?:\/\//i.test(v)) return true;
  if (v.includes("grefa-logo") || v.includes("/img/")) return true;
  return false;
}

export function tasksForDailyReport(
  tasks: Task[],
  logsByTask: LogsByTask,
  dateStr: string
): ReportRow[] {
  return tasks
    .filter((t) => {
      const log = logsByTask[t.id];
      if (sameCalendarDay(t.taskDate, dateStr)) return true;
      const auditedTs = t.auditedAt || log?.auditedAt;
      return sameCalendarDay(auditedTs, dateStr);
    })
    .map((t) => {
      const log = logsByTask[t.id];
      const title = t.title || log?.taskTitle || "";
      const desc = (t.description || log?.taskDescription || "").trim();
      const completedTs = t.completedAt || log?.completionDate;
      return {
        description: buildDescription(title, desc, completedTs),
        performedBy: t.completedByName || log?.completedByName || "",
        comments: t.completionNotes || log?.comments || "",
        material: isNoiseMaterial(t.materialShortage || log?.materialShortage)
          ? ""
          : String(t.materialShortage || log?.materialShortage || ""),
        hecha: true,
        pendiente: false,
        revisado: true,
        sortKey: toDateFromFirestore(completedTs)?.getTime() ?? 0,
        empty: false,
      };
    })
    .sort((a, b) => {
      if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
      return a.description.localeCompare(b.description, "es");
    });
}

function padDayRows(rows: ReportRow[]): ReportRow[] {
  const page = rows.map((r) => ({ ...r, empty: false }));
  while (page.length < ROWS_PER_PAGE) {
    page.push({
      description: "",
      performedBy: "",
      comments: "",
      material: "",
      hecha: false,
      pendiente: false,
      revisado: false,
      sortKey: 0,
      empty: true,
    });
  }
  return page;
}

function chunkDayPages(rows: ReportRow[]): ReportRow[][] {
  if (!rows.length) return [padDayRows([])];
  const pages: ReportRow[][] = [];
  for (let i = 0; i < rows.length; i += ROWS_PER_PAGE) {
    pages.push(padDayRows(rows.slice(i, i + ROWS_PER_PAGE)));
  }
  return pages;
}

/**
 * Ayudantes del día: quien tuviera turno en el cuadrante más quien realizara
 * alguna tarea, aunque no estuviera previsto. El responsable no se repite.
 */
function buildStaffLists(
  rows: ReportRow[],
  responsibleName: string,
  onDutyNames: string[] = []
) {
  const responsible = String(responsibleName || "").trim();
  const ayudantes = uniqueNames([...onDutyNames, ...rows.map((r) => r.performedBy)])
    .filter((n) => n !== responsible)
    .sort((a, b) => a.localeCompare(b, "es"));
  const responsables = responsible ? [responsible] : [];
  return { responsables, ayudantes };
}

function buildMaterialText(rows: ReportRow[]): string {
  return rows
    .filter((r) => r.material && !isNoiseMaterial(r.material))
    .map((r, i) => {
      const label = r.description.split("\n")[0] || `Tarea ${i + 1}`;
      return `${label}: ${r.material}`;
    })
    .join("\n");
}

function buildExtraAyudantesNote(ayudantes: string[]): string {
  if (ayudantes.length <= 6) return "";
  return `Ayudantes adicionales: ${ayudantes.slice(6).join(", ")}`;
}

function markCell(on: boolean): string {
  return on ? "X" : "";
}

function infoTableHtml(fecha: string, responsables: string[], ayudantes: string[]): string {
  const resp = [0, 1, 2].map((i) => responsables[i] || "");
  const ayud = [0, 1, 2, 3, 4, 5].map((i) => ayudantes[i] || "");
  const rows = [0, 1, 2]
    .map((i) => {
      const respCells =
        i === 0 ? `<td rowspan="3" class="fecha-cell">${escapeHtml(fecha)}</td>` : "";
      return `<tr>
      ${respCells}
      <td class="info-num">${i + 1}.</td>
      <td class="info-name">${escapeHtml(resp[i])}</td>
      <td class="info-num">${i + 1}.</td>
      <td class="info-name">${escapeHtml(ayud[i])}</td>
      <td class="info-num">${i + 4}.</td>
      <td class="info-name">${escapeHtml(ayud[i + 3])}</td>
    </tr>`;
    })
    .join("");

  return `<table class="info-table">
    <thead>
      <tr>
        <th>FECHA</th>
        <th colspan="2">RESPONSABLES</th>
        <th colspan="4">AYUDANTES</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function taskRowHtml(row: ReportRow, index: number): string {
  const n = index + 1;
  if (row.empty) {
    return `<tr class="task-row blank">
      <td class="task-num">${n}</td>
      <td class="mark"></td><td class="mark"></td><td class="mark"></td>
      <td></td><td></td><td></td>
    </tr>`;
  }
  const desc = escapeHtml(row.description).replace(/\n/g, "<br>");
  return `<tr class="task-row">
    <td class="task-num">${n}</td>
    <td class="mark">${markCell(row.hecha)}</td>
    <td class="mark">${markCell(row.pendiente)}</td>
    <td class="mark">${markCell(row.revisado)}</td>
    <td class="desc">${desc}</td>
    <td class="performed">${escapeHtml(row.performedBy)}</td>
    <td class="comments">${escapeHtml(row.comments)}</td>
  </tr>`;
}

function sheetHtml(
  pageRows: ReportRow[],
  dateStr: string,
  materialText: string,
  extraNotes: string,
  responsibleName: string,
  pageBreak: boolean,
  logoUrl: string,
  onDutyNames: string[]
): string {
  const dayRows = pageRows.filter((r) => !r.empty);
  const staff = buildStaffLists(dayRows, responsibleName, onDutyNames);
  const ayudSlots = staff.ayudantes.slice(0, 6);
  const fecha = formatReportDateShort(dateStr);
  const tasksBody = pageRows.map((r, i) => taskRowHtml(r, i)).join("");

  return `<section class="sheet${pageBreak ? " page-break" : ""}">
  <div class="top">
    <img class="logo" src="${escapeHtml(logoUrl)}" alt="GREFA"/>
    ${infoTableHtml(fecha, staff.responsables, ayudSlots)}
  </div>
  <p class="tasks-title">TAREAS</p>
  <table class="tasks-table">
    <thead>
      <tr>
        <th class="task-num"></th>
        <th class="mark">HECHA</th>
        <th class="mark">PENDIENTE</th>
        <th class="mark">REVISADO</th>
        <th class="desc">DESCRIPCIÓN</th>
        <th class="performed">REALIZADA<br/>POR</th>
        <th class="comments">COMENTARIOS<br/><span class="th-sub">(de la realización de la tarea)</span></th>
      </tr>
    </thead>
    <tbody>${tasksBody}</tbody>
  </table>
  <table class="footer-table">
    <thead>
      <tr>
        <th>MATERIAL A REPONER</th>
        <th>OTRAS OBSERVACIONES</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="footer-box">${escapeHtml(materialText)}</td>
        <td class="footer-box">${escapeHtml(extraNotes)}</td>
      </tr>
    </tbody>
  </table>
</section>`;
}

const REPORT_CSS = `
@page { size: A4 landscape; margin: 8mm 10mm 9mm; }
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 8.5pt;
  color: #000;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.sheet {
  width: 100%;
  height: 190mm;
  max-height: 190mm;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.page-break { page-break-after: always; break-after: page; }
.top {
  display: flex;
  align-items: flex-start;
  gap: 6mm;
  margin-bottom: 2mm;
  flex-shrink: 0;
}
.logo {
  width: 42mm;
  max-height: 22mm;
  flex-shrink: 0;
  display: block;
  object-fit: contain;
}
.info-table {
  flex: 1;
  border-collapse: collapse;
  table-layout: fixed;
}
.info-table th,
.info-table td {
  border: 1px solid #000;
  padding: 1mm 1.5mm;
  vertical-align: middle;
  font-size: 8pt;
}
.info-table th {
  font-weight: 700;
  text-align: center;
  text-transform: uppercase;
}
.fecha-cell {
  width: 14%;
  text-align: center;
  font-weight: 700;
  font-size: 11pt;
  vertical-align: middle;
}
.info-num { width: 5mm; text-align: right; padding-right: 1mm; }
.info-name { min-height: 4.5mm; }
.tasks-title {
  margin: 0 0 1mm;
  font-weight: 700;
  font-size: 9pt;
  text-transform: uppercase;
  flex-shrink: 0;
}
.tasks-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  margin-bottom: 0;
  flex: 1 1 auto;
}
.tasks-table th,
.tasks-table td {
  border: 1px solid #000;
  padding: 0.8mm 1.2mm;
  vertical-align: top;
  font-size: 8pt;
  line-height: 1.2;
}
.tasks-table thead th {
  font-weight: 700;
  text-align: center;
  text-transform: uppercase;
  vertical-align: middle;
  padding: 1mm 0.8mm;
}
.th-sub {
  font-weight: 400;
  text-transform: none;
  font-size: 6.5pt;
  display: block;
  line-height: 1.1;
}
.task-num { width: 5mm; text-align: center; font-weight: 700; }
.mark { width: 10mm; text-align: center; vertical-align: middle; font-weight: 700; }
.desc { width: 40%; }
.performed { width: 14%; }
.comments { width: 24%; }
.task-row { height: 8.5mm; }
.task-row.blank td { height: 8.5mm; }
.footer-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  margin-top: -1px;
  flex-shrink: 0;
}
.footer-table th,
.footer-table td {
  border: 1px solid #000;
  padding: 1mm 1.5mm;
  vertical-align: top;
}
.footer-table th {
  font-weight: 700;
  text-align: center;
  text-transform: uppercase;
  font-size: 8pt;
}
.footer-box {
  height: 22mm;
  white-space: pre-wrap;
  font-size: 8pt;
}
`;

export interface AuditReportResult {
  ok: boolean;
  html?: string;
  title?: string;
  count: number;
  days: number;
  error?: string;
}

export function buildDailyAuditReportHtml(
  tasks: Task[],
  logsByTask: LogsByTask,
  dateFrom: string,
  dateTo: string,
  responsibleName = "",
  logoUrl = DEFAULT_LOGO_URL,
  /** Nombres con turno en el cuadrante, por clave YYYY-MM-DD */
  onDutyByDate: Record<string, string[]> = {}
): AuditReportResult {
  const dates = enumerateLocalDates(dateFrom, dateTo || dateFrom);
  if (!dates.length) {
    return { ok: false, count: 0, days: 0, error: "Rango de fechas no válido." };
  }

  let totalTasks = 0;
  const sheetParts: string[] = [];
  dates.forEach((dateStr, dateIdx) => {
    const rows = tasksForDailyReport(tasks, logsByTask, dateStr);
    const onDuty = onDutyByDate[dateStr] ?? [];
    totalTasks += rows.length;
    const materialText = buildMaterialText(rows);
    const extraNotes = buildExtraAyudantesNote(
      buildStaffLists(rows, responsibleName, onDuty).ayudantes
    );
    const dayPages = chunkDayPages(rows);
    dayPages.forEach((pageRows, pageIdx) => {
      const isLastSheet =
        dateIdx === dates.length - 1 && pageIdx === dayPages.length - 1;
      const pageBreak = !isLastSheet;
      const mat = pageIdx === 0 ? materialText : "";
      let notes = pageIdx === 0 ? extraNotes : "";
      if (pageIdx > 0) {
        notes = notes ? `${notes}\n` : "";
        notes += `(continuación — ${formatReportDateShort(dateStr)})`;
      }
      sheetParts.push(
        sheetHtml(pageRows, dateStr, mat, notes, responsibleName, pageBreak, logoUrl, onDuty)
      );
    });
  });

  const title =
    dates.length === 1
      ? `Informe GREFA ${formatReportDateShort(dates[0])}`
      : `Informe GREFA ${formatReportDateShort(dates[0])} – ${formatReportDateShort(dates[dates.length - 1])}`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(title)}</title>
  <style>${REPORT_CSS}</style>
</head>
<body>${sheetParts.join("")}</body>
</html>`;

  return { ok: true, html, title, count: totalTasks, days: dates.length };
}
