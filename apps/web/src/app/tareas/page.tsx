export default function TareasPage() {
  return (
    <main className="container">
      <a href="/" className="small muted">
        ← Inicio
      </a>
      <h1 className="h1" style={{ fontSize: "1.875rem", marginTop: "0.5rem" }}>
        Asignación de Tareas
      </h1>
      <p className="muted">Crear y asignar tareas a trabajadores y voluntarios.</p>
      <div className="card" style={{ marginTop: "2rem" }}>
        <p className="muted" style={{ margin: 0 }}>
          Módulo en despliegue. Usa la app móvil o vuelve tras el siguiente deploy con formularios
          completos.
        </p>
        <p style={{ marginTop: "1rem" }}>
          <a href="/login/" className="btn btn-primary">
            Iniciar sesión
          </a>
        </p>
      </div>
    </main>
  );
}
