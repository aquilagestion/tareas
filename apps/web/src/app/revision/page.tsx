"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { subscribeTasksByStatus } from "@grefa/firebase";
import type { Task } from "@grefa/shared";

export default function RevisionPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      return subscribeTasksByStatus("IN_REVIEW", setTasks, (e) => setError(e.message));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error Firebase");
    }
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link href="/" className="text-sm text-stone-500 hover:underline">
        ← Inicio
      </Link>
      <h1 className="mt-2 text-3xl font-bold">Revisión de tareas</h1>
      <p className="text-stone-600">Estado IN_REVIEW → Validar (COMPLETED) o devolver (PENDING).</p>

      {error && (
        <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
          {error}
        </p>
      )}

      <ul className="mt-8 space-y-3">
        {tasks.length === 0 ? (
          <li className="rounded-lg border border-dashed border-stone-300 p-8 text-center text-stone-500">
            No hay tareas en revisión.
          </li>
        ) : (
          tasks.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white p-4"
            >
              <div>
                <p className="font-semibold">{t.title}</p>
                <p className="text-sm text-stone-600">
                  {t.assignedUsersInfo?.map((u) => u.fullName).join(", ")} · {t.totalAmount} €
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-md border border-stone-300 px-3 py-1.5 text-sm"
                  onClick={() => alert(`Devolver ${t.id} → PENDING`)}
                >
                  Devolver
                </button>
                <button
                  type="button"
                  className="rounded-md bg-[var(--grefa-green)] px-3 py-1.5 text-sm text-white"
                  onClick={() => alert(`Validar ${t.id} → COMPLETED`)}
                >
                  Validar
                </button>
              </div>
            </li>
          ))
        )}
      </ul>
    </main>
  );
}
