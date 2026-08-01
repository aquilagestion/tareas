import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { getDb } from "@grefa/firebase";
import {
  plannedState,
  resolveMark,
  type AvailabilityState,
  type PlannedState,
  type ResolvedMark,
  type WeeklySchedule,
} from "@grefa/shared";

export type { AvailabilityState, PlannedState, ResolvedMark };

export interface AvailabilityEntry {
  uid: string;
  dateKey: string;
  available: boolean;
}

/** Persona mínima que necesita el cuadrante. */
export interface RosterPerson {
  uid: string;
  schedule?: WeeklySchedule | null;
}

/** Mapa "dateKey|uid" → marca guardada por el administrador. */
export type AvailabilityMap = Record<string, boolean>;

export function availabilityKey(dateKey: string, uid: string): string {
  return `${dateKey}|${uid}`;
}

function docId(dateKey: string, uid: string): string {
  return `${dateKey}_${uid}`;
}

/** Marca guardada, sin mirar horarios. */
export function explicitMark(
  map: AvailabilityMap,
  dateKey: string,
  uid: string
): boolean | undefined {
  return map[availabilityKey(dateKey, uid)];
}

export function plannedFor(person: RosterPerson, dateKey: string): PlannedState {
  return plannedState(person.schedule, dateKey);
}

/** Marca efectiva de la casilla: marca manual si existe, si no el horario. */
export function markOf(
  map: AvailabilityMap,
  dateKey: string,
  person: RosterPerson
): ResolvedMark {
  return resolveMark(explicitMark(map, dateKey, person.uid), plannedFor(person, dateKey));
}

export function stateOf(
  map: AvailabilityMap,
  dateKey: string,
  person: RosterPerson
): AvailabilityState {
  return markOf(map, dateKey, person).state;
}

export function subscribeAvailability(
  dateKeys: string[],
  onChange: (map: AvailabilityMap) => void,
  onError?: (e: Error) => void
): () => void {
  if (!dateKeys.length) {
    onChange({});
    return () => {};
  }
  const q = query(collection(getDb(), "availability"), where("dateKey", "in", dateKeys));
  return onSnapshot(
    q,
    (snap) => {
      const map: AvailabilityMap = {};
      snap.forEach((d) => {
        const data = d.data() as AvailabilityEntry;
        if (!data.dateKey || !data.uid) return;
        map[availabilityKey(data.dateKey, data.uid)] = data.available === true;
      });
      onChange(map);
    },
    (e) => onError?.(e)
  );
}

export async function setAvailability(
  dateKey: string,
  uid: string,
  state: AvailabilityState,
  adminUid: string
): Promise<void> {
  const ref = doc(getDb(), "availability", docId(dateKey, uid));
  if (state === "UNSET") {
    await deleteDoc(ref);
    return;
  }
  await setDoc(ref, {
    uid,
    dateKey,
    available: state === "AVAILABLE",
    updatedBy: adminUid,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Guarda la marca elegida. Si coincide con lo que ya dice el horario se borra
 * la marca manual, de forma que la casilla vuelve a seguir el horario y los
 * cambios futuros de horario se reflejan solos.
 */
export async function applyMark(
  dateKey: string,
  person: RosterPerson,
  target: AvailabilityState,
  adminUid: string
): Promise<void> {
  const planned = plannedFor(person, dateKey);
  const matchesSchedule =
    (planned === "AVAILABLE" && target === "AVAILABLE") ||
    ((planned === "OFF" || planned === "OUT_OF_RANGE") && target === "OFF");
  await setAvailability(dateKey, person.uid, matchesSchedule ? "UNSET" : target, adminUid);
}

/**
 * Copia las marcas manuales de una semana a otra, día a día en el mismo orden.
 * Los días sin marca en origen se dejan sin tocar en destino.
 */
export async function copyWeek(
  fromKeys: string[],
  toKeys: string[],
  uids: string[],
  sourceMap: AvailabilityMap,
  adminUid: string
): Promise<number> {
  const batch = writeBatch(getDb());
  let count = 0;

  fromKeys.forEach((fromKey, i) => {
    const toKey = toKeys[i];
    if (!toKey) return;
    uids.forEach((uid) => {
      const value = sourceMap[availabilityKey(fromKey, uid)];
      if (value === undefined) return;
      batch.set(doc(getDb(), "availability", docId(toKey, uid)), {
        uid,
        dateKey: toKey,
        available: value,
        updatedBy: adminUid,
        updatedAt: serverTimestamp(),
      });
      count += 1;
    });
  });

  if (count) await batch.commit();
  return count;
}

/**
 * Personal asignable en un día según el cuadrante.
 *
 * Quien esté fuera del rango de su voluntariado o prácticas no cuenta ese día.
 * Quien esté marcado como no disponible queda fuera. Si nadie consta como
 * disponible, el día no se ha planificado y se devuelve al resto del personal
 * para no bloquear la asignación.
 */
export function assignableOn<T extends RosterPerson>(
  users: T[],
  dateKey: string,
  map: AvailabilityMap
): { list: T[]; planned: boolean } {
  const inRange = users.filter((u) => {
    if (plannedFor(u, dateKey) !== "OUT_OF_RANGE") return true;
    // Una marca manual permite contar con alguien fuera de su rango habitual.
    return explicitMark(map, dateKey, u.uid) === true;
  });
  const notOff = inRange.filter((u) => stateOf(map, dateKey, u) !== "OFF");
  const available = notOff.filter((u) => stateOf(map, dateKey, u) === "AVAILABLE");
  return available.length
    ? { list: available, planned: true }
    : { list: notOff, planned: false };
}

export function countAvailable(
  map: AvailabilityMap,
  dateKey: string,
  people: RosterPerson[]
): number {
  return people.filter((p) => stateOf(map, dateKey, p) === "AVAILABLE").length;
}

/** Turnos de una persona en la semana, para el email del cuadrante. */
export function shiftsOf(
  map: AvailabilityMap,
  weekKeys: string[],
  person: RosterPerson
): string[] {
  return weekKeys.filter((k) => stateOf(map, k, person) === "AVAILABLE");
}
