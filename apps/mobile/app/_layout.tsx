import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StyleSheet } from "react-native";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { HeaderMenuButton } from "../components/MenuButton";
import { LiveNotifications } from "../components/LiveNotifications";
import { FIREBASE_CONFIG } from "../config/firebase";
import { getFirebaseApp } from "@grefa/firebase";

try {
  getFirebaseApp(FIREBASE_CONFIG);
} catch (e) {
  console.error("Firebase init", e);
}

const withMenu = {
  headerRight: () => <HeaderMenuButton />,
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: "#2F6B3A" },
              headerTintColor: "#fff",
              headerTitleStyle: { fontWeight: "700" },
              contentStyle: { backgroundColor: "#F5F1E8" },
            }}
          >
            <Stack.Screen name="login" options={{ title: "Acceso", headerShown: false }} />
            <Stack.Screen name="home" options={{ title: "Menú", headerBackVisible: false }} />
            <Stack.Screen name="admin" options={{ title: "Administración", headerBackVisible: false }} />
            <Stack.Screen name="index" options={{ title: "Mis tareas", ...withMenu }} />
            <Stack.Screen name="admin-new-task" options={{ title: "Nueva tarea", ...withMenu }} />
            <Stack.Screen name="admin-revision" options={{ title: "Revisión", ...withMenu }} />
            <Stack.Screen name="admin-audit" options={{ title: "Auditoría", ...withMenu }} />
            <Stack.Screen name="roster" options={{ title: "Cuadrante", ...withMenu }} />
            <Stack.Screen name="admin-roster" options={{ title: "Editar cuadrante", ...withMenu }} />
            <Stack.Screen name="admin-staff" options={{ title: "Personal", ...withMenu }} />
            <Stack.Screen name="calendar" options={{ title: "Calendario", ...withMenu }} />
            <Stack.Screen name="others" options={{ title: "Asumir tareas", ...withMenu }} />
            <Stack.Screen name="completed" options={{ title: "Tareas realizadas", ...withMenu }} />
            <Stack.Screen name="profile" options={{ title: "Mi ficha", ...withMenu }} />
          </Stack>
          <LiveNotifications />
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F1E8" },
});
