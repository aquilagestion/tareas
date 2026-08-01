import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from "react-native";
import { onAuthStateChanged } from "firebase/auth";
import { router } from "expo-router";
import { getFirebaseAuth, getFirebaseApp, subscribeUser } from "@grefa/firebase";
import type { User } from "@grefa/shared";
import { FIREBASE_CONFIG } from "../config/firebase";
import { ScreenShell } from "../components/ScreenShell";
import { RosterTable } from "../components/RosterTable";
import { exportRosterPdf } from "../lib/rosterExport";
import {
  formatClosedAt,
  subscribeClosedRosters,
  type RosterSnapshot,
} from "../lib/rosterHistory";

getFirebaseApp(FIREBASE_CONFIG);

export default function RosterScreen() {
  const [uid, setUid] = useState<string | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [closed, setClosed] = useState<RosterSnapshot[]>([]);
  const [index, setIndex] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let unsubUser = () => {};
    const unsubAuth = onAuthStateChanged(getFirebaseAuth(), (user) => {
      unsubUser();
      setUid(user?.uid ?? null);
      if (!user) {
        router.replace("/login");
        return;
      }
      unsubUser = subscribeUser(user.uid, (p) => {
        setProfile(p);
        setReady(true);
      });
    });
    return () => {
      unsubAuth();
      unsubUser();
    };
  }, []);

  // El histórico solo es legible con sesión abierta: se espera a tenerla.
  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeClosedRosters(setClosed, (e) => setError(e.message));
    return () => unsub();
  }, [uid]);

  const current = closed[index] ?? null;

  /** Los días con turno de quien mira, para no buscarse en la tabla. */
  const myShifts = useMemo(() => {
    if (!current || !profile) return [];
    const row = current.rows.find((r) => r.uid === profile.uid);
    if (!row) return [];
    return current.dayLabels
      .map((label, i) => (row.marks[i] === "SI" ? label : null))
      .filter((s): s is string => Boolean(s))
      .map((s) => (row.hours ? `${s} · ${row.hours}` : s));
  }, [current, profile]);

  async function onExport() {
    if (!current) return;
    setError(null);
    try {
      await exportRosterPdf(
        current.weekLabel,
        current.dayLabels,
        current.rows,
        `Cuadrante cerrado el ${formatClosedAt(current)} por ${current.closedByName}.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo exportar el cuadrante");
    }
  }

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#2F6B3A" />
      </View>
    );
  }

  const isAdmin = profile?.role === "ADMIN";

  return (
    <ScreenShell style={styles.shell}>
      <View style={styles.toolbar}>
        <Pressable
          style={[styles.navBtn, index >= closed.length - 1 && styles.navBtnOff]}
          disabled={index >= closed.length - 1}
          onPress={() => setIndex((i) => i + 1)}
        >
          <Text style={styles.navBtnText}>← Anterior</Text>
        </Pressable>
        <Pressable
          style={[styles.navBtn, index === 0 && styles.navBtnOff]}
          disabled={index === 0}
          onPress={() => setIndex((i) => Math.max(0, i - 1))}
        >
          <Text style={styles.navBtnText}>Siguiente →</Text>
        </Pressable>
        <Pressable style={styles.navBtn} onPress={() => setHistoryOpen(true)}>
          <Text style={styles.navBtnText}>Ver otras semanas</Text>
        </Pressable>
        {current ? (
          <Pressable style={styles.primaryBtn} onPress={() => void onExport()}>
            <Text style={styles.primaryBtnText}>Exportar PDF</Text>
          </Pressable>
        ) : null}
        {isAdmin ? (
          <Pressable style={styles.editBtn} onPress={() => router.push("/admin-roster")}>
            <Text style={styles.primaryBtnText}>Editar cuadrante</Text>
          </Pressable>
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!current ? (
        <Text style={styles.empty}>
          Todavía no hay ningún cuadrante publicado.{" "}
          {isAdmin
            ? "Ciérralo desde «Editar cuadrante» cuando lo tengas terminado y aparecerá aquí para todo el personal."
            : "Cuando el responsable cierre el de la semana, lo verás aquí."}
        </Text>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.weekLabel}>{current.weekLabel}</Text>
          <Text style={styles.closedNote}>
            Publicado el {formatClosedAt(current)} por {current.closedByName}.
            {isAdmin ? " Para cambiarlo, entra en «Editar cuadrante»." : " Solo lectura."}
          </Text>

          {myShifts.length ? (
            <Text style={styles.mine}>
              Tus turnos: {myShifts.join(" · ")}
            </Text>
          ) : profile ? (
            <Text style={styles.mineNone}>Esta semana no tienes turnos en el cuadrante.</Text>
          ) : null}

          <RosterTable
            dayLabels={current.dayLabels}
            rows={current.rows}
            highlightUid={profile?.uid ?? null}
          />
        </ScrollView>
      )}

      <Modal
        visible={historyOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setHistoryOpen(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Cuadrantes publicados</Text>
            <ScrollView style={styles.modalList}>
              {closed.length === 0 ? (
                <Text style={styles.hint}>Todavía no hay ninguno.</Text>
              ) : null}
              {closed.map((c, i) => (
                <Pressable
                  key={c.weekStart}
                  style={[styles.savedItem, i === index && styles.savedItemOn]}
                  onPress={() => {
                    setIndex(i);
                    setHistoryOpen(false);
                  }}
                >
                  <Text style={styles.savedWeek}>{c.weekLabel}</Text>
                  <Text style={styles.savedMeta}>
                    Publicado el {formatClosedAt(c)} por {c.closedByName}
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
    </ScreenShell>
  );
}

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
  navBtnOff: { opacity: 0.45 },
  navBtnText: { fontWeight: "700", color: "#2F6B3A", fontSize: 13 },
  primaryBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: "#2F6B3A",
  },
  editBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: "#B45309",
  },
  primaryBtnText: { fontWeight: "700", color: "#fff", fontSize: 13 },
  weekLabel: { fontWeight: "700", color: "#1C1917", marginBottom: 2 },
  closedNote: { fontSize: 12, color: "#78716C", marginBottom: 6, lineHeight: 17 },
  mine: { fontSize: 12, color: "#166534", fontWeight: "700", marginBottom: 8, lineHeight: 17 },
  mineNone: { fontSize: 12, color: "#78716C", marginBottom: 8 },
  empty: { color: "#78716C", marginTop: 24, textAlign: "center", lineHeight: 20 },
  error: { color: "#B91C1C", marginBottom: 8 },
  hint: { fontSize: 12, color: "#78716C", lineHeight: 17 },
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
  savedItemOn: { borderColor: "#2F6B3A", backgroundColor: "#F0FDF4" },
  savedWeek: { fontWeight: "700", color: "#1C1917", fontSize: 14 },
  savedMeta: { fontSize: 11, color: "#78716C", marginTop: 2 },
  modalClose: { marginTop: 8, paddingVertical: 11, alignItems: "center" },
  modalCloseText: { color: "#57534E", fontWeight: "700", fontSize: 14 },
});
