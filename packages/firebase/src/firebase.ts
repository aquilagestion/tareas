import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, initializeAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

export type FirebaseClientConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

function isReactNative(): boolean {
  return typeof navigator !== "undefined" && navigator.product === "ReactNative";
}

/**
 * Acceso ESTÁTICO a process.env (Metro/Expo solo inlinea referencias estáticas).
 * process.env[name] dinámico queda vacío en APK → crash / pantalla blanca.
 */
function readStaticEnv(): Partial<FirebaseClientConfig> {
  return {
    apiKey:
      process.env.EXPO_PUBLIC_FIREBASE_API_KEY ||
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
      undefined,
    authDomain:
      process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ||
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
      undefined,
    projectId:
      process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
      undefined,
    storageBucket:
      process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ||
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
      undefined,
    messagingSenderId:
      process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
      undefined,
    appId:
      process.env.EXPO_PUBLIC_FIREBASE_APP_ID ||
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||
      undefined,
  };
}

/** require oculto a webpack/Metro (módulos solo existen en RN). */
function tryRequire(moduleId: string): unknown {
  try {
    // eslint-disable-next-line no-new-func, @typescript-eslint/no-implied-eval
    return Function("id", "return require(id)")(moduleId);
  } catch {
    return null;
  }
}

function readExtraConfig(): Partial<FirebaseClientConfig> {
  try {
    const mod = tryRequire("expo-constants") as
      | { default?: { expoConfig?: { extra?: { firebase?: Partial<FirebaseClientConfig> } }; manifest?: { extra?: { firebase?: Partial<FirebaseClientConfig> } }; manifest2?: { extra?: { firebase?: Partial<FirebaseClientConfig> } } } }
      | null;
    if (!mod) return {};
    const Constants = (mod as { default?: unknown }).default ?? mod;
    const c = Constants as {
      expoConfig?: { extra?: { firebase?: Partial<FirebaseClientConfig> } };
      manifest?: { extra?: { firebase?: Partial<FirebaseClientConfig> } };
      manifest2?: { extra?: { firebase?: Partial<FirebaseClientConfig> } };
    };
    const extra = c.expoConfig?.extra ?? c.manifest?.extra ?? c.manifest2?.extra ?? {};
    return extra.firebase ?? {};
  } catch {
    return {};
  }
}

export function resolveFirebaseConfig(
  overrides?: Partial<FirebaseClientConfig>
): FirebaseClientConfig {
  const fromEnv = readStaticEnv();
  const fromExtra = readExtraConfig();

  const cfg: FirebaseClientConfig = {
    apiKey: overrides?.apiKey || fromEnv.apiKey || fromExtra.apiKey || "",
    authDomain: overrides?.authDomain || fromEnv.authDomain || fromExtra.authDomain || "",
    projectId: overrides?.projectId || fromEnv.projectId || fromExtra.projectId || "",
    storageBucket:
      overrides?.storageBucket || fromEnv.storageBucket || fromExtra.storageBucket || "",
    messagingSenderId:
      overrides?.messagingSenderId ||
      fromEnv.messagingSenderId ||
      fromExtra.messagingSenderId ||
      "",
    appId: overrides?.appId || fromEnv.appId || fromExtra.appId || "",
  };

  const missing = Object.entries(cfg)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length) {
    throw new Error(
      `Faltan variables Firebase: ${missing.join(", ")}. Revisa apps/mobile/.env y regenera la APK.`
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
  const app = getFirebaseApp(overrides);

  if (isReactNative()) {
    try {
      const asMod = tryRequire("@react-native-async-storage/async-storage") as
        | { default?: unknown }
        | null;
      const AsyncStorage = asMod?.default ?? asMod;
      const authMod = tryRequire("firebase/auth") as {
        getReactNativePersistence?: (storage: unknown) => never;
      } | null;
      if (AsyncStorage && authMod?.getReactNativePersistence) {
        authInstance = initializeAuth(app, {
          persistence: authMod.getReactNativePersistence(AsyncStorage),
        });
      } else {
        authInstance = getAuth(app);
      }
    } catch {
      authInstance = getAuth(app);
    }
  } else {
    authInstance = getAuth(app);
  }

  return authInstance;
}

export function getDb(overrides?: Partial<FirebaseClientConfig>): Firestore {
  if (dbInstance) return dbInstance;
  dbInstance = getFirestore(getFirebaseApp(overrides));
  return dbInstance;
}

let secondaryApp: FirebaseApp | null = null;

/**
 * App aparte para dar de alta usuarios sin tocar la sesión del administrador:
 * `createUserWithEmailAndPassword` deja autenticado al usuario recién creado,
 * así que se hace sobre esta instancia y luego se cierra su sesión.
 */
export function getSecondaryAuth(overrides?: Partial<FirebaseClientConfig>): Auth {
  if (!secondaryApp) {
    secondaryApp = initializeApp(resolveFirebaseConfig(overrides), "Secondary");
  }
  return getAuth(secondaryApp);
}

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
