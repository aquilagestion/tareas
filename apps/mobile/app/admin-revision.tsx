import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { onAuthStateChanged } from "firebase/auth";
import { router } from "expo-router";
import {
  getFirebaseAuth,
  subscribeTasksByStatus,
  subscribeTaskLogs,
  subscribeUser,
} from "@grefa/firebase";
import type { Task, TaskLog, User } from "@grefa/shared";
import { ScreenShell } from "../components/ScreenShell";
import { formatScheduled } from "../utils/taskFormat";
import { approveTask, formatTs, logsByTaskId, returnTask } from "../lib/adminReview";

export default function AdminRevisionScreen() {
  const [profile, setProfile] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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
    return () => {
      unsubAuth();
      unsubUser();
    };
  }, []);

  useEffect(() => {
    if (!profile || profile.role !== "ADMIN") return;
    const u1 = subscribeTasksByStatus("IN_REVIEW", setTasks, (e) => setError(e.message));
    const u2 = subscribeTaskLogs(setLogs, (e) => setError(e.message));
    return () => {
      u1();
      u2();
    };
  }, [profile]);

  const logMap = useMemo(() => logsByTaskId(logs), [logs]);
  const materialCount = useMemo(
    () => tasks.filter((t) => (t.materialShortage || logMap[t.id]?.materialShortage || "").trim()).length,
    [tasks, logMap]
  );

  async function onApprove(task: Task) {
    if (!profile) return;
    Alert.alert(
      "Chequear tarea",
      "¿Confirmas que has chequeado esta tarea como correctamente realizada?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Chequear",
          onPress: async () => {
            setBusyId(task.id);
            setError(null);
            try {
              await approveTask(task.id, logMap[task.id]?.id, profile.uid);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Error al chequear");
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );
  }

  async function onReturn(task: Task) {
    Alert.alert(
      "Devolver tarea",
      "La tarea volverá al trabajador para volver a realizar.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Devolver",
          style: "destructive",
          onPress: async () => {
            setBusyId(task.id);
            setError(null);
            try {
              await returnTask(task.id, logMap[task.id]?.id);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Error al devolver");
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#2F6B3A" />
      </View>
    );
  }

  return (
    <ScreenShell>
      <Text style={styles.intro}>
        Tareas marcadas como hechas pendientes de chequeo por el responsable.
      </Text>
      <View style={styles.stats}>
        <Text style={styles.stat}>
          <Text style={styles.statNum}>{tasks.length}</Text> pendientes
        </Text>
        {materialCount > 0 ? (
          <Text style={[styles.stat, styles.statWarn]}>
            <Text style={styles.statNum}>{materialCount}</Text> avisos material
          </Text>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={tasks}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={styles.empty}>No hay tareas pendientes de chequeo.</Text>
        }
        renderItem={({ item }) => {
          const log = logMap[item.id];
          const names = (item.assignedUsersInfo || []).map((a) => a.fullName).join(", ");
          const doneBy = item.completedByName || log?.completedByName || "—";
          const doneAt = formatTs(item.completedAt || log?.completionDate);
          const material = (item.materialShortage || log?.materialShortage || "").trim();
          const notes = (item.completionNotes || log?.comments || "").trim();
          const disabled = busyId === item.id;

          return (
            <View style={styles.card}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.meta}>Programada: {formatScheduled(item)}</Text>
              {item.description ? (
                <Text style={styles.desc} numberOfLines={3}>
                  {item.description}
                </Text>
              ) : null}
              <Text style={styles.meta}>Asignados: {names || "—"}</Text>
              <Text style={styles.done}>
                Realizada: {doneBy} · {doneAt}
              </Text>
              {log?.wasAssignedToHim === false ? (
                <Text style={styles.crossTag}>Chequeo cruzado</Text>
              ) : null}
              {material ? (
                <View style={styles.warnBox}>
                  <Text style={styles.warnLabel}>Falta de material</Text>
                  <Text style={styles.warnText}>{material}</Text>
                </View>
              ) : null}
              {notes ? (
                <View style={styles.notesBox}>
                  <Text style={styles.notesLabel}>Observaciones</Text>
                  <Text style={styles.notesText}>{notes}</Text>
                </View>
              ) : null}
              <View style={styles.actions}>
                <Pressable
                  style={[styles.btnPrimary, disabled && styles.btnDisabled]}
                  disabled={disabled}
                  onPress={() => onApprove(item)}
                >
                  <Text style={styles.btnPrimaryText}>
                    {disabled ? "…" : "Chequear"}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.btnSecondary, disabled && styles.btnDisabled]}
                  disabled={disabled}
                  onPress={() => onReturn(item)}
                >
                  <Text style={styles.btnSecondaryText}>Devolver</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  listContent: { paddingBottom: 24 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  intro: { color: "#57534E", marginBottom: 10, lineHeight: 20 },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 12 },
  stat: { backgroundColor: "#fff", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "#E7E5E4" },
  statWarn: { borderColor: "#FCD34D", backgroundColor: "#FFFBEB" },
  statNum: { fontWeight: "800", color: "#1C1917" },
  empty: { textAlign: "center", color: "#78716C", marginTop: 40 },
  error: { color: "#B91C1C", marginBottom: 8 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E7E5E4",
  },
  title: { fontSize: 16, fontWeight: "700" },
  meta: { color: "#78716C", marginTop: 4, fontSize: 12 },
  desc: { color: "#44403C", marginTop: 6, fontSize: 13, lineHeight: 18 },
  done: { marginTop: 8, fontSize: 12, fontWeight: "700", color: "#166534" },
  crossTag: { marginTop: 6, fontSize: 11, color: "#B45309", fontWeight: "600" },
  warnBox: {
    marginTop: 10,
    backgroundColor: "#FFFBEB",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  warnLabel: { fontSize: 11, fontWeight: "800", color: "#92400E", marginBottom: 4 },
  warnText: { color: "#78350F", lineHeight: 18 },
  notesBox: {
    marginTop: 10,
    backgroundColor: "#F5F5F4",
    borderRadius: 8,
    padding: 10,
  },
  notesLabel: { fontSize: 11, fontWeight: "800", color: "#57534E", marginBottom: 4 },
  notesText: { color: "#44403C", lineHeight: 20 },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  btnPrimary: {
    flex: 1,
    backgroundColor: "#2F6B3A",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  btnPrimaryText: { color: "#fff", fontWeight: "700" },
  btnSecondary: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D6D3D1",
  },
  btnSecondaryText: { color: "#44403C", fontWeight: "700" },
  btnDisabled: { opacity: 0.5 },
});
