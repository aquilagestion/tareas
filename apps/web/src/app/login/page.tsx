"use client";

import { FormEvent, useEffect, useState } from "react";
import { FIREBASE_CONFIG } from "../../lib/firebaseConfig";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { getFirebaseApp } = await import("@grefa/firebase");
        getFirebaseApp(FIREBASE_CONFIG);
        if (!cancelled) setReady(true);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error Firebase");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { getFirebaseAuth } = await import("@grefa/firebase");
      const { signInWithEmailAndPassword } = await import("firebase/auth");
      await signInWithEmailAndPassword(getFirebaseAuth(FIREBASE_CONFIG), email.trim(), password);
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de autenticación");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="container"
      style={{
        maxWidth: "28rem",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <h1 className="h1" style={{ fontSize: "1.5rem" }}>
        Acceso administradores
      </h1>
      <p className="small muted">GREFA Tareas — Email / contraseña</p>

      <form onSubmit={onSubmit} style={{ marginTop: "2rem", display: "grid", gap: "1rem" }}>
        <label className="small">
          Email
          <input
            className="input"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="small">
          Contraseña
          <input
            className="input"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="alert">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={loading || !ready}>
          {loading ? "Entrando…" : ready ? "Entrar" : "Cargando…"}
        </button>
      </form>
    </main>
  );
}
