import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { notifyTaskAssignees } from "../notifications/notifyAssignees";

/** Procesa cola creada desde web (útil si el trigger de tasks no está desplegado). */
export const onNotificationQueueCreated = onDocumentCreated(
  {
    document: "notificationQueue/{queueId}",
    region: "europe-west1",
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data();
    if (data.status !== "PENDING" || data.type !== "TASK_ASSIGNED") return;
    const taskId = data.taskId as string;
    if (!taskId) return;
    const db = getFirestore();
    const ref = snap.ref;
    try {
      const taskSnap = await db.collection("tasks").doc(taskId).get();
      if (!taskSnap.exists) {
        await ref.update({ status: "FAILED", error: "Tarea no encontrada", processedAt: FieldValue.serverTimestamp() });
        return;
      }
      const results = await notifyTaskAssignees(db, taskId, taskSnap.data()!);
      await ref.update({
        status: "SENT",
        results,
        processedAt: FieldValue.serverTimestamp(),
      });
      logger.info("Cola procesada", event.params.queueId, taskId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await ref.update({ status: "FAILED", error: msg, processedAt: FieldValue.serverTimestamp() });
      logger.error("onNotificationQueue", msg);
    }
  }
);
