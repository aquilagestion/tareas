import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { router } from "expo-router";
import { getFirebaseAuth, subscribeUser } from "@grefa/firebase";
import type { User } from "@grefa/shared";
import { MenuScreen } from "../components/MenuScreen";
import { ADMIN_MENU_ITEMS } from "../constants/menuItems";

export default function AdminHomeScreen() {
  const [profile, setProfile] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let unsubUser = () => {};
    const unsubAuth = onAuthStateChanged(getFirebaseAuth(), (user) => {
      unsubUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      unsubUser = subscribeUser(user.uid, (p) => {
        setProfile(p);
        setReady(true);
        // Nunca cerrar la sesión aquí: esta pantalla puede seguir montada
        // cuando entra otra persona y expulsaría a un usuario legítimo.
        if (p && p.active && p.role !== "ADMIN") router.replace("/home");
      });
    });
    return () => {
      unsubAuth();
      unsubUser();
    };
  }, []);

  return (
    <MenuScreen
      profile={profile}
      roleLabel="Administración / responsable"
      items={ADMIN_MENU_ITEMS}
      ready={ready}
    />
  );
}
