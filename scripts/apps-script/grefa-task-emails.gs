/**
 * GREFA Tareas — Emails agrupados por trabajador (Gmail gratis).
 *
 * Propiedades del script (⚙️):
 *   NOTIFY_SECRET  = clave compartida con la web y la APK (no se escribe aquí)
 *   SPREADSHEET_ID = ID del Google Sheet (registro)
 *
 * El remitente (replyTo / nombre) lo envía la web: administrador logueado que crea la tarea.
 */

var ALL_STAFF_LABEL = "Asignada a TODO el personal";
var LOG_SHEET = "Registro avisos";
// La clave vive en la propiedad NOTIFY_SECRET del script: aquí queda vacía a
// propósito para no publicarla. Sin la propiedad, el endpoint rechaza todo.
var DEFAULT_SECRET = "";

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("GREFA Tareas")
    .addItem("Enviar filas pendientes de la cola", "sendPendingFromSheet")
    .addToUi();
}

function doPost(e) {
  try {
    var secret = PropertiesService.getScriptProperties().getProperty("NOTIFY_SECRET") || DEFAULT_SECRET;
    var body = JSON.parse(e.postData.contents);
    if (!body.secret || body.secret !== secret) {
      return jsonOut({ ok: false, error: "No autorizado" });
    }
    var sender = {
      email: String(body.senderEmail || "").trim(),
      fullName: String(body.senderName || "Administración GREFA").trim(),
    };
    if (body.roster) {
      return jsonOut(sendRoster(body.roster, sender));
    }
    var list = body.notifications || [];
    if (!list.length) {
      return jsonOut({ ok: false, error: "Sin notificaciones" });
    }
    var sent = 0;
    var errors = [];
    for (var i = 0; i < list.length; i++) {
      try {
        sendGroupedEmail(list[i], sender);
        logToSheet(list[i], sender, "ENVIADO", "");
        sent++;
      } catch (err) {
        var msg = String(err.message || err);
        errors.push(String(list[i].email) + ": " + msg);
        logToSheet(list[i], sender, "ERROR", msg);
      }
    }
    return jsonOut({ ok: true, sent: sent, errors: errors, sender: sender.email });
  } catch (err) {
    return jsonOut({ ok: false, error: err.message });
  }
}

function sendPendingFromSheet() {
  var ss = getSpreadsheet();
  if (!ss) throw new Error("Sin SPREADSHEET_ID configurado");
  var sh = ss.getSheetByName("Cola envío");
  if (!sh) throw new Error('Crea la hoja "Cola envío"');
  var data = sh.getDataRange().getValues();
  var sender = { email: Session.getActiveUser().getEmail(), fullName: Session.getActiveUser().getEmail() };
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][5] || "").toUpperCase() !== "PENDIENTE") continue;
    try {
      var item = {
        email: data[r][0],
        fullName: data[r][1],
        tasks: JSON.parse(data[r][2] || "[]"),
      };
      var rowSender = {
        email: data[r][3] || sender.email,
        fullName: data[r][4] || sender.fullName,
      };
      sendGroupedEmail(item, rowSender);
      sh.getRange(r + 1, 6).setValue("ENVIADO");
      sh.getRange(r + 1, 7).setValue(new Date());
      logToSheet(item, rowSender, "ENVIADO (cola)", "");
    } catch (e) {
      sh.getRange(r + 1, 6).setValue("ERROR");
      sh.getRange(r + 1, 7).setValue(String(e.message));
    }
  }
}

