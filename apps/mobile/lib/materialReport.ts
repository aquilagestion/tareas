import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import type { Task, User } from "@grefa/shared";
import { getDb } from "@grefa/firebase";

/** Encola el aviso al administrador sin tocar la tarea. */
export async function enqueueMaterialShortage(
  task: Task,
  profile: User,
  message: string
): Promise<void> {
  await addDoc(collection(getDb(), "notificationQueue"), {
    type: "MATERIAL_SHORTAGE",
    status: "PENDING",
    taskId: task.id,
    taskTitle: task.title,
    message: message.trim(),
    reportedBy: profile.uid,
    reportedByName: profile.fullName,
    createdAt: serverTimestamp(),
  });
}

/**
 * Reporte suelto desde una tarea pendiente: guarda el material en la tarea
 * y avisa al administrador.
 */
export async function reportMaterialShortage(
  task: Task,
  profile: User,
  message: string
): Promise<void> {
  const text = message.trim();
  await updateDoc(doc(getDb(), "tasks", task.id), { materialShortage: text });
  await enqueueMaterialShortage(task, profile, text);
}
