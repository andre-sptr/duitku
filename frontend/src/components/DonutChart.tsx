import React from "react";
import { View, StyleSheet, Text } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import { colors, fontSizes } from "@/src/lib/theme";
import { formatRp } from "@/src/lib/format";

type Segment = { value: number; color: string };

type Props = {
  segments: Segment[];
  total: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
};

export function DonutChart({ segments, total, size = 200, strokeWidth = 28, label }: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;

  const sum = segments.reduce((a, b) => a + b.value, 0);
  let offset = 0;

  const arcs = sum > 0
    ? segments.map((seg, i) => {
        const portion = seg.value / sum;
        const length = portion * circumference;
        const node = (
          <Circle
            key={i}
            cx={cx}
            cy={cy}
            r={radius}
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${length} ${circumference - length}`}
            strokeDashoffset={-offset}
            fill="transparent"
            strokeLinecap="butt"
          />
        );
        offset += length;
        return node;
      })
    : [];

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${cx}, ${cy}`}>
          <Circle
            cx={cx}
            cy={cy}
            r={radius}
            stroke={colors.borderLight}
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {arcs}
        </G>
      </Svg>
      <View style={styles.center} pointerEvents="none">
        {label ? <Text style={styles.label}>{label}</Text> : null}
        <Text style={styles.total} numberOfLines={1} adjustsFontSizeToFit>
          {formatRp(total)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  center: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: fontSizes.small,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  total: {
    fontSize: fontSizes.h2,
    fontWeight: "700",
    color: colors.textPrimary,
  },
});
