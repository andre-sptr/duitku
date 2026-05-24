import React from "react";
import { TouchableOpacity, StyleSheet, View } from "react-native";
import { Plus } from "lucide-react-native";
import { colors, shadow } from "@/src/lib/theme";

type Props = {
  onPress: () => void;
  testID?: string;
  icon?: React.ReactNode;
};

export function FAB({ onPress, testID = "fab-add", icon }: Props) {
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={styles.btn}
        testID={testID}
      >
        {icon || <Plus size={28} color={colors.textPrimary} strokeWidth={2.5} />}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    right: 20,
    bottom: 24,
  },
  btn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.fab,
  },
});
