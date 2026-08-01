"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@grefa/shared";
import { UserTypeBadge } from "../../components/UserTypeBadge";
import { FIREBASE_CONFIG } from "../../lib/firebaseConfig";

export default function PersonalPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      try {
        const { getFirebaseApp, subscribeActiveUsers } = await import("@grefa/firebase");
        getFirebaseApp(FIREBASE_CONFIG);
        unsub = subscribeActiveUsers(setUsers, (e) => setError(e.message));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error Firebase");
      }
    })();
    return () => {
      unsub?.();
    };
  }, []);

  const grouped = useMemo(() => {
    return {
      trabajadores: users.filter((u) => u.userType === "TRABAJADOR_GREFA"),
      voluntarios: users.filter((u) => u.userType === "VOLUNTARIO"),
    };
  }, [users]);

  return (
    <main className="container">
      <a href="/" className="small muted">
        ← Inicio
      </a>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", marginTop: "0.5rem" }}>
        <div>
          <h1 className="h1" style={{ fontSize: "1.875rem" }}>
            Gestión de Personal
          </h1>
          <p className="muted">ABM de trabajadores GREFA y voluntarios (tiempo real).</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => alert("Próximo: formulario de alta")}
        >
          + Alta
        </button>
      </div>
      {error && <p className="alert">{error}</p>}
      <Section title="Trabajadores de GREFA" users={grouped.trabajadores} />
      <Section title="Voluntarios" users={grouped.voluntarios} />
    </main>
  );
}

function Section({ title, users }: { title: string; users: User[] }) {
  return (
    <section style={{ marginTop: "2rem" }}>
      <h2 className="h2">{title}</h2>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>DNI</th>
              <th>Tipo</th>
              <th>Email</th>
              <th>Rol</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: "1.5rem", color: "#78716c" }}>
                  Sin registros (conecta Firebase y crea usuarios).
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.uid}>
                  <td>
                    <strong>{u.fullName}</strong>
                  </td>
                  <td>
                    <code>{u.dni}</code>
                  </td>
                  <td>
                    <UserTypeBadge userType={u.userType} />
                  </td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
