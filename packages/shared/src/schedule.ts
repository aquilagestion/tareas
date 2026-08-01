import type { WeeklySchedule } from "./types";

export const WEEKDAY_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
export const WEEKDAY_LONG = [
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
  "domingo",
];

/** Qué dice el horario de una persona para un día concreto. */
export type PlannedState = "AVAILABLE" | "OFF" | "OUT_OF_RANGE" | "NONE";

/** Marca efectiva de una casilla del cuadrante. */
export type AvailabilityState = "AVAILABLE" | "OFF" | "UNSET";

/** De dónde sale la marca: la puso el administrador o la deduce el horario. */
export type MarkSource = "MANUAL" | "SCHEDULE" | "NONE";

export interface ResolvedMark {
  state: AvailabilityState;
  source: MarkSource;
}

/** 1 = lunes … 7 = domingo, a partir de una clave YYYY-MM-DD. */
export function weekdayOfKey(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return 0;
  const day = new Date(y, m - 1, d, 12, 0, 0).getDay();
  return day === 0 ? 7 : day;
}

export function hasSchedule(s?: WeeklySchedule | null): boolean {
  return Boolean(s && Array.isArray(s.weekdays) && s.weekdays.length > 0);
}

/**
 * Lo que el horario dice de ese día.
 *
 * Fuera del rango de fechas del voluntariado o las prácticas la persona no
 * cuenta como personal de ese día: se distingue de un simple «no viene» para
 * poder ocultarla del cuadrante de esas semanas.
 */
export function plannedState(
  s: WeeklySchedule | null | undefined,
  dateKey: string
): PlannedState {
  if (!hasSchedule(s) || !dateKey) return "NONE";
  const sch = s as WeeklySchedule;
  if (sch.fromDate && dateKey < sch.fromDate) return "OUT_OF_RANGE";
  if (sch.toDate && dateKey > sch.toDate) return "OUT_OF_RANGE";
  return sch.weekdays.includes(weekdayOfKey(dateKey)) ? "AVAILABLE" : "OFF";
}

/**
 * Marca final de la casilla: lo que el administrador haya puesto a mano manda
 * sobre el horario, y sin horario ni marca la casilla queda sin definir.
 */
export function resolveMark(
  explicit: boolean | undefined,
  planned: PlannedState
): ResolvedMark {
  if (explicit !== undefined) {
    return { state: explicit ? "AVAILABLE" : "OFF", source: "MANUAL" };
  }
  if (planned === "AVAILABLE") return { state: "AVAILABLE", source: "SCHEDULE" };
  if (planned === "OFF" || planned === "OUT_OF_RANGE") {
    return { state: "OFF", source: "SCHEDULE" };
  }
  return { state: "UNSET", source: "NONE" };
}

/**
 * Siguiente marca al pulsar una casilla.
 *
 * Con horario definido solo tiene sentido alternar entre sí y no; sin horario
 * se mantiene el ciclo de tres pasos con la casilla vacía.
 */
export function nextMark(
  current: AvailabilityState,
  planned: PlannedState
): AvailabilityState {
  if (planned === "NONE") {
    if (current === "UNSET") return "AVAILABLE";
    if (current === "AVAILABLE") return "OFF";
    return "UNSET";
  }
  return current === "AVAILABLE" ? "OFF" : "AVAILABLE";
}

/**
 * ¿La marca elegida contradice el horario de la persona?
 * Se usa para pedir confirmación al administrador.
 */
export function contradictsSchedule(
  target: AvailabilityState,
  planned: PlannedState
): boolean {
  return target === "AVAILABLE" && (planned === "OFF" || planned === "OUT_OF_RANGE");
}

/** Aparece en el cuadrante salvo que toda la semana quede fuera de su rango. */
export function inRosterWeek(
  s: WeeklySchedule | null | undefined,
  weekKeys: string[]
): boolean {
  if (!hasSchedule(s)) return true;
  return weekKeys.some((k) => plannedState(s, k) !== "OUT_OF_RANGE");
}

export function scheduleHours(s?: WeeklySchedule | null): string {
  if (!s) return "";
  const from = (s.startTime || "").trim();
  const to = (s.endTime || "").trim();
  if (from && to) return `${from}–${to}`;
  return from || to;
}

/** Resumen legible: «Lun, Jue · 09:00–14:00 · hasta 2026-12-31». */
export function scheduleSummary(s?: WeeklySchedule | null): string {
  if (!hasSchedule(s)) return "";
  const sch = s as WeeklySchedule;
  const days = [...sch.weekdays]
    .sort((a, b) => a - b)
    .map((n) => WEEKDAY_SHORT[n - 1] || "")
    .filter(Boolean)
    .join(", ");
  const parts = [days];
  const hours = scheduleHours(sch);
  if (hours) parts.push(hours);
  if (sch.fromDate && sch.toDate) parts.push(`${sch.fromDate} → ${sch.toDate}`);
  else if (sch.fromDate) parts.push(`desde ${sch.fromDate}`);
  else if (sch.toDate) parts.push(`hasta ${sch.toDate}`);
  return parts.join(" · ");
}

/**
 * Quién tenía turno cada día, combinando las marcas del cuadrante con los
 * horarios. Sirve para la cabecera del informe diario de auditoría.
 */
export function onDutyNamesByDate(
  dates: string[],
  people: Array<{ uid: string; fullName?: string; schedule?: WeeklySchedule | null }>,
  marks: Record<string, boolean>
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  dates.forEach((dateKey) => {
    out[dateKey] = people
      .filter(
        (p) =>
          resolveMark(marks[`${dateKey}|${p.uid}`], plannedState(p.schedule, dateKey))
            .state === "AVAILABLE"
      )
      .map((p) => String(p.fullName || "").trim())
      .filter(Boolean);
  });
  return out;
}

/** Descarta claves vacías para no guardar campos inútiles en Firestore. */
export function normalizeSchedule(input: {
  weekdays: number[];
  startTime?: string;
  endTime?: string;
  fromDate?: string;
  toDate?: string;
}): WeeklySchedule | null {
  const weekdays = [...new Set(input.weekdays)]
    .filter((n) => n >= 1 && n <= 7)
    .sort((a, b) => a - b);
  if (!weekdays.length) return null;
  const out: WeeklySchedule = { weekdays };
  const start = (input.startTime || "").trim();
  const end = (input.endTime || "").trim();
  const from = (input.fromDate || "").trim();
  const to = (input.toDate || "").trim();
  if (start) out.startTime = start;
  if (end) out.endTime = end;
  if (from) out.fromDate = from;
  if (to) out.toDate = to;
  return out;
}
