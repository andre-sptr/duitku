import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar } from "react-native";
import { Menu } from "lucide-react-native";
import { colors, fontSizes, spacing, radius } from "@/src/lib/theme";

type Props = {
  title: string;
  onMenu?: () => void;
  right?: React.ReactNode;
  subtitle?: string;
  testID?: string;
};

export function Header({ title, onMenu, right, subtitle, testID }: Props) {
  return (
    <View style={styles.wrapper} testID={testID}>
      <View style={styles.row}>
        <TouchableOpacity
          onPress={onMenu}
          style={styles.iconBtn}
          testID="header-menu-button"
          accessibilityRole="button"
        >
          <Menu size={26} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        <View style={styles.right}>{right}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.primary,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    paddingTop: (Platform.OS === "android" ? StatusBar.currentHeight || 0 : 48) + spacing.sm,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  titleWrap: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  title: {
    color: "#FFFFFF",
    fontSize: fontSizes.h2,
    fontWeight: "600",
  },
  subtitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: fontSizes.small,
    marginTop: 2,
  },
  right: {
    minWidth: 44,
    alignItems: "flex-end",
  },
});
