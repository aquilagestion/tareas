/**
 * Establece la misma contraseña a todos los usuarios Auth.
 * Uso: node scripts/reset-all-passwords.js [password]
 */
const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

const pwd = process.argv[2] || "Grefa2026!";
const admin = createRequire(path.join(__dirname, "..", "functions", "package.json"))("firebase-admin");
const saPath = path.join(__dirname, "..", "secrets", "serviceAccount.json");
if (!fs.existsSync(saPath)) {
  console.error("Falta secrets/serviceAccount.json");
  process.exit(1);
}
admin.initializeApp({
  credential: admin.credential.cert(require(saPath)),
  projectId: "grefa-tareas",
});

(async () => {
  let nextPageToken;
  let count = 0;
  do {
    const res = await admin.auth().listUsers(500, nextPageToken);
    for (const u of res.users) {
      await admin.auth().updateUser(u.uid, { password: pwd });
      console.log("OK", u.email || u.uid);
      count++;
    }
    nextPageToken = res.pageToken;
  } while (nextPageToken);
  console.log(`\n${count} usuarios → contraseña: ${pwd}`);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
