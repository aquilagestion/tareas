import { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  Modal,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { onAuthStateChanged } from "firebase/auth";
import { router } from "expo-router";
import { getFirebaseAuth, subscribeTasksForUser, getFirebaseApp, subscribeUser } from "@grefa/firebase";
import { TASK_STATUS_LABELS, type Task, type User } from "@grefa/shared";
import { FIREBASE_CONFIG } from "../config/firebase";
import { formatScheduled } from "../utils/taskFormat";
import { reportMaterialShortage } from "../lib/materialReport";
import { completeTaskAsUser } from "../lib/completeTask";
import { ScreenShell } from "../components/ScreenShell";
import { TaskDetailModal } from "../components/TaskDetailModal";
import { CompleteTaskModal } from "../components/CompleteTaskModal";
import { TaskEditModal } from "../components/TaskEditModal";

getFirebaseApp(FIREBASE_CONFIG);

type MaterialModal = { task: Task };

export default function TasksScreen() {
  const [uid, setUid] = useState<string | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [authReady, setAuthReady] = useState(false);
  const [completeModal, setCompleteModal] = useState<{ task: Task; wasAssigned: boolean } | null>(null);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [materialModal, setMaterialModal] = useState<MaterialModal | null>(null);
  const [comment, setComment] = useState("");
  const [materialNote, setMaterialNote] = useState("");
  const [materialOnly, setMaterialOnly] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pendingTasks = useMemo(
    () => tasks.filter((t) => t.status === "PENDING"),
    [tasks]
  );
  const inReviewTasks = useMemo(
    () => tasks.filter((t) => t.status === "IN_REVIEW"),
    [tasks]
  );
  const completedTasks = useMemo(
    () => tasks.filter((t) => t.status === "COMPLETED"),
    [tasks]
  );

  useEffect(() => {
    let unsub = () => {};
    try {
      unsub = onAuthStateChanged(getFirebaseAuth(), (user) => {
        setUid(user?.uid ?? null);
        setAuthReady(true);
        if (!user) router.replace("/login");
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error Firebase al iniciar");
      setAuthReady(true);
    }
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!uid) return;
    const u1 = subscribeUser(uid, setProfile);
    const u2 = subscribeTasksForUser(uid, setTasks, (e) => setError(e.message));
    return () => {
      u1();
      u2();
    };
  }, [uid]);

  async function saveMaterialOnly(task: Task, text: string) {
    if (!uid || !profile) return;
    setBusy(true);
    setError(null);
    try {
      await reportMaterialShortage(task, profile, text.trim());
      setMaterialModal(null);
      setMaterialOnly("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  async function submitComplete() {
    if (!completeModal || !profile) return;
    setBusy(true);
    setError(null);
    try {
      await completeTaskAsUser(
        completeModal.task,
        profile,
        completeModal.wasAssigned,
        comment.trim(),
        materialNote.trim()
      );
      setCompleteModal(null);
      setComment("");
      setMaterialNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar");
    } finally {
      setBusy(false);
    }
  }

  function onCheck(task: Task) {
    if (task.status !== "PENDING") return;
    const wasAssigned = (task.assignedUserIds ?? []).includes(uid!);
    setCompleteModal({ task, wasAssigned });
    setComment("");
    setMaterialNote(task.materialShortage || "");
  }

  function onReportMaterial(task: Task) {
    setMaterialModal({ task });
    setMaterialOnly(task.materialShortage || "");
  }

  function renderTaskCard(item: Task, showActions: boolean) {
    const canComplete = showActions && item.status === "PENDING";
    const canReportMaterial = showActions && item.status === "PENDING";

    return (
      <View style={styles.card}>
        <Pressable onPress={() => setDetailTask(item)} accessibilityRole="button">
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.meta}>{formatScheduled(item)}</Text>
          {item.description ? (
            <Text style={styles.desc} numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}
          {item.materialShortage ? (
            <Text style={styles.materialTag}>Falta material: {item.materialShortage}</Text>
          ) : null}
          {!showActions && (
            <Text style={styles.statusTag}>{TASK_STATUS_LABELS[item.status] ?? item.status}</Text>
          )}
          {!showActions && item.completionNotes ? (
            <Text style={styles.notesPreview}>Observaciones: {item.completionNotes}</Text>
          ) : null}
          <Text style={styles.tapHint}>Pulsa para ver detalle</Text>
        </Pressable>
        {canComplete && (
          <>
            <Pressable style={styles.checkBtn} onPress={() => onCheck(item)} disabled={busy}>
              <Text style={styles.checkText}>Marcar como hecha</Text>
            </Pressable>
            {canReportMaterial && (
              <Pressable
                style={styles.materialBtn}
                onPress={() => onReportMaterial(item)}
                disabled={busy}
              >
                <Text style={styles.materialBtnText}>Reportar falta de material</Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    );
  }

  if (!authReady) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#2F6B3A" />
        {error ? <Text style={[styles.error, { marginTop: 12 }]}>{error}</Text> : null}
      </View>
    );
  }

  if (!uid) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#2F6B3A" />
      </View>
    );
  }

  type Row =
    | { type: "header"; key: string; title: string }
    | { type: "task"; key: string; task: Task; showActions: boolean };

  const listData: Row[] = [
    ...(pendingTasks.length ? [{ type: "header" as const, key: "h-pending", title: "Por hacer" }] : []),
    ...pendingTasks.map((t) => ({ type: "task" as const, key: t.id, task: t, showActions: true })),
    ...(inReviewTasks.length ? [{ type: "header" as const, key: "h-review", title: "Pendientes de chequeo" }] : []),
    ...inReviewTasks.map((t) => ({ type: "task" as const, key: t.id, task: t, showActions: false })),
    ...(completedTasks.length ? [{ type: "header" as const, key: "h-done", title: "Chequeadas" }] : []),
    ...completedTasks.map((t) => ({ type: "task" as const, key: t.id, task: t, showActions: false })),
  ];

  return (
    <ScreenShell>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        style={styles.list}
        data={listData}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No tienes tareas asignadas. Puedes asumir tareas de otras personas desde el menú.
          </Text>
        }
        renderItem={({ item }) =>
          item.type === "header" ? (
            <Text style={styles.sectionHeader}>{item.title}</Text>
          ) : (
            renderTaskCard(item.task, item.showActions)
          )
        }
      />

      <CompleteTaskModal
        task={completeModal?.task ?? null}
        wasAssigned={completeModal?.wasAssigned ?? true}
        comment={comment}
        materialNote={materialNote}
        busy={busy}
        onCommentChange={setComment}
        onMaterialChange={setMaterialNote}
        onCancel={() => setCompleteModal(null)}
        onConfirm={() => void submitComplete()}
      />

      <TaskDetailModal
        task={detailTask}
        uid={uid}
        isAdmin={profile?.role === "ADMIN"}
        onClose={() => setDetailTask(null)}
        onEdit={(t) => setEditTask(t)}
      />

      <TaskEditModal
        task={editTask}
        onClose={() => setEditTask(null)}
        onSaved={(t) => {
          setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, ...t } : x)));
        }}
      />

      <Modal visible={!!materialModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Falta de material</Text>
            <Text style={styles.modalBody}>
              Aviso para el administrador sobre «{materialModal?.task.title}».
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Describe qué falta…"
              value={materialOnly}
              onChangeText={setMaterialOnly}
              multiline
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setMaterialModal(null)} style={styles.secondary}>
                <Text>Cancelar</Text>
              </Pressable>
              <Pressable
                style={styles.checkBtn}
                disabled={busy || materialOnly.trim().length < 3}
                onPress={() =>
                  materialModal && void saveMaterialOnly(materialModal.task, materialOnly.trim())
                }
              >
                <Text style={styles.checkText}>Enviar aviso</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  listContent: { paddingBottom: 24 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "800",
    color: "#2F6B3A",
    marginTop: 8,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
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
  desc: { marginTop: 8, color: "#44403C" },
  materialTag: {
    marginTop: 8,
    fontSize: 12,
    color: "#B45309",
    fontWeight: "700",
    backgroundColor: "#FFFBEB",
    padding: 8,
    borderRadius: 6,
  },
  statusTag: { marginTop: 8, fontSize: 12, color: "#57534E", fontWeight: "600" },
  notesPreview: { marginTop: 6, fontSize: 12, color: "#44403C", fontStyle: "italic" },
  tapHint: { marginTop: 8, fontSize: 11, color: "#2F6B3A", fontWeight: "600" },
  checkBtn: {
    marginTop: 12,
    backgroundColor: "#2F6B3A",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    paddingHorizontal: 14,
  },
  checkText: { color: "#fff", fontWeight: "700" },
  materialBtn: {
    marginTop: 8,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#D97706",
    backgroundColor: "#FFFBEB",
  },
  materialBtnText: { color: "#B45309", fontWeight: "700" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: { backgroundColor: "#fff", borderRadius: 12, padding: 18 },
  modalTitle: { fontSize: 18, fontWeight: "800", marginBottom: 8 },
  modalBody: { color: "#44403C", marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#D6D3D1",
    borderRadius: 8,
    minHeight: 72,
    padding: 10,
    textAlignVertical: "top",
    marginBottom: 4,
  },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 14 },
  secondary: { paddingVertical: 10, paddingHorizontal: 12 },
});
