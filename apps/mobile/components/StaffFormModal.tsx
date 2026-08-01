import { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
} from "react-native";
import {
  USER_TYPE_LABELS,
  WEEKDAY_SHORT,
  isValidDni,
  normalizeSchedule,
  scheduleSummary,
  type User,
  type UserRole,
  type UserType,
} from "@grefa/shared";
import {
  DEFAULT_PASSWORD,
  createStaff,
  setStaffPassword,
  timestampToDateInput,
  updateStaff,
  type StaffInput,
} from "../lib/staffAdmin";
import { TimeField } from "./TimeField";

const TYPES: UserType[] = ["TRABAJADOR_GREFA", "VOLUNTARIO", "PERSONAL_PRACTICAS"];

interface StaffFormModalProps {
  visible: boolean;
  /** null = alta nueva */
  person: User | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

export function StaffFormModal({ visible, person, onClose, onSaved }: StaffFormModalProps) {
  const editing = Boolean(person);
  const [fullName, setFullName] = useState("");
  const [dni, setDni] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>("WORKER");
  const [userType, setUserType] = useState<UserType>("TRABAJADOR_GREFA");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [active, setActive] = useState(true);
  const [password, setPassword] = useState(DEFAULT_PASSWORD);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [schedStart, setSchedStart] = useState("");
  const [schedEnd, setSchedEnd] = useState("");
  const [schedFrom, setSchedFrom] = useState("");
  const [schedTo, setSchedTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setError(null);
    setBusy(false);
    if (person) {
      setFullName(person.fullName || "");
      setDni(person.dni || "");
      setEmail(person.email || "");
      setPhone(person.phone || "");
      setRole(person.role || "WORKER");
      setUserType(person.userType || "TRABAJADOR_GREFA");
      setStartDate(timestampToDateInput(person.startDate));
      setEndDate(timestampToDateInput(person.endDate));
      setActive(person.active !== false);
      setPassword("");
      setWeekdays(person.schedule?.weekdays ? [...person.schedule.weekdays] : []);
      setSchedStart(person.schedule?.startTime || "");
      setSchedEnd(person.schedule?.endTime || "");
      setSchedFrom(person.schedule?.fromDate || "");
      setSchedTo(person.schedule?.toDate || "");
      return;
    }
    setFullName("");
    setDni("");
    setEmail("");
    setPhone("");
    setRole("WORKER");
    setUserType("TRABAJADOR_GREFA");
    setStartDate("");
    setEndDate("");
    setActive(true);
    setPassword(DEFAULT_PASSWORD);
    setWeekdays([]);
    setSchedStart("");
    setSchedEnd("");
    setSchedFrom("");
    setSchedTo("");
  }, [visible, person]);

  if (!visible) return null;

  const schedule = normalizeSchedule({
    weekdays,
    startTime: schedStart,
    endTime: schedEnd,
    fromDate: schedFrom,
    toDate: schedTo,
  });
  const isAdminRole = role === "ADMIN";
  const preview = scheduleSummary(schedule);

