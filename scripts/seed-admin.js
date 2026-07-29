/**
 * Seed ADMIN + usuario demo WORKER.
 * Requiere:
 *  1) Authentication activado en consola (Email/Password)
 *  2) secrets/serviceAccount.json
 *
 * Uso:
 *   node scripts/seed-admin.js
 */
const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");
const pathMod = require("path");
let admin;
try { admin = require("firebase-admin"); }
catch {
  admin = createRequire(pathMod.join(__dirname, "..", "functions", "package.json"))("firebase-admin");
}

const saPath = path.join(__dirname, "..", "secrets", "serviceAccount.json");
if (!fs.existsSync(saPath)) {
  console.error("Falta secrets/serviceAccount.json");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(saPath)),
  projectId: "grefa-tareas",
});

const auth = admin.auth();
const db = admin.firestore();

const USERS = [
  {
    email: "admin@grefa.org",
    password: "GrefaAdmin2026!",
    profile: {
      fullName: "Administrador GREFA",
      dni: "12345678Z",
      phone: "",
      role: "ADMIN",
      userType: "TRABAJADOR_GREFA",
      active: true,
    },
  },
  {
    email: "trabajador@grefa.org",
    password: "GrefaWorker2026!",
    profile: {
      fullName: "Trabajador Demo GREFA",
      dni: "87654321X",
      phone: "",
      role: "WORKER",
      userType: "TRABAJADOR_GREFA",
      active: true,
    },
  },
  {
    email: "voluntario@grefa.org",
    password: "GrefaVol2026!",
    profile: {
      fullName: "Voluntario Demo",
      dni: "11223344B",
      phone: "",
      role: "WORKER",
      userType: "VOLUNTARIO",
      active: true,
    },
  },
];

async function upsertUser(entry) {
  let user;
  try {
    user = await auth.getUserByEmail(entry.email);
    await auth.updateUser(user.uid, { password: entry.password, displayName: entry.profile.fullName });
    console.log("Actualizado Auth:", entry.email, user.uid);
  } catch (e) {
    if (e.code !== "auth/user-not-found") throw e;
    user = await auth.createUser({
      email: entry.email,
      password: entry.password,
      displayName: entry.profile.fullName,
      emailVerified: true,
    });
    console.log("Creado Auth:", entry.email, user.uid);
  }

  await db
    .collection("users")
    .doc(user.uid)
    .set(
      {
        uid: user.uid,
        email: entry.email,
        ...entry.profile,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  console.log("Firestore users/" + user.uid);
}

(async () => {
  for (const u of USERS) {
    await upsertUser(u);
  }
  console.log("\nListo. Credenciales demo:");
  for (const u of USERS) {
    console.log(`  ${u.profile.role}/${u.profile.userType}: ${u.email} / ${u.password}`);
  }
  process.exit(0);
})().catch((e) => {
  console.error("\nERROR:", e.message || e);
  if (String(e.message || e).includes("CONFIGURATION_NOT_FOUND")) {
    console.error(
      "\nActiva Authentication en la consola:\n  https://console.firebase.google.com/project/grefa-tareas/authentication/providers\n  â†’ Get started â†’ Email/Password â†’ Enable â†’ Save\nLuego vuelve a ejecutar: node scripts/seed-admin.js"
    );
  }
  process.exit(1);
});

