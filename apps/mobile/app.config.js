/**
 * Inyecta Firebase en `extra` (respaldo del APK).
 * Expo carga automáticamente apps/mobile/.env al evaluar este archivo.
 */
const appJson = require("./app.json");

module.exports = {
  ...appJson.expo,
  extra: {
    ...(appJson.expo.extra || {}),
    router: { origin: false },
    firebase: {
      apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "",
      authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
      projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "",
      storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
      messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
      appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "",
    },
  },
};
