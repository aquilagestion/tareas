import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  getDb,
  getFirebaseApp,
  getFirebaseAuth,
  getSecondaryAuth,
} from "@grefa/firebase";
import type { UserRole, UserType, WeeklySchedule } from "@grefa/shared";
import { FIREBASE_CONFIG } from "../config/firebase";

export const DEFAULT_PASSWORD = "Grefa2026!";

export interface StaffInput {
  fullName: string;
  dni: string;
  email: string;
  phone: string;
  role: UserRole;
  userType: UserType;
  startDate: string;
  endDate: string;
  schedule: WeeklySchedule | null;
}

/** AAAA-MM-DD → Timestamp al mediodía, para que no baile el día por zona horaria. */
export function dateInputToTimestamp(value: string): Timestamp | null {
  const v = value.trim();
  if (!v) return null;
  const [y, m, d] = v.split("-").map(Number);
  if (!y || !m || !d) return null;
  return Timestamp.fromDate(new Date(y, m - 1, d, 12, 0, 0));
}

export function timestampToDateInput(v: unknown): string {
  if (!v) return "";
  const raw = v as { toDate?: () => Date; seconds?: number };
  const d =
    typeof raw.toDate === "function"
      ? raw.toDate()
      : typeof raw.seconds === "number"
        ? new Date(raw.seconds * 1000)
        : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Alta de personal desde la APK. El usuario se crea en una app secundaria para
 * que el administrador no pierda su sesión.
 */
export async function createStaff(
  data: StaffInput,
  password: string
): Promise<string> {
  const secondary = getSecondaryAuth(FIREBASE_CONFIG);
  const cred = await createUserWithEmailAndPassword(
    secondary,
    data.email.trim().toLowerCase(),
    password || DEFAULT_PASSWORD
  );
  const uid = cred.user.uid;
  try {
    await signOut(secondary);
  } catch {
    /* la sesión secundaria es de un solo uso */
  }

  const payload: Record<string, unknown> = {
    uid,
    email: data.email.trim().toLowerCase(),
    fullName: data.fullName.trim(),
    dni: data.dni.trim().toUpperCase(),
    phone: data.phone.trim(),
    role: data.role,
    userType: data.userType,
    active: true,
    schedule: data.schedule,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const start = dateInputToTimestamp(data.startDate);
  const end = dateInputToTimestamp(data.endDate);
  if (start) payload.startDate = start;
  if (end) payload.endDate = end;

  await setDoc(doc(getDb(), "users", uid), payload);
  return uid;
}

export async function updateStaff(
  uid: string,
  data: StaffInput & { active: boolean }
): Promise<void> {
  await updateDoc(doc(getDb(), "users", uid), {
    fullName: data.fullName.trim(),
    dni: data.dni.trim().toUpperCase(),
    email: data.email.trim().toLowerCase(),
    phone: data.phone.trim(),
    role: data.role,
    userType: data.userType,
    active: data.active,
    schedule: data.schedule,
    startDate: dateInputToTimestamp(data.startDate),
    endDate: dateInputToTimestamp(data.endDate),
    updatedAt: serverTimestamp(),
  });
}

export async function setStaffActive(uid: string, active: boolean): Promise<void> {
  await updateDoc(doc(getDb(), "users", uid), {
    active,
    updatedAt: serverTimestamp(),
  });
}

/** Cambio de contraseña por el administrador (Cloud Function con Admin SDK). */
export async function setStaffPassword(uid: string, password: string): Promise<void> {
  if (password.trim().length < 6) {
    throw new Error("La contraseña debe tener al menos 6 caracteres.");
  }
  const functions = getFunctions(getFirebaseApp(FIREBASE_CONFIG), "europe-west1");
  const call = httpsCallable(functions, "adminSetPassword");
  await call({ uid, password: password.trim() });
}

export async function sendStaffPasswordReset(email: string): Promise<void> {
  const trimmed = email.trim();
  if (!trimmed) throw new Error("La ficha no tiene email.");
  await sendPasswordResetEmail(getFirebaseAuth(), trimmed, {
    url: "https://grefa-tareas.web.app/login/",
    handleCodeInApp: false,
  });
}
