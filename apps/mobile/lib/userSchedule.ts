import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { getDb } from "@grefa/firebase";
import type { WeeklySchedule } from "@grefa/shared";

/** Guarda (o quita, con null) el horario semanal previsto de una persona. */
export async function saveSchedule(
  uid: string,
  schedule: WeeklySchedule | null
): Promise<void> {
  await updateDoc(doc(getDb(), "users", uid), {
    schedule,
    updatedAt: serverTimestamp(),
  });
}
