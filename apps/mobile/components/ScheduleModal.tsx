import { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";
import {
  USER_TYPE_LABELS,
  WEEKDAY_SHORT,
  normalizeSchedule,
  scheduleSummary,
  type User,
} from "@grefa/shared";
import { saveSchedule } from "../lib/userSchedule";
import { TimeField } from "./TimeField";

interface ScheduleModalProps {
  person: User | null;
  onClose: () => void;
  onSaved?: () => void;
}

export function ScheduleModal({ person, onClose, onSaved }: ScheduleModalProps) {
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!person) return;
    const s = person.schedule;
    setWeekdays(s?.weekdays ? [...s.weekdays] : []);
    setStartTime(s?.startTime || "");
    setEndTime(s?.endTime || "");
    setFromDate(s?.fromDate || "");
    setToDate(s?.toDate || "");
    setError(null);
  }, [person]);

  if (!person) return null;
  const target = person;

  function toggleDay(n: number) {
    setWeekdays((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  }

  async function onSave(clear: boolean) {
    setError(null);
    setBusy(true);
    try {
      const next = clear
        ? null
        : normalizeSchedule({ weekdays, startTime, endTime, fromDate, toDate });
      await saveSchedule(target.uid, next);
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el horario");
    } finally {
      setBusy(false);
    }
  }

  const preview = scheduleSummary(
    normalizeSchedule({ weekdays, startTime, endTime, fromDate, toDate })
  );

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Horario de {person.fullName}</Text>
            <Text style={styles.subtitle}>
              {USER_TYPE_LABELS[person.userType] ?? "Personal"}
            </Text>

            <Text style={styles.label}>Días que viene</Text>
            <View style={styles.dayRow}>
              {WEEKDAY_SHORT.map((label, i) => {
                const n = i + 1;
                const on = weekdays.includes(n);
                return (
                  <Pressable
                    key={label}
                    style={[styles.dayChip, on && styles.dayChipOn]}
                    onPress={() => toggleDay(n)}
                  >
                    <Text style={[styles.dayText, on && styles.dayTextOn]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.row}>
              <View style={styles.half}>
                <TimeField label="Hora entrada" value={startTime} onChange={setStartTime} />
              </View>
              <View style={styles.half}>
                <TimeField
                  label="Hora salida"
                  value={endTime}
                  onChange={setEndTime}
                  placeholder="14:00"
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>Desde (AAAA-MM-DD)</Text>
                <TextInput
                  style={styles.input}
                  value={fromDate}
                  onChangeText={setFromDate}
                  placeholder="2026-09-01"
                />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>Hasta (AAAA-MM-DD)</Text>
                <TextInput
                  style={styles.input}
                  value={toDate}
                  onChangeText={setToDate}
                  placeholder="2026-12-31"
                />
              </View>
            </View>

            <Text style={styles.hint}>
              {preview
                ? `Quedará así: ${preview}`
                : "Sin días marcados no hay horario: el cuadrante quedará libre para rellenar a mano."}
            </Text>
            <Text style={styles.hint}>
              El cuadrante marcará solo estos días. Fuera del rango de fechas la persona no
              aparece en el cuadrante de esas semanas.
            </Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={styles.saveBtn}
              disabled={busy}
              onPress={() => void onSave(false)}
            >
              <Text style={styles.saveText}>{busy ? "Guardando…" : "Guardar horario"}</Text>
            </Pressable>
            <Pressable
              style={styles.clearBtn}
              disabled={busy}
              onPress={() => void onSave(true)}
            >
              <Text style={styles.clearText}>Quitar horario fijo</Text>
            </Pressable>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeText}>Cancelar</Text>
            </Pressable>
          </ScrollView>
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
    padding: 16,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    maxHeight: "88%",
  },
  title: { fontSize: 17, fontWeight: "800", color: "#1C1917" },
  subtitle: { fontSize: 13, color: "#78716C", marginBottom: 6 },
  label: { marginTop: 10, fontWeight: "600", color: "#1C1917", fontSize: 13 },
  dayRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  dayChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D6D3D1",
    backgroundColor: "#fff",
  },
  dayChipOn: { backgroundColor: "#2F6B3A", borderColor: "#2F6B3A" },
  dayText: { fontWeight: "700", color: "#44403C", fontSize: 13 },
  dayTextOn: { color: "#fff" },
  row: { flexDirection: "row", gap: 10 },
  half: { flex: 1 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D6D3D1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 15,
    marginTop: 4,
  },
  hint: { fontSize: 12, color: "#78716C", marginTop: 10, lineHeight: 17 },
  error: { color: "#B91C1C", marginTop: 10 },
  saveBtn: {
    marginTop: 14,
    backgroundColor: "#2F6B3A",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  clearBtn: { marginTop: 8, paddingVertical: 10, alignItems: "center" },
  clearText: { color: "#B45309", fontWeight: "700", fontSize: 14 },
  closeBtn: { marginTop: 2, paddingVertical: 10, alignItems: "center" },
  closeText: { color: "#57534E", fontWeight: "700", fontSize: 14 },
});
