import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, type Href } from "expo-router";
import { signOut } from "firebase/auth";
import type { User } from "@grefa/shared";
import { USER_TYPE_LABELS } from "@grefa/shared";
import { getFirebaseAuth } from "@grefa/firebase";
import { APP_VERSION } from "../constants/version";
import type { MenuItemDef } from "../constants/menuItems";

const COLUMNS = 4;
const H_PADDING = 14;
const GAP = 8;

interface MenuScreenProps {
  profile: User | null;
  roleLabel: string;
  items: MenuItemDef[];
  ready: boolean;
}

export function MenuScreen({ profile, roleLabel, items, ready }: MenuScreenProps) {
  const { width } = useWindowDimensions();

  async function onItemPress(item: MenuItemDef) {
    if (item.route === "__logout__") {
      await signOut(getFirebaseAuth());
      router.replace("/login");
      return;
    }
    router.push(item.route as Href);
  }

  if (!ready) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <View style={styles.center}>
          <ActivityIndicator color="#2F6B3A" size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const typeLabel =
    profile?.role === "WORKER" && profile.userType
      ? USER_TYPE_LABELS[profile.userType]
      : null;

  const tileWidth = Math.floor(
    (width - H_PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS
  );
  // En pantallas estrechas la descripción no cabe en la celda: solo el título.
  const compact = tileWidth < 112;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.brand}>GREFA Tareas</Text>
        <Text style={styles.hello} numberOfLines={1}>
          Hola, {profile?.fullName ?? "…"}
        </Text>
        <Text style={styles.role} numberOfLines={1}>
          {typeLabel ? `${roleLabel} · ${typeLabel}` : roleLabel}
        </Text>

        <View style={styles.menu}>
          {items.map((item) => (
            <Pressable
              key={item.route}
              style={({ pressed }) => [
                styles.menuBtn,
                { width: tileWidth, minHeight: compact ? 76 : 96 },
                item.primary && styles.menuBtnPrimary,
                item.route === "__logout__" && styles.menuBtnLogout,
                pressed && styles.menuBtnPressed,
              ]}
              onPress={() => void onItemPress(item)}
            >
              <Text
                style={[
                  styles.menuTitle,
                  compact && styles.menuTitleCompact,
                  item.primary && styles.menuTitlePrimary,
                  item.route === "__logout__" && styles.menuTitleLogout,
                ]}
                numberOfLines={compact ? 3 : 2}
              >
                {item.title}
              </Text>
              {compact ? null : (
                <Text
                  style={[
                    styles.menuDesc,
                    item.primary && styles.menuDescPrimary,
                    item.route === "__logout__" && styles.menuDescLogout,
                  ]}
                  numberOfLines={3}
                >
                  {item.description}
                </Text>
              )}
            </Pressable>
          ))}
        </View>

        <Text style={styles.version}>Versión {APP_VERSION}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F1E8" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: H_PADDING, paddingTop: 6, paddingBottom: 16 },
  brand: {
    fontSize: 12,
    fontWeight: "800",
    color: "#2F6B3A",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  hello: { fontSize: 19, fontWeight: "800", color: "#1C1917" },
  role: { fontSize: 13, color: "#57534E", marginTop: 2, fontWeight: "600" },
  menu: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GAP,
    marginTop: 12,
  },
  menuBtn: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "#E7E5E4",
    justifyContent: "center",
  },
  menuBtnPrimary: {
    backgroundColor: "#2F6B3A",
    borderColor: "#2F6B3A",
  },
  menuBtnLogout: {
    backgroundColor: "#fff",
    borderColor: "#D6D3D1",
  },
  menuBtnPressed: { opacity: 0.88 },
  menuTitle: { fontSize: 14, fontWeight: "800", color: "#1C1917" },
  menuTitleCompact: { fontSize: 12, textAlign: "center" },
  menuTitlePrimary: { color: "#fff" },
  menuTitleLogout: { color: "#57534E" },
  menuDesc: { marginTop: 4, fontSize: 11, color: "#78716C", lineHeight: 14 },
  menuDescPrimary: { color: "rgba(255,255,255,0.88)" },
  menuDescLogout: { color: "#A8A29E" },
  version: { textAlign: "center", color: "#A8A29E", fontSize: 11, marginTop: 14 },
});
