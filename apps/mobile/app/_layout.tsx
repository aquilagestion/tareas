import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#2F6B3A" },
          headerTintColor: "#fff",
          headerTitleStyle: { fontWeight: "700" },
        }}
      >
        <Stack.Screen name="index" options={{ title: "Mis tareas" }} />
        <Stack.Screen name="login" options={{ title: "Acceso", headerShown: false }} />
      </Stack>
    </>
  );
}
