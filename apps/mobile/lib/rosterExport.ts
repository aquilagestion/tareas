import type { RosterRow } from "./rosterData";
import { shareHtmlAsPdf } from "./shareExport";

function esc(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Cuadrante en HTML apaisado, listo para PDF o impresión. */
export function buildRosterHtml(
  weekLabel: string,
  dayLabels: string[],
  rows: RosterRow[],
  footer = ""
): string {
  const head = dayLabels.map((d) => `<th>${esc(d)}</th>`).join("");
  const body = rows
    .map((row) => {
      const cells = row.marks
        .map((m) => {
          const cls = m === "SI" ? "ok" : m === "NO" ? "off" : "";
          const text = m === "SI" ? "Sí" : m === "NO" ? "No" : "·";
          return `<td class="${cls}">${text}</td>`;
        })
        .join("");
      const extra = [row.role, row.hours].filter(Boolean).map(esc).join(" · ");
      return `<tr><td class="name"><strong>${esc(row.name)}</strong>${
        extra ? `<br/><span class="sub">${extra}</span>` : ""
      }</td>${cells}</tr>`;
    })
    .join("");
  const totals = dayLabels
    .map((_, i) => {
      const n = rows.filter((r) => r.marks[i] === "SI").length;
      return `<td>${n} de ${rows.length}</td>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<title>${esc(weekLabel)}</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1C1917; }
  h1 { font-size: 15pt; margin: 0 0 2mm; }
  p.week { font-size: 11pt; font-weight: 700; margin: 0 0 4mm; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #999; padding: 2mm 2.5mm; text-align: center; font-size: 9pt; }
  th { background: #F5F1E8; font-weight: 800; }
  td.name { text-align: left; }
  .sub { font-size: 7.5pt; color: #57534E; }
  td.ok { background: #D1FAE5; font-weight: 700; }
  td.off { background: #FEE2E2; }
  tr.totals td { background: #F5F1E8; font-weight: 800; }
  p.foot { font-size: 8pt; color: #57534E; margin-top: 4mm; }
</style>
</head>
<body>
  <h1>GREFA · Cuadrante semanal de personal</h1>
  <p class="week">${esc(weekLabel)}</p>
  <table>
    <thead><tr><th class="name">Personal</th>${head}</tr></thead>
    <tbody>
      ${body}
      <tr class="totals"><td class="name">Disponibles</td>${totals}</tr>
    </tbody>
  </table>
  ${footer ? `<p class="foot">${esc(footer)}</p>` : ""}
</body>
</html>`;
}

export async function exportRosterPdf(
  weekLabel: string,
  dayLabels: string[],
  rows: RosterRow[],
  footer = ""
): Promise<void> {
  if (!rows.length) throw new Error("El cuadrante no tiene personal que exportar.");
  const html = buildRosterHtml(weekLabel, dayLabels, rows, footer);
  await shareHtmlAsPdf(html, `Cuadrante ${weekLabel}`);
}
