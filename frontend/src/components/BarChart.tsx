import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { colors, spacing, fontSizes, radius } from "@/src/lib/theme";
import { formatRp } from "@/src/lib/format";

type Bar = {
  period: string;
  income: number;
  expense: number;
  profit: number;
};

type Props = {
  data: Bar[];
  mode: "umum" | "expense" | "income";
};

export function BarChart({ data, mode }: Props) {
  const maxValue = Math.max(
    1,
    ...data.flatMap((d) => [d.income, d.expense, Math.abs(d.profit)])
  );
  const chartHeight = 180;

  if (data.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Belum ada data untuk ditampilkan</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {data.map((b, i) => {
          const incomeH = (b.income / maxValue) * chartHeight;
          const expenseH = (b.expense / maxValue) * chartHeight;
          const profitH = (Math.abs(b.profit) / maxValue) * chartHeight;
          const profitColor = b.profit >= 0 ? colors.info : colors.warning;

          return (
            <View key={i} style={styles.group}>
              <View style={[styles.barsWrap, { height: chartHeight }]}>
                {(mode === "umum" || mode === "income") && (
                  <View style={[styles.bar, { height: incomeH || 1, backgroundColor: colors.success }]}>
                    {b.income > 0 && (
                      <Text style={styles.barLabel} numberOfLines={1}>{formatRp(b.income, false)}</Text>
                    )}
                  </View>
                )}
                {(mode === "umum" || mode === "expense") && (
                  <View style={[styles.bar, { height: expenseH || 1, backgroundColor: colors.accent }]}>
                    {b.expense > 0 && (
                      <Text style={styles.barLabel} numberOfLines={1}>{formatRp(b.expense, false)}</Text>
                    )}
                  </View>
                )}
                {mode === "umum" && (
                  <View style={[styles.bar, { height: profitH || 1, backgroundColor: profitColor }]}>
                    {Math.abs(b.profit) > 0 && (
                      <Text style={styles.barLabel} numberOfLines={1}>{formatRp(b.profit, false)}</Text>
                    )}
                  </View>
                )}
              </View>
              <Text style={styles.period} numberOfLines={1}>{b.period}</Text>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.legend}>
        {(mode === "umum" || mode === "income") && (
          <Legend color={colors.success} label="Pemasukan" />
        )}
        {(mode === "umum" || mode === "expense") && (
          <Legend color={colors.accent} label="Pengeluaran" />
        )}
        {mode === "umum" && <Legend color={colors.info} label="Laba" />}
        {mode === "umum" && <Legend color={colors.warning} label="Rugi" />}
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: spacing.md },
  scroll: { paddingHorizontal: spacing.md, alignItems: "flex-end" },
  group: {
    marginRight: spacing.md,
    alignItems: "center",
  },
  barsWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
  },
  bar: {
    width: 18,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    minHeight: 2,
    justifyContent: "flex-start",
    overflow: "hidden",
  },
  barLabel: {
    position: "absolute",
    top: -16,
    fontSize: 9,
    color: colors.textSecondary,
    width: 50,
    left: -16,
    textAlign: "center",
  },
  period: {
    marginTop: spacing.sm,
    fontSize: fontSizes.small,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.md,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: fontSizes.small, color: colors.textPrimary },
  empty: {
    padding: spacing.xl,
    alignItems: "center",
  },
  emptyText: { color: colors.textSecondary, fontSize: fontSizes.body },
});
