import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { notifyTaskAssignees } from "../notifications/notifyAssignees";

/** Al crear una tarea PENDING, avisa por email/WhatsApp a cada asignado. */
export const onTaskCreatedNotify = onDocumentCreated(
  {
    document: "tasks/{taskId}",
    region: "europe-west1",
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data();
    if (data.status !== "PENDING") return;
    const taskId = event.params.taskId;
    const db = getFirestore();
    try {
      const results = await notifyTaskAssignees(db, taskId, data);
      const ok = results.filter((r) => r.email?.ok || r.whatsapp?.ok).length;
      logger.info(`Avisos tarea ${taskId}: ${ok}/${results.length} canales OK`);
    } catch (e) {
      logger.error("onTaskCreatedNotify", taskId, e);
    }
  }
);
