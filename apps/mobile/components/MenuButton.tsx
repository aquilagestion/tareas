import { useEffect, useState } from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { router } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { getFirebaseAuth, subscribeUser } from "@grefa/firebase";
import type { User } from "@grefa/shared";

export function HeaderMenuButton() {
  const [profile, setProfile] = useState<User | null>(null);

  useEffect(() => {
    let unsubUser = () => {};
    const unsubAuth = onAuthStateChanged(getFirebaseAuth(), (user) => {
      unsubUser();
      if (!user) return;
      unsubUser = subscribeUser(user.uid, setProfile);
    });
    return () => {
      unsubAuth();
      unsubUser();
    };
  }, []);

  function goMenu() {
    const dest = profile?.role === "ADMIN" ? "/admin" : "/home";
    router.replace(dest);
  }

  return (
    <Pressable onPress={goMenu} style={styles.btn} hitSlop={12}>
      <Text style={styles.text}>Menú</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { marginRight: 4, paddingHorizontal: 8, paddingVertical: 6 },
  text: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
