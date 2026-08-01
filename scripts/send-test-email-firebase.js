/**
 * Email de prueba vía Firebase Auth (restablecimiento contraseña).
 * Solo si no hay RESEND/SMTP. El asunto será el de Firebase, no el de tareas.
 */
const path = require("path");
const fs = require("fs");

const TEST_EMAIL = "monteromiguel@gmail.com";

function loadMobileEnv() {
  const p = path.join(__dirname, "../apps/mobile/.env");
  if (!fs.existsSync(p)) throw new Error("Falta apps/mobile/.env");
  const cfg = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    cfg[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return {
    apiKey: cfg.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: cfg.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: cfg.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  };
}

async function main() {
  const { initializeApp } = await import("firebase/app");
  const { getAuth, sendPasswordResetEmail } = await import("firebase/auth");
  const cfg = loadMobileEnv();
  const app = initializeApp(cfg);
  const auth = getAuth(app);
  await sendPasswordResetEmail(auth, TEST_EMAIL, {
    url: "https://grefa-tareas.web.app/login/",
    handleCodeInApp: false,
  });
  console.log("Email Firebase Auth enviado a", TEST_EMAIL);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
