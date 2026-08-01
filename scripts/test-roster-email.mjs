/**
 * Envío de prueba del cuadrante al propio administrador, para comprobar que el
 * script de Apps Script publicado sabe montar y mandar la tabla semanal.
 *
 *   node scripts/test-roster-email.mjs correo@grefa.org
 */
const URL_EXEC =
  "https://script.google.com/macros/s/AKfycbzUDKoSuJXYQyw_XDx0y8FiWNyvbd4OA-IYZu5HUf2DJHGuatNVEQeMqMpg7vsuMOo3fw/exec";
const to = process.argv[2];
const SECRET = process.argv[3] || process.env.NOTIFY_SECRET || "";
if (!to || !SECRET) {
  console.error(
    "Uso: node scripts/test-roster-email.mjs correo@grefa.org [clave]\n" +
      "La clave también se puede pasar en la variable NOTIFY_SECRET."
  );
  process.exit(1);
}

const body = {
  secret: SECRET,
  senderEmail: to,
  senderName: "Prueba técnica",
  roster: {
    weekLabel: "PRUEBA · Semana del 3/8/2026",
    days: ["Lun 3/8", "Mar 4/8", "Mié 5/8", "Jue 6/8", "Vie 7/8", "Sáb 8/8", "Dom 9/8"],
    rows: [
      {
        uid: "prueba-1",
        name: "Ejemplo Voluntario",
        role: "Voluntario",
        hours: "09:00–14:00",
        marks: ["SI", "", "", "SI", "", "", ""],
      },
      {
        uid: "prueba-2",
        name: "Ejemplo Trabajador",
        role: "Trabajador",
        hours: "08:00–15:00",
        marks: ["SI", "SI", "SI", "SI", "SI", "", ""],
      },
    ],
    recipients: [
      {
        uid: "prueba-1",
        email: to,
        fullName: "Ejemplo Voluntario",
        shifts: ["lunes 3/8 · 09:00–14:00", "jueves 6/8 · 09:00–14:00"],
      },
    ],
  },
};

const res = await fetch(URL_EXEC, {
  method: "POST",
  headers: { "Content-Type": "text/plain;charset=utf-8" },
  body: JSON.stringify(body),
});
console.log(`HTTP ${res.status}`);
console.log(await res.text());
