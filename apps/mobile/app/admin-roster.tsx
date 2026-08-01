import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import { onAuthStateChanged } from "firebase/auth";
import { router } from "expo-router";
import {
  getFirebaseAuth,
  getFirebaseApp,
  subscribeActiveUsers,
  subscribeAllTasks,
  subscribeUser,
} from "@grefa/firebase";
import {
  USER_TYPE_SHORT,
  WEEKDAY_LONG,
  contradictsSchedule,
  inRosterWeek,
  localDateKey,
  mondayOfWeek,
  nextMark,
  scheduleSummary,
  weekDateKeys,
  type Task,
  type User,
} from "@grefa/shared";
import { FIREBASE_CONFIG } from "../config/firebase";
import { ScreenShell } from "../components/ScreenShell";
import { ScheduleModal } from "../components/ScheduleModal";
import { sortUsersForAssign } from "../lib/adminTasks";
import {
  applyMark,
  copyWeek,
  countAvailable,
  markOf,
  plannedFor,
  subscribeAvailability,
  type AvailabilityMap,
  type AvailabilityState,
} from "../lib/roster";
import { buildRosterRows, dayLabels } from "../lib/rosterData";
import { exportRosterPdf } from "../lib/rosterExport";
import {
  closeRoster,
  formatClosedAt,
  subscribeClosedRosters,
  type RosterSnapshot,
} from "../lib/rosterHistory";
import { sendRosterEmail } from "../lib/rosterEmail";
import { taskDayKey } from "../utils/taskFormat";

