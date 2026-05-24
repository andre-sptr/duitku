import React, { useEffect, useRef } from "react";
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, Animated,
  Pressable, ScrollView, Dimensions, Platform, StatusBar,
} from "react-native";
import { useRouter, usePathname } from "expo-router";
import {
  Home, Wallet, BarChart3, FolderTree, Settings, X, Share2, Star, Mail,
  Repeat, BellRing,
} from "lucide-react-native";
import { colors, spacing, radius, fontSizes } from "@/src/lib/theme";

const { width } = Dimensions.get("window");
const DRAWER_WIDTH = Math.min(width * 0.8, 320);

type Props = {
  visible: boolean;
  onClose: () => void;
  totalBalance?: number;
};

type NavItem = {
  label: string;
  icon: any;
  route: string;
  testID: string;
};

const ITEMS: NavItem[] = [
  { label: "Beranda", icon: Home, route: "/", testID: "drawer-beranda" },
  { label: "Rekening", icon: Wallet, route: "/rekening", testID: "drawer-rekening" },
  { label: "Bagan", icon: BarChart3, route: "/bagan", testID: "drawer-bagan" },
  { label: "Kategori", icon: FolderTree, route: "/kategori", testID: "drawer-kategori" },
  { label: "Pembayaran Reguler", icon: Repeat, route: "/pembayaran-reguler", testID: "drawer-recurring" },
  { label: "Pengingat", icon: BellRing, route: "/pengingat", testID: "drawer-reminders" },
  { label: "Pengaturan", icon: Settings, route: "/pengaturan", testID: "drawer-pengaturan" },
];

export function SideDrawer({ visible, onClose }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const slide = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slide, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slide, { toValue: -DRAWER_WIDTH, duration: 200, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, slide, fade]);

  const navigate = (route: string) => {
    onClose();
    setTimeout(() => router.push(route as any), 200);
  };

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: fade }]}>
        <Pressable style={styles.backdropPress} onPress={onClose} testID="drawer-backdrop" />
      </Animated.View>
      <Animated.View style={[styles.drawer, { transform: [{ translateX: slide }] }]}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>D</Text>
          </View>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={styles.userName}>DuitKu</Text>
            <Text style={styles.userMail}>Pelacak keuangan pribadi</Text>
          </View>
          <TouchableOpacity onPress={onClose} testID="drawer-close" hitSlop={10}>
            <X size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ paddingVertical: spacing.sm }}>
          {ITEMS.map((it) => {
            const active = pathname === it.route || (it.route !== "/" && pathname.startsWith(it.route));
            const IconCmp = it.icon;
            return (
              <TouchableOpacity
                key={it.route}
                style={[styles.item, active && styles.itemActive]}
                onPress={() => navigate(it.route)}
                testID={it.testID}
              >
                <IconCmp size={22} color={active ? colors.primary : colors.textPrimary} />
                <Text style={[styles.itemLabel, active && styles.itemLabelActive]}>{it.label}</Text>
              </TouchableOpacity>
            );
          })}

          <View style={styles.divider} />

          <TouchableOpacity style={styles.item} testID="drawer-share" onPress={onClose}>
            <Share2 size={22} color={colors.textPrimary} />
            <Text style={styles.itemLabel}>Bagikan dengan teman</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.item} testID="drawer-rate" onPress={onClose}>
            <Star size={22} color={colors.textPrimary} />
            <Text style={styles.itemLabel}>Beri nilai aplikasi</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.item} testID="drawer-support" onPress={onClose}>
            <Mail size={22} color={colors.textPrimary} />
            <Text style={styles.itemLabel}>Hubungi tim dukungan</Text>
          </TouchableOpacity>
        </ScrollView>

        <Text style={styles.footer}>v1.0.0 • DuitKu</Text>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  backdropPress: { flex: 1 },
  drawer: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: colors.background,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight || 0 : 0,
  },
  header: {
    backgroundColor: colors.primary,
    paddingTop: spacing.lg + (Platform.OS === "ios" ? 20 : 0),
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    borderBottomRightRadius: radius.lg,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  userName: {
    color: "#FFFFFF",
    fontSize: fontSizes.h3,
    fontWeight: "600",
  },
  userMail: {
    color: "rgba(255,255,255,0.85)",
    fontSize: fontSizes.small,
    marginTop: 2,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    gap: spacing.md,
  },
  itemActive: {
    backgroundColor: colors.primarySoft,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  itemLabel: {
    fontSize: fontSizes.bodyLarge,
    color: colors.textPrimary,
    fontWeight: "500",
  },
  itemLabelActive: {
    color: colors.primary,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
    marginHorizontal: spacing.md,
  },
  footer: {
    textAlign: "center",
    color: colors.textMuted,
    fontSize: fontSizes.small,
    paddingVertical: spacing.md,
  },
});
