import { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import type { Task } from "@grefa/shared";
import { taskToDateInput, updateTaskFields } from "../lib/taskEdit";

interface TaskEditModalProps {
  task: Task | null;
  onClose: () => void;
  onSaved: (task: Task) => void;
}

export function TaskEditModal({ task, onClose, onSaved }: TaskEditModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [taskDate, setTaskDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [materialShortage, setMaterialShortage] = useState("");
  const [completionNotes, setCompletionNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!task) return;
    setTitle(task.title || "");
    setDescription(task.description || "");
    setTaskDate(taskToDateInput(task));
    setStartTime(task.startTime || "");
    setEndTime(task.endTime || "");
    setMaterialShortage(task.materialShortage || "");
    setCompletionNotes(task.completionNotes || "");
    setError(null);
  }, [task]);

  if (!task) return null;
  const currentTask = task;

  async function onSave() {
    if (!title.trim()) {
      setError("El título es obligatorio.");
      return;
    }
    if (!taskDate.trim()) {
      setError("Indica la fecha (AAAA-MM-DD).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const taskId = currentTask.id;
      await updateTaskFields(taskId, {
        title,
        description,
        taskDate,
        startTime,
        endTime,
        materialShortage,
        completionNotes,
      });
      onSaved({
        ...currentTask,
        id: taskId,
        title: title.trim(),
        description: description.trim(),
        startTime: startTime.trim(),
        endTime: endTime.trim(),
        materialShortage: materialShortage.trim(),
        completionNotes: completionNotes.trim(),
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.heading}>Editar tarea</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Text style={styles.label}>Título</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} />
            <Text style={styles.label}>Descripción</Text>
            <TextInput
              style={[styles.input, styles.area]}
              value={description}
              onChangeText={setDescription}
              multiline
            />
            <Text style={styles.label}>Fecha (AAAA-MM-DD)</Text>
            <TextInput style={styles.input} value={taskDate} onChangeText={setTaskDate} />
            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>Hora inicio</Text>
                <TextInput style={styles.input} value={startTime} onChangeText={setStartTime} />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>Hora fin</Text>
                <TextInput style={styles.input} value={endTime} onChangeText={setEndTime} />
              </View>
            </View>
            <Text style={styles.label}>Compra de materiales / falta de material</Text>
            <TextInput
              style={[styles.input, styles.area]}
              value={materialShortage}
              onChangeText={setMaterialShortage}
              placeholder="Ej. guantes, comida para aves…"
              multiline
            />
            <Text style={styles.label}>Observaciones</Text>
            <TextInput
              style={[styles.input, styles.area]}
              value={completionNotes}
              onChangeText={setCompletionNotes}
              placeholder="Incidencias, estado del recinto, material usado…"
              multiline
            />
            <Text style={styles.hint}>
              Material y observaciones salen en el informe diario de auditoría.
            </Text>
          </ScrollView>
          <View style={styles.actions}>
            <Pressable style={styles.secondary} onPress={onClose} disabled={busy}>
              <Text>Cancelar</Text>
            </Pressable>
            <Pressable style={styles.primary} onPress={() => void onSave()} disabled={busy}>
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryText}>Guardar</Text>
              )}
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
    padding: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 18,
    maxHeight: "90%",
  },
  heading: { fontSize: 18, fontWeight: "800", marginBottom: 12 },
  label: { fontWeight: "700", marginTop: 8, marginBottom: 4, color: "#44403C" },
  input: {
    borderWidth: 1,
    borderColor: "#D6D3D1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  area: { minHeight: 72, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 10 },
  half: { flex: 1 },
  hint: { fontSize: 11, color: "#78716C", marginTop: 8, lineHeight: 16 },
  error: { color: "#B91C1C", marginBottom: 8 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 14 },
  secondary: { paddingVertical: 10, paddingHorizontal: 12 },
  primary: {
    backgroundColor: "#2F6B3A",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minWidth: 100,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "700" },
});
