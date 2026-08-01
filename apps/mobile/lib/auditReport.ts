import { collection, getDocs, query, where } from "firebase/firestore";
import { getDb } from "@grefa/firebase";
import {
  buildDailyAuditReportHtml,
  enumerateLocalDates,
  onDutyNamesByDate,
  type LogsByTask,
  type Task,
  type User,
} from "@grefa/shared";
import { shareHtmlAsPdf } from "./shareExport";

export type { LogsByTask };

/** Personal con turno cada día del rango: marcas del cuadrante + horarios. */
async function loadOnDuty(dates: string[]): Promise<Record<string, string[]>> {
  if (!dates.length) return {};
  const db = getDb();
  const [usersSnap, availSnap] = await Promise.all([
    getDocs(collection(db, "users")),
    getDocs(
      query(
        collection(db, "availability"),
        where("dateKey", ">=", dates[0]),
        where("dateKey", "<=", dates[dates.length - 1])
      )
    ),
  ]);
  const people = usersSnap.docs
    .map((d) => ({ uid: d.id, ...d.data() }) as User)
    .filter((u) => u.active !== false);
  const marks: Record<string, boolean> = {};
  availSnap.forEach((d) => {
    const x = d.data() as { dateKey?: string; uid?: string; available?: boolean };
    if (x.dateKey && x.uid) marks[`${x.dateKey}|${x.uid}`] = x.available === true;
  });
  return onDutyNamesByDate(dates, people, marks);
}

export async function exportAuditReportPdf(
  tasks: Task[],
  logsByTask: LogsByTask,
  dateFrom: string,
  dateTo: string,
  responsibleName: string
): Promise<{ count: number; days: number }> {
  if (typeof buildDailyAuditReportHtml !== "function") {
    throw new Error("No se pudo cargar el generador del informe.");
  }

  const dates = enumerateLocalDates(dateFrom, dateTo || dateFrom);
  let onDutyByDate: Record<string, string[]> = {};
  try {
    onDutyByDate = await loadOnDuty(dates);
  } catch {
    /* sin cuadrante el informe sale con los realizadores */
  }

  const result = buildDailyAuditReportHtml(
    tasks,
    logsByTask,
    dateFrom,
    dateTo,
    responsibleName,
    undefined,
    onDutyByDate
  );
  if (!result.ok || !result.html) {
    throw new Error(result.error || "No se pudo generar el informe.");
  }
  await shareHtmlAsPdf(result.html, result.title || "Informe GREFA");
  return { count: result.count, days: result.days };
}
