/** Avisos email vía Google Apps Script (alineado con web). */
export const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbzUDKoSuJXYQyw_XDx0y8FiWNyvbd4OA-IYZu5HUf2DJHGuatNVEQeMqMpg7vsuMOo3fw/exec";

/**
 * Clave compartida con el script de correo. No va escrita en el código: se lee
 * de apps/mobile/.env, que no se sube a git, porque con ella cualquiera podría
 * enviar correos por ese endpoint.
 *
 * La referencia a process.env tiene que ser estática: Metro solo sustituye así.
 */
export const NOTIFY_SECRET = process.env.EXPO_PUBLIC_NOTIFY_SECRET ?? "";

/** Falla con un mensaje claro si la APK se compiló sin la clave. */
export function requireNotifySecret(): string {
  if (!NOTIFY_SECRET) {
    throw new Error(
      "Falta EXPO_PUBLIC_NOTIFY_SECRET en apps/mobile/.env: esta APK se compiló sin la clave del correo."
    );
  }
  return NOTIFY_SECRET;
}
