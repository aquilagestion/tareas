import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { onAuthStateChanged } from "firebase/auth";
import { getFirebaseAuth } from "@grefa/firebase";
import {
  relevantNotifications,
  subscribeNotifications,
  type AppNotification,
} from "../lib/notifications";

const AUTO_HIDE_MS = 9000;

export function LiveNotifications() {
  const insets = useSafeAreaInsets();
  const [uid, setUid] = useState<string | null>(null);
  const [list, setList] = useState<AppNotification[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const since = useRef(new Date());

  useEffect(() => {
    const unsub = onAuthStateChanged(getFirebaseAuth(), (user) => {
      setUid(user?.uid ?? null);
      since.current = new Date();
      setList([]);
      setDismissed(new Set());
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeNotifications(setList, () => setList([]));
    return () => unsub();
  }, [uid]);

  const pending = useMemo(() => {
    if (!uid) return [];
    return relevantNotifications(list, uid, since.current, dismissed);
  }, [list, uid, dismissed]);

  const current = pending[0] ?? null;

  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => {
      setDismissed((prev) => new Set(prev).add(current.id));
    }, AUTO_HIDE_MS);
    return () => clearTimeout(t);
  }, [current]);

  if (!current) return null;

  const taken = current.type === "TASK_TAKEN";

  return (
    <View style={[styles.wrap, { top: insets.top + 8 }]} pointerEvents="box-none">
      <Pressable
        style={[styles.card, taken ? styles.cardTaken : styles.cardDone]}
        onPress={() => setDismissed((prev) => new Set(prev).add(current.id))}
      >
        <Text style={[styles.label, taken ? styles.labelTaken : styles.labelDone]}>
          {taken ? "Tarea reasignada" : "Tarea realizada"}
        </Text>
        <Text style={styles.message}>{current.message}</Text>
        {pending.length > 1 ? (
          <Text style={styles.more}>+{pending.length - 1} aviso(s) más</Text>
        ) : null}
        <Text style={styles.hint}>Toca para descartar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 12, right: 12, zIndex: 1000 },
  card: {
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  cardDone: { backgroundColor: "#ECFDF5", borderColor: "#6EE7B7" },
  cardTaken: { backgroundColor: "#FFFBEB", borderColor: "#FCD34D" },
  label: { fontSize: 11, fontWeight: "800", marginBottom: 4 },
  labelDone: { color: "#166534" },
  labelTaken: { color: "#92400E" },
  message: { color: "#1C1917", lineHeight: 20, fontWeight: "600" },
  more: { marginTop: 6, fontSize: 12, color: "#57534E", fontWeight: "700" },
  hint: { marginTop: 6, fontSize: 11, color: "#78716C" },
});
