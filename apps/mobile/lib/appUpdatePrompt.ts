import { Alert } from "react-native";
import { checkForAppUpdate } from "./versionCheck";
import { installLatestApk } from "./apkUpdate";

/** Comprueba versión y ofrece instalar la APK publicada (sin intervención del admin). */
export async function promptAppUpdate(manual = false): Promise<void> {
  const result = await checkForAppUpdate();
  if (!result.available || !result.remoteVersion) {
    if (manual) {
      Alert.alert(
        "Sin actualizaciones",
        `Ya tienes la versión más reciente (v${result.localVersion}).`
      );
    }
    return;
  }
  if (!result.apkUrl) {
    Alert.alert(
      "Actualización disponible",
      `Hay una versión nueva (v${result.remoteVersion}) pero no hay enlace de descarga configurado.`
    );
    return;
  }

  Alert.alert(
    "Nueva versión disponible",
    `Versión ${result.remoteVersion} disponible (tienes v${result.localVersion}).\n\nPulsa «Actualizar» para descargar e instalar. Android puede pedirte permiso para instalar apps.`,
    [
      { text: "Más tarde", style: "cancel" },
      {
        text: "Actualizar",
        onPress: () => void installLatestApk(result.apkUrl!),
      },
    ]
  );
}