function sendGroupedEmail(item, sender) {
  var email = String(item.email || "").trim();
  var fullName = String(item.fullName || "Trabajador").trim();
  var tasks = item.tasks || [];
  if (!email || !tasks.length) throw new Error("Email o tareas vacías");

  sender = sender || { email: "", fullName: "Administración GREFA" };

  var subject =
    tasks.length === 1
      ? "GREFA Tareas — Tu tarea programada"
      : "GREFA Tareas — Tus " + tasks.length + " tareas programadas";

  var html = buildHtml(fullName, tasks, sender);
  var text = buildText(fullName, tasks, sender);

  var displayName = sender.fullName
    ? "GREFA Tareas · " + sender.fullName
    : "GREFA Tareas";

  var opts = { htmlBody: html, name: displayName };

  if (sender.email) {
    opts.replyTo = sender.email;
    // Si el admin tiene alias «Enviar correo como» en la cuenta del script, usarlo
    try {
      GmailApp.sendEmail(email, subject, text, opts);
      return;
    } catch (e1) {
      // Reintento con from explícito por si el alias está configurado
      try {
        opts.from = sender.fullName
          ? sender.fullName + " <" + sender.email + ">"
          : sender.email;
        GmailApp.sendEmail(email, subject, text, opts);
        return;
      } catch (e2) {
        delete opts.from;
        GmailApp.sendEmail(email, subject, text, opts);
      }
    }
  } else {
    GmailApp.sendEmail(email, subject, text, opts);
  }
}

/**
 * Cuadrante semanal: mismo cuadro para todos, con la fila de cada destinatario
 * destacada y sus turnos listados arriba.
 *
 * roster = {
 *   weekLabel: "Semana del 3/8/2026",
 *   days: ["Lun 3/8", ...],
 *   rows: [{ uid, name, role, hours, marks: ["SI","NO","",...] }],
 *   recipients: [{ uid, email, fullName, shifts: ["lunes 3/8 · 09:00–14:00"] }]
 * }
 */
function sendRoster(roster, sender) {
  var days = roster.days || [];
  var rows = roster.rows || [];
  var recipients = roster.recipients || [];
  var weekLabel = String(roster.weekLabel || "Cuadrante semanal");
  if (!recipients.length) return { ok: false, error: "Cuadrante sin destinatarios" };

  var sent = 0;
  var errors = [];
  for (var i = 0; i < recipients.length; i++) {
    var r = recipients[i];
    try {
      if (!r.email) throw new Error("Sin email");
      var subject = "GREFA Tareas — Cuadrante: " + weekLabel;
      var html = buildRosterHtml(r, weekLabel, days, rows, sender);
      var text = buildRosterText(r, weekLabel, days, rows, sender);
      var opts = {
        htmlBody: html,
        name: sender.fullName ? "GREFA Tareas · " + sender.fullName : "GREFA Tareas",
      };
      if (sender.email) opts.replyTo = sender.email;
      GmailApp.sendEmail(r.email, subject, text, opts);
      logRoster(r, sender, weekLabel, "ENVIADO", "");
      sent++;
    } catch (err) {
      var msg = String(err.message || err);
      errors.push(String(r.email) + ": " + msg);
      logRoster(r, sender, weekLabel, "ERROR", msg);
    }
  }
  return { ok: true, sent: sent, errors: errors, sender: sender.email };
}

