import type { User } from "@grefa/shared";
import { APPS_SCRIPT_URL, requireNotifySecret } from "../constants/notifications";
import type { AvailabilityMap } from "./roster";
import { buildRosterRows, dayLabels, shiftLabels } from "./rosterData";

export interface RosterEmailResult {
  sent: number;
  errors: string[];
}

/**
 * Envía el cuadrante de la semana a cada persona que tenga algún turno,
 * con la tabla completa del equipo y su fila destacada.
 */
export async function sendRosterEmail(
  weekLabel: string,
  weekKeys: string[],
  staff: User[],
  map: AvailabilityMap,
  sender: { email: string; fullName: string }
): Promise<RosterEmailResult> {
  const rows = buildRosterRows(staff, weekKeys, map);

  const recipients = staff
    .filter((u) => (u.email || "").trim())
    .map((u) => ({
      uid: u.uid,
      email: u.email.trim(),
      fullName: u.fullName,
      shifts: shiftLabels(u, weekKeys, map),
    }))
    .filter((r) => r.shifts.length > 0);

  if (!recipients.length) {
    throw new Error("Nadie tiene turnos marcados esta semana.");
  }

  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      secret: requireNotifySecret(),
      senderEmail: sender.email.trim(),
      senderName: sender.fullName.trim() || sender.email,
      roster: {
        weekLabel,
        days: dayLabels(weekKeys),
        rows,
        recipients,
      },
    }),
  });

  const text = await res.text();
  let json: { ok?: boolean; sent?: number; errors?: string[]; error?: string };
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    throw new Error("Respuesta inesperada del servicio de correo.");
  }
  if (!json.ok) {
    if (/Sin notificaciones/i.test(json.error || "")) {
      throw new Error(
        "El script de correo de Google todavía no sabe enviar cuadrantes: hay que actualizarlo y volver a publicarlo."
      );
    }
    throw new Error(json.error || "No se pudo enviar el cuadrante.");
  }
  return { sent: json.sent ?? 0, errors: json.errors ?? [] };
}
