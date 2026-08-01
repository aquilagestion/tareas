import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { buildScheduleEmailHtml, buildScheduleSmsText, SCHEDULE_SUBJECT_NEW } from "../notifications/templates";
import { sendEmail, sendWhatsApp } from "../notifications/sendMessage";
import { normalizePhoneE164 } from "../notifications/formatTaskWhen";
import { notifyTaskAssignees } from "../notifications/notifyAssignees";

/** Admin: aviso de prueba o reenvío real para una tarea o usuario. */
export const sendTaskScheduleNotice = onCall({ region: "europe-west1" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sin sesión");
  const db = getFirestore();
  const adminSnap = await db.collection("users").doc(request.auth.uid).get();
  const admin = adminSnap.data();
  if (!admin || admin.role !== "ADMIN" || admin.active !== true) {
    throw new HttpsError("permission-denied", "Solo administrador");
  }

  const { uid, email, phone, dryRun, taskId } = request.data as {
    uid?: string;
    email?: string;
    phone?: string;
    dryRun?: boolean;
    taskId?: string;
  };

  if (taskId) {
    const taskSnap = await db.collection("tasks").doc(taskId).get();
    if (!taskSnap.exists) throw new HttpsError("not-found", "Tarea no encontrada");
    if (dryRun) {
      return {
        ok: true,
        preview: {
          task: taskSnap.data(),
          assignees: taskSnap.data()?.assignedUserIds,
        },
      };
    }
    const results = await notifyTaskAssignees(db, taskId, taskSnap.data()!);
    return { ok: true, results };
  }

  let userEmail = email;
  let userPhone = phone;
  let fullName = "Trabajador";

  if (uid) {
    const u = await db.collection("users").doc(uid).get();
    if (!u.exists) throw new HttpsError("not-found", "Usuario no encontrado");
    const d = u.data()!;
    userEmail = userEmail || (d.email as string);
    userPhone = userPhone || (d.phone as string);
    fullName = (d.fullName as string) || fullName;
  }

  const sampleTasks = [
    {
      title: "Revisión recinto (prueba)",
      when: "Mañana 09:00–12:00",
      description: "Aviso de prueba del gestor GREFA Tareas.",
    },
  ];
  const subject = SCHEDULE_SUBJECT_NEW;
  const text = buildScheduleSmsText({ fullName, tasks: sampleTasks });
  const html = buildScheduleEmailHtml({ fullName, tasks: sampleTasks });

  if (dryRun) return { ok: true, preview: { text, html, userEmail, userPhone } };

  const results: string[] = [];
  if (userEmail) {
    await sendEmail({ to: userEmail, subject, text, html });
    results.push(`email:${userEmail}`);
  }
  const digits = userPhone ? normalizePhoneE164(userPhone) : null;
  if (digits) {
    await sendWhatsApp({ toPhoneE164: digits, body: text });
    results.push(`whatsapp:${digits}`);
  }
  if (!results.length) throw new HttpsError("invalid-argument", "Indica email o teléfono");
  return { ok: true, sent: results };
});
