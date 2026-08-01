import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  updatePassword,
  sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-functions.js";
import { firebaseConfig } from "./firebase-config.js";
import { APP_VERSION } from "./version.js";
import { startVersionWatch } from "./version-check.js";
import { enumerateLocalDates, MAX_RECURRING_DAYS } from "./date-range.js";

startVersionWatch(APP_VERSION);

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
const functions = getFunctions(app, "europe-west1");
const adminSetPasswordFn = httpsCallable(functions, "adminSetPassword");
const notifyTaskAssigneesFn = httpsCallable(functions, "notifyTaskAssigneesCall");

let secondaryApp = null;
function getSecondaryAuth() {
  if (!secondaryApp) {
    secondaryApp = initializeApp(firebaseConfig, "Secondary");
  }
  return getAuth(secondaryApp);
}

export const DEFAULT_PASSWORD = "Grefa2026!";

export function $(id) {
  return document.getElementById(id);
}

export function showError(el, msg) {
  if (!el) return;
  if (!msg) {
    el.style.display = "none";
    el.textContent = "";
    return;
  }
  el.textContent = msg;
  el.style.display = "block";
}

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

/** Campo contraseña con botón mostrar/ocultar */
export function bindPasswordToggle(inputId, btnId) {
  const input = $(inputId);
  const btn = $(btnId);
  if (!input || !btn) return;
  btn.addEventListener("click", () => {
    const hidden = input.type === "password";
    input.type = hidden ? "text" : "password";
    btn.textContent = hidden ? "Ocultar" : "Mostrar";
    btn.setAttribute("aria-label", hidden ? "Ocultar contraseña" : "Mostrar contraseña");
  });
}

export function isValidDni(value) {
  const v = String(value || "")
    .trim()
    .toUpperCase();
  if (!/^[0-9XYZ]\d{7}[A-Z]$/.test(v)) return false;
  const letters = "TRWAGMYFPDXBNJZSQVHLCKE";
  let num = v.slice(0, 8);
  if (num[0] === "X") num = "0" + num.slice(1);
  else if (num[0] === "Y") num = "1" + num.slice(1);
  else if (num[0] === "Z") num = "2" + num.slice(1);
  return letters[parseInt(num, 10) % 23] === v[8];
}

export function dateInputValue(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : ts instanceof Date ? ts : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function makeRecurrenceId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const rand = () => Math.random().toString(36).slice(2, 10);
  return `rec-${Date.now().toString(36)}-${rand()}${rand()}`;
}

export function parseDateInput(value) {
  const v = String(value || "").trim();
  if (!v) return null;
  const [y, m, d] = v.split("-").map(Number);
  if (!y || !m || !d) return null;
  return Timestamp.fromDate(new Date(y, m - 1, d, 12, 0, 0));
}

export function formatTaskWhen(task) {
  const date = dateInputValue(task.taskDate);
  const start = task.startTime || "";
  const end = task.endTime || "";
  if (!date && !start) return "—";
  let s = date ? new Date(date + "T12:00:00").toLocaleDateString("es-ES") : "";
  if (start) s += (s ? " · " : "") + start;
  if (end) s += "–" + end;
  return s;
}

/** Rol → orden; luego nombre */
export function sortPeopleForAssign(list) {
  const roleOrder = { ADMIN: 0, WORKER: 1 };
  const typeOrder = { TRABAJADOR_GREFA: 0, VOLUNTARIO: 1, PERSONAL_PRACTICAS: 2 };
  return [...list].sort((a, b) => {
    const ra = roleOrder[a.role] ?? 9;
    const rb = roleOrder[b.role] ?? 9;
    if (ra !== rb) return ra - rb;
    const ta = typeOrder[a.userType] ?? 9;
    const tb = typeOrder[b.userType] ?? 9;
    if (ta !== tb) return ta - tb;
    return String(a.fullName || "").localeCompare(String(b.fullName || ""), "es");
  });
}

export function roleLabel(role, userType) {
  if (role === "ADMIN") return "Administrador";
  if (userType === "VOLUNTARIO") return "Voluntario";
  if (userType === "PERSONAL_PRACTICAS") return "Personal en prácticas";
  return "Trabajador GREFA";
}

