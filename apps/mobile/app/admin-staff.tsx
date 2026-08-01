import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { onAuthStateChanged } from "firebase/auth";
import { router } from "expo-router";
import {
  getFirebaseApp,
  getFirebaseAuth,
  subscribeAllUsers,
  subscribeUser,
} from "@grefa/firebase";
import {
  USER_TYPE_SHORT,
  scheduleSummary,
  type User,
} from "@grefa/shared";
import { FIREBASE_CONFIG } from "../config/firebase";
import { ScreenShell } from "../components/ScreenShell";
import { StaffFormModal } from "../components/StaffFormModal";
import { sortUsersForAssign } from "../lib/adminTasks";
import { sendStaffPasswordReset, setStaffActive } from "../lib/staffAdmin";

getFirebaseApp(FIREBASE_CONFIG);

export default function AdminStaffScreen() {
  const [profile, setProfile] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [filter, setFilter] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let unsubUser = () => {};
    const unsubAuth = onAuthStateChanged(getFirebaseAuth(), (user) => {
      unsubUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      unsubUser = subscribeUser(user.uid, (p) => {
        setProfile(p);
        setReady(true);
        if (p && p.active && p.role !== "ADMIN") router.replace("/home");
      });
    });
    const u2 = subscribeAllUsers(setUsers, (e) => setError(e.message));
    return () => {
      unsubAuth();
      unsubUser();
      u2();
    };
  }, []);

  const listed = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return sortUsersForAssign(
      users.filter((u) => (showInactive ? u.active === false : u.active !== false))
    ).filter((u) => {
      if (!q) return true;
      return `${u.fullName} ${u.email} ${u.dni}`.toLowerCase().includes(q);
    });
  }, [users, filter, showInactive]);

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(u: User) {
    setEditing(u);
    setFormOpen(true);
  }

  function onToggleActive(u: User) {
    const turningOff = u.active !== false;
    Alert.alert(
      turningOff ? "Desactivar ficha" : "Reactivar ficha",
      turningOff
        ? `${u.fullName} dejará de tener acceso y no aparecerá en el cuadrante ni en las asignaciones. Su historial se conserva.`
        : `${u.fullName} volverá a tener acceso y a aparecer en el cuadrante.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: turningOff ? "Desactivar" : "Reactivar",
          style: turningOff ? "destructive" : "default",
          onPress: () => void toggleActive(u, !turningOff),
        },
      ]
    );
  }

  async function toggleActive(u: User, active: boolean) {
    setError(null);
    setNotice(null);
    try {
      await setStaffActive(u.uid, active);
      setNotice(`Ficha de ${u.fullName} ${active ? "reactivada" : "desactivada"}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cambiar el estado");
    }
  }

  function onSendReset(u: User) {
    Alert.alert(
      "Email de recuperación",
      `Se enviará a ${u.email} un correo para que cambie su contraseña.`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Enviar", onPress: () => void sendReset(u) },
      ]
    );
  }

  async function sendReset(u: User) {
    setError(null);
    setNotice(null);
    try {
      await sendStaffPasswordReset(u.email);
      setNotice(`Email de recuperación enviado a ${u.email}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar el email");
    }
  }

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#2F6B3A" />
      </View>
    );
  }

  return (
    <ScreenShell style={styles.shell}>
      <View style={styles.toolbar}>
        <Pressable style={styles.newBtn} onPress={openNew}>
          <Text style={styles.newText}>+ Nueva ficha</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, !showInactive && styles.tabOn]}
          onPress={() => setShowInactive(false)}
        >
          <Text style={[styles.tabText, !showInactive && styles.tabTextOn]}>Activas</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, showInactive && styles.tabOn]}
          onPress={() => setShowInactive(true)}
        >
          <Text style={[styles.tabText, showInactive && styles.tabTextOn]}>Inactivas</Text>
        </Pressable>
      </View>

      <TextInput
        style={styles.search}
        value={filter}
        onChangeText={setFilter}
        placeholder="Buscar por nombre, email o DNI"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <ScrollView style={styles.list}>
        {listed.length === 0 ? (
          <Text style={styles.empty}>
            {showInactive ? "No hay fichas inactivas." : "No hay personal que coincida."}
          </Text>
        ) : null}
        {listed.map((u) => {
          const sched = scheduleSummary(u.schedule);
          return (
            <View key={u.uid} style={styles.card}>
              <Text style={styles.name}>{u.fullName}</Text>
              <Text style={styles.meta}>
                {u.role === "ADMIN" ? "Administrador" : (USER_TYPE_SHORT[u.userType] ?? "Trabajador")}
                {" · "}
                {u.email}
              </Text>
              {u.dni ? <Text style={styles.meta}>DNI: {u.dni}</Text> : null}
              {u.role === "ADMIN" ? null : (
                <Text style={sched ? styles.sched : styles.schedNone}>
                  {sched || "Sin disponibilidad semanal definida"}
                </Text>
              )}
              <View style={styles.actions}>
                <Pressable style={styles.actionBtn} onPress={() => openEdit(u)}>
                  <Text style={styles.actionText}>Editar</Text>
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={() => onSendReset(u)}>
                  <Text style={styles.actionText}>Recuperar contraseña</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionBtn, styles.actionDanger]}
                  onPress={() => onToggleActive(u)}
                >
                  <Text style={[styles.actionText, styles.actionDangerText]}>
                    {u.active === false ? "Reactivar" : "Desactivar"}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Text style={styles.hint}>
        El alta crea el acceso a la app con el email y la contraseña que indiques. Los días y horas
        de disponibilidad alimentan el cuadrante automáticamente.
      </Text>

      <StaffFormModal
        visible={formOpen}
        person={editing}
        onClose={() => setFormOpen(false)}
        onSaved={(msg) => {
          setNotice(msg);
          setError(null);
        }}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  shell: { paddingHorizontal: 14, paddingTop: 6 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  toolbar: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  newBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#2F6B3A",
  },
  newText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E7E5E4",
    backgroundColor: "#fff",
  },
  tabOn: { borderColor: "#2F6B3A", backgroundColor: "#F0FDF4" },
  tabText: { fontWeight: "700", color: "#57534E", fontSize: 13 },
  tabTextOn: { color: "#2F6B3A" },
  search: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D6D3D1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 15,
  },
  error: { color: "#B91C1C", marginTop: 8 },
  notice: { color: "#166534", marginTop: 8, fontWeight: "600" },
  list: { marginTop: 10 },
  empty: { color: "#78716C", textAlign: "center", marginTop: 20 },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E7E5E4",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  name: { fontWeight: "800", fontSize: 15, color: "#1C1917" },
  meta: { fontSize: 12, color: "#78716C", marginTop: 2 },
  sched: { fontSize: 12, color: "#166534", marginTop: 4, fontWeight: "600" },
  schedNone: { fontSize: 12, color: "#B45309", marginTop: 4, fontWeight: "600" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  actionBtn: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#D6D3D1",
  },
  actionText: { fontWeight: "700", color: "#2F6B3A", fontSize: 12 },
  actionDanger: { borderColor: "#FCA5A5" },
  actionDangerText: { color: "#B91C1C" },
  hint: { fontSize: 11, color: "#78716C", marginTop: 6, lineHeight: 16 },
});
