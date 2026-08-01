import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { logger } from "firebase-functions";
import { formatTaskWhen } from "../notifications/formatTaskWhen";
import { notifyUserTasks } from "../notifications/notifyAssignees";
import type { ScheduleTaskLine } from "../notifications/templates";

/**
 * Recordatorio diario 08:00 Europe/Madrid.
 * FCM + email + WhatsApp a cada usuario con tareas PENDING del día.
 */
export const dailyTasksReminder = onSchedule(
  {
    schedule: "0 8 * * *",
    timeZone: "Europe/Madrid",
    region: "europe-west1",
  },
  async () => {
    const db = getFirestore();
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const snap = await db
      .collection("tasks")
      .where("status", "==", "PENDING")
      .where("taskDate", ">=", Timestamp.fromDate(start))
      .where("taskDate", "<", Timestamp.fromDate(end))
      .get();

    const byUser = new Map<
      string,
      Array<{ title: string; when: string; description?: string }>
    >();

    for (const doc of snap.docs) {
      const data = doc.data();
      const when = formatTaskWhen(data);
      const item: ScheduleTaskLine = {
        title: (data.title as string) ?? "Tarea",
        when,
        description: (data.description as string) || undefined,
        assignedToAll: data.assignedToAll === true,
      };
      const ids: string[] = data.assignedUserIds ?? [];
      for (const uid of ids) {
        const list = byUser.get(uid) ?? [];
        list.push(item);
        byUser.set(uid, list);
      }
    }

    if (byUser.size === 0) {
      logger.info("Sin tareas PENDING para hoy");
      return;
    }

    const messaging = getMessaging();
    let fcmSent = 0;
    let notifySent = 0;

    for (const [uid, tasks] of byUser) {
      const userSnap = await db.collection("users").doc(uid).get();
      const token = userSnap.data()?.fcmToken as string | undefined;
      if (token) {
        try {
          const titles = tasks.map((t) => `• ${t.title}`).join("\n");
          await messaging.send({
            token,
            notification: {
              title: `GREFA · ${tasks.length} tarea(s) hoy`,
              body: titles.slice(0, 180),
            },
            data: { type: "DAILY_TASKS", count: String(tasks.length) },
          });
          fcmSent += 1;
        } catch (e) {
          logger.warn("FCM falló", uid, e);
        }
      }

      const r = await notifyUserTasks(db, uid, tasks, "daily");
      if (r.email?.ok || r.whatsapp?.ok) notifySent += 1;
    }

    logger.info(
      `Recordatorio diario: FCM ${fcmSent}, email/WhatsApp ${notifySent}/${byUser.size} usuarios`
    );
  }
);
