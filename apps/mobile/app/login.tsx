import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { signInWithEmailAndPassword, sendPasswordResetEmail, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseApp, getDb } from "@grefa/firebase";
import { FIREBASE_CONFIG } from "../config/firebase";
import { APP_VERSION } from "../constants/version";

getFirebaseApp(FIREBASE_CONFIG);

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function onLogin() {
    setError(null);
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
      const snap = await getDoc(doc(getDb(), "users", cred.user.uid));
      if (!snap.exists() || snap.data().active !== true) {
        await signOut(getFirebaseAuth());
        throw new Error("Tu ficha no está activa. Contacta con administración.");
      }
      const role = snap.data().role as string;
      router.replace(role === "ADMIN" ? "/admin" : "/home");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de acceso");
    } finally {
      setLoading(false);
    }
  }

  async function onForgotPassword() {
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Escribe tu email arriba");
      return;
    }
    setResetting(true);
    try {
      await sendPasswordResetEmail(getFirebaseAuth(), trimmed, {
        url: "https://grefa-tareas.web.app/login/",
        handleCodeInApp: false,
      });
      Alert.alert(
        "Correo enviado",
        "Revisa tu bandeja (y spam). Asunto: «Ha solicitado cambiar su contraseña de acceso en el gestor de tareas.»"
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar el correo");
    } finally {
      setResetting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.brand}>GREFA</Text>
      <Text style={styles.subtitle}>Tareas · Campo y administración</Text>

      <TextInput
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
      />
      <View style={styles.pwdRow}>
        <TextInput
          style={[styles.input, styles.pwdInput]}
          secureTextEntry={!showPwd}
          placeholder="Contraseña"
          value={password}
          onChangeText={setPassword}
        />
        <Pressable style={styles.pwdToggle} onPress={() => setShowPwd((v) => !v)}>
          <Text style={styles.pwdToggleText}>{showPwd ? "Ocultar" : "Mostrar"}</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.button} onPress={onLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Entrar</Text>}
      </Pressable>

      <Pressable style={styles.linkBtn} onPress={() => void onForgotPassword()} disabled={resetting}>
        <Text style={styles.linkText}>
          {resetting ? "Enviando correo…" : "¿Olvidaste tu contraseña?"}
        </Text>
      </Pressable>
      <Text style={styles.version}>v{APP_VERSION}</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#F5F1E8",
  },
  brand: {
    fontSize: 36,
    fontWeight: "800",
    color: "#2F6B3A",
  },
  subtitle: {
    marginBottom: 32,
    color: "#555",
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D6D3D1",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  pwdRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  pwdInput: { flex: 1, marginBottom: 0 },
  pwdToggle: { paddingVertical: 12, paddingHorizontal: 4 },
  pwdToggleText: { color: "#2F6B3A", fontWeight: "700", fontSize: 13 },
  button: {
    backgroundColor: "#2F6B3A",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "#fff", fontWeight: "700" },
  linkBtn: { marginTop: 16, alignItems: "center", paddingVertical: 8 },
  linkText: { color: "#2F6B3A", fontWeight: "600", textDecorationLine: "underline" },
  error: { color: "#B91C1C", marginBottom: 8 },
  version: { marginTop: 24, textAlign: "center", color: "#78716C", fontSize: 12 },
});
