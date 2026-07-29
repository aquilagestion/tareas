import { initializeApp } from "firebase-admin/app";
import { dailyTasksReminder } from "./scheduled/dailyTasksReminder";

initializeApp();

export { dailyTasksReminder };
