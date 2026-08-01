/** Fechas locales YYYY-MM-DD inclusive entre from y to. */
export function enumerateLocalDates(fromStr: string, toStr: string): string[] {
  const [y1, m1, d1] = fromStr.split("-").map(Number);
  const [y2, m2, d2] = toStr.split("-").map(Number);
  const start = new Date(y1, m1 - 1, d1, 12, 0, 0);
  const end = new Date(y2, m2 - 1, d2, 12, 0, 0);
  if (start > end) return [];
  const out: string[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${day}`);
  }
  return out;
}

export const MAX_RECURRING_DAYS = 366;

/** Clave YYYY-MM-DD en hora local (no usar toISOString: desplaza el día). */
export function localDateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Lunes de la semana a la que pertenece la fecha. */
export function mondayOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay();
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day));
  return x;
}

/** Las siete claves de día, de lunes a domingo, de la semana indicada. */
export function weekDateKeys(anchor: Date): string[] {
  const mon = mondayOfWeek(anchor);
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    out.push(localDateKey(d));
  }
  return out;
}
