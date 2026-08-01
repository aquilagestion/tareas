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
import {
  getFirebaseAuth,
  subscribeActiveUsers,
  subscribeAllTasks,
  subscribeUser,
} from "@grefa/firebase";
import { TASK_STATUS_LABELS, type Task, type User } from "@grefa/shared";
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
import { TaskDetailModal } from "../components/TaskDetailModal";
import { TaskEditModal } from "../components/TaskEditModal";
import { TimeField } from "../components/TimeField";
import { formatScheduled } from "../utils/taskFormat";

export default function AdminTasksScreen() {
  const [uid, setUid] = useState<string | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [detail, setDetail] = useState<Task | null>(null);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [formOpen, setFormOpen] = useState(false);
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
      setUid(user?.uid ?? null);
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

  /** Sin sesión confirmada la consulta de tareas la rechazan las reglas. */
  useEffect(() => {
    if (!uid) return;
    const u = subscribeAllTasks(setTasks, (e) => setError(e.message));
    return () => u();
  }, [uid]);

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

  function resetForm() {
    setTitle("");
    setDescription("");
    setTaskDate(todayDateInput());
    setStartTime("");
    setEndTime("");
    setSelected(new Set());
    setAssignAll(false);
    setRepeatDaily(false);
    setRepeatUntil("");
    setSendNotify(true);
    setError(null);
  }

  /** El alta parte siempre en blanco: la pantalla base es el listado. */
  function openForm() {
    resetForm();
    setFormOpen(true);
  }

  function backToList() {
    setCreated(null);
    setFormOpen(false);
    setError(null);
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

          <Pressable style={styles.btn} onPress={backToList}>
            <Text style={styles.btnText}>Cerrar</Text>
          </Pressable>
        </ScrollView>
      </ScreenShell>
    );
  }

  if (!formOpen) {
    return (
      <ScreenShell>
        <View style={styles.toolbar}>
          <Pressable style={styles.newBtn} onPress={openForm}>
            <Text style={styles.newText}>+ Añadir tarea</Text>
          </Pressable>
          <Text style={styles.count}>
            {tasks.length} {tasks.length === 1 ? "tarea" : "tareas"}
          </Text>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          {tasks.length === 0 ? (
            <Text style={styles.empty}>
              Todavía no hay tareas. Pulsa «Añadir tarea» para crear la primera.
            </Text>
          ) : (
            tasks.map((t) => (
              <Pressable key={t.id} style={styles.taskCard} onPress={() => setDetail(t)}>
                <Text style={styles.taskTitle}>{t.title}</Text>
                <Text style={styles.taskMeta}>{formatScheduled(t)}</Text>
                <Text style={styles.taskStatus}>
                  {TASK_STATUS_LABELS[t.status] ?? t.status}
                </Text>
                <Text style={styles.taskMeta} numberOfLines={2}>
                  Asignada a:{" "}
                  {(t.assignedUsersInfo ?? []).map((a) => a.fullName).join(", ") || "—"}
                </Text>
              </Pressable>
            ))
          )}
        </ScrollView>
        <TaskDetailModal
          task={detail}
          uid={uid}
          isAdmin={profile?.role === "ADMIN"}
          onClose={() => setDetail(null)}
          onEdit={(t) => setEditTask(t)}
        />
        <TaskEditModal
          task={editTask}
          onClose={() => setEditTask(null)}
          onSaved={(t) => {
            if (detail?.id === t.id) setDetail({ ...detail, ...t });
          }}
        />
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

      <Pressable style={styles.cancelBtn} onPress={backToList} disabled={busy}>
        <Text style={styles.cancelText}>Cancelar</Text>
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
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },
  newBtn: {
    backgroundColor: "#2F6B3A",
    borderRadius: 8,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  newText: { color: "#fff", fontWeight: "800" },
  count: { color: "#78716C", fontSize: 13, fontWeight: "600" },
  empty: { color: "#78716C", lineHeight: 20, marginTop: 8 },
  taskCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E7E5E4",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  taskTitle: { fontSize: 15, fontWeight: "700", color: "#1C1917" },
  taskMeta: { marginTop: 3, fontSize: 12, color: "#78716C" },
  taskStatus: { marginTop: 4, fontSize: 12, fontWeight: "700", color: "#2F6B3A" },
  cancelBtn: {
    marginTop: 10,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D6D3D1",
    backgroundColor: "#fff",
  },
  cancelText: { color: "#57534E", fontWeight: "700" },
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
