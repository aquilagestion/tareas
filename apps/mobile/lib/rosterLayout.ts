import { useWindowDimensions } from "react-native";

export interface RosterLayout {
  /** Ancho de la columna de nombres; los siete días se reparten el resto. */
  nameW: number;
  /** Casillas estrechas: conviene reducir letra y quitar detalles. */
  compact: boolean;
  /** Tan estrechas que solo cabe la marca. */
  tight: boolean;
}

/**
 * El cuadrante tiene que entrar de lunes a domingo sin desplazar la tabla, así
 * que la columna de nombres cede espacio a los días en pantallas pequeñas.
 */
export function useRosterLayout(horizontalPadding = 24): RosterLayout {
  const { width } = useWindowDimensions();
  const usable = Math.max(240, width - horizontalPadding);
  const nameW = Math.round(Math.max(92, Math.min(164, usable * 0.26)));
  const dayW = (usable - nameW) / 7;
  return { nameW, compact: dayW < 48, tight: dayW < 34 };
}
