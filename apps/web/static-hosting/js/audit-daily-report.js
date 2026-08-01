/** Informe diario GREFA — formulario A4 apaisado (réplica del impreso). */

import { GREFA_LOGO_DATA_URI } from "./grefa-logo-data.js";

const ROWS_PER_PAGE = 10;
const RESP_SLOTS = 3;
const AYUD_SLOTS = 6;

function formatReportDateShort(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

function toLocalDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

import { enumerateLocalDates } from "./date-range.js";

/** Lista de fechas YYYY-MM-DD inclusive (from → to). */
export function enumerateDates(fromStr, toStr) {
  return enumerateLocalDates(fromStr, toStr);
}

function sameCalendarDay(ts, dateStr) {
  if (!ts?.toDate) return false;
  const d = ts.toDate();
  const [y, m, day] = dateStr.split("-").map(Number);
  return d.getFullYear() === y && d.getMonth() === m - 1 && d.getDate() === day;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function uniqueNames(list) {
  const seen = new Set();
  const out = [];
  for (const name of list) {
    const n = String(name || "").trim();
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

function formatCompletionTime(ts) {
  if (!ts?.toDate) return "";
  return ts.toDate().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function buildDescription(title, desc, completedTs) {
  const time = formatCompletionTime(completedTs);
  const head = time ? `${time} — ${title}` : title;
  const body = (desc || "").trim();
  if (body && body !== title) return `${head}\n${body}`;
  return head;
}

/** Tareas auditadas/completadas del día (fecha programada o fecha de chequeo). */
export function tasksForDailyReport(tasks, logsByTask, dateStr) {
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
          : (t.materialShortage || log?.materialShortage || ""),
        hecha: true,
        pendiente: false,
        revisado: true,
        sortKey: completedTs?.toDate?.()?.getTime?.() ?? 0,
      };
    })
    .sort((a, b) => {
      if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
      return a.description.localeCompare(b.description, "es");
    });
}

function padDayRows(rows) {
  const page = rows.map((r) => ({ ...r, empty: false }));
  while (page.length < ROWS_PER_PAGE) page.push({ empty: true });
  return page;
}

function chunkDayPages(rows) {
  if (!rows.length) return [padDayRows([])];
  const pages = [];
  for (let i = 0; i < rows.length; i += ROWS_PER_PAGE) {
    pages.push(padDayRows(rows.slice(i, i + ROWS_PER_PAGE)));
  }
  return pages;
}

/** Sufijo que acompaña al nombre en la columna de ayudantes. */
const TYPE_SUFFIX = {
  TRABAJADOR_GREFA: "T",
  VOLUNTARIO: "V",
  PERSONAL_PRACTICAS: "P",
};

/** Orden de la columna de ayudantes: GREFA, voluntariado y prácticas. */
const TYPE_ORDER = ["TRABAJADOR_GREFA", "VOLUNTARIO", "PERSONAL_PRACTICAS"];

function staffKey(name) {
  return String(name ?? "").trim().toLocaleLowerCase("es");
}

/** Sin tipo se cuenta como trabajador de GREFA, que es el caso corriente. */
function staffType(ref) {
  const t = String(ref.userType || "").trim();
  return TYPE_SUFFIX[t] ? t : TYPE_ORDER[0];
}

function ayudanteLabel(ref) {
  return `${ref.fullName} -${TYPE_SUFFIX[staffType(ref)]}-`;
}

/**
 * Cabecera del día: los administradores van a RESPONSABLES y el resto a
 * AYUDANTES con su tipo entre guiones. Entran tanto quien tuviera turno en el
 * cuadrante como quien realizara alguna tarea sin estar previsto; a quien no
 * se encuentre en las fichas se le supone trabajador de GREFA.
 */
function buildStaffLists(rows, responsibleName, onDuty = [], directory = []) {
  const fichas = new Map();
  for (const ref of [...directory, ...onDuty]) {
    const key = staffKey(ref?.fullName);
    if (!key) continue;
    fichas.set(key, { ...(fichas.get(key) || {}), ...ref });
  }

  const present = new Map();
  for (const name of [...onDuty.map((p) => p?.fullName), ...rows.map((r) => r.performedBy)]) {
    const key = staffKey(name);
    if (!key || present.has(key)) continue;
    present.set(key, fichas.get(key) || { fullName: String(name).trim() });
  }

  const responsible = String(responsibleName || "").trim();
  const responsibleKey = staffKey(responsible);
  const people = [...present.values()].filter(
    (p) => staffKey(p.fullName) !== responsibleKey
  );

  const responsables = uniqueNames([
    responsible,
    ...people
      .filter((p) => p.role === "ADMIN")
      .map((p) => p.fullName)
      .sort((a, b) => a.localeCompare(b, "es")),
  ]);

  const ayudantes = people
    .filter((p) => p.role !== "ADMIN")
    .sort(
      (a, b) =>
        TYPE_ORDER.indexOf(staffType(a)) - TYPE_ORDER.indexOf(staffType(b)) ||
        a.fullName.localeCompare(b.fullName, "es")
    )
    .map(ayudanteLabel);

  return { responsables, ayudantes };
}

function isNoiseMaterial(value) {
  const v = String(value || "").trim();
  if (!v) return true;
  if (/^https?:\/\//i.test(v)) return true;
  if (v.includes("grefa-logo") || v.includes("/img/")) return true;
  return false;
}

function buildMaterialText(rows) {
  return rows
    .filter((r) => r.material && !isNoiseMaterial(r.material))
    .map((r, i) => {
      const label = r.description.split("\n")[0] || `Tarea ${i + 1}`;
      return `${label}: ${r.material}`;
    })
    .join("\n");
}

/** La cabecera solo tiene tres huecos de responsable y seis de ayudante. */
function buildExtraStaffNote(staff) {
  const parts = [];
  if (staff.responsables.length > RESP_SLOTS) {
    parts.push(`Responsables adicionales: ${staff.responsables.slice(RESP_SLOTS).join(", ")}`);
  }
  if (staff.ayudantes.length > AYUD_SLOTS) {
    parts.push(`Ayudantes adicionales: ${staff.ayudantes.slice(AYUD_SLOTS).join(", ")}`);
  }
  return parts.join("\n");
}

function markCell(on) {
  return on ? "X" : "";
}

function infoTableHtml(fecha, responsables, ayudantes) {
  const resp = [0, 1, 2].map((i) => responsables[i] || "");
  const ayud = [0, 1, 2, 3, 4, 5].map((i) => ayudantes[i] || "");
  const rows = [0, 1, 2].map((i) => {
    const respCells =
      i === 0
        ? `<td rowspan="3" class="fecha-cell">${escapeHtml(fecha)}</td>`
        : "";
    return `<tr>
      ${respCells}
      <td class="info-num">${i + 1}.</td>
      <td class="info-name">${escapeHtml(resp[i])}</td>
      <td class="info-num">${i + 1}.</td>
      <td class="info-name">${escapeHtml(ayud[i])}</td>
      <td class="info-num">${i + 4}.</td>
      <td class="info-name">${escapeHtml(ayud[i + 3])}</td>
    </tr>`;
  }).join("");

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

function taskRowHtml(row, index) {
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

function sheetHtml(pageRows, dateStr, materialText, extraNotes, staff, pageBreak) {
  const ayudSlots = staff.ayudantes.slice(0, AYUD_SLOTS);
  const fecha = formatReportDateShort(dateStr);
  const tasksBody = pageRows.map((r, i) => taskRowHtml(r, i)).join("");

  return `<section class="sheet${pageBreak ? " page-break" : ""}">
  <div class="top">
    <img class="logo" src="${GREFA_LOGO_DATA_URI}" alt="GREFA"/>
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
@media print {
  .sheet { height: auto; max-height: none; page-break-inside: avoid; }
}
`;

function buildReportHtml(sheetsHtml, title) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(title)}</title>
  <style>${REPORT_CSS}</style>
</head>
<body>${sheetsHtml}</body>
</html>`;
}

/**
 * Imprime informe(s) GREFA. Un día = una página A4 apaisada (10 filas).
 * @param {string} dateFrom YYYY-MM-DD
 * @param {string} dateTo YYYY-MM-DD
 */
/**
 * @param {string} responsibleName Administrador con sesión abierta (responsable del informe).
 * @param {{onDutyByDate?: Record<string, Array<{fullName: string, role?: string, userType?: string}>>,
 *          directory?: Array<{fullName: string, role?: string, userType?: string}>}} staff
 *        Quién tenía turno cada día y todas las fichas, para la cabecera.
 */
export function printDailyAuditReport(
  tasks,
  logsByTask,
  dateFrom,
  dateTo,
  responsibleName = "",
  staff = {}
) {
  const dates = enumerateDates(dateFrom, dateTo || dateFrom);
  if (!dates.length) {
    return { ok: false, count: 0, days: 0, error: "Rango de fechas no válido." };
  }

  let totalTasks = 0;
  const sheetParts = [];
  dates.forEach((dateStr, dateIdx) => {
    const rows = tasksForDailyReport(tasks, logsByTask, dateStr);
    totalTasks += rows.length;
    const materialText = buildMaterialText(rows);
    /** Una sola cabecera por día: se repite igual en las hojas de continuación. */
    const dayStaff = buildStaffLists(
      rows,
      responsibleName,
      (staff.onDutyByDate || {})[dateStr] || [],
      staff.directory || []
    );
    const extraNotes = buildExtraStaffNote(dayStaff);
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
        sheetHtml(pageRows, dateStr, mat, notes, dayStaff, pageBreak)
      );
    });
  });

  const title =
    dates.length === 1
      ? `Informe GREFA ${formatReportDateShort(dates[0])}`
      : `Informe GREFA ${formatReportDateShort(dates[0])} – ${formatReportDateShort(dates[dates.length - 1])}`;

  const html = buildReportHtml(sheetParts.join(""), title);

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);

  const win = frame.contentWindow;
  const doc = win.document;
  doc.open();
  doc.write(html);
  doc.close();

  const doPrint = () => {
    win.focus();
    win.print();
    setTimeout(() => frame.remove(), 2000);
  };

  const img = new Image();
  img.onload = () => setTimeout(doPrint, 200);
  img.onerror = () => setTimeout(doPrint, 200);
  img.src = GREFA_LOGO_DATA_URI;
  setTimeout(doPrint, 1200);

  return { ok: true, count: totalTasks, days: dates.length };
}
