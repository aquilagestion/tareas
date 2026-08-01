import { View, Text, StyleSheet } from "react-native";
import type { RosterRow } from "../lib/rosterData";
import { useRosterLayout } from "../lib/rosterLayout";

interface RosterTableProps {
  dayLabels: string[];
  rows: RosterRow[];
  /** Fila a destacar, normalmente la de quien está mirando. */
  highlightUid?: string | null;
}

/** Cuadrante de solo lectura: histórico cerrado y vista del personal. */
export function RosterTable({ dayLabels, rows, highlightUid }: RosterTableProps) {
  const { nameW, compact, tight } = useRosterLayout();

  return (
    <View>
      <View style={styles.row}>
        <View style={[styles.nameCell, styles.headCell, { width: nameW }]}>
          <Text style={styles.headText}>Personal</Text>
        </View>
        {dayLabels.map((label) => (
          <View key={label} style={[styles.cell, styles.headCell]}>
            <Text
              style={[styles.headText, compact && styles.headTextCompact]}
              numberOfLines={2}
            >
              {label}
            </Text>
          </View>
        ))}
      </View>

      {rows.map((r) => {
        const mine = Boolean(highlightUid) && r.uid === highlightUid;
        return (
          <View key={r.uid} style={styles.row}>
            <View style={[styles.nameCell, { width: nameW }, mine && styles.mineCell]}>
              <Text
                style={[styles.nameText, compact && styles.nameTextCompact]}
                numberOfLines={2}
              >
                {r.name}
              </Text>
              {tight ? null : (
                <Text style={styles.roleText} numberOfLines={2}>
                  {[r.role, r.hours].filter(Boolean).join(" · ")}
                </Text>
              )}
            </View>
            {r.marks.map((m, i) => (
              <View
                key={`${r.uid}-${i}`}
                style={[
                  styles.cell,
                  m === "SI" && styles.cellOk,
                  m === "NO" && styles.cellOff,
                  mine && styles.mineCell,
                ]}
              >
                <Text style={[styles.cellMark, compact && styles.cellMarkCompact]}>
                  {m === "SI" ? "Sí" : m === "NO" ? "No" : "·"}
                </Text>
              </View>
            ))}
          </View>
        );
      })}

      <View style={styles.row}>
        <View style={[styles.nameCell, styles.totalCell, { width: nameW }]}>
          <Text style={styles.totalLabel}>Disponibles</Text>
        </View>
        {dayLabels.map((label, i) => (
          <View key={label} style={[styles.cell, styles.totalCell]}>
            <Text style={[styles.totalText, compact && styles.totalTextCompact]}>
              {compact
                ? `${rows.filter((r) => r.marks[i] === "SI").length}`
                : `${rows.filter((r) => r.marks[i] === "SI").length} de ${rows.length}`}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
  nameCell: {
    padding: 6,
    borderWidth: 1,
    borderColor: "#E7E5E4",
    backgroundColor: "#fff",
    justifyContent: "center",
  },
  nameText: { fontSize: 12, fontWeight: "700", color: "#1C1917" },
  nameTextCompact: { fontSize: 11 },
  roleText: { fontSize: 10, color: "#78716C", marginTop: 2 },
  mineCell: { borderColor: "#2F6B3A" },
  cell: {
    flex: 1,
    minHeight: 46,
    padding: 2,
    borderWidth: 1,
    borderColor: "#E7E5E4",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  cellOk: { backgroundColor: "#D1FAE5", borderColor: "#34D399" },
  cellOff: { backgroundColor: "#FEE2E2", borderColor: "#F87171" },
  cellMark: { fontSize: 14, fontWeight: "800", color: "#44403C" },
  cellMarkCompact: { fontSize: 12 },
  headCell: { backgroundColor: "#F5F1E8", minHeight: 38 },
  headText: { fontSize: 12, fontWeight: "800", color: "#2F6B3A", textAlign: "center" },
  headTextCompact: { fontSize: 10 },
  totalCell: { backgroundColor: "#F5F1E8", minHeight: 36 },
  totalLabel: { fontSize: 12, fontWeight: "800", color: "#2F6B3A" },
  totalText: { fontSize: 12, fontWeight: "800", color: "#1C1917" },
  totalTextCompact: { fontSize: 11 },
});
