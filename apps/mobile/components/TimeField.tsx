import { useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

function splitTime(value: string): { h: string; m: string } {
  const match = /^(\d{1,2}):(\d{1,2})$/.exec(value.trim());
  if (!match) return { h: "09", m: "00" };
  return {
    h: String(Math.min(23, Number(match[1]))).padStart(2, "0"),
    m: String(Math.min(59, Number(match[2]))).padStart(2, "0"),
  };
}

interface TimeFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/**
 * Hora escrita a mano o elegida en un reloj emergente de horas y minutos.
 * Sin dependencias nativas, para no romper la compilación en Android antiguos.
 */
export function TimeField({ label, value, onChange, placeholder = "09:00" }: TimeFieldProps) {
  const [open, setOpen] = useState(false);
  const initial = useMemo(() => splitTime(value), [value]);
  const [hour, setHour] = useState(initial.h);
  const [minute, setMinute] = useState(initial.m);

  function openPicker() {
    const { h, m } = splitTime(value);
    setHour(h);
    setMinute(m);
    setOpen(true);
  }

  function accept() {
    onChange(`${hour}:${minute}`);
    setOpen(false);
  }

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          keyboardType="numbers-and-punctuation"
        />
        <Pressable style={styles.clockBtn} onPress={openPicker}>
          <Text style={styles.clockText}>Reloj</Text>
        </Pressable>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.title}>{label}</Text>
            <Text style={styles.preview}>
              {hour}:{minute}
            </Text>
            <View style={styles.columns}>
              <View style={styles.column}>
                <Text style={styles.colLabel}>Hora</Text>
                <ScrollView style={styles.colScroll}>
                  {HOURS.map((h) => (
                    <Pressable
                      key={h}
                      style={[styles.option, h === hour && styles.optionOn]}
                      onPress={() => setHour(h)}
                    >
                      <Text style={[styles.optionText, h === hour && styles.optionTextOn]}>
                        {h}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.column}>
                <Text style={styles.colLabel}>Minutos</Text>
                <ScrollView style={styles.colScroll}>
                  {MINUTES.map((m) => (
                    <Pressable
                      key={m}
                      style={[styles.option, m === minute && styles.optionOn]}
                      onPress={() => setMinute(m)}
                    >
                      <Text style={[styles.optionText, m === minute && styles.optionTextOn]}>
                        {m}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>
            <Pressable style={styles.okBtn} onPress={accept}>
              <Text style={styles.okText}>Usar esta hora</Text>
            </Pressable>
            <Pressable
              style={styles.clearBtn}
              onPress={() => {
                onChange("");
                setOpen(false);
              }}
            >
              <Text style={styles.clearText}>Dejar en blanco</Text>
            </Pressable>
            <Pressable style={styles.cancelBtn} onPress={() => setOpen(false)}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: 10, fontWeight: "600", color: "#1C1917", fontSize: 13 },
  row: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  input: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D6D3D1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 15,
  },
  clockBtn: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2F6B3A",
  },
  clockText: { color: "#2F6B3A", fontWeight: "700", fontSize: 13 },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 24,
  },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 16 },
  title: { fontSize: 16, fontWeight: "800", color: "#1C1917" },
  preview: {
    fontSize: 30,
    fontWeight: "800",
    color: "#2F6B3A",
    textAlign: "center",
    marginVertical: 8,
  },
  columns: { flexDirection: "row", gap: 12 },
  column: { flex: 1 },
  colLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#78716C",
    textAlign: "center",
    marginBottom: 4,
  },
  colScroll: {
    height: 180,
    borderWidth: 1,
    borderColor: "#E7E5E4",
    borderRadius: 8,
  },
  option: { paddingVertical: 10, alignItems: "center" },
  optionOn: { backgroundColor: "#2F6B3A" },
  optionText: { fontSize: 16, fontWeight: "700", color: "#44403C" },
  optionTextOn: { color: "#fff" },
  okBtn: {
    marginTop: 14,
    backgroundColor: "#2F6B3A",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  okText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  clearBtn: { marginTop: 6, paddingVertical: 9, alignItems: "center" },
  clearText: { color: "#B45309", fontWeight: "700", fontSize: 13 },
  cancelBtn: { paddingVertical: 9, alignItems: "center" },
  cancelText: { color: "#57534E", fontWeight: "700", fontSize: 13 },
});