  function toggleDay(n: number) {
    setWeekdays((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  }

  function validate(): string | null {
    if (!fullName.trim()) return "El nombre es obligatorio.";
    if (!isValidDni(dni)) return "DNI/NIE no válido.";
    if (!email.trim()) return "El email es obligatorio.";
    if (!editing && password.trim().length < 6) {
      return "La contraseña inicial debe tener al menos 6 caracteres.";
    }
    return null;
  }

  function onSubmit() {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    if (!isAdminRole && !schedule) {
      Alert.alert(
        "Sin disponibilidad semanal",
        "No has indicado días. Sin ellos el cuadrante no se rellenará solo para esta persona.",
        [
          { text: "Volver", style: "cancel" },
          { text: "Guardar así", onPress: () => void save() },
        ]
      );
      return;
    }
    void save();
  }

  async function save() {
    setBusy(true);
    setError(null);
    const data: StaffInput = {
      fullName,
      dni,
      email,
      phone,
      role,
      userType,
      startDate,
      endDate,
      schedule: isAdminRole ? null : schedule,
    };
    try {
      if (person) {
        await updateStaff(person.uid, { ...data, active });
        if (password.trim()) await setStaffPassword(person.uid, password);
        onSaved(`Ficha de ${fullName.trim()} actualizada.`);
      } else {
        await createStaff(data, password);
        onSaved(`${fullName.trim()} dado de alta con acceso ${email.trim()}.`);
      }
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo guardar la ficha";
      setError(
        /email-already-in-use/i.test(msg)
          ? "Ese email ya está registrado en otra ficha."
          : msg
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>{editing ? "Editar ficha" : "Nueva ficha de personal"}</Text>

            <Text style={styles.label}>Nombre completo</Text>
            <TextInput style={styles.input} value={fullName} onChangeText={setFullName} />

            <Text style={styles.label}>DNI / NIE</Text>
            <TextInput
              style={styles.input}
              value={dni}
              onChangeText={setDni}
              autoCapitalize="characters"
              placeholder="12345678Z"
            />

            <Text style={styles.label}>Email (acceso a la app)</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!editing}
            />
            {editing ? (
              <Text style={styles.hint}>
                El email de acceso no se cambia desde aquí: hazlo en la web si es necesario.
              </Text>
            ) : null}

            <Text style={styles.label}>Teléfono</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>Tipo de personal</Text>
            <View style={styles.chipRow}>
              {TYPES.map((t) => (
                <Pressable
                  key={t}
                  style={[styles.chip, userType === t && styles.chipOn]}
                  onPress={() => setUserType(t)}
                >
                  <Text style={[styles.chipText, userType === t && styles.chipTextOn]}>
                    {USER_TYPE_LABELS[t]}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Rol</Text>
            <View style={styles.chipRow}>
              <Pressable
                style={[styles.chip, role === "WORKER" && styles.chipOn]}
                onPress={() => setRole("WORKER")}
              >
                <Text style={[styles.chipText, role === "WORKER" && styles.chipTextOn]}>
                  Trabajador
                </Text>
              </Pressable>
              <Pressable
                style={[styles.chip, role === "ADMIN" && styles.chipOn]}
                onPress={() => setRole("ADMIN")}
              >
                <Text style={[styles.chipText, role === "ADMIN" && styles.chipTextOn]}>
                  Administrador
                </Text>
              </Pressable>
            </View>

            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>Alta (AAAA-MM-DD)</Text>
                <TextInput
                  style={styles.input}
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="2026-09-01"
                />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>Baja (AAAA-MM-DD)</Text>
                <TextInput
                  style={styles.input}
                  value={endDate}
                  onChangeText={setEndDate}
                  placeholder="2026-12-31"
                />
              </View>
            </View>

            {isAdminRole ? (
              <Text style={styles.hint}>
                Los administradores no llevan disponibilidad semanal: no aparecen como personal
                del cuadrante.
              </Text>
            ) : (
              <View style={styles.schedBox}>
                <Text style={styles.schedTitle}>Disponibilidad semanal</Text>
                <Text style={styles.label}>Días que viene</Text>
                <View style={styles.chipRow}>
                  {WEEKDAY_SHORT.map((label, i) => {
                    const n = i + 1;
                    const on = weekdays.includes(n);
                    return (
                      <Pressable
                        key={label}
                        style={[styles.dayChip, on && styles.chipOn]}
                        onPress={() => toggleDay(n)}
                      >
                        <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.row}>
                  <View style={styles.half}>
                    <TimeField
                      label="Hora entrada"
                      value={schedStart}
                      onChange={setSchedStart}
                    />
                  </View>
                  <View style={styles.half}>
                    <TimeField
                      label="Hora salida"
                      value={schedEnd}
                      onChange={setSchedEnd}
                      placeholder="14:00"
                    />
                  </View>
                </View>
                <View style={styles.row}>
                  <View style={styles.half}>
                    <Text style={styles.label}>Disponible desde</Text>
                    <TextInput
                      style={styles.input}
                      value={schedFrom}
                      onChangeText={setSchedFrom}
                      placeholder="2026-09-01"
                    />
                  </View>
                  <View style={styles.half}>
                    <Text style={styles.label}>Disponible hasta</Text>
                    <TextInput
                      style={styles.input}
                      value={schedTo}
                      onChangeText={setSchedTo}
                      placeholder="2026-12-31"
                    />
                  </View>
                </View>
                <Text style={[styles.hint, preview ? styles.hintOk : styles.hintWarn]}>
                  {preview
                    ? `Quedará así: ${preview}`
                    : "Sin días marcados el cuadrante quedará libre para rellenar a mano."}
                </Text>
              </View>
            )}

            {editing ? (
              <>
                <Text style={styles.label}>Estado de la ficha</Text>
                <View style={styles.chipRow}>
                  <Pressable
                    style={[styles.chip, active && styles.chipOn]}
                    onPress={() => setActive(true)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextOn]}>Activa</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.chip, !active && styles.chipOff]}
                    onPress={() => setActive(false)}
                  >
                    <Text style={[styles.chipText, !active && styles.chipTextOn]}>Inactiva</Text>
                  </Pressable>
                </View>
              </>
            ) : null}

            <Text style={styles.label}>
              {editing ? "Nueva contraseña (opcional)" : "Contraseña inicial"}
            </Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              placeholder={editing ? "Dejar vacío para no cambiarla" : DEFAULT_PASSWORD}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable style={styles.saveBtn} disabled={busy} onPress={onSubmit}>
              <Text style={styles.saveText}>
                {busy ? "Guardando…" : editing ? "Guardar ficha" : "Dar de alta"}
              </Text>
            </Pressable>
            <Pressable style={styles.cancelBtn} onPress={onClose} disabled={busy}>
              <Text style={styles.cancelText}>Cancelar</Text>
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
    padding: 14,
  },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 16, maxHeight: "92%" },
  title: { fontSize: 17, fontWeight: "800", color: "#1C1917", marginBottom: 4 },
  label: { marginTop: 10, fontWeight: "600", color: "#1C1917", fontSize: 13 },
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
  row: { flexDirection: "row", gap: 10 },
  half: { flex: 1 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D6D3D1",
    backgroundColor: "#fff",
  },
  dayChip: {
    paddingVertical: 8,
    paddingHorizontal: 11,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D6D3D1",
    backgroundColor: "#fff",
  },
  chipOn: { backgroundColor: "#2F6B3A", borderColor: "#2F6B3A" },
  chipOff: { backgroundColor: "#B45309", borderColor: "#B45309" },
  chipText: { fontWeight: "700", color: "#44403C", fontSize: 13 },
  chipTextOn: { color: "#fff" },
  schedBox: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#E7E5E4",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#FAFAF9",
  },
  schedTitle: { fontWeight: "800", color: "#2F6B3A", fontSize: 14 },
  hint: { fontSize: 12, color: "#78716C", marginTop: 8, lineHeight: 17 },
  hintOk: { color: "#166534" },
  hintWarn: { color: "#B45309" },
  error: { color: "#B91C1C", marginTop: 10 },
  saveBtn: {
    marginTop: 16,
    backgroundColor: "#2F6B3A",
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: "center",
  },
  saveText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  cancelBtn: { marginTop: 6, paddingVertical: 11, alignItems: "center" },
  cancelText: { color: "#57534E", fontWeight: "700", fontSize: 14 },
});
