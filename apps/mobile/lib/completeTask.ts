import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import type { Task, User } from "@grefa/shared";
import { getDb } from "@grefa/firebase";
import { enqueueMaterialShortage } from "./materialReport";
import { notifyTaskDone } from "./notifications";

export async function completeTaskAsUser(
  task: Task,
  profile: User,
  wasAssigned: boolean,
  comments: string,
  material: string
): Promise<void> {
  const notes = comments.trim();
  const materialText = material.trim();

  await updateDoc(doc(getDb(), "tasks", task.id), {
    status: "IN_REVIEW",
    completedAt: serverTimestamp(),
    completedBy: profile.uid,
    completedByName: profile.fullName,
    completionNotes: notes || null,
    materialShortage: materialText || null,
  });

  await addDoc(collection(getDb(), "taskLogs"), {
    taskId: task.id,
    completionDate: serverTimestamp(),
    assignedUsersList: (task.assignedUsersInfo ?? []).map((u) => ({
      uid: u.uid,
      fullName: u.fullName,
      dni: u.dni,
    })),
    completedByUserId: profile.uid,
    completedByName: profile.fullName,
    wasAssignedToHim: wasAssigned,
    comments: notes,
    materialShortage: materialText,
    taskTitle: task.title,
    taskDescription: task.description || "",
    taskScheduledDate: task.taskDate,
    taskStartTime: task.startTime || "",
    taskEndTime: task.endTime || "",
  });

  // La tarea ya quedó marcada y registrada: los avisos son secundarios y no
  // deben hacer fallar la operación si algo va mal.
  if (materialText) {
    const prev = (task.materialShortage || "").trim();
    if (!prev || materialText !== prev) {
      try {
        await enqueueMaterialShortage(task, profile, materialText);
      } catch {
        /* sin aviso de material */
      }
    }
  }

  try {
    await notifyTaskDone(task, profile);
  } catch {
    /* sin aviso general */
  }
}
