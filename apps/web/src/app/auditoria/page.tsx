"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { subscribeTaskLogs } from "@grefa/firebase";
import type { TaskLog } from "@grefa/shared";

export default function AuditoriaPage() {
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [filterPerson, setFilterPerson] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      return subscribeTaskLogs(setLogs, (e) => setError(e.message));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error Firebase");
    }
  }, []);

  const filtered = useMemo(() => {
    const q = filterPerson.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter(
      (l) =>
        l.completedByName?.toLowerCase().includes(q) ||
        l.assignedUsersList?.some((a) => a.fullName.toLowerCase().includes(q))
    );
  }, [logs, filterPerson]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Link href="/" className="text-sm text-stone-500 hover:underline">
        ← Inicio
      </Link>
      <h1 className="mt-2 text-3xl font-bold">Auditoría diaria</h1>
      <p className="text-stone-600">
        Registro de quién estaba asignado vs quién ejecutó realmente la tarea.
      </p>

      <div className="mt-6">
        <input
          placeholder="Filtrar por persona…"
          value={filterPerson}
          onChange={(e) => setFilterPerson(e.target.value)}
          className="w-full max-w-sm rounded-md border border-stone-300 px-3 py-2 text-sm"
        />
      </div>

      {error && (
        <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
          {error}
        </p>
      )}

      <div className="mt-6 overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-stone-100 text-stone-600">
            <tr>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Tarea</th>
              <th className="px-3 py-2">Asignados</th>
              <th className="px-3 py-2">Realizó</th>
              <th className="px-3 py-2">Comentarios</th>
              <th className="px-3 py-2">Texto legal</th>
              <th className="px-3 py-2">Importe</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-stone-500">
                  Sin registros de auditoría.
                </td>
              </tr>
            ) : (
              filtered.map((l) => (
                <tr key={l.id} className="border-t border-stone-100 align-top">
                  <td className="px-3 py-2 whitespace-nowrap">{l.locationDateText}</td>
                  <td className="px-3 py-2 font-mono text-xs">{l.taskId}</td>
                  <td className="px-3 py-2">
                    {l.assignedUsersList?.map((a) => a.fullName).join(", ")}
                  </td>
                  <td className="px-3 py-2">
                    <span className={l.wasAssignedToHim ? "" : "font-semibold text-amber-700"}>
                      {l.completedByName}
                      {!l.wasAssignedToHim && " (distinto)"}
                    </span>
                  </td>
                  <td className="px-3 py-2 max-w-[160px] truncate">{l.comments}</td>
                  <td className="px-3 py-2 max-w-[220px] truncate" title={l.concatenatedText}>
                    {l.concatenatedText}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {l.totalAmount != null ? `${l.totalAmount} €` : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
