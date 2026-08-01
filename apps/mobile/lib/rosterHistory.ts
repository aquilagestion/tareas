import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getDb } from "@grefa/firebase";
import type { RosterRow } from "./rosterData";

export interface RosterSnapshot {
  /** Clave del lunes de la semana, que además es el id del documento */
  weekStart: string;
  weekLabel: string;
  days: string[];
  dayLabels: string[];
  rows: RosterRow[];
  closedBy: string;
  closedByName: string;
  closedAt?: { toDate?: () => Date; seconds?: number };
}

/**
 * Congela el cuadrante de una semana. Se guarda con los nombres y las marcas
 * ya resueltas, de modo que un cambio posterior de horarios no altera lo que
 * se publicó.
 */
export async function closeRoster(
  snapshot: Omit<RosterSnapshot, "closedAt">
): Promise<void> {
  await setDoc(doc(getDb(), "rosters", snapshot.weekStart), {
    ...snapshot,
    closedAt: serverTimestamp(),
  });
}

export function subscribeClosedRosters(
  onChange: (list: RosterSnapshot[]) => void,
  onError?: (e: Error) => void
): () => void {
  const q = query(collection(getDb(), "rosters"), orderBy("weekStart", "desc"), limit(52));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => d.data() as RosterSnapshot)),
    (e) => onError?.(e)
  );
}

export function formatClosedAt(snapshot: RosterSnapshot): string {
  const raw = snapshot.closedAt;
  const d =
    typeof raw?.toDate === "function"
      ? raw.toDate()
      : typeof raw?.seconds === "number"
        ? new Date(raw.seconds * 1000)
        : null;
  if (!d) return "";
  return d.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
}
