/**
 * Horarios semanales del personal y resolución de marcas del cuadrante.
 * Espejo de packages/shared/src/schedule.ts para el hosting estático.
 */

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

export const USER_TYPE_LABELS = {
  TRABAJADOR_GREFA: "Trabajador de GREFA",
  VOLUNTARIO: "Voluntario",
  PERSONAL_PRACTICAS: "Personal en prácticas",
};

export const USER_TYPE_SHORT = {
  TRABAJADOR_GREFA: "Trabajador",
  VOLUNTARIO: "Voluntario",
  PERSONAL_PRACTICAS: "Prácticas",
};

export const USER_TYPE_ORDER = {
  TRABAJADOR_GREFA: 0,
  VOLUNTARIO: 1,
  PERSONAL_PRACTICAS: 2,
};

/** 1 = lunes … 7 = domingo, a partir de una clave YYYY-MM-DD. */
export function weekdayOfKey(dateKey) {
  const [y, m, d] = String(dateKey).split("-").map(Number);
  if (!y || !m || !d) return 0;
  const day = new Date(y, m - 1, d, 12, 0, 0).getDay();
  return day === 0 ? 7 : day;
}

export function hasSchedule(s) {
  return Boolean(s && Array.isArray(s.weekdays) && s.weekdays.length > 0);
}

/** "AVAILABLE" | "OFF" | "OUT_OF_RANGE" | "NONE" */
export function plannedState(s, dateKey) {
  if (!hasSchedule(s) || !dateKey) return "NONE";
  if (s.fromDate && dateKey < s.fromDate) return "OUT_OF_RANGE";
  if (s.toDate && dateKey > s.toDate) return "OUT_OF_RANGE";
  return s.weekdays.includes(weekdayOfKey(dateKey)) ? "AVAILABLE" : "OFF";
}

/** { state: "AVAILABLE"|"OFF"|"UNSET", source: "MANUAL"|"SCHEDULE"|"NONE" } */
export function resolveMark(explicit, planned) {
  if (explicit !== undefined) {
    return { state: explicit ? "AVAILABLE" : "OFF", source: "MANUAL" };
  }
  if (planned === "AVAILABLE") return { state: "AVAILABLE", source: "SCHEDULE" };
  if (planned === "OFF" || planned === "OUT_OF_RANGE") {
    return { state: "OFF", source: "SCHEDULE" };
  }
  return { state: "UNSET", source: "NONE" };
}

export function nextMark(current, planned) {
  if (planned === "NONE") {
    if (current === "UNSET") return "AVAILABLE";
    if (current === "AVAILABLE") return "OFF";
    return "UNSET";
  }
  return current === "AVAILABLE" ? "OFF" : "AVAILABLE";
}

export function contradictsSchedule(target, planned) {
  return target === "AVAILABLE" && (planned === "OFF" || planned === "OUT_OF_RANGE");
}

export function inRosterWeek(s, weekKeys) {
  if (!hasSchedule(s)) return true;
  return weekKeys.some((k) => plannedState(s, k) !== "OUT_OF_RANGE");
}

export function scheduleHours(s) {
  if (!s) return "";
  const from = String(s.startTime || "").trim();
  const to = String(s.endTime || "").trim();
  if (from && to) return `${from}–${to}`;
  return from || to;
}

export function scheduleSummary(s) {
  if (!hasSchedule(s)) return "";
  const days = [...s.weekdays]
    .sort((a, b) => a - b)
    .map((n) => WEEKDAY_SHORT[n - 1] || "")
    .filter(Boolean)
    .join(", ");
  const parts = [days];
  const hours = scheduleHours(s);
  if (hours) parts.push(hours);
  if (s.fromDate && s.toDate) parts.push(`${s.fromDate} → ${s.toDate}`);
  else if (s.fromDate) parts.push(`desde ${s.fromDate}`);
  else if (s.toDate) parts.push(`hasta ${s.toDate}`);
  return parts.join(" · ");
}

/**
 * Quién tenía turno cada día, combinando marcas del cuadrante y horarios.
 * marks: { "dateKey|uid": boolean }
 */
export function onDutyNamesByDate(dates, people, marks) {
  const out = {};
  for (const dateKey of dates) {
    out[dateKey] = people
      .filter(
        (p) =>
          resolveMark(marks[`${dateKey}|${p.uid}`], plannedState(p.schedule, dateKey))
            .state === "AVAILABLE"
      )
      .map((p) => String(p.fullName || "").trim())
      .filter(Boolean);
  }
  return out;
}

export function normalizeSchedule(input) {
  const weekdays = [...new Set(input.weekdays || [])]
    .map(Number)
    .filter((n) => n >= 1 && n <= 7)
    .sort((a, b) => a - b);
  if (!weekdays.length) return null;
  const out = { weekdays };
  const start = String(input.startTime || "").trim();
  const end = String(input.endTime || "").trim();
  const from = String(input.fromDate || "").trim();
  const to = String(input.toDate || "").trim();
  if (start) out.startTime = start;
  if (end) out.endTime = end;
  if (from) out.fromDate = from;
  if (to) out.toDate = to;
  return out;
}

/**
 * Personal asignable un día: fuera de rango no cuenta, «no disponible» queda
 * fuera y, si nadie consta disponible, el día no está planificado y se ofrece
 * al resto para no bloquear la asignación.
 */
export function assignableOn(users, dateKey, map) {
  const mark = (u) => resolveMark(map[`${dateKey}|${u.uid}`], plannedState(u.schedule, dateKey));
  const inRange = users.filter(
    (u) =>
      plannedState(u.schedule, dateKey) !== "OUT_OF_RANGE" ||
      map[`${dateKey}|${u.uid}`] === true
  );
  const notOff = inRange.filter((u) => mark(u).state !== "OFF");
  const available = notOff.filter((u) => mark(u).state === "AVAILABLE");
  return available.length
    ? { list: available, planned: true }
    : { list: notOff, planned: false };
}
