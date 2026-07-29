const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

function toDate(input: Date | string | number): Date {
  if (input instanceof Date) return input;
  return new Date(input);
}

/**
 * Texto principal de presentación para liquidación de gastos.
 */
export function buildPresentationText(params: {
  fullName: string;
  dni: string;
  totalAmount: number;
}): string {
  const amount = Number(params.totalAmount ?? 0);
  const formatted = amount.toLocaleString("es-ES", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });

  return (
    `D./Dña. ${params.fullName} con D.N.I. ${params.dni}, ` +
    `presenta para su validación y posterior liquidación la siguiente relación de gastos ` +
    `en los que ha incurrido con motivo de viajes realizados en vehículo de la entidad, ` +
    `ascendiendo a un importe total de ${formatted} Euros.`
  );
}

/**
 * Pie de firma y localidad: "En Majadahonda a 15 de abril de 2026"
 */
export function buildLocationDateText(date: Date | string | number = new Date()): string {
  const d = toDate(date);
  const day = d.getDate();
  const month = MESES[d.getMonth()];
  const year = d.getFullYear();
  return `En Majadahonda a ${day} de ${month} de ${year}`;
}

export function buildLegalBundle(params: {
  fullName: string;
  dni: string;
  totalAmount: number;
  date?: Date | string | number;
}): { concatenatedText: string; locationDateText: string } {
  const concatenatedText = buildPresentationText(params);
  const locationDateText = buildLocationDateText(params.date);
  return { concatenatedText, locationDateText };
}
