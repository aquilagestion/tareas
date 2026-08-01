import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

/** Admin establece contraseña de un usuario (sin email de reset). */
export const adminSetPassword = onCall({ region: "europe-west1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }
  const callerUid = request.auth.uid;
  const db = getFirestore();
  const callerSnap = await db.collection("users").doc(callerUid).get();
  const caller = callerSnap.data();
  if (!caller || caller.role !== "ADMIN" || caller.active !== true) {
    throw new HttpsError("permission-denied", "Solo administradores activos.");
  }

  const { uid, password } = request.data as { uid?: string; password?: string };
  if (!uid || typeof uid !== "string") {
    throw new HttpsError("invalid-argument", "Falta uid.");
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    throw new HttpsError("invalid-argument", "Contraseña mínimo 6 caracteres.");
  }

  await getAuth().updateUser(uid, { password });
  return { ok: true };
});