function buildRosterHtml(recipient, weekLabel, days, rows, sender) {
  var shifts = recipient.shifts || [];
  var mine = shifts.length
    ? "<ul>" +
      shifts
        .map(function (s) {
          return "<li><strong>" + esc(s) + "</strong></li>";
        })
        .join("") +
      "</ul>"
    : '<p style="color:#92400e">Esta semana no tienes turnos asignados.</p>';

  var head =
    '<tr><th align="left" style="' +
    thStyle() +
    '">Personal</th>' +
    days
      .map(function (d) {
        return '<th style="' + thStyle() + '">' + esc(d) + "</th>";
      })
      .join("") +
    "</tr>";

  var bodyRows = rows
    .map(function (row) {
      var isMe = row.uid && recipient.uid && row.uid === recipient.uid;
      var nameBg = isMe ? "#FEF3C7" : "#ffffff";
      var weight = isMe ? "700" : "400";
      var cells = (row.marks || [])
        .map(function (m) {
          var bg = m === "SI" ? "#D1FAE5" : m === "NO" ? "#FEE2E2" : "#ffffff";
          var txt = m === "SI" ? "Sí" : m === "NO" ? "No" : "·";
          return (
            '<td align="center" style="' +
            tdStyle() +
            "background:" +
            bg +
            ";font-weight:" +
            weight +
            '">' +
            txt +
            "</td>"
          );
        })
        .join("");
      var label = esc(row.name || "");
      if (row.role) label += '<br/><span style="font-size:11px;color:#78716C">' + esc(row.role) + "</span>";
      if (row.hours) label += '<br/><span style="font-size:11px;color:#A8A29E">' + esc(row.hours) + "</span>";
      return (
        '<tr><td style="' +
        tdStyle() +
        "background:" +
        nameBg +
        ";font-weight:" +
        weight +
        '">' +
        label +
        "</td>" +
        cells +
        "</tr>"
      );
    })
    .join("");

  var byLine = sender && sender.fullName
    ? '<p style="font-size:12px;color:#57534e">Enviado por: <strong>' +
      esc(sender.fullName) +
      "</strong>" +
      (sender.email ? " (" + esc(sender.email) + ")" : "") +
      "</p>"
    : "";

  return (
    "<p>Hola " +
    esc(recipient.fullName || "") +
    ",</p>" +
    "<p>Este es el cuadrante de la <strong>" +
    esc(weekLabel) +
    "</strong>. Tus turnos:</p>" +
    mine +
    '<p>Cuadrante completo del equipo (tu fila va resaltada):</p>' +
    '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px">' +
    head +
    bodyRows +
    "</table>" +
    byLine +
    "<p>— GREFA · Majadahonda</p>"
  );
}

function buildRosterText(recipient, weekLabel, days, rows, sender) {
  var shifts = recipient.shifts || [];
  var mine = shifts.length
    ? shifts
        .map(function (s) {
          return "• " + s;
        })
        .join("\n")
    : "Esta semana no tienes turnos asignados.";
  var table = rows
    .map(function (row) {
      var marks = (row.marks || [])
        .map(function (m, i) {
          return (days[i] || "") + ": " + (m === "SI" ? "Sí" : m === "NO" ? "No" : "-");
        })
        .join(" | ");
      var star = row.uid && recipient.uid && row.uid === recipient.uid ? "» " : "  ";
      return star + row.name + " → " + marks;
    })
    .join("\n");
  var byLine =
    sender && sender.fullName
      ? "\nEnviado por: " + sender.fullName + (sender.email ? " (" + sender.email + ")" : "") + "\n"
      : "";
  return (
    "GREFA Tareas — Cuadrante " +
    weekLabel +
    "\n\nHola " +
    (recipient.fullName || "") +
    ", tus turnos:\n" +
    mine +
    "\n\nCuadrante completo:\n" +
    table +
    "\n" +
    byLine
  );
}

function thStyle() {
  return "border:1px solid #E7E5E4;padding:6px 8px;background:#F5F1E8;color:#2F6B3A;font-weight:800;";
}

function tdStyle() {
  return "border:1px solid #E7E5E4;padding:6px 8px;";
}

function logRoster(recipient, sender, weekLabel, status, detail) {
  var ss = getSpreadsheet();
  if (!ss) return;
  var sh = ss.getSheetByName(LOG_SHEET);
  if (!sh) return;
  sh.appendRow([
    new Date(),
    recipient.email,
    recipient.fullName,
    "Cuadrante " + weekLabel + " (" + (recipient.shifts || []).length + " turnos)",
    (sender.fullName || "") + (sender.email ? " <" + sender.email + ">" : ""),
    status,
    detail,
  ]);
}

function logToSheet(item, sender, status, detail) {
  var ss = getSpreadsheet();
  if (!ss) return;
  var sh = ss.getSheetByName(LOG_SHEET);
  if (!sh) {
    sh = ss.insertSheet(LOG_SHEET);
    sh.appendRow(["Fecha", "Destinatario", "Nombre", "Nº tareas", "Enviado por", "Estado", "Detalle"]);
  }
  sh.appendRow([
    new Date(),
    item.email,
    item.fullName,
    (item.tasks || []).length,
    (sender.fullName || "") + (sender.email ? " <" + sender.email + ">" : ""),
    status,
    detail,
  ]);
}

