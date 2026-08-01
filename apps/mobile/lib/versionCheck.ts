import { APP_VERSION } from "../constants/version";

const VERSION_URL = "https://grefa-tareas.web.app/js/version.js";

function parseVersion(v: string): number[] {
  return v.trim().split(".").map((n) => parseInt(n, 10) || 0);
}

export function isNewerVersion(remote: string, local: string): boolean {
  const r = parseVersion(remote);
  const l = parseVersion(local);
  const len = Math.max(r.length, l.length);
  for (let i = 0; i < len; i++) {
    const a = r[i] ?? 0;
    const b = l[i] ?? 0;
    if (a > b) return true;
    if (a < b) return false;
  }
  return false;
}

function parseVersionJs(text: string): { version: string | null; apkUrl: string | null } {
  const versionMatch = text.match(/APP_VERSION\s*=\s*["']([^"']+)["']/);
  const driveIdMatch = text.match(/APK_DRIVE_FILE_ID\s*=\s*["']([^"']*)["']/);
  const driveId = driveIdMatch?.[1]?.trim();
  if (driveId) {
    return {
      version: versionMatch?.[1]?.trim() ?? null,
      apkUrl: `https://drive.google.com/uc?export=download&id=${driveId}&confirm=t`,
    };
  }
  const urlMatch = text.match(/APK_DOWNLOAD_URL\s*=\s*["']([^"']+)["']/);
  return {
    version: versionMatch?.[1]?.trim() ?? null,
    apkUrl: urlMatch?.[1]?.trim() || null,
  };
}

export async function fetchRemoteRelease(): Promise<{ version: string | null; apkUrl: string | null }> {
  const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, {
    cache: "no-store",
    headers: { Accept: "text/javascript, text/plain, */*" },
  });
  if (!res.ok) return { version: null, apkUrl: null };
  const text = await res.text();
  return parseVersionJs(text);
}

export async function checkForAppUpdate(): Promise<{
  available: boolean;
  remoteVersion?: string;
  localVersion: string;
  apkUrl?: string;
}> {
  try {
    const { version: remoteVersion, apkUrl } = await fetchRemoteRelease();
    if (!remoteVersion || !isNewerVersion(remoteVersion, APP_VERSION)) {
      return { available: false, localVersion: APP_VERSION };
    }
    return { available: true, remoteVersion, localVersion: APP_VERSION, apkUrl: apkUrl ?? undefined };
  } catch {
    return { available: false, localVersion: APP_VERSION };
  }
}