getFirebaseApp(FIREBASE_CONFIG);

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function shiftWeek(anchor: Date, weeks: number): Date {
  const d = new Date(anchor);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

export default function AdminRosterScreen() {
  const [profile, setProfile] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [anchor, setAnchor] = useState(() => mondayOfWeek(new Date()));
  const [map, setMap] = useState<AvailabilityMap>({});
  const [prevMap, setPrevMap] = useState<AvailabilityMap>({});
  const [closed, setClosed] = useState<RosterSnapshot[]>([]);
  const [viewing, setViewing] = useState<RosterSnapshot | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const weekKeys = useMemo(() => weekDateKeys(anchor), [anchor]);
  const prevKeys = useMemo(() => weekDateKeys(shiftWeek(anchor, -1)), [anchor]);
  const staff = useMemo(
    () => sortUsersForAssign(users).filter((u) => inRosterWeek(u.schedule, weekKeys)),
    [users, weekKeys]
  );
  const uids = useMemo(() => staff.map((u) => u.uid), [staff]);
  const weekStart = useMemo(() => localDateKey(mondayOfWeek(anchor)), [anchor]);
  const weekLabel = useMemo(
    () => `Semana del ${mondayOfWeek(anchor).toLocaleDateString("es-ES")}`,
    [anchor]
  );
  const closedThisWeek = useMemo(
    () => closed.find((c) => c.weekStart === weekStart) ?? null,
    [closed, weekStart]
  );

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
    const u2 = subscribeActiveUsers(setUsers);
    const u3 = subscribeAllTasks(setTasks, (e) => setError(e.message));
    const u4 = subscribeClosedRosters(setClosed);
    return () => {
      unsubAuth();
      unsubUser();
      u2();
      u3();
      u4();
    };
  }, []);

  useEffect(() => {
    const u = subscribeAvailability(weekKeys, setMap, (e) => setError(e.message));
    return () => u();
  }, [weekKeys]);

  useEffect(() => {
    const u = subscribeAvailability(prevKeys, setPrevMap);
    return () => u();
  }, [prevKeys]);

  const tasksPerDay = useMemo(() => {
    const acc: Record<string, Record<string, number>> = {};
    tasks.forEach((t) => {
      const key = taskDayKey(t);
      if (!key) return;
      (t.assignedUserIds ?? []).forEach((uid) => {
        acc[key] ??= {};
        acc[key][uid] = (acc[key][uid] ?? 0) + 1;
      });
    });
    return acc;
  }, [tasks]);

  async function save(dateKey: string, person: User, target: AvailabilityState) {
    if (!profile) return;
    setError(null);
    try {
      await applyMark(dateKey, person, target, profile.uid);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    }
  }

  function onCellPress(dateKey: string, person: User) {
    const planned = plannedFor(person, dateKey);
    const target = nextMark(markOf(map, dateKey, person).state, planned);
    if (!contradictsSchedule(target, planned)) {
      void save(dateKey, person, target);
      return;
    }
    const dayName = WEEKDAY_LONG[weekKeys.indexOf(dateKey)] ?? "ese día";
    const reason =
      planned === "OUT_OF_RANGE"
        ? `Esa fecha queda fuera de su periodo (${scheduleSummary(person.schedule)}).`
        : `Según su horario no viene los ${dayName} (${scheduleSummary(person.schedule)}).`;
    Alert.alert(
      `${person.fullName} no está disponible ese día`,
      `${reason}\n\n¿Aun así quieres añadirlo al cuadrante?`,
      [
        { text: "No", style: "cancel" },
        { text: "Sí, añadir", onPress: () => void save(dateKey, person, target) },
      ]
    );
  }

  async function onCopyPrevious() {
    if (!profile) return;
    setBusy(true);
    setError(null);
    try {
      const n = await copyWeek(prevKeys, weekKeys, uids, prevMap, profile.uid);
      if (!n) setError("La semana anterior no tiene ninguna marca manual que copiar.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo copiar");
    } finally {
      setBusy(false);
    }
  }

  function onClose() {
    if (!profile) return;
    Alert.alert(
      closedThisWeek ? "Volver a cerrar el cuadrante" : "Cerrar el cuadrante",
      closedThisWeek
        ? `Ya se cerró el ${formatClosedAt(closedThisWeek)}. Se guardará de nuevo con el estado actual.`
        : `Se guardará una copia del cuadrante de la ${weekLabel.toLowerCase()} en el histórico. Podrás seguir editándolo, pero la copia no cambiará.`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Cerrar cuadrante", onPress: () => void doClose() },
      ]
    );
  }

  async function doClose() {
    if (!profile) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await closeRoster({
        weekStart,
        weekLabel,
        days: weekKeys,
        dayLabels: dayLabels(weekKeys),
        rows: buildRosterRows(staff, weekKeys, map),
        closedBy: profile.uid,
        closedByName: profile.fullName,
      });
      setNotice(`Cuadrante de la ${weekLabel.toLowerCase()} guardado en el histórico.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cerrar el cuadrante");
    } finally {
      setBusy(false);
    }
  }

  async function onExport() {
    setError(null);
    setNotice(null);
    try {
      if (viewing) {
        await exportRosterPdf(
          viewing.weekLabel,
          viewing.dayLabels,
          viewing.rows,
          `Cuadrante cerrado el ${formatClosedAt(viewing)} por ${viewing.closedByName}.`
        );
        return;
      }
      await exportRosterPdf(weekLabel, dayLabels(weekKeys), buildRosterRows(staff, weekKeys, map));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo exportar el cuadrante");
    }
  }

  function onSendEmail() {
    if (!profile?.email) {
      setError("Tu ficha no tiene email: no se puede enviar el cuadrante.");
      return;
    }
    Alert.alert(
      "Enviar cuadrante por email",
      `Se enviará el cuadrante de la ${weekLabel.toLowerCase()} a quienes tengan turno, con sus días destacados.`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Enviar", onPress: () => void doSendEmail() },
      ]
    );
  }

  async function doSendEmail() {
    if (!profile) return;
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const res = await sendRosterEmail(weekLabel, weekKeys, staff, map, {
        email: profile.email,
        fullName: profile.fullName,
      });
      setNotice(
        res.errors.length
          ? `Enviados ${res.sent}. Con problemas: ${res.errors.join("; ")}`
          : `Cuadrante enviado a ${res.sent} persona(s).`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar el cuadrante");
    } finally {
      setSending(false);
    }
  }

  function openSaved(snapshot: RosterSnapshot) {
    setViewing(snapshot);
    setHistoryOpen(false);
    setNotice(null);
    setError(null);
  }

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#2F6B3A" />
      </View>
    );
  }

  const today = new Date();
  const todayKey = weekDateKeys(today)[today.getDay() === 0 ? 6 : today.getDay() - 1];

  const historyModal = (
    <Modal
      visible={historyOpen}
      transparent
      animationType="fade"
      onRequestClose={() => setHistoryOpen(false)}
    >
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Cuadrantes guardados</Text>
          <ScrollView style={styles.modalList}>
            {closed.length === 0 ? (
              <Text style={styles.hint}>
                Todavía no has cerrado ningún cuadrante. Usa «Cerrar cuadrante» cuando termines una
                semana y quedará aquí guardado.
              </Text>
            ) : null}
            {closed.map((c) => (
              <Pressable key={c.weekStart} style={styles.savedItem} onPress={() => openSaved(c)}>
                <Text style={styles.savedWeek}>{c.weekLabel}</Text>
                <Text style={styles.savedMeta}>
                  Cerrado el {formatClosedAt(c)} por {c.closedByName}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable style={styles.modalClose} onPress={() => setHistoryOpen(false)}>
            <Text style={styles.modalCloseText}>Cerrar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );

  if (viewing) {
    return (
      <ScreenShell style={styles.shell}>
        <View style={styles.toolbar}>
          <Pressable style={styles.navBtn} onPress={() => setViewing(null)}>
            <Text style={styles.navBtnText}>← Cuadrante actual</Text>
          </Pressable>
          <Pressable style={styles.navBtn} onPress={() => setHistoryOpen(true)}>
            <Text style={styles.navBtnText}>Guardados</Text>
          </Pressable>
          <Pressable style={styles.copyBtn} onPress={() => void onExport()}>
            <Text style={styles.copyBtnText}>Exportar PDF</Text>
          </Pressable>
        </View>

        <Text style={styles.weekLabel}>{viewing.weekLabel}</Text>
        <Text style={styles.frozenBanner}>
          Copia guardada el {formatClosedAt(viewing)} por {viewing.closedByName}. No se puede
          editar.
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View>
            <View style={styles.row}>
              <View style={[styles.nameCell, styles.headCell]}>
                <Text style={styles.headText}>Personal</Text>
              </View>
              {viewing.dayLabels.map((label) => (
                <View key={label} style={[styles.cell, styles.headCell]}>
                  <Text style={styles.headText}>{label}</Text>
                </View>
              ))}
            </View>
            <ScrollView style={styles.body}>
              {viewing.rows.map((r) => (
                <View key={r.uid} style={styles.row}>
                  <View style={styles.nameCell}>
                    <Text style={styles.nameText} numberOfLines={2}>
                      {r.name}
                    </Text>
                    <Text style={styles.roleText}>
                      {[r.role, r.hours].filter(Boolean).join(" · ")}
                    </Text>
                  </View>
                  {r.marks.map((m, i) => (
                    <View
                      key={`${r.uid}-${i}`}
                      style={[
                        styles.cell,
                        m === "SI" && styles.cellOk,
                        m === "NO" && styles.cellOff,
                      ]}
                    >
                      <Text style={styles.cellMark}>
                        {m === "SI" ? "Sí" : m === "NO" ? "No" : "·"}
                      </Text>
                    </View>
                  ))}
                </View>
              ))}
              <View style={styles.row}>
                <View style={[styles.nameCell, styles.totalCell]}>
                  <Text style={styles.totalLabel}>Disponibles</Text>
                </View>
                {viewing.dayLabels.map((label, i) => (
                  <View key={label} style={[styles.cell, styles.totalCell]}>
                    <Text style={styles.totalText}>
                      {viewing.rows.filter((r) => r.marks[i] === "SI").length} de{" "}
                      {viewing.rows.length}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </ScrollView>

        {historyModal}
      </ScreenShell>
    );
  }

  return (
    <ScreenShell style={styles.shell}>
      <View style={styles.toolbar}>
        <Pressable style={styles.navBtn} onPress={() => setAnchor((a) => shiftWeek(a, -1))}>
          <Text style={styles.navBtnText}>←</Text>
        </Pressable>
        <Pressable style={styles.navBtn} onPress={() => setAnchor(mondayOfWeek(new Date()))}>
          <Text style={styles.navBtnText}>Esta semana</Text>
        </Pressable>
        <Pressable style={styles.navBtn} onPress={() => setAnchor((a) => shiftWeek(a, 1))}>
          <Text style={styles.navBtnText}>→</Text>
        </Pressable>
        <Pressable style={styles.navBtn} onPress={() => setHistoryOpen(true)}>
          <Text style={styles.navBtnText}>Guardados</Text>
        </Pressable>
      </View>
      <View style={styles.toolbar}>
        <Pressable style={styles.copyBtn} onPress={() => void onCopyPrevious()} disabled={busy}>
          <Text style={styles.copyBtnText}>{busy ? "Trabajando…" : "Copiar anterior"}</Text>
        </Pressable>
        <Pressable style={styles.closeBtn} onPress={onClose} disabled={busy}>
          <Text style={styles.copyBtnText}>Cerrar cuadrante</Text>
        </Pressable>
        <Pressable style={styles.copyBtn} onPress={() => void onExport()}>
          <Text style={styles.copyBtnText}>Exportar PDF</Text>
        </Pressable>
        <Pressable style={styles.mailBtn} onPress={onSendEmail} disabled={sending}>
          <Text style={styles.copyBtnText}>{sending ? "Enviando…" : "Enviar por email"}</Text>
        </Pressable>
      </View>

      <Text style={styles.weekLabel}>{weekLabel}</Text>
      {closedThisWeek ? (
        <Text style={styles.closedNote}>
          Cerrado el {formatClosedAt(closedThisWeek)}. Los cambios que hagas ahora no afectan a la
          copia guardada.
        </Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          <View style={styles.row}>
            <View style={[styles.nameCell, styles.headCell]}>
              <Text style={styles.headText}>Personal</Text>
            </View>
            {weekKeys.map((key, i) => (
              <View
                key={key}
                style={[styles.cell, styles.headCell, key === todayKey && styles.todayCell]}
              >
                <Text style={styles.headText}>{DAYS[i]}</Text>
                <Text style={styles.headSub}>{key.slice(8)}</Text>
              </View>
            ))}
          </View>

          <ScrollView style={styles.body}>
            {staff.map((u) => {
              const summary = scheduleSummary(u.schedule);
              return (
                <View key={u.uid} style={styles.row}>
                  <Pressable style={styles.nameCell} onPress={() => setEditing(u)}>
                    <Text style={styles.nameText} numberOfLines={2}>
                      {u.fullName}
                    </Text>
                    <Text style={styles.roleText}>
                      {u.role === "ADMIN"
                        ? "Responsable"
                        : (USER_TYPE_SHORT[u.userType] ?? "Trabajador")}
                    </Text>
                    <Text style={styles.schedText} numberOfLines={2}>
                      {summary || "Sin horario · toca para definirlo"}
                    </Text>
                  </Pressable>
                  {weekKeys.map((key) => {
                    const mark = markOf(map, key, u);
                    const auto = mark.source === "SCHEDULE";
                    const nTasks = tasksPerDay[key]?.[u.uid] ?? 0;
                    return (
                      <Pressable
                        key={key}
                        style={[
                          styles.cell,
                          mark.state === "AVAILABLE" && (auto ? styles.cellOkAuto : styles.cellOk),
                          mark.state === "OFF" && (auto ? styles.cellOffAuto : styles.cellOff),
                        ]}
                        onPress={() => onCellPress(key, u)}
                      >
                        <Text style={[styles.cellMark, auto && styles.cellMarkAuto]}>
                          {mark.state === "AVAILABLE" ? "Sí" : mark.state === "OFF" ? "No" : "·"}
                        </Text>
                        {nTasks ? <Text style={styles.cellTasks}>{nTasks} tarea(s)</Text> : null}
                      </Pressable>
                    );
                  })}
                </View>
              );
            })}

            <View style={styles.row}>
              <View style={[styles.nameCell, styles.totalCell]}>
                <Text style={styles.totalLabel}>Disponibles</Text>
              </View>
              {weekKeys.map((key) => (
                <View key={key} style={[styles.cell, styles.totalCell]}>
                  <Text style={styles.totalText}>
                    {countAvailable(map, key, staff)} de {staff.length}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </ScrollView>

      <Text style={styles.hint}>
        Las marcas en gris claro las pone el horario de cada persona; las de color las has puesto
        tú y mandan sobre el horario. Toca el nombre para cambiar su horario.
      </Text>

      <ScheduleModal person={editing} onClose={() => setEditing(null)} />
      {historyModal}
    </ScreenShell>
  );
}

const CELL_W = 76;

const styles = StyleSheet.create({
  shell: { paddingHorizontal: 12, paddingTop: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  toolbar: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 },
  navBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E7E5E4",
  },
  navBtnText: { fontWeight: "700", color: "#2F6B3A", fontSize: 13 },
  copyBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: "#2F6B3A",
  },
  closeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: "#B45309",
  },
  mailBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: "#1D4ED8",
  },
  copyBtnText: { fontWeight: "700", color: "#fff", fontSize: 13 },
  weekLabel: { fontWeight: "700", marginBottom: 6, color: "#1C1917" },
  closedNote: { fontSize: 12, color: "#B45309", marginBottom: 6 },
  frozenBanner: {
    fontSize: 12,
    color: "#1D4ED8",
    marginBottom: 8,
    fontWeight: "600",
    lineHeight: 17,
  },
  error: { color: "#B91C1C", marginBottom: 8 },
  notice: { color: "#166534", marginBottom: 8, fontWeight: "600" },
  body: { maxHeight: 420 },
  row: { flexDirection: "row" },
  nameCell: {
    width: 140,
    padding: 6,
    borderWidth: 1,
    borderColor: "#E7E5E4",
    backgroundColor: "#fff",
    justifyContent: "center",
  },
  nameText: { fontSize: 12, fontWeight: "700", color: "#1C1917" },
  roleText: { fontSize: 10, color: "#78716C", marginTop: 2 },
  schedText: { fontSize: 9, color: "#A8A29E", marginTop: 2 },
  cell: {
    width: CELL_W,
    minHeight: 52,
    padding: 4,
    borderWidth: 1,
    borderColor: "#E7E5E4",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  cellOk: { backgroundColor: "#D1FAE5", borderColor: "#34D399" },
  cellOkAuto: { backgroundColor: "#F0FDF4", borderColor: "#D1FAE5" },
  cellOff: { backgroundColor: "#FEE2E2", borderColor: "#F87171" },
  cellOffAuto: { backgroundColor: "#FEF9F9", borderColor: "#FCE7E7" },
  cellMark: { fontSize: 14, fontWeight: "800", color: "#44403C" },
  cellMarkAuto: { color: "#A8A29E", fontWeight: "600" },
  cellTasks: { fontSize: 9, color: "#78716C", marginTop: 2 },
  headCell: { backgroundColor: "#F5F1E8", minHeight: 40 },
  todayCell: { borderColor: "#2F6B3A", borderWidth: 2 },
  headText: { fontSize: 12, fontWeight: "800", color: "#2F6B3A" },
  headSub: { fontSize: 10, color: "#78716C" },
  totalCell: { backgroundColor: "#F5F1E8", minHeight: 38 },
  totalLabel: { fontSize: 12, fontWeight: "800", color: "#2F6B3A" },
  totalText: { fontSize: 12, fontWeight: "800", color: "#1C1917" },
  hint: { fontSize: 11, color: "#78716C", marginTop: 8, lineHeight: 16 },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: { backgroundColor: "#fff", borderRadius: 14, padding: 16, maxHeight: "80%" },
  modalTitle: { fontSize: 16, fontWeight: "800", color: "#1C1917", marginBottom: 8 },
  modalList: { maxHeight: 380 },
  savedItem: {
    borderWidth: 1,
    borderColor: "#E7E5E4",
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  savedWeek: { fontWeight: "700", color: "#1C1917", fontSize: 14 },
  savedMeta: { fontSize: 11, color: "#78716C", marginTop: 2 },
  modalClose: { marginTop: 8, paddingVertical: 11, alignItems: "center" },
  modalCloseText: { color: "#57534E", fontWeight: "700", fontSize: 14 },
});
