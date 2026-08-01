import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Switch,
} from "react-native";
import { onAuthStateChanged } from "firebase/auth";
import { router } from "expo-router";
import { getFirebaseAuth, subscribeActiveUsers, subscribeUser } from "@grefa/firebase";
import type { User } from "@grefa/shared";
import {
  createTaskDoc,
  sendGroupedTaskEmails,
  sortUsersForAssign,
  todayDateInput,
} from "../lib/adminTasks";
import { formatTaskShareHtml, formatTaskShareText, type TaskShareInput } from "../lib/taskShare";
import { shareHtmlAsPdf, shareTextContent } from "../lib/shareExport";
import { assignableOn, subscribeAvailability, type AvailabilityMap } from "../lib/roster";
import { ScreenShell } from "../components/ScreenShell";
import { TimeField } from "../components/TimeField";

export default function AdminNewTaskScreen() {
  const [profile, setProfile] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [taskDate, setTaskDate] = useState(todayDateInput());
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignAll, setAssignAll] = useState(false);
  const [repeatDaily, setRepeatDaily] = useState(false);
  const [repeatUntil, setRepeatUntil] = useState("");
  const [sendNotify, setSendNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    heading: string;
    note: string;
    payload: TaskShareInput;
  } | null>(null);
  const [availability, setAvailability] = useState<AvailabilityMap>({});

  const sorted = useMemo(() => sortUsersForAssign(users), [users]);
  const { list: assignable, planned } = useMemo(
    () => assignableOn(sorted, taskDate.trim(), availability),
    [sorted, taskDate, availability]
  );

  useEffect(() => {
    let unsubUser = () => {};
    const unsubAuth = onAuthStateChanged(getFirebaseAuth(), (user) => {
      unsubUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      unsubUser = subscribeUser(user.uid, (p) => {
        setProfile(p);
        if (p && p.active && p.role !== "ADMIN") router.replace("/home");
      });
    });
    const u2 = subscribeActiveUsers(setUsers);
    return () => {
      unsubAuth();
      unsubUser();
      u2();
    };
  }, []);

  useEffect(() => {
    const key = taskDate.trim();
    if (!key) return;
    const u = subscribeAvailability([key], setAvailability);
    return () => u();
  }, [taskDate]);

  useEffect(() => {
    if (assignAll) {
      setSelected(new Set(assignable.map((u) => u.uid)));
      return;
    }
    // Al cambiar la fecha, soltar a quien ya no esté disponible ese día.
    setSelected((prev) => {
      const allowed = new Set(assignable.map((u) => u.uid));
      const next = new Set([...prev].filter((uid) => allowed.has(uid)));
      return next.size === prev.size ? prev : next;
    });
  }, [assignAll, assignable]);

  function toggle(uid: string) {
    setAssignAll(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  function buildSharePayload(count = 1): TaskShareInput {
    const assignees = assignable
      .filter((u) => selected.has(u.uid))
      .map((u) => ({
        uid: u.uid,
        fullName: u.fullName,
        dni: u.dni,
        userType: u.userType,
      }));
    return {
      title,
      description,
      taskDate,
      startTime,
      endTime,
      assignees,
      repeatDaily,
      repeatUntil: repeatDaily ? repeatUntil : undefined,
      count,
    };
  }

  async function shareCreated(asPdf: boolean) {
    if (!created) return;
    setError(null);
    try {
      if (asPdf) {
        await shareHtmlAsPdf(formatTaskShareHtml(created.payload), "Tarea GREFA");
      } else {
        await shareTextContent("Tarea GREFA", formatTaskShareText(created.payload));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo compartir");
    }
  }

  async function onSubmit() {
    setError(null);
    if (!profile || profile.role !== "ADMIN") {
      setError("Sin permisos de administrador");
      return;
    }
    const assignees = assignable
      .filter((u) => selected.has(u.uid))
      .map((u) => ({
        uid: u.uid,
        fullName: u.fullName,
        dni: u.dni,
        userType: u.userType,
      }));
    if (!assignees.length) {
      setError("Selecciona al menos un asignado");
      return;
    }
    setBusy(true);
    try {
      const ids = await createTaskDoc({
        title,
        description,
        taskDate,
        startTime,
        endTime,
        assignees,
        assignedToAll: assignAll,
        createdBy: profile.uid,
        repeatDaily,
        repeatUntil: repeatDaily ? repeatUntil : undefined,
      });
      const heading = ids.length > 1 ? `${ids.length} tareas creadas` : "Tarea creada";
      const payload = buildSharePayload(ids.length);
      let note = "Asignación guardada correctamente.";
      if (sendNotify && profile.email) {
        try {
          const n = await sendGroupedTaskEmails(
            assignees.map((a) => a.uid),
            users,
            { email: profile.email, fullName: profile.fullName }
          );
          note = `Emails agrupados enviados a ${n} trabajador(es).`;
        } catch (ex) {
          note = `Se guardó, pero el email falló: ${ex instanceof Error ? ex.message : "error"}`;
        }
      }
      setCreated({ heading, note, payload });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear");
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <ScreenShell>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <View style={styles.okBox}>
            <Text style={styles.okHeading}>{created.heading}</Text>
            <Text style={styles.okNote}>{created.note}</Text>
            <Text style={styles.okTask}>{created.payload.title}</Text>
            <Text style={styles.okMeta}>
              Asignada a: {created.payload.assignees.map((a) => a.fullName).join(", ")}
            </Text>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.shareHint}>Enviar la tarea (WhatsApp, Drive, impresora…)</Text>
          <View style={styles.shareRow}>
            <Pressable style={styles.shareBtn} onPress={() => void shareCreated(false)}>
              <Text style={styles.shareBtnText}>Texto</Text>
            </Pressable>
            <Pressable style={styles.shareBtn} onPress={() => void shareCreated(true)}>
              <Text style={styles.shareBtnText}>PDF</Text>
            </Pressable>
          </View>

          <Pressable style={styles.btn} onPress={() => router.replace("/admin")}>
            <Text style={styles.btnText}>Cerrar</Text>
          </Pressable>
        </ScrollView>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.label}>Título</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Ej. Revisión recinto" />

      <Text style={styles.label}>Descripción</Text>
      <TextInput
        style={[styles.input, styles.area]}
        value={description}
        onChangeText={setDescription}
        multiline
        placeholder="Detalle de la tarea"
      />

      <Text style={styles.label}>Fecha (AAAA-MM-DD)</Text>
      <TextInput style={styles.input} value={taskDate} onChangeText={setTaskDate} placeholder="2026-07-30" />

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Repetir cada día</Text>
        <Switch
          value={repeatDaily}
          onValueChange={(v) => {
            setRepeatDaily(v);
            if (v && !repeatUntil) setRepeatUntil(taskDate);
          }}
          trackColor={{ true: "#2F6B3A" }}
        />
      </View>
      {repeatDaily ? (
        <>
          <Text style={styles.label}>Repetir hasta (AAAA-MM-DD)</Text>
          <TextInput
            style={styles.input}
            value={repeatUntil}
            onChangeText={setRepeatUntil}
            placeholder="2026-08-15"
          />
        </>
      ) : null}

      <View style={styles.row}>
        <View style={styles.half}>
          <TimeField label="Hora inicio" value={startTime} onChange={setStartTime} />
        </View>
        <View style={styles.half}>
          <TimeField
            label="Hora fin"
            value={endTime}
            onChange={setEndTime}
            placeholder="12:00"
          />
        </View>
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Asignar a todo el personal</Text>
        <Switch
          value={assignAll}
          onValueChange={(v) => {
            setAssignAll(v);
            if (v) setSelected(new Set(assignable.map((u) => u.uid)));
          }}
          trackColor={{ true: "#2F6B3A" }}
        />
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Avisar por email (agrupado)</Text>
        <Switch value={sendNotify} onValueChange={setSendNotify} trackColor={{ true: "#2F6B3A" }} />
      </View>

      <Text style={styles.label}>Asignados</Text>
      <Text style={planned ? styles.rosterOk : styles.rosterNone}>
        {planned
          ? `Según el cuadrante, ${assignable.length} disponible(s) el ${taskDate.trim()}.`
          : `El ${taskDate.trim()} no tiene cuadrante marcado: se muestra todo el personal.`}
      </Text>
      {repeatDaily ? (
        <Text style={styles.rosterNone}>
          En series diarias se aplica el cuadrante del primer día.
        </Text>
      ) : null}
      {assignable.length === 0 ? (
        <Text style={styles.error}>
          Nadie disponible ese día. Marca disponibilidad en el Cuadrante.
        </Text>
      ) : null}
      {assignable.map((u) => (
        <Pressable key={u.uid} style={styles.checkRow} onPress={() => toggle(u.uid)}>
          <View style={[styles.checkbox, selected.has(u.uid) && styles.checkboxOn]} />
          <Text style={styles.checkLabel}>{u.fullName}</Text>
        </Pressable>
      ))}

      <Pressable style={styles.btn} onPress={() => void onSubmit()} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Crear y asignar</Text>}
      </Pressable>

      <Text style={styles.shareHint}>
        Podrás enviarla por texto o PDF en cuanto se haya creado.
      </Text>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 40 },
  label: { fontWeight: "700", marginTop: 10, marginBottom: 4, color: "#44403C" },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D6D3D1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  area: { minHeight: 80, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 10 },
  half: { flex: 1 },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
  },
  switchLabel: { flex: 1, color: "#44403C", fontWeight: "600" },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#2F6B3A",
  },
  checkboxOn: { backgroundColor: "#2F6B3A" },
  checkLabel: { fontSize: 15, color: "#1C1917" },
  btn: {
    marginTop: 20,
    backgroundColor: "#2F6B3A",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "800" },
  shareHint: { marginTop: 16, fontSize: 13, color: "#57534E", fontWeight: "600" },
  shareRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  shareBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2F6B3A",
    backgroundColor: "#fff",
  },
  shareBtnText: { color: "#2F6B3A", fontWeight: "700" },
  error: { color: "#B91C1C", marginBottom: 8 },
  okBox: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 10,
    padding: 16,
    marginTop: 8,
  },
  okHeading: { fontSize: 18, fontWeight: "800", color: "#166534" },
  okNote: { marginTop: 6, color: "#166534", lineHeight: 20 },
  okTask: { marginTop: 12, fontSize: 16, fontWeight: "700", color: "#1C1917" },
  okMeta: { marginTop: 4, fontSize: 13, color: "#57534E" },
  rosterOk: { fontSize: 12, color: "#166534", fontWeight: "600", marginBottom: 4 },
  rosterNone: { fontSize: 12, color: "#B45309", fontWeight: "600", marginBottom: 4 },
});
