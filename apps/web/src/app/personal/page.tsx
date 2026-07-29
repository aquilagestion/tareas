"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { subscribeActiveUsers } from "@grefa/firebase";
import type { User } from "@grefa/shared";
import { UserTypeBadge } from "@/components/UserTypeBadge";

export default function PersonalPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      return subscribeActiveUsers(setUsers, (e) => setError(e.message));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error Firebase");
    }
  }, []);

  const grouped = useMemo(() => {
    const trabajadores = users.filter((u) => u.userType === "TRABAJADOR_GREFA");
    const voluntarios = users.filter((u) => u.userType === "VOLUNTARIO");
    return { trabajadores, voluntarios };
  }, [users]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <Link href="/" className="text-sm text-stone-500 hover:underline">
            ← Inicio
          </Link>
          <h1 className="mt-2 text-3xl font-bold">Gestión de Personal</h1>
          <p className="text-stone-600">ABM de trabajadores GREFA y voluntarios (tiempo real).</p>
        </div>
        <button
          type="button"
          className="rounded-md bg-[var(--grefa-green)] px-4 py-2 text-sm font-medium text-white"
          onClick={() => alert("Próximo: formulario de alta (+ desde selector de tareas)")}
        >
          + Alta
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {error} — Configura las variables Firebase en <code>apps/web/.env.local</code>
        </p>
      )}

      <Section title="Trabajadores de GREFA" users={grouped.trabajadores} />
      <Section title="Voluntarios" users={grouped.voluntarios} />
    </main>
  );
}

function Section({ title, users }: { title: string; users: User[] }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-stone-100 text-stone-600">
            <tr>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">DNI</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Rol</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-stone-500">
                  Sin registros (conecta Firebase y crea usuarios).
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.uid} className="border-t border-stone-100">
                  <td className="px-3 py-2 font-medium">{u.fullName}</td>
                  <td className="px-3 py-2 font-mono">{u.dni}</td>
                  <td className="px-3 py-2">
                    <UserTypeBadge userType={u.userType} />
                  </td>
                  <td className="px-3 py-2">{u.email}</td>
                  <td className="px-3 py-2">{u.role}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
