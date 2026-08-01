import { doc, updateDoc } from "firebase/firestore";
import { getDb } from "@grefa/firebase";
import type { Task, User } from "@grefa/shared";
import { notifyTaskTaken } from "./notifications";

/**
 * Añade al usuario a los asignados de una tarea pendiente y avisa a quienes
 * ya la tenían asignada.
 */
export async function assumeTask(task: Task, profile: User): Promise<void> {
  if ((task.assignedUserIds ?? []).includes(profile.uid)) return;

  const ids = [...(task.assignedUserIds ?? []), profile.uid];
  const info = [
    ...(task.assignedUsersInfo ?? []),
    {
      uid: profile.uid,
      fullName: profile.fullName,
      userType: profile.userType,
      dni: profile.dni,
    },
  ];

  await updateDoc(doc(getDb(), "tasks", task.id), {
    assignedUserIds: ids,
    assignedUsersInfo: info,
  });

  // El aviso es secundario: si falla, la asignación ya está hecha.
  try {
    await notifyTaskTaken(task, profile);
  } catch {
    /* sin aviso */
  }
}
