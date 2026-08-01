import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { router } from "expo-router";
import { getFirebaseAuth, subscribeUser } from "@grefa/firebase";
import type { User } from "@grefa/shared";
import { MenuScreen } from "../components/MenuScreen";
import { WORKER_MENU_ITEMS } from "../constants/menuItems";

export default function WorkerHomeScreen() {
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
        if (p?.role === "ADMIN") router.replace("/admin");
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
      roleLabel="Trabajador / voluntario"
      items={WORKER_MENU_ITEMS}
      ready={ready}
    />
  );
}
