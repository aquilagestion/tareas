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
  Alert,
} from "react-native";
import { onAuthStateChanged } from "firebase/auth";
import { router, useLocalSearchParams } from "expo-router";
import { getFirebaseAuth, getFirebaseApp, subscribeAllTasks, subscribeUser } from "@grefa/firebase";
import type { Task, User } from "@grefa/shared";
import { FIREBASE_CONFIG } from "../config/firebase";
import { ScreenShell } from "../components/ScreenShell";
import { formatScheduled } from "../utils/taskFormat";
import { reportMaterialShortage } from "../lib/materialReport";
import { completeTaskAsUser } from "../lib/completeTask";
import { assumeTask } from "../lib/assumeTask";
import { CompleteTaskModal } from "../components/CompleteTaskModal";

getFirebaseApp(FIREBASE_CONFIG);

export default function OthersTasksScreen() {
  const params = useLocalSearchParams<{ focus?: string }>();
  const [uid, setUid] = useState<string | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [materialModal, setMaterialModal] = useState<Task | null>(null);
  const [materialNote, setMaterialNote] = useState("");
  const [materialBusy, setMaterialBusy] = useState(false);
  const [completeModal, setCompleteModal] = useState<Task | null>(null);
  const [comment, setComment] = useState("");
  const [completeMaterial, setCompleteMaterial] = useState("");
  const [completeBusy, setCompleteBusy] = useState(false);

  const available = useMemo(() => {
    if (!uid) return [];
    return tasks.filter(
      (t) =>
        t.status === "PENDING" &&
        !(t.assignedUserIds ?? []).includes(uid)
    );
  }, [tasks, uid]);

  useEffect(() => {
    const unsub = onAuthStateChanged(getFirebaseAuth(), (user) => {
      setUid(user?.uid ?? null);
      if (!user) router.replace("/login");
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!uid) return;
    const u1 = subscribeUser(uid, setProfile);
    const u2 = subscribeAllTasks(setTasks, (e) => setError(e.message));
    return () => {
      u1();
      u2();
    };
  }, [uid]);

  function tasksHomeRoute() {
    return "/";
  }

  async function onAssume(task: Task) {
    if (!uid || !profile) return;
    if ((task.assignedUserIds ?? []).includes(uid)) {
      router.replace(tasksHomeRoute());
      return;
    }
    Alert.alert(
      "Asumir tarea",
      `¿Te asignas «${task.title}»? Pasará a tu lista de tareas por hacer.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Asumir",
          onPress: async () => {
            setBusy(task.id);
            setError(null);
            try {
              await assumeTask(task, profile);
              router.replace(tasksHomeRoute());
            } catch (e) {
              setError(e instanceof Error ? e.message : "No se pudo asumir");
            } finally {
              setBusy(null);
            }
          },
        },
      ]
    );
  }

  function openComplete(task: Task) {
    setCompleteModal(task);
    setComment("");
    setCompleteMaterial(task.materialShortage || "");
  }

  async function submitComplete() {
    if (!completeModal || !profile) return;
    setCompleteBusy(true);
    setError(null);
    try {
      await completeTaskAsUser(completeModal, profile, false, comment.trim(), completeMaterial.trim());
      setCompleteModal(null);
      setComment("");
      setCompleteMaterial("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar");
    } finally {
      setCompleteBusy(false);
    }
  }

  return (
    <ScreenShell>
      <Text style={styles.intro}>
        Tareas pendientes asignadas a otras personas. Puedes asumirlas o marcarlas como hechas
        (chequeo cruzado) sin asignártelas antes.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={available}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={styles.empty}>No hay tareas de otros disponibles para asumir.</Text>
        }
        renderItem={({ item }) => {
          const names = (item.assignedUsersInfo ?? []).map((u) => u.fullName).join(", ");
          const focused = params.focus === item.id;
          return (
            <View style={[styles.card, focused && styles.cardFocus]}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.meta}>{formatScheduled(item)}</Text>
              {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
              <Text style={styles.meta}>Asignada a: {names || "—"}</Text>
              {item.materialShortage ? (
                <Text style={styles.materialTag}>Falta material: {item.materialShortage}</Text>
              ) : null}
              <Pressable
                style={styles.completeBtn}
                disabled={completeBusy}
                onPress={() => openComplete(item)}
              >
                <Text style={styles.completeBtnText}>Marcar como hecha (chequeo cruzado)</Text>
              </Pressable>
              <Pressable
                style={styles.materialBtn}
                disabled={materialBusy}
                onPress={() => {
                  setMaterialModal(item);
                  setMaterialNote(item.materialShortage || "");
                }}
              >
                <Text style={styles.materialBtnText}>Reportar falta de material</Text>
              </Pressable>
              <Pressable
                style={styles.btn}
                disabled={busy === item.id}
                onPress={() => void onAssume(item)}
              >
                <Text style={styles.btnText}>
                  {busy === item.id ? "Asignando…" : "Asumir tarea"}
                </Text>
              </Pressable>
            </View>
          );
        }}
      />

      <CompleteTaskModal
        task={completeModal}
        wasAssigned={false}
        comment={comment}
        materialNote={completeMaterial}
        busy={completeBusy}
        onCommentChange={setComment}
        onMaterialChange={setCompleteMaterial}
        onCancel={() => setCompleteModal(null)}
        onConfirm={() => void submitComplete()}
      />

      <Modal visible={!!materialModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Falta de material</Text>
            <Text style={styles.modalBody}>Aviso para el administrador sobre «{materialModal?.title}».</Text>
            <TextInput
              style={styles.input}
              placeholder="Describe qué falta…"
              value={materialNote}
              onChangeText={setMaterialNote}
              multiline
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setMaterialModal(null)} style={styles.secondary}>
                <Text>Cancelar</Text>
              </Pressable>
              <Pressable
                style={styles.btn}
                disabled={materialBusy || materialNote.trim().length < 3 || !profile || !materialModal}
                onPress={async () => {
                  if (!profile || !materialModal) return;
                  setMaterialBusy(true);
                  try {
                    await reportMaterialShortage(materialModal, profile, materialNote.trim());
                    setMaterialModal(null);
                    setMaterialNote("");
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "No se pudo enviar");
                  } finally {
                    setMaterialBusy(false);
                  }
                }}
              >
                <Text style={styles.btnText}>Enviar aviso</Text>
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
  intro: { color: "#57534E", marginBottom: 12, lineHeight: 20 },
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
  cardFocus: { borderColor: "#2F6B3A", borderWidth: 2 },
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
  completeBtn: {
    marginTop: 12,
    backgroundColor: "#1D4ED8",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  completeBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  btn: {
    marginTop: 8,
    backgroundColor: "#2F6B3A",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700" },
  materialBtn: {
    marginTop: 8,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
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
  },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 14 },
  secondary: { paddingVertical: 10, paddingHorizontal: 12 },
});
