import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Modal,
  ScrollView,
} from "react-native";
import { onAuthStateChanged } from "firebase/auth";
import { router } from "expo-router";
import { Timestamp } from "firebase/firestore";
import {
  getFirebaseAuth,
  getFirebaseApp,
  subscribeTaskLogsForUser,
} from "@grefa/firebase";
import type { TaskLog } from "@grefa/shared";
import { FIREBASE_CONFIG } from "../config/firebase";
import { ScreenShell } from "../components/ScreenShell";

getFirebaseApp(FIREBASE_CONFIG);

function formatWhen(ts: unknown): string {
  if (ts instanceof Timestamp) {
    return ts.toDate().toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
  }
  if (ts && typeof ts === "object" && "toDate" in ts && typeof ts.toDate === "function") {
    return ts.toDate().toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
  }
  return "—";
}

function formatScheduled(log: TaskLog): string {
  const ts = log.taskScheduledDate;
  let dateStr = "—";
  if (ts instanceof Timestamp) {
    dateStr = ts.toDate().toLocaleDateString("es-ES");
  } else if (ts && typeof ts === "object" && "toDate" in ts && typeof ts.toDate === "function") {
    dateStr = ts.toDate().toLocaleDateString("es-ES");
  }
  const start = log.taskStartTime?.trim();
  const end = log.taskEndTime?.trim();
  if (start && end) return `${dateStr} · ${start}–${end}`;
  if (start) return `${dateStr} · ${start}`;
  return dateStr;
}

export default function CompletedTasksScreen() {
  const [uid, setUid] = useState<string | null>(null);
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<TaskLog | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(getFirebaseAuth(), (user) => {
      setUid(user?.uid ?? null);
      if (!user) router.replace("/login");
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!uid) return;
    return subscribeTaskLogsForUser(uid, setLogs, (e) => setError(e.message));
  }, [uid]);

  if (!uid) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#2F6B3A" />
      </View>
    );
  }

  return (
    <ScreenShell>
      <Text style={styles.intro}>
        Historial de tareas que has marcado como hechas. Pulsa una para ver el detalle completo.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={logs}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={styles.empty}>Aún no has marcado ninguna tarea como hecha.</Text>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => setSelected(item)}>
            <Text style={styles.title}>{item.taskTitle}</Text>
            <Text style={styles.meta}>Programada: {formatScheduled(item)}</Text>
            <Text style={styles.meta}>Realizada: {formatWhen(item.completionDate)}</Text>
            <Text style={[styles.status, item.audited ? styles.statusOk : styles.statusPending]}>
              {item.audited ? "Chequeada por responsable" : "Pendiente de chequeo"}
            </Text>
            {item.materialShortage ? (
              <Text style={styles.materialTag}>Falta material: {item.materialShortage}</Text>
            ) : null}
            {item.comments ? (
              <Text style={styles.notesPreview} numberOfLines={2}>
                Observaciones: {item.comments}
              </Text>
            ) : null}
            {item.wasAssignedToHim === false ? (
              <Text style={styles.crossTag}>Chequeo cruzado</Text>
            ) : null}
          </Pressable>
        )}
      />

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {selected ? (
              <ScrollView>
                <Text style={styles.modalTitle}>{selected.taskTitle}</Text>
                <Text style={styles.meta}>Programada: {formatScheduled(selected)}</Text>
                <Text style={styles.meta}>Realizada: {formatWhen(selected.completionDate)}</Text>
                <Text style={[styles.status, selected.audited ? styles.statusOk : styles.statusPending]}>
                  {selected.audited ? "Chequeada por responsable" : "Pendiente de chequeo"}
                </Text>
                {selected.taskDescription ? (
                  <Text style={styles.body}>{selected.taskDescription}</Text>
                ) : null}
                {selected.materialShortage ? (
                  <View style={styles.warnBox}>
                    <Text style={styles.warnLabel}>Falta de material</Text>
                    <Text style={styles.warnText}>{selected.materialShortage}</Text>
                  </View>
                ) : null}
                {selected.comments ? (
                  <View style={styles.notesBox}>
                    <Text style={styles.notesLabel}>Observaciones</Text>
                    <Text style={styles.notesText}>{selected.comments}</Text>
                  </View>
                ) : null}
                {selected.wasAssignedToHim === false ? (
                  <Text style={styles.crossTag}>Chequeo cruzado</Text>
                ) : null}
              </ScrollView>
            ) : null}
            <Pressable style={styles.closeBtn} onPress={() => setSelected(null)}>
              <Text style={styles.closeText}>Cerrar</Text>
            </Pressable>
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
  title: { fontSize: 16, fontWeight: "700" },
  meta: { color: "#78716C", marginTop: 4, fontSize: 12 },
  status: { marginTop: 8, fontSize: 12, fontWeight: "700" },
  statusOk: { color: "#166534" },
  statusPending: { color: "#B45309" },
  materialTag: {
    marginTop: 8,
    fontSize: 12,
    color: "#B45309",
    fontWeight: "700",
    backgroundColor: "#FFFBEB",
    padding: 8,
    borderRadius: 6,
  },
  notesPreview: { marginTop: 6, fontSize: 12, color: "#44403C", fontStyle: "italic" },
  crossTag: { marginTop: 8, fontSize: 11, color: "#B45309", fontWeight: "600" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: { backgroundColor: "#fff", borderRadius: 12, padding: 18, maxHeight: "85%" },
  modalTitle: { fontSize: 18, fontWeight: "800", marginBottom: 8 },
  body: { marginTop: 10, color: "#44403C", lineHeight: 20 },
  warnBox: {
    marginTop: 12,
    backgroundColor: "#FFFBEB",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  warnLabel: { fontSize: 11, fontWeight: "800", color: "#92400E", marginBottom: 4 },
  warnText: { color: "#78350F", lineHeight: 18 },
  notesBox: {
    marginTop: 12,
    backgroundColor: "#F5F5F4",
    borderRadius: 8,
    padding: 10,
  },
  notesLabel: { fontSize: 11, fontWeight: "800", color: "#57534E", marginBottom: 4 },
  notesText: { color: "#44403C", lineHeight: 20 },
  closeBtn: {
    marginTop: 14,
    backgroundColor: "#2F6B3A",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  closeText: { color: "#fff", fontWeight: "700" },
});
