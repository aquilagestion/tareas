import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

type Props = { children: ReactNode };
type State = { error: Error | null };

/** Evita pantalla blanca opaca en release: muestra el error real. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary", error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.wrap}>
          <Text style={styles.title}>Error al iniciar</Text>
          <ScrollView style={styles.box}>
            <Text style={styles.msg}>{this.state.error.message}</Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#F5F1E8", padding: 24, justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "800", color: "#B91C1C", marginBottom: 12 },
  box: { maxHeight: 280, backgroundColor: "#fff", borderRadius: 8, padding: 12 },
  msg: { color: "#1C1917", fontFamily: "monospace", fontSize: 13 },
});
