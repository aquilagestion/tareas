import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

export type FirebaseClientConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

function readEnv(name: string): string | undefined {
  // Compatible con Next (NEXT_PUBLIC_*) y Expo (EXPO_PUBLIC_*)
  if (typeof process === "undefined" || !process.env) return undefined;
  return process.env[name] || undefined;
}

export function resolveFirebaseConfig(
  overrides?: Partial<FirebaseClientConfig>
): FirebaseClientConfig {
  const cfg: FirebaseClientConfig = {
    apiKey:
      overrides?.apiKey ||
      readEnv("NEXT_PUBLIC_FIREBASE_API_KEY") ||
      readEnv("EXPO_PUBLIC_FIREBASE_API_KEY") ||
      "",
    authDomain:
      overrides?.authDomain ||
      readEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN") ||
      readEnv("EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN") ||
      "",
    projectId:
      overrides?.projectId ||
      readEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID") ||
      readEnv("EXPO_PUBLIC_FIREBASE_PROJECT_ID") ||
      "",
    storageBucket:
      overrides?.storageBucket ||
      readEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET") ||
      readEnv("EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET") ||
      "",
    messagingSenderId:
      overrides?.messagingSenderId ||
      readEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID") ||
      readEnv("EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID") ||
      "",
    appId:
      overrides?.appId ||
      readEnv("NEXT_PUBLIC_FIREBASE_APP_ID") ||
      readEnv("EXPO_PUBLIC_FIREBASE_APP_ID") ||
      "",
  };

  const missing = Object.entries(cfg)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length) {
    throw new Error(
      `Faltan variables Firebase: ${missing.join(", ")}. Revisa .env.local / .env`
    );
  }

  return cfg;
}

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

export function getFirebaseApp(overrides?: Partial<FirebaseClientConfig>): FirebaseApp {
  if (appInstance) return appInstance;
  const config = resolveFirebaseConfig(overrides);
  appInstance = getApps().length ? getApp() : initializeApp(config);
  return appInstance;
}

export function getFirebaseAuth(overrides?: Partial<FirebaseClientConfig>): Auth {
  if (authInstance) return authInstance;
  authInstance = getAuth(getFirebaseApp(overrides));
  return authInstance;
}

export function getDb(overrides?: Partial<FirebaseClientConfig>): Firestore {
  if (dbInstance) return dbInstance;
  dbInstance = getFirestore(getFirebaseApp(overrides));
  return dbInstance;
}

/** Atajos lazy (se inicializan al primer uso) */
export const auth = new Proxy({} as Auth, {
  get(_t, prop, receiver) {
    return Reflect.get(getFirebaseAuth() as object, prop, receiver);
  },
});

export const db = new Proxy({} as Firestore, {
  get(_t, prop, receiver) {
    return Reflect.get(getDb() as object, prop, receiver);
  },
});
