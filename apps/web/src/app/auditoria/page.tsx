export default function AuditoriaPage() {
  return (
    <main className="container" style={{ maxWidth: "72rem" }}>
      <a href="/" className="small muted">
        ← Inicio
      </a>
      <h1 className="h1" style={{ fontSize: "1.875rem", marginTop: "0.5rem" }}>
        Auditoría diaria
      </h1>
      <p className="muted">Histórico con textos legales e importes.</p>
      <div className="card" style={{ marginTop: "2rem" }}>
        <p className="muted" style={{ margin: 0 }}>
          El histórico de liquidación se activará en el siguiente deploy con listeners Firestore.
        </p>
      </div>
    </main>
  );
}
