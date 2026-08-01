import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import { onAuthStateChanged, updatePassword, signOut } from "firebase/auth";
import { doc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { router } from "expo-router";
import { getFirebaseAuth, getDb, subscribeUser, getFirebaseApp } from "@grefa/firebase";
import { isValidDni, scheduleSummary, USER_TYPE_LABELS, type User } from "@grefa/shared";
import { FIREBASE_CONFIG } from "../config/firebase";
import { ScreenShell } from "../components/ScreenShell";

getFirebaseApp(FIREBASE_CONFIG);

function dateToInput(v: unknown): string {
  if (!v) return "";
  const d =
    v instanceof Timestamp
      ? v.toDate()
      : typeof (v as { toDate?: () => Date }).toDate === "function"
        ? (v as { toDate: () => Date }).toDate()
        : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function inputToTimestamp(value: string): Timestamp | null {
  const v = value.trim();
  if (!v) return null;
  const [y, m, d] = v.split("-").map(Number);
  if (!y || !m || !d) return null;
  return Timestamp.fromDate(new Date(y, m - 1, d, 12, 0, 0));
}

export default function ProfileScreen() {
  const [uid, setUid] = useState<string | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [fullName, setFullName] = useState("");
  const [dni, setDni] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(getFirebaseAuth(), (user) => {
      setUid(user?.uid ?? null);
      if (!user) router.replace("/login");
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!uid) return;
    return subscribeUser(uid, (u) => {
      setProfile(u);
      if (u) {
        setFullName(u.fullName ?? "");
        setDni(u.dni ?? "");
        setPhone(u.phone ?? "");
        setEmail(u.email ?? "");
        setStartDate(dateToInput(u.startDate));
        setEndDate(dateToInput(u.endDate));
      }
    });
  }, [uid]);

  async function onSave() {
    if (!uid) return;
    setError(null);
    setOk(null);
    if (!fullName.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    if (!isValidDni(dni)) {
      setError("DNI/NIE no válido");
      return;
    }
    setBusy(true);
    try {
      const patch: Record<string, unknown> = {
        fullName: fullName.trim(),
        dni: dni.trim().toUpperCase(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        updatedAt: serverTimestamp(),
      };
      const sd = inputToTimestamp(startDate);
      const ed = inputToTimestamp(endDate);
      patch.startDate = sd;
      patch.endDate = ed;

      await updateDoc(doc(getDb(), "users", uid), patch);

      if (newPassword.trim()) {
        if (newPassword.trim().length < 6) {
          throw new Error("La contraseña debe tener al menos 6 caracteres");
        }
        const user = getFirebaseAuth().currentUser;
        if (!user) throw new Error("Sesión no válida");
        await updatePassword(user, newPassword.trim());
        setNewPassword("");
      }
      setOk("Ficha actualizada");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo guardar";
      if (/requires-recent-login/i.test(msg)) {
        setError("Para cambiar la contraseña, cierra sesión y vuelve a entrar.");
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  async function onLogout() {
    await signOut(getFirebaseAuth());
    router.replace("/login");
  }

  if (!uid || !profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#2F6B3A" />
      </View>
    );
  }

  return (
    <ScreenShell>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.hint}>
        Edita tu ficha. Tipo, rol y estado los gestiona el administrador en la web.
      </Text>

      <Text style={styles.label}>Nombre completo</Text>
      <TextInput style={styles.input} value={fullName} onChangeText={setFullName} />

      <Text style={styles.label}>DNI / NIE</Text>
      <TextInput style={styles.input} value={dni} onChangeText={setDni} autoCapitalize="characters" />

      <Text style={styles.label}>Teléfono</Text>
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

      <Text style={styles.label}>Email (ficha)</Text>
      <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />

      <Text style={styles.label}>Fecha comienzo (AAAA-MM-DD)</Text>
      <TextInput style={styles.input} value={startDate} onChangeText={setStartDate} placeholder="2026-01-15" />

      <Text style={styles.label}>Fecha fin (AAAA-MM-DD)</Text>
      <TextInput style={styles.input} value={endDate} onChangeText={setEndDate} placeholder="2026-06-30" />

      <Text style={styles.meta}>
        Tipo: {USER_TYPE_LABELS[profile.userType] ?? "Personal"} · Rol: {profile.role}
      </Text>
      {scheduleSummary(profile.schedule) ? (
        <Text style={styles.meta}>Horario previsto: {scheduleSummary(profile.schedule)}</Text>
      ) : null}

      <Text style={styles.label}>Nueva contraseña (opcional)</Text>
      <View style={styles.pwdRow}>
        <TextInput
          style={[styles.input, styles.pwdInput]}
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry={!showPwd}
          placeholder="Tu contraseña personal"
        />
        <Pressable style={styles.pwdToggle} onPress={() => setShowPwd((v) => !v)}>
          <Text style={styles.pwdToggleText}>{showPwd ? "Ocultar" : "Mostrar"}</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {ok ? <Text style={styles.ok}>{ok}</Text> : null}

      <Pressable style={styles.btn} onPress={() => void onSave()} disabled={busy}>
        <Text style={styles.btnText}>{busy ? "Guardando…" : "Guardar ficha"}</Text>
      </Pressable>

      <Pressable
        style={[styles.btn, styles.btnSecondary]}
        onPress={() =>
          Alert.alert("Cerrar sesión", "¿Salir de la app?", [
            { text: "Cancelar", style: "cancel" },
            { text: "Salir", style: "destructive", onPress: () => void onLogout() },
          ])
        }
      >
        <Text style={[styles.btnText, styles.btnTextSecondary]}>Cerrar sesión</Text>
      </Pressable>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { padding: 20, gap: 6, paddingBottom: 40 },
  hint: { color: "#57534e", marginBottom: 12, lineHeight: 20 },
  label: { marginTop: 10, fontWeight: "600", color: "#1c1917" },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d6d3d1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  pwdRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  pwdInput: { flex: 1 },
  pwdToggle: { paddingVertical: 10, paddingHorizontal: 4 },
  pwdToggleText: { color: "#2F6B3A", fontWeight: "700" },
  meta: { marginTop: 8, color: "#78716c", fontSize: 13 },
  error: { color: "#b91c1c", marginTop: 10 },
  ok: { color: "#166534", marginTop: 10 },
  btn: {
    marginTop: 16,
    backgroundColor: "#2F6B3A",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnSecondary: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#d6d3d1" },
  btnText: { color: "#fff", fontWeight: "700" },
  btnTextSecondary: { color: "#1c1917" },
});
