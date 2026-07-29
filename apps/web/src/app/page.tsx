import Link from "next/link";

const modules = [
  {
    href: "/personal",
    title: "Gestión de Personal",
    desc: "Alta, edición y baja de trabajadores GREFA y voluntarios.",
  },
  {
    href: "/tareas",
    title: "Asignación de Tareas",
    desc: "Crear tareas y asignarlas a una o varias personas.",
  },
  {
    href: "/revision",
    title: "Revisión",
    desc: "Validar tareas en IN_REVIEW o devolverlas a PENDING.",
  },
  {
    href: "/auditoria",
    title: "Auditoría",
    desc: "Histórico diario con textos legales e importes.",
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-10 border-b border-stone-200 pb-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-[var(--grefa-green)]">
          GREFA · Majadahonda
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-stone-900">
          Panel de administración
        </h1>
        <p className="mt-3 max-w-2xl text-stone-600">
          Gestión, asignación, revisión y liquidación de tareas/gastos. Sincronizado en
          tiempo real con la app móvil vía Cloud Firestore.
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            href="/login"
            className="rounded-md bg-[var(--grefa-green)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/personal"
            className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 hover:bg-stone-100"
          >
            Ir a Personal
          </Link>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        {modules.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm transition hover:border-[var(--grefa-green)]"
          >
            <h2 className="text-lg font-semibold">{m.title}</h2>
            <p className="mt-1 text-sm text-stone-600">{m.desc}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
