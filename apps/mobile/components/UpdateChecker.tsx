import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { checkForAppUpdate } from "../lib/versionCheck";
import { promptAppUpdate } from "../lib/appUpdatePrompt";

/** Avisa si hay APK más reciente y permite instalarla directamente. */
export function UpdateChecker() {
  const shownForVersion = useRef<string | null>(null);

  useEffect(() => {
    async function run() {
      const result = await checkForAppUpdate();
      if (!result.available || !result.remoteVersion) return;
      if (shownForVersion.current === result.remoteVersion) return;
      shownForVersion.current = result.remoteVersion;
      await promptAppUpdate(false);
    }

    void run();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void run();
    });
    const interval = setInterval(() => void run(), 15 * 60 * 1000);
    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, []);

  return null;
}