function getSpreadsheet() {
  var id =
    PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID") ||
    "1l-rYv-0Gc--zC8qHGll_B-9lOPcnFnn8VjQkLpv5mTw";
  return SpreadsheetApp.openById(id);
}

function setupSpreadsheet() {
  var ss = getSpreadsheet();
  ensureSheet(ss, LOG_SHEET, [
    "Fecha",
    "Destinatario",
    "Nombre",
    "Nº tareas",
    "Enviado por",
    "Estado",
    "Detalle",
  ]);
  ensureSheet(ss, "Cola envío", [
    "Email",
    "Nombre",
    "Tareas (JSON)",
    "Email responsable",
    "Nombre responsable",
    "Estado",
    "Resultado",
  ]);
}

function ensureSheet(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.appendRow(headers);
}

function buildHtml(fullName, tasks, sender) {
  var hasAll = tasks.some(function (t) {
    return t.assignedToAll === true;
  });
  var intro =
    tasks.length === 1 ? "Esta es tu tarea pendiente:" : "Tienes " + tasks.length + " tareas pendientes:";
  var allNote = hasAll
    ? '<p style="color:#92400e;font-weight:600">Incluye tarea(s) marcadas como <strong>' +
      ALL_STAFF_LABEL +
      "</strong>.</p>"
    : "";
  var byLine = "";
  if (sender && sender.fullName) {
    byLine =
      '<p class="small" style="color:#57534e">Programado por: <strong>' +
      esc(sender.fullName) +
      "</strong>" +
      (sender.email ? " (" + esc(sender.email) + ")" : "") +
      "</p>";
  }
  var rows = tasks
    .map(function (t) {
      var badge = t.assignedToAll
        ? ' <span style="color:#92400e;font-weight:700">[' + ALL_STAFF_LABEL + "]</span>"
        : "";
      var row = "<li><strong>" + esc(t.title) + "</strong>" + badge + " — " + esc(t.when);
      if (t.description) row += '<br/><span style="color:#57534e">' + esc(t.description) + "</span>";
      return row + "</li>";
    })
    .join("");
  return (
    "<p>Hola " +
    esc(fullName) +
    ",</p><p>" +
    intro +
    "</p>" +
    allNote +
    "<ul>" +
    rows +
    "</ul>" +
    byLine +
    '<p>Consulta la app <strong>GREFA Tareas</strong>.</p><p>— GREFA · Majadahonda</p>'
  );
}

function buildText(fullName, tasks, sender) {
  var hasAll = tasks.some(function (t) {
    return t.assignedToAll === true;
  });
  var header =
    tasks.length === 1 ? "Tu tarea pendiente:" : "Tus " + tasks.length + " tareas pendientes:";
  var allNote = hasAll ? "\n⚠ Incluye: " + ALL_STAFF_LABEL + "\n" : "";
  var byLine =
    sender && sender.fullName
      ? "\nProgramado por: " + sender.fullName + (sender.email ? " (" + sender.email + ")" : "") + "\n"
      : "";
  var lines = tasks
    .map(function (t) {
      var badge = t.assignedToAll ? " [" + ALL_STAFF_LABEL + "]" : "";
      var line = "• " + t.title + badge + " (" + t.when + ")";
      if (t.description) line += "\n  " + t.description.substring(0, 120);
      return line;
    })
    .join("\n");
  return (
    "GREFA Tareas — Hola " +
    fullName +
    ":\n\n" +
    header +
    allNote +
    "\n" +
    lines +
    byLine +
    "\nConsulta la app GREFA Tareas."
  );
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function testSend() {
  sendGroupedEmail(
    {
      email: "monteromiguel@gmail.com",
      fullName: "Prueba GREFA",
      tasks: [
        {
          title: "Tarea demo",
          when: "lunes · 09:00",
          description: "Prueba Apps Script",
          assignedToAll: true,
        },
      ],
    },
    { email: "aquilagestion@grefa.org", fullName: "Admin GREFA" }
  );
}
