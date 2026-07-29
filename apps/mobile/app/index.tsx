import { useEffect, useState } from "react";
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
import { doc, updateDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { router } from "expo-router";
import { getFirebaseAuth, getDb, subscribeTasksForUser } from "@grefa/firebase";
import { buildLegalBundle, type Task, type User } from "@grefa/shared";
import { subscribeUser } from "@grefa/firebase";

export default function TasksScreen() {
  const [uid, setUid] = useState<string | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [authReady, setAuthReady] = useState(false);
  const [crossTask, setCrossTask] = useState<Task | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(getFirebaseAuth(), (user) => {
      setUid(user?.uid ?? null);
      setAuthReady(true);
      if (!user) router.replace("/login");
    });
    return unsub;
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

  async function completeTask(task: Task, wasAssigned: boolean, comments: string) {
    if (!uid || !profile) return;
    setBusy(true);
    setError(null);
    try {
      const { concatenatedText, locationDateText } = buildLegalBundle({
        fullName: profile.fullName,
        dni: profile.dni,
        totalAmount: task.totalAmount ?? 0,
      });

      await updateDoc(doc(getDb(), "tasks", task.id), { status: "IN_REVIEW" });

      await addDoc(collection(getDb(), "taskLogs"), {
        taskId: task.id,
        completionDate: serverTimestamp(),
        assignedUsersList: (task.assignedUsersInfo ?? []).map((u) => ({
          uid: u.uid,
          fullName: u.fullName,
          dni: u.dni,
        })),
        completedByUserId: uid,
        completedByName: profile.fullName,
        wasAssignedToHim: wasAssigned,
        comments,
        concatenatedText,
        locationDateText,
        totalAmount: task.totalAmount ?? 0,
      });

      setCrossTask(null);
      setComment("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar");
    } finally {
      setBusy(false);
    }
  }

  function onCheck(task: Task) {
    if (task.status !== "PENDING") return;
    const wasAssigned = (task.assignedUserIds ?? []).includes(uid!);
    if (!wasAssigned) {
      setCrossTask(task);
      return;
    }
    void completeTask(task, true, "");
  }

  if (!authReady || !uid) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#2F6B3A" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.hello}>Hola, {profile?.fullName ?? "…"}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={styles.empty}>No tienes tareas asignadas (o falta config Firebase).</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.meta}>
              {item.status} · {item.totalAmount ?? 0} €
            </Text>
            <Text style={styles.desc}>{item.description}</Text>
            {item.status === "PENDING" && (
              <Pressable style={styles.checkBtn} onPress={() => onCheck(item)} disabled={busy}>
                <Text style={styles.checkText}>Marcar hecha</Text>
              </Pressable>
            )}
          </View>
        )}
      />

      <Modal visible={!!crossTask} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Chequeo cruzado</Text>
            <Text style={styles.modalBody}>
              Esta tarea estaba asignada a{" "}
              {crossTask?.assignedUsersInfo?.map((u) => u.fullName).join(", ") || "otra persona"}.
              ¿Confirmas que la has realizado tú?
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Comentario explicativo (obligatorio)"
              value={comment}
              onChangeText={setComment}
              multiline
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setCrossTask(null)} style={styles.secondary}>
                <Text>Cancelar</Text>
              </Pressable>
              <Pressable
                style={styles.checkBtn}
                disabled={busy || comment.trim().length < 3}
                onPress={() => crossTask && completeTask(crossTask, false, comment.trim())}
              >
                <Text style={styles.checkText}>Confirmar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F1E8", padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  hello: { fontSize: 18, fontWeight: "700", marginBottom: 12, color: "#1C1917" },
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
  checkBtn: {
    marginTop: 12,
    backgroundColor: "#2F6B3A",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    paddingHorizontal: 14,
  },
  checkText: { color: "#fff", fontWeight: "700" },
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
    minHeight: 80,
    padding: 10,
    textAlignVertical: "top",
  },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 14 },
  secondary: { paddingVertical: 10, paddingHorizontal: 12 },
});
