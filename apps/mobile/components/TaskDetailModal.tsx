import { Modal, View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { TASK_STATUS_LABELS, type Task } from "@grefa/shared";
import { formatScheduled } from "../utils/taskFormat";

function formatWhen(ts: unknown): string {
  if (ts && typeof ts === "object" && "toDate" in ts && typeof ts.toDate === "function") {
    return ts.toDate().toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
  }
  return "—";
}

interface TaskDetailModalProps {
  task: Task | null;
  uid?: string | null;
  isAdmin?: boolean;
  assuming?: boolean;
  onClose: () => void;
  onEdit?: (task: Task) => void;
  onAssume?: (task: Task) => void;
}

export function TaskDetailModal({
  task,
  uid,
  isAdmin,
  assuming,
  onClose,
  onEdit,
  onAssume,
}: TaskDetailModalProps) {
  if (!task) return null;

  const names = (task.assignedUsersInfo ?? []).map((u) => u.fullName).join(", ");
  const mine = uid ? (task.assignedUserIds ?? []).includes(uid) : false;
  // El administrador edita cualquier tarea; el asignado, solo las suyas
  // mientras no estén chequeadas.
  const editableByWorker = task.status === "PENDING" || task.status === "IN_REVIEW";
  const canEdit = Boolean(isAdmin) || (mine && editableByWorker);
  const canAssume = Boolean(uid) && !mine && task.status === "PENDING";

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ScrollView>
            <Text style={styles.title}>{task.title}</Text>
            <Text style={styles.meta}>Programada: {formatScheduled(task)}</Text>
            <Text style={styles.meta}>
              Estado: {TASK_STATUS_LABELS[task.status] ?? task.status}
            </Text>
            {task.description ? <Text style={styles.body}>{task.description}</Text> : null}
            <Text style={styles.meta}>Asignados: {names || "—"}</Text>
            {mine ? (
              <Text style={styles.tagMine}>Estás asignado a esta tarea</Text>
            ) : null}
            {task.completedByName ? (
              <Text style={styles.meta}>
                Realizada por: {task.completedByName} · {formatWhen(task.completedAt)}
              </Text>
            ) : null}
            {task.auditedAt ? (
              <Text style={styles.meta}>Chequeada: {formatWhen(task.auditedAt)}</Text>
            ) : null}
            {task.materialShortage ? (
              <View style={styles.warnBox}>
                <Text style={styles.warnLabel}>Falta de material</Text>
                <Text style={styles.warnText}>{task.materialShortage}</Text>
              </View>
            ) : null}
            {task.completionNotes ? (
              <View style={styles.notesBox}>
                <Text style={styles.notesLabel}>Observaciones</Text>
                <Text style={styles.notesText}>{task.completionNotes}</Text>
              </View>
            ) : null}
          </ScrollView>
          <View style={styles.footer}>
            {canAssume && onAssume ? (
              <Pressable
                style={styles.assumeBtn}
                disabled={assuming}
                onPress={() => onAssume(task)}
              >
                <Text style={styles.assumeText}>
                  {assuming ? "Asignando…" : "Asumir esta tarea"}
                </Text>
              </Pressable>
            ) : null}
            {canEdit && onEdit ? (
              <Pressable
                style={styles.editBtn}
                onPress={() => {
                  onEdit(task);
                  onClose();
                }}
              >
                <Text style={styles.editText}>Editar tarea</Text>
              </Pressable>
            ) : (
              <Text style={styles.noEditHint}>
                Esta tarea ya está chequeada: solo el administrador puede modificarla.
              </Text>
            )}
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeText}>Cerrar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 18,
    maxHeight: "85%",
  },
  title: { fontSize: 18, fontWeight: "800", marginBottom: 8 },
  meta: { color: "#78716C", marginTop: 4, fontSize: 13 },
  body: { marginTop: 10, color: "#44403C", lineHeight: 20 },
  tagMine: { marginTop: 8, fontSize: 12, color: "#166534", fontWeight: "600" },
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
  footer: { marginTop: 14, gap: 8 },
  assumeBtn: {
    backgroundColor: "#1D4ED8",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  assumeText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  editBtn: {
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2F6B3A",
  },
  editText: { color: "#2F6B3A", fontWeight: "700", fontSize: 15 },
  noEditHint: { fontSize: 12, color: "#78716C", textAlign: "center", lineHeight: 18 },
  closeBtn: {
    backgroundColor: "#2F6B3A",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  closeText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
