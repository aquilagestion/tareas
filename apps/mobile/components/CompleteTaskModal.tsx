import { Modal, View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import type { Task } from "@grefa/shared";

interface CompleteTaskModalProps {
  task: Task | null;
  wasAssigned: boolean;
  comment: string;
  materialNote: string;
  busy: boolean;
  onCommentChange: (v: string) => void;
  onMaterialChange: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function CompleteTaskModal({
  task,
  wasAssigned,
  comment,
  materialNote,
  busy,
  onCommentChange,
  onMaterialChange,
  onCancel,
  onConfirm,
}: CompleteTaskModalProps) {
  if (!task) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>
            {wasAssigned ? "Marcar como hecha" : "Chequeo cruzado"}
          </Text>
          {wasAssigned ? (
            <Text style={styles.body}>¿Confirmas que has realizado «{task.title}»?</Text>
          ) : (
            <Text style={styles.body}>
              Esta tarea estaba asignada a{" "}
              {task.assignedUsersInfo?.map((u) => u.fullName).join(", ") || "otra persona"}. ¿Confirmas
              que la has realizado tú?
            </Text>
          )}
          <Text style={styles.label}>Falta de material (opcional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej. sin guantes, falta comida para aves…"
            value={materialNote}
            onChangeText={onMaterialChange}
            multiline
          />
          <Text style={styles.label}>Observaciones (opcional, salen en el informe)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej. incidencias, estado del recinto…"
            value={comment}
            onChangeText={onCommentChange}
            multiline
          />
          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={styles.secondary}>
              <Text>Cancelar</Text>
            </Pressable>
            <Pressable
              style={styles.primary}
              disabled={busy || (!wasAssigned && comment.trim().length < 3)}
              onPress={onConfirm}
            >
              <Text style={styles.primaryText}>Confirmar</Text>
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
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 18 },
  title: { fontSize: 18, fontWeight: "800", marginBottom: 8 },
  body: { color: "#44403C", marginBottom: 12 },
  label: { fontWeight: "700", color: "#44403C", marginBottom: 6, marginTop: 4, fontSize: 13 },
  input: {
    borderWidth: 1,
    borderColor: "#D6D3D1",
    borderRadius: 8,
    minHeight: 72,
    padding: 10,
    textAlignVertical: "top",
    marginBottom: 4,
  },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 14 },
  secondary: { paddingVertical: 10, paddingHorizontal: 12 },
  primary: {
    backgroundColor: "#2F6B3A",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  primaryText: { color: "#fff", fontWeight: "700" },
});
