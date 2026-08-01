/** Comprueba si hay versión nueva en el servidor y recarga la web automáticamente. */
export function startVersionWatch(currentVersion, options = {}) {
  const intervalMs = options.intervalMs ?? 5 * 60 * 1000;
  let checking = false;

  function showUpdatingBanner(remoteVersion) {
    if (document.getElementById("grefa-version-update")) return;
    const el = document.createElement("div");
    el.id = "grefa-version-update";
    el.setAttribute("role", "status");
    el.textContent = `Nueva versión (${remoteVersion}). Actualizando…`;
    Object.assign(el.style, {
      position: "fixed",
      bottom: "1rem",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: "99999",
      background: "#2F6B3A",
      color: "#fff",
      padding: "0.65rem 1.25rem",
      borderRadius: "8px",
      fontSize: "0.9rem",
      fontWeight: "600",
      boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
    });
    document.body.appendChild(el);
  }

  async function check() {
    if (checking) return;
    checking = true;
    try {
      const mod = await import(`./version.js?t=${Date.now()}`);
      const remote = mod.APP_VERSION;
      if (remote && remote !== currentVersion) {
        showUpdatingBanner(remote);
        window.setTimeout(() => window.location.reload(), 600);
      }
    } catch {
      /* sin red o error puntual */
    } finally {
      checking = false;
    }
  }

  void check();
  window.setInterval(check, intervalMs);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void check();
  });
  window.addEventListener("focus", () => void check());
}
