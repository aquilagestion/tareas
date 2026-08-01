/**
 * Config Firebase web (claves públicas).
 * Evita depender solo de .env en el build de Hosting.
 */
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCnHSHVwYp0IsoRuM-mUufowmkISVvcE4o",
  authDomain: "grefa-tareas.firebaseapp.com",
  projectId: "grefa-tareas",
  storageBucket: "grefa-tareas.firebasestorage.app",
  messagingSenderId: "671980041366",
  appId: "1:671980041366:web:20e5ad3e71c58c6ae73eb7",
} as const;
