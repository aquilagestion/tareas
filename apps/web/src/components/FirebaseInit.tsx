"use client";

import { useEffect } from "react";
import { getFirebaseApp } from "@grefa/firebase";
import { FIREBASE_CONFIG } from "../lib/firebaseConfig";

/** Inicializa Firebase una vez en el cliente (export estático). */
export function FirebaseInit() {
  useEffect(() => {
    try {
      getFirebaseApp(FIREBASE_CONFIG);
    } catch (e) {
      console.error("Firebase init", e);
    }
  }, []);
  return null;
}
