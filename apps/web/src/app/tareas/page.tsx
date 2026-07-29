"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { subscribeActiveUsers } from "@grefa/firebase";
import type { User } from "@grefa/shared";
import { isValidDni } from "@grefa/shared";
import { UserTypeBadge } from "@/components/UserTypeBadge";

export default function TareasPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [totalAmount, setTotalAmount] = useState("0");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      return subscribeActiveUsers(setUsers, (e) => setError(e.message));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error Firebase");
    }
  }, []);

  const grouped = useMemo(() => {
    const workers = users.filter((u) => u.userType === "TRABAJADOR_GREFA" && u.role === "WORKER");
    const vols = users.filter((u) => u.userType === "VOLUNTARIO");
    return { workers, vols };
  }, [users]);

  function toggle(uid: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  function validateAssignees(): string | null {
    for (const uid of selected) {
      const u = users.find((x) => x.uid === uid);
      if (u && !isValidDni(u.dni)) {
        return `DNI inválido para ${u.fullName}: ${u.dni}`;
      }
    }
    return null;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const dniError = validateAssignees();
    if (dniError) {
      setError(dniError);
      return;
    }
    if (selected.size === 0) {
      setError("Selecciona al menos una persona");
      return;
    }
    setError(null);
    alert(
      `Borrador listo (pendiente createDoc):\n${title}\nAsignados: ${[...selected].join(", ")}\nImporte: ${totalAmount} €`
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/" className="text-sm text-stone-500 hover:underline">
        ← Inicio
      </Link>
      <h1 className="mt-2 text-3xl font-bold">Nueva tarea</h1>
      <p className="text-stone-600">Asignación múltiple agrupada por tipo de personal.</p>

      {error && (
        <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
          {error}
        </p>
      )}

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <label className="block text-sm">
          Título
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Descripción
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Importe total (€)
          <input
            type="number"
            min="0"
            step="0.01"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2"
          />
        </label>

        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="text-sm font-medium">Asignar a</span>
            <button
              type="button"
              className="rounded bg-stone-800 px-2 py-0.5 text-xs text-white"
              title="Alta rápida de personal"
              onClick={() => alert("Próximo: modal alta personal sin salir del formulario")}
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-left text-sm"
          >
            {selected.size === 0
              ? "Seleccionar personal…"
              : `${selected.size} persona(s) seleccionada(s)`}
          </button>
          {open && (
            <div className="mt-2 max-h-72 overflow-auto rounded-md border border-stone-200 bg-white p-3 shadow-sm">
              <Group
                title="🔵 Trabajadores de GREFA"
                users={grouped.workers}
                selected={selected}
                onToggle={toggle}
              />
              <Group
                title="🟢 Voluntarios"
                users={grouped.vols}
                selected={selected}
                onToggle={toggle}
              />
            </div>
          )}
        </div>

        <button
          type="submit"
          className="rounded-md bg-[var(--grefa-green)] px-4 py-2 font-medium text-white"
        >
          Guardar tarea (PENDING)
        </button>
      </form>
    </main>
  );
}

function Group({
  title,
  users,
  selected,
  onToggle,
}: {
  title: string;
  users: User[];
  selected: Set<string>;
  onToggle: (uid: string) => void;
}) {
  return (
    <div className="mb-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">{title}</p>
      {users.length === 0 && <p className="text-sm text-stone-400">Sin personas</p>}
      {users.map((u) => (
        <label key={u.uid} className="flex cursor-pointer items-center gap-2 py-1.5 text-sm">
          <input
            type="checkbox"
            checked={selected.has(u.uid)}
            onChange={() => onToggle(u.uid)}
          />
          <span className="font-medium">{u.fullName}</span>
          <UserTypeBadge userType={u.userType} />
          <span className="font-mono text-xs text-stone-500">{u.dni}</span>
        </label>
      ))}
    </div>
  );
}
