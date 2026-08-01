import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { notifyTaskAssignees } from "../notifications/notifyAssignees";

/** Admin: reenvía avisos de programación para una tarea existente. */
export const notifyTaskAssigneesCall = onCall({ region: "europe-west1" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sin sesión");
  const db = getFirestore();
  const adminSnap = await db.collection("users").doc(request.auth.uid).get();
  const admin = adminSnap.data();
  if (!admin || admin.role !== "ADMIN" || admin.active !== true) {
    throw new HttpsError("permission-denied", "Solo administrador");
  }
  const { taskId } = request.data as { taskId?: string };
  if (!taskId) throw new HttpsError("invalid-argument", "Falta taskId");
  const taskSnap = await db.collection("tasks").doc(taskId).get();
  if (!taskSnap.exists) throw new HttpsError("not-found", "Tarea no encontrada");
  const results = await notifyTaskAssignees(db, taskId, taskSnap.data()!);
  return {
    ok: true,
    results: results.map((r) => ({
      uid: r.uid,
      fullName: r.fullName,
      email: r.email,
      whatsapp: r.whatsapp,
    })),
  };
});
