import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { onAuthStateChanged } from "firebase/auth";
import { router } from "expo-router";
import { getFirebaseAuth, getFirebaseApp, subscribeAllTasks, subscribeUser } from "@grefa/firebase";
import { TASK_STATUS_LABELS, type Task, type User } from "@grefa/shared";
import { FIREBASE_CONFIG } from "../config/firebase";
import { ScreenShell } from "../components/ScreenShell";
import { TaskDetailModal } from "../components/TaskDetailModal";
import { TaskEditModal } from "../components/TaskEditModal";
import { assumeTask } from "../lib/assumeTask";
import { formatScheduled, mondayOf, startOfDay, taskDayKey } from "../utils/taskFormat";

getFirebaseApp(FIREBASE_CONFIG);

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function taskStyle(t: Task, uid: string) {
  const mine = (t.assignedUserIds ?? []).includes(uid);
  if (t.status === "COMPLETED") return { box: styles.calTaskDone, label: mine ? " · Hecha" : " · Hecha" };
  if (t.status === "IN_REVIEW") return { box: mine ? styles.calTaskReview : styles.calTaskReviewOther, label: mine ? " · En revisión" : " · Revisión" };
  if (mine) return { box: styles.calTaskMine, label: "" };
  return { box: styles.calTaskOther, label: " · Asumir" };
}