export async function requireAdmin() {
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      unsub();
      if (!user) {
        location.href = "/login/?next=" + encodeURIComponent(location.pathname);
        reject(new Error("no-auth"));
        return;
      }
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (!snap.exists() || snap.data().role !== "ADMIN" || snap.data().active !== true) {
          await signOut(auth);
          location.href = "/login/?err=not-admin";
          reject(new Error("not-admin"));
          return;
        }
        resolve({ user, profile: { uid: user.uid, ...snap.data() } });
      } catch (e) {
        reject(e);
      }
    });
  });
}

export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  const snap = await getDoc(doc(db, "users", cred.user.uid));
  if (!snap.exists() || snap.data().role !== "ADMIN" || snap.data().active !== true) {
    await signOut(auth);
    throw new Error("Esta cuenta no es administrador activo.");
  }
  return cred.user;
}

export async function logout() {
  await signOut(auth);
  location.href = "/login/";
}

/** Envía email de recuperación (plantilla Firebase con asunto personalizado). */
export async function requestPasswordReset(email) {
  const trimmed = String(email || "").trim();
  if (!trimmed) throw new Error("Indica el email.");
  await sendPasswordResetEmail(auth, trimmed, {
    url: "https://grefa-tareas.web.app/login/",
    handleCodeInApp: false,
  });
}

export async function setUserPassword(uid, password) {
  await adminSetPasswordFn({ uid, password });
}

/** Usuario cambia su propia contraseña (web admin logueado). */
export async function changeOwnPassword(newPassword) {
  const user = auth.currentUser;
  if (!user) throw new Error("Sin sesión");
  await updatePassword(user, newPassword);
}

export async function createPersonnel(data) {
  const password = data.password || DEFAULT_PASSWORD;
  const secondaryAuth = getSecondaryAuth();
  const cred = await createUserWithEmailAndPassword(secondaryAuth, data.email.trim(), password);
  const uid = cred.user.uid;
  await signOut(secondaryAuth);
  const payload = {
    uid,
    email: data.email.trim(),
    fullName: data.fullName.trim(),
    dni: String(data.dni).trim().toUpperCase(),
    phone: (data.phone || "").trim(),
    role: data.role,
    userType: data.userType,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const start = parseDateInput(data.startDate);
  const end = parseDateInput(data.endDate);
  if (start) payload.startDate = start;
  if (end) payload.endDate = end;
  if (data.schedule !== undefined) payload.schedule = data.schedule;
  await setDoc(doc(db, "users", uid), payload);
  return uid;
}

export async function updatePersonnel(uid, data) {
  const payload = {
    fullName: String(data.fullName || "").trim(),
    dni: String(data.dni || "")
      .trim()
      .toUpperCase(),
    phone: String(data.phone || "").trim(),
    email: String(data.email || "")
      .trim()
      .toLowerCase(),
    role: data.role,
    userType: data.userType,
    active: data.active === true || data.active === "true",
    updatedAt: serverTimestamp(),
  };
  const start = parseDateInput(data.startDate);
  const end = parseDateInput(data.endDate);
  payload.startDate = start;
  payload.endDate = end;
  if (data.schedule !== undefined) payload.schedule = data.schedule;
  await updateDoc(doc(db, "users", uid), payload);
  if (data.newPassword && String(data.newPassword).length >= 6) {
    await setUserPassword(uid, String(data.newPassword));
  }
}

export async function createTask(data) {
  if (!data.assignees?.length) throw new Error("Selecciona al menos un asignado.");
  const repeatDaily = data.repeatDaily === true;
  const repeatUntil = String(data.repeatUntil || "").trim();
  let dateKeys = [String(data.taskDate || "").trim()];
  if (repeatDaily) {
    if (!repeatUntil) throw new Error("Indica hasta qué fecha debe repetirse la tarea.");
    dateKeys = enumerateLocalDates(dateKeys[0], repeatUntil);
    if (!dateKeys.length) {
      throw new Error("La fecha «hasta» debe ser igual o posterior a la fecha de la tarea.");
    }
    if (dateKeys.length > MAX_RECURRING_DAYS) {
      throw new Error(`Máximo ${MAX_RECURRING_DAYS} días de repetición.`);
    }
  }
  const recurrenceId = dateKeys.length > 1 ? makeRecurrenceId() : null;
  const ids = [];
  for (const dateStr of dateKeys) {
    const ref = await addDoc(collection(db, "tasks"), {
      title: data.title.trim(),
      description: (data.description || "").trim(),
      createdBy: data.createdBy,
      assignedUserIds: data.assignees.map((a) => a.uid),
      assignedUsersInfo: data.assignees.map((a) => ({
        uid: a.uid,
        fullName: a.fullName,
        userType: a.userType,
        dni: a.dni,
      })),
      assignedToAll: data.assignedToAll === true,
      status: "PENDING",
      taskDate: parseDateInput(dateStr) || Timestamp.now(),
      startTime: String(data.startTime || "").trim(),
      endTime: String(data.endTime || "").trim(),
      recurrenceId,
      createdAt: serverTimestamp(),
    });
    ids.push(ref.id);
  }
  return ids;
}

/** Encola aviso de programación (procesado por Cloud Function o script local). */
export async function enqueueTaskNotification(taskId) {
  await addDoc(collection(db, "notificationQueue"), {
    taskId,
    type: "TASK_ASSIGNED",
    status: "PENDING",
    createdAt: serverTimestamp(),
  });
}

/** Reenvía avisos inmediatos vía Cloud Function (requiere functions desplegadas). */
export async function notifyTaskAssignees(taskId) {
  const res = await notifyTaskAssigneesFn({ taskId });
  return res.data;
}

export async function updateTask(taskId, data, assignees) {
  const payload = {
    title: String(data.title || "").trim(),
    description: String(data.description || "").trim(),
    taskDate: parseDateInput(data.taskDate) || Timestamp.now(),
    startTime: String(data.startTime || "").trim(),
    endTime: String(data.endTime || "").trim(),
    updatedAt: serverTimestamp(),
  };
  if (data.materialShortage !== undefined) {
    payload.materialShortage = String(data.materialShortage || "").trim() || null;
  }
  if (data.completionNotes !== undefined) {
    payload.completionNotes = String(data.completionNotes || "").trim() || null;
  }
  if (assignees?.length) {
    payload.assignedUserIds = assignees.map((a) => a.uid);
    payload.assignedUsersInfo = assignees.map((a) => ({
      uid: a.uid,
      fullName: a.fullName,
      userType: a.userType,
      dni: a.dni,
    }));
  }
  await updateDoc(doc(db, "tasks", taskId), payload);
}

export function subscribeActiveUsers(onChange, onError) {
  const q = query(collection(db, "users"), where("active", "==", true));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, uid: d.id, ...d.data() }))),
    (err) => onError?.(err)
  );
}

