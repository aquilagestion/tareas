import { Platform, Linking, Alert } from "react-native";
import * as FileSystem from "expo-file-system";
import { startActivityAsync } from "expo-intent-launcher";

/** Descarga la APK publicada en la web e inicia el instalador de Android. */
export async function installLatestApk(url: string): Promise<void> {
  if (Platform.OS !== "android") {
    Alert.alert("Actualización", "La actualización automática solo está disponible en Android.");
    return;
  }

  const downloadUrl = url.includes("drive.google.com")
    ? `${url.split("&confirm=")[0]}&confirm=t&t=${Date.now()}`
    : `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`;
  const dest = `${FileSystem.cacheDirectory ?? ""}grefa-tareas-update.apk`;

  try {
    const { uri } = await FileSystem.downloadAsync(downloadUrl, dest);
    const contentUri = await FileSystem.getContentUriAsync(uri);
    await startActivityAsync("android.intent.action.VIEW", {
      data: contentUri,
      flags: 1,
      type: "application/vnd.android.package-archive",
    });
  } catch {
    try {
      await Linking.openURL(downloadUrl);
      Alert.alert(
        "Descarga iniciada",
        "Cuando termine la descarga, abre el archivo APK desde las notificaciones para instalar."
      );
    } catch {
      Alert.alert("Error", "No se pudo iniciar la descarga. Comprueba tu conexión e inténtalo de nuevo.");
    }
  }
}
