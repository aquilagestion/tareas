const modules = [
  {
    href: "/personal/",
    title: "Gestión de Personal",
    desc: "Alta, edición y baja de trabajadores GREFA y voluntarios.",
  },
  {
    href: "/tareas/",
    title: "Asignación de Tareas",
    desc: "Crear tareas y asignarlas a una o varias personas.",
  },
  {
    href: "/revision/",
    title: "Revisión",
    desc: "Validar tareas en IN_REVIEW o devolverlas a PENDING.",
  },
  {
    href: "/auditoria/",
    title: "Auditoría",
    desc: "Histórico diario con textos legales e importes.",
  },
];

export default function HomePage() {
  return (
    <main className="container">
      <header style={{ marginBottom: "2.5rem", borderBottom: "1px solid #e7e5e4", paddingBottom: "2rem" }}>
        <p className="brand">GREFA · Majadahonda</p>
        <h1 className="h1">Panel de administración</h1>
        <p className="muted" style={{ maxWidth: "40rem" }}>
          Gestión, asignación, revisión y liquidación de tareas/gastos. Sincronizado en tiempo real
          con la app móvil vía Cloud Firestore.
        </p>
        <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.75rem" }}>
          <a href="/login/" className="btn btn-primary">
            Iniciar sesión
          </a>
          <a href="/personal/" className="btn btn-secondary">
            Ir a Personal
          </a>
        </div>
      </header>

      <section className="grid grid-2">
        {modules.map((m) => (
          <a key={m.href} href={m.href} className="card">
            <h2 className="h2">{m.title}</h2>
            <p className="small muted">{m.desc}</p>
          </a>
        ))}
      </section>
    </main>
  );
}
