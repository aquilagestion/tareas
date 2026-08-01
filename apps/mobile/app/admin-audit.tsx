import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { onAuthStateChanged } from "firebase/auth";
import { router } from "expo-router";
import {
  getFirebaseAuth,
  subscribeTasksByStatus,
  subscribeTaskLogs,
  subscribeUser,
} from "@grefa/firebase";
import type { Task, TaskLog, User } from "@grefa/shared";
import { ScreenShell } from "../components/ScreenShell";
import { formatScheduled } from "../utils/taskFormat";
import { formatTs, logsByTaskId } from "../lib/adminReview";
import { exportAuditReportPdf } from "../lib/auditReport";
import { todayDateInput } from "../lib/adminTasks";

export default function AdminAuditScreen() {
  const [profile, setProfile] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [filter, setFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reportFrom, setReportFrom] = useState(todayDateInput());
  const [reportTo, setReportTo] = useState(todayDateInput());
  const [exportBusy, setExportBusy] = useState(false);

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
        if (p && p.active && p.role !== "ADMIN") router.replace("/home");
      });
    });
    return () => {
      unsubAuth();
      unsubUser();
    };
  }, []);

  useEffect(() => {
    if (!profile || profile.role !== "ADMIN") return;
    const u1 = subscribeTasksByStatus("COMPLETED", setTasks, (e) => setError(e.message));
    const u2 = subscribeTaskLogs(setLogs, (e) => setError(e.message));
    return () => {
      u1();
      u2();
    };
  }, [profile]);

  const logMap = useMemo(() => logsByTaskId(logs), [logs]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter((t) => {
      const log = logMap[t.id];
      if ((t.title || "").toLowerCase().includes(q)) return true;
      if ((t.completedByName || log?.completedByName || "").toLowerCase().includes(q)) return true;
      return (t.assignedUsersInfo || []).some((a) =>
        (a.fullName || "").toLowerCase().includes(q)
      );
    });
  }, [tasks, logMap, filter]);

  const selected = selectedId ? tasks.find((t) => t.id === selectedId) : null;
  const selectedLog = selected ? logMap[selected.id] : undefined;

  async function onExportReport() {
    if (!profile) return;
    const from = reportFrom.trim();
    const to = (reportTo.trim() || from).trim();
    if (!from) {
      setError("Indica la fecha inicial del informe.");
      return;
    }
    if (to < from) {
      setError("La fecha final no puede ser anterior a la inicial.");
      return;
    }
    setExportBusy(true);
    setError(null);
    try {
      const { count, days } = await exportAuditReportPdf(
        tasks,
        logMap,
        from,
        to,
        profile.fullName
      );
      if (count === 0) {
        setError(`No hay tareas auditadas entre ${from} y ${to}.`);
      } else {
        setError(null);
      }
      void days;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo exportar el informe");
    } finally {
      setExportBusy(false);
    }
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#2F6B3A" />
      </View>
    );
  }

  return (
    <ScreenShell>
      <Text style={styles.intro}>
        Informe GREFA A4 apaisado (igual que en la web). Elige fechas y comparte el PDF por WhatsApp,
        Drive, impresora u otra app.
      </Text>

      <View style={styles.reportBox}>
        <Text style={styles.reportTitle}>Informe diario</Text>
        <View style={styles.dateRow}>
          <View style={styles.dateField}>
            <Text style={styles.dateLabel}>Desde</Text>
            <TextInput style={styles.dateInput} value={reportFrom} onChangeText={setReportFrom} placeholder="AAAA-MM-DD" />
          </View>
          <View style={styles.dateField}>
            <Text style={styles.dateLabel}>Hasta</Text>
            <TextInput style={styles.dateInput} value={reportTo} onChangeText={setReportTo} placeholder="AAAA-MM-DD" />
          </View>
        </View>
        <Pressable
          style={[styles.exportBtn, exportBusy && styles.btnDisabled]}
          disabled={exportBusy}
          onPress={() => void onExportReport()}
        >
          <Text style={styles.exportBtnText}>
            {exportBusy ? "Generando PDF…" : "Exportar / compartir informe"}
          </Text>
        </Pressable>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Filtrar por persona o título…"
        value={filter}
        onChangeText={setFilter}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text style={styles.count}>
        <Text style={styles.countNum}>{tasks.length}</Text> tareas auditadas
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {selected ? (
        <View style={styles.detail}>
          <Text style={styles.detailTitle}>{selected.title}</Text>
          <Text style={styles.meta}>Programada: {formatScheduled(selected)}</Text>
          {selected.description ? (
            <Text style={styles.desc}>{selected.description}</Text>
          ) : null}
          <Text style={styles.meta}>
            Asignados:{" "}
            {(selected.assignedUsersInfo || []).map((a) => a.fullName).join(", ") || "—"}
          </Text>
          <Text style={styles.meta}>
            Realizó: {selected.completedByName || selectedLog?.completedByName || "—"} ·{" "}
            {formatTs(selected.completedAt || selectedLog?.completionDate)}
          </Text>
          <Text style={styles.meta}>
            Chequeada: {formatTs(selected.auditedAt || selectedLog?.auditedAt)}
          </Text>
          {selectedLog?.wasAssignedToHim === false ? (
            <Text style={styles.crossTag}>Chequeo cruzado</Text>
          ) : null}
          {(selected.materialShortage || selectedLog?.materialShortage) ? (
            <View style={styles.warnBox}>
              <Text style={styles.warnLabel}>Falta de material</Text>
              <Text style={styles.warnText}>
                {selected.materialShortage || selectedLog?.materialShortage}
              </Text>
            </View>
          ) : null}
          {(selected.completionNotes || selectedLog?.comments) ? (
            <View style={styles.notesBox}>
              <Text style={styles.notesLabel}>Observaciones</Text>
              <Text style={styles.notesText}>
                {selected.completionNotes || selectedLog?.comments}
              </Text>
            </View>
          ) : null}
          <Pressable style={styles.closeDetail} onPress={() => setSelectedId(null)}>
            <Text style={styles.closeDetailText}>Cerrar detalle</Text>
          </Pressable>
        </View>
      ) : null}

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={filtered}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {tasks.length ? "Sin coincidencias con el filtro." : "Sin tareas auditadas aún."}
          </Text>
        }
        renderItem={({ item }) => {
          const log = logMap[item.id];
          const active = item.id === selectedId;
          return (
            <Pressable
              style={[styles.row, active && styles.rowActive]}
              onPress={() => setSelectedId(item.id)}
            >
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.rowMeta} numberOfLines={1}>
                {item.completedByName || log?.completedByName || "—"} ·{" "}
                {formatTs(item.completedAt || log?.completionDate)}
              </Text>
              <Text style={styles.rowMeta} numberOfLines={1}>
                Programada: {formatScheduled(item)}
              </Text>
            </Pressable>
          );
        }}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  listContent: { paddingBottom: 24 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  intro: { color: "#57534E", marginBottom: 10, lineHeight: 20, fontSize: 13 },
  reportBox: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2F6B3A",
  },
  reportTitle: { fontWeight: "800", color: "#2F6B3A", marginBottom: 8 },
  dateRow: { flexDirection: "row", gap: 10 },
  dateField: { flex: 1 },
  dateLabel: { fontSize: 12, fontWeight: "600", color: "#57534E", marginBottom: 4 },
  dateInput: {
    borderWidth: 1,
    borderColor: "#D6D3D1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#FAFAF9",
  },
  exportBtn: {
    marginTop: 10,
    backgroundColor: "#2F6B3A",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  exportBtnText: { color: "#fff", fontWeight: "800" },
  btnDisabled: { opacity: 0.6 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D6D3D1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  count: { marginBottom: 10, color: "#57534E", fontSize: 13 },
  countNum: { fontWeight: "800", color: "#1C1917" },
  empty: { textAlign: "center", color: "#78716C", marginTop: 24 },
  error: { color: "#B91C1C", marginBottom: 8 },
  detail: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2F6B3A",
  },
  detailTitle: { fontSize: 17, fontWeight: "800", marginBottom: 6 },
  meta: { color: "#78716C", marginTop: 4, fontSize: 12 },
  desc: { color: "#44403C", marginTop: 8, lineHeight: 20 },
  crossTag: { marginTop: 8, fontSize: 11, color: "#B45309", fontWeight: "600" },
  warnBox: {
    marginTop: 10,
    backgroundColor: "#FFFBEB",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  warnLabel: { fontSize: 11, fontWeight: "800", color: "#92400E", marginBottom: 4 },
  warnText: { color: "#78350F", lineHeight: 18 },
  notesBox: {
    marginTop: 10,
    backgroundColor: "#F5F5F4",
    borderRadius: 8,
    padding: 10,
  },
  notesLabel: { fontSize: 11, fontWeight: "800", color: "#57534E", marginBottom: 4 },
  notesText: { color: "#44403C", lineHeight: 20 },
  closeDetail: { marginTop: 12, alignSelf: "flex-start" },
  closeDetailText: { color: "#2F6B3A", fontWeight: "700" },
  row: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E7E5E4",
  },
  rowActive: { borderColor: "#2F6B3A", backgroundColor: "#ECFDF5" },
  rowTitle: { fontWeight: "700", fontSize: 15 },
  rowMeta: { color: "#78716C", fontSize: 12, marginTop: 3 },
});
