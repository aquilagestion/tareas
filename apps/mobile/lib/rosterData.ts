import {
  USER_TYPE_SHORT,
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
  scheduleHours,
  type User,
} from "@grefa/shared";
import { markOf, type AvailabilityMap } from "./roster";

/** Marca de una casilla tal y como se guarda o se imprime. */
export type RosterMark = "SI" | "NO" | "";

export interface RosterRow {
  uid: string;
  name: string;
  role: string;
  hours: string;
  marks: RosterMark[];
}

export function roleText(u: User): string {
  if (u.role === "ADMIN") return "Responsable";
  return USER_TYPE_SHORT[u.userType] ?? "Trabajador";
}

export function dayShortLabel(dateKey: string, index: number): string {
  const [, m, d] = dateKey.split("-");
  return `${WEEKDAY_SHORT[index]} ${Number(d)}/${Number(m)}`;
}

export function dayLongLabel(dateKey: string, index: number): string {
  const [, m, d] = dateKey.split("-");
  return `${WEEKDAY_LONG[index]} ${Number(d)}/${Number(m)}`;
}

export function dayLabels(weekKeys: string[]): string[] {
  return weekKeys.map(dayShortLabel);
}

/** Filas del cuadrante: una por persona, con su marca de cada día. */
export function buildRosterRows(
  staff: User[],
  weekKeys: string[],
  map: AvailabilityMap
): RosterRow[] {
  return staff.map((u) => ({
    uid: u.uid,
    name: u.fullName || "",
    role: roleText(u),
    hours: scheduleHours(u.schedule),
    marks: weekKeys.map((k) => {
      const st = markOf(map, k, u).state;
      return st === "AVAILABLE" ? "SI" : st === "OFF" ? "NO" : "";
    }),
  }));
}

/** Turnos de una persona en texto: «lunes 3/8 · 09:00–14:00». */
export function shiftLabels(u: User, weekKeys: string[], map: AvailabilityMap): string[] {
  const hours = scheduleHours(u.schedule);
  return weekKeys
    .map((k, i) => (markOf(map, k, u).state === "AVAILABLE" ? dayLongLabel(k, i) : null))
    .filter((s): s is string => Boolean(s))
    .map((s) => (hours ? `${s} · ${hours}` : s));
}
