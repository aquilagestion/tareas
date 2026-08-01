import { initializeApp } from "firebase-admin/app";
import { dailyTasksReminder } from "./scheduled/dailyTasksReminder";
import { adminSetPassword } from "./callable/adminSetPassword";
import { sendTaskScheduleNotice } from "./callable/sendTaskScheduleNotice";
import { notifyTaskAssigneesCall } from "./callable/notifyTaskAssignees";
import { onTaskCreatedNotify } from "./triggers/onTaskCreated";
import { onNotificationQueueCreated } from "./triggers/onNotificationQueue";

initializeApp();

export {
  dailyTasksReminder,
  adminSetPassword,
  sendTaskScheduleNotice,
  notifyTaskAssigneesCall,
  onTaskCreatedNotify,
  onNotificationQueueCreated,
};