export function subscribeAllUsers(onChange, onError) {
  return onSnapshot(
    collection(db, "users"),
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, uid: d.id, ...d.data() }))),
    (err) => onError?.(err)
  );
}

export function subscribeRecentTasks(onChange, onError) {
  const q = query(collection(db, "tasks"), orderBy("taskDate", "desc"));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => onError?.(err)
  );
}

export function renderNav(active, profileName) {
  const items = [
    { href: "/", label: "Inicio", id: "home" },
    { href: "/personal/", label: "Personal", id: "personal" },
    { href: "/tareas/", label: "Tareas", id: "tareas" },
    { href: "/revision/", label: "Revisión", id: "revision" },
    { href: "/auditoria/", label: "Auditoría", id: "auditoria" },
    { href: "/calendario/", label: "Calendario", id: "calendario" },
    { href: "/cuadrante/", label: "Cuadrante", id: "cuadrante" },
  ];
  return `
  <nav class="topnav">
    <div class="topnav-brand">GREFA Tareas</div>
    <div class="topnav-links">
      ${items
        .map(
          (i) =>
            `<a href="${i.href}" class="nav-btn ${i.id === active ? "active" : ""}">${i.label}</a>`
        )
        .join("")}
    </div>
    <div class="topnav-user">
      <span class="small muted nav-user-name">${escapeHtml(profileName || "")}</span>
      <span class="badge">v${APP_VERSION}</span>
      <button type="button" class="btn btn-secondary btn-sm" id="btnLogout">Salir</button>
    </div>
  </nav>`;
}

export { onAuthStateChanged, signInWithEmailAndPassword, Timestamp };
