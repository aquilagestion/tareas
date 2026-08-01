import { View, StyleSheet, type ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface ScreenShellProps extends ViewProps {
  children: React.ReactNode;
}

/** Contenedor con safe area inferior para pantallas de contenido. */
export function ScreenShell({ children, style, ...rest }: ScreenShellProps) {
  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <View style={[styles.inner, style]} {...rest}>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F1E8" },
  inner: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
});