export default function CalendarScreen() {
  const { width } = useWindowDimensions();
  /** Los siete días entran siempre en pantalla, así que en poco ancho se aprieta la letra. */
  const narrow = (width - 24) / 7 < 74;
  const [uid, setUid] = useState<string | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [mode, setMode] = useState<"week" | "day">("week");
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [assuming, setAssuming] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(getFirebaseAuth(), (user) => {
      setUid(user?.uid ?? null);
      if (!user) router.replace("/login");
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!uid) return;
    const u = subscribeUser(uid, setProfile);
    const unsub = subscribeAllTasks(
      (list) => {
        setTasks(list);
        setLoading(false);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      }
    );
    return () => {
      u();
      unsub();
    };
  }, [uid]);

  function shift(days: number) {
    setAnchor((prev) => {
      const n = new Date(prev);
      n.setDate(n.getDate() + days);
      return n;
    });
  }

  function onTaskPress(t: Task) {
    if (!uid) return;
    setDetailTask(t);
  }

  async function onAssume(t: Task) {
    if (!profile) return;
    setAssuming(true);
    setError(null);
    try {
      await assumeTask(t, profile);
      setDetailTask(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo asumir la tarea");
    } finally {
      setAssuming(false);
    }
  }

  function renderWeek() {
    const mon = mondayOf(anchor);
    const todayKey = new Date().toISOString().slice(0, 10);
    const rows = [];
    for (let i = 0; i < 7; i++) {
      const cell = new Date(mon);
      cell.setDate(mon.getDate() + i);
      const key = cell.toISOString().slice(0, 10);
      const dayTasks = tasks.filter((t) => taskDayKey(t) === key);
      rows.push(
        <View
          key={key}
          style={[
            styles.dayCol,
            narrow && styles.dayColNarrow,
            key === todayKey && styles.todayCol,
          ]}
        >
          <Text style={[styles.dayLabel, narrow && styles.dayLabelNarrow]} numberOfLines={1}>
            {DAYS[i]} {cell.getDate()}
          </Text>
          {dayTasks.length === 0 ? (
            <Text style={styles.emptyDay}>—</Text>
          ) : (
            dayTasks.map((t) => {
              const { box, label } = taskStyle(t, uid!);
              return (
                <Pressable
                  key={t.id}
                  style={[styles.calTask, narrow && styles.calTaskNarrow, box]}
                  onPress={() => onTaskPress(t)}
                >
                  <Text
                    style={[styles.calTaskTitle, narrow && styles.calTaskTitleNarrow]}
                    numberOfLines={narrow ? 3 : 2}
                  >
                    {t.title}
                  </Text>
                  <Text style={styles.calTaskMeta} numberOfLines={narrow ? 2 : 1}>
                    {t.startTime || ""}
                    {label}
                  </Text>
                </Pressable>
              );
            })
          )}
        </View>
      );
    }
    return <View style={[styles.weekRow, narrow && styles.weekRowNarrow]}>{rows}</View>;
  }

  function renderDay() {
    const key = anchor.toISOString().slice(0, 10);
    const dayTasks = tasks.filter((t) => taskDayKey(t) === key);
    if (!dayTasks.length) {
      return <Text style={styles.empty}>Sin tareas este día.</Text>;
    }
    return dayTasks.map((t) => {
      const mine = (t.assignedUserIds ?? []).includes(uid!);
      const names = (t.assignedUsersInfo ?? []).map((u) => u.fullName).join(", ");
      return (
        <Pressable key={t.id} style={styles.card} onPress={() => onTaskPress(t)}>
          <Text style={styles.title}>{t.title}</Text>
          <Text style={styles.meta}>{formatScheduled(t)}</Text>
          <Text style={styles.meta}>{TASK_STATUS_LABELS[t.status] ?? t.status}</Text>
          {t.description ? <Text style={styles.desc} numberOfLines={2}>{t.description}</Text> : null}
          <Text style={styles.meta}>Asignados: {names || "—"}</Text>
          {t.status === "PENDING" && !mine ? (
            <Text style={styles.linkText}>Pulsa para ver detalle y asumirla</Text>
          ) : (
            <Text style={styles.linkText}>Pulsa para ver detalle</Text>
          )}
        </Pressable>
      );
    });
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#2F6B3A" />
      </View>
    );
  }

  return (
    <ScreenShell style={styles.shell}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.toolbar}>
        <Pressable style={[styles.tab, mode === "week" && styles.tabActive]} onPress={() => setMode("week")}>
          <Text style={[styles.tabText, mode === "week" && styles.tabTextActive]}>Semana</Text>
        </Pressable>
        <Pressable style={[styles.tab, mode === "day" && styles.tabActive]} onPress={() => setMode("day")}>
          <Text style={[styles.tabText, mode === "day" && styles.tabTextActive]}>Día</Text>
        </Pressable>
        <Pressable style={styles.navBtn} onPress={() => shift(mode === "week" ? -7 : -1)}>
          <Text style={styles.navBtnText}>←</Text>
        </Pressable>
        <Pressable style={styles.navBtn} onPress={() => setAnchor(startOfDay(new Date()))}>
          <Text style={styles.navBtnText}>Hoy</Text>
        </Pressable>
        <Pressable style={styles.navBtn} onPress={() => shift(mode === "week" ? 7 : 1)}>
          <Text style={styles.navBtnText}>→</Text>
        </Pressable>
      </View>
      <Text style={styles.calLabel}>
        {mode === "week"
          ? `Semana del ${mondayOf(anchor).toLocaleDateString("es-ES")}`
          : anchor.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
      </Text>
      <ScrollView style={styles.scroll}>{mode === "week" ? renderWeek() : renderDay()}</ScrollView>
      <Text style={styles.legend}>
        <Text style={styles.legendMine}>■</Text> Mis tareas ·{" "}
        <Text style={styles.legendOther}>■</Text> De otros ·{" "}
        <Text style={styles.legendReview}>■</Text> En revisión ·{" "}
        <Text style={styles.legendDone}>■</Text> Hechas
      </Text>
      <TaskDetailModal
        task={detailTask}
        uid={uid}
        isAdmin={profile?.role === "ADMIN"}
        assuming={assuming}
        onClose={() => setDetailTask(null)}
        onEdit={(t) => setEditTask(t)}
        onAssume={(t) => void onAssume(t)}
      />
      <TaskEditModal
        task={editTask}
        onClose={() => setEditTask(null)}
        onSaved={(t) => {
          setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, ...t } : x)));
          if (detailTask?.id === t.id) setDetailTask({ ...detailTask, ...t });
        }}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  shell: { paddingHorizontal: 12, paddingTop: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  toolbar: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  tab: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E7E5E4" },
  tabActive: { backgroundColor: "#2F6B3A", borderColor: "#2F6B3A" },
  tabText: { fontSize: 13, fontWeight: "600", color: "#444" },
  tabTextActive: { color: "#fff" },
  navBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E7E5E4" },
  navBtnText: { fontWeight: "700", color: "#2F6B3A" },
  calLabel: { fontWeight: "700", marginBottom: 8, color: "#1C1917" },
  scroll: { flex: 1 },
  weekRow: { flexDirection: "row", gap: 6, paddingBottom: 12 },
  weekRowNarrow: { gap: 3 },
  dayCol: { flex: 1, backgroundColor: "#fff", borderRadius: 8, padding: 6, borderWidth: 1, borderColor: "#E7E5E4", minHeight: 120 },
  dayColNarrow: { padding: 3, borderRadius: 6 },
  todayCol: { borderColor: "#2F6B3A", borderWidth: 2 },
  dayLabel: { fontWeight: "800", fontSize: 12, marginBottom: 6, color: "#2F6B3A" },
  dayLabelNarrow: { fontSize: 10, marginBottom: 4 },
  emptyDay: { color: "#A8A29E", fontSize: 12 },
  calTask: { borderRadius: 6, padding: 6, marginBottom: 4 },
  calTaskNarrow: { padding: 3, borderRadius: 4, marginBottom: 3 },
  calTaskMine: { backgroundColor: "#ecfdf5", borderWidth: 1, borderColor: "#a7f3d0" },
  calTaskOther: { backgroundColor: "#fffbeb", borderWidth: 1, borderColor: "#fde68a" },
  calTaskReview: { backgroundColor: "#eff6ff", borderWidth: 1, borderColor: "#93c5fd" },
  calTaskReviewOther: { backgroundColor: "#f0f9ff", borderWidth: 1, borderColor: "#bae6fd" },
  calTaskDone: { backgroundColor: "#f5f5f4", borderWidth: 1, borderColor: "#d6d3d1" },
  calTaskTitle: { fontSize: 11, fontWeight: "700" },
  calTaskTitleNarrow: { fontSize: 9, lineHeight: 12 },
  calTaskMeta: { fontSize: 10, color: "#78716C", marginTop: 2 },
  card: { backgroundColor: "#fff", borderRadius: 10, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#E7E5E4" },
  title: { fontSize: 16, fontWeight: "700" },
  meta: { color: "#78716C", marginTop: 4, fontSize: 12 },
  desc: { marginTop: 8, color: "#44403C" },
  empty: { textAlign: "center", color: "#78716C", marginTop: 24 },
  linkText: { marginTop: 10, color: "#2F6B3A", fontWeight: "700", fontSize: 12 },
  legend: { textAlign: "center", fontSize: 10, color: "#78716C", marginTop: 6, lineHeight: 16 },
  legendMine: { color: "#059669" },
  legendOther: { color: "#d97706" },
  legendReview: { color: "#2563eb" },
  legendDone: { color: "#78716C" },
  error: { color: "#B91C1C", marginBottom: 8 },
});
