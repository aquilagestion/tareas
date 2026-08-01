export default function RevisionPage() {
  return (
    <main className="container">
      <a href="/" className="small muted">
        ← Inicio
      </a>
      <h1 className="h1" style={{ fontSize: "1.875rem", marginTop: "0.5rem" }}>
        Revisión de tareas
      </h1>
      <p className="muted">Validar tareas en IN_REVIEW o devolverlas a PENDING.</p>
      <div className="card" style={{ marginTop: "2rem" }}>
        <p className="muted" style={{ margin: 0 }}>
          Panel de revisión disponible tras autenticación. Próximo deploy activará la lista en tiempo
          real.
        </p>
      </div>
    </main>
  );
}
