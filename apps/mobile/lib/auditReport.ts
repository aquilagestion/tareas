import { collection, getDocs, query, where } from "firebase/firestore";
import { getDb } from "@grefa/firebase";
import {
  buildDailyAuditReportHtml,
  enumerateLocalDates,
  onDutyStaffByDate,
  type LogsByTask,
  type ReportStaffInfo,
  type Task,
  type User,
} from "@grefa/shared";
import { shareHtmlAsPdf } from "./shareExport";

export type { LogsByTask };

/**
 * Personal para la cabecera del informe: quién tenía turno cada día (marcas del
 * cuadrante más horarios) y las fichas completas, que dan el rol y el tipo de
 * quien realizó tareas sin estar previsto.
 */
async function loadStaff(dates: string[]): Promise<ReportStaffInfo> {
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
  return {
    onDutyByDate: onDutyStaffByDate(dates, people, marks),
    directory: people.map((u) => ({
      fullName: String(u.fullName || "").trim(),
      role: u.role,
      userType: u.userType,
    })),
  };
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
  let staff: ReportStaffInfo = {};
  try {
    staff = await loadStaff(dates);
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
    staff
  );
  if (!result.ok || !result.html) {
    throw new Error(result.error || "No se pudo generar el informe.");
  }
  await shareHtmlAsPdf(result.html, result.title || "Informe GREFA");
  return { count: result.count, days: result.days };
}
