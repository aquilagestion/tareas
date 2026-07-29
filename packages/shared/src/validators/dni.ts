/**
 * Validación de DNI/NIE español (algoritmo oficial Policía Nacional).
 * DNI: 8 dígitos + letra de control
 * NIE: X/Y/Z + 7 dígitos + letra de control
 */

const DNI_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";

export function normalizeDni(raw: string): string {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s\-.]/g, "");
}

function controlLetter(numberPart: number): string {
  return DNI_LETTERS[numberPart % 23];
}

/**
 * Calcula la letra de control para un número de DNI (0–99999999).
 */
export function dniControlLetter(numberPart: number | string): string {
  const n = typeof numberPart === "string" ? parseInt(numberPart, 10) : numberPart;
  if (!Number.isFinite(n) || n < 0) return "";
  return controlLetter(n);
}

/**
 * Valida DNI (12345678Z) o NIE (X1234567L).
 */
export function isValidDni(raw: string): boolean {
  const value = normalizeDni(raw);
  if (!value) return false;

  // NIE: X/Y/Z + 7 dígitos + letra
  const nie = value.match(/^([XYZ])(\d{7})([A-Z])$/);
  if (nie) {
    const prefixMap: Record<string, string> = { X: "0", Y: "1", Z: "2" };
    const num = parseInt(prefixMap[nie[1]] + nie[2], 10);
    return controlLetter(num) === nie[3];
  }

  // DNI: 8 dígitos + letra
  const dni = value.match(/^(\d{8})([A-Z])$/);
  if (dni) {
    const num = parseInt(dni[1], 10);
    return controlLetter(num) === dni[2];
  }

  return false;
}

export function formatDni(raw: string): string {
  return normalizeDni(raw);
}
