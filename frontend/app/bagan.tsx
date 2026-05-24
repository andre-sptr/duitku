import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";

import { Header } from "@/src/components/Header";
import { SideDrawer } from "@/src/components/SideDrawer";
import { BarChart } from "@/src/components/BarChart";
import { Stats, BarEntry } from "@/src/lib/api";
import { colors, fontSizes, radius, shadow, spacing } from "@/src/lib/theme";
import { formatRp } from "@/src/lib/format";

type Granularity = "year" | "month" | "week";

const TABS = [
  { value: "umum", label: "UMUM" },
  { value: "expense", label: "PENGELUARAN" },
  { value: "income", label: "PEMASUKAN" },
] as const;

const GRANS: { value: Granularity; label: string }[] = [
  { value: "year", label: "Tahun" },
  { value: "month", label: "Bulan" },
  { value: "week", label: "Minggu" },
];

export default function Bagan() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mode, setMode] = useState<"umum" | "expense" | "income">("umum");
  const [gran, setGran] = useState<Granularity>("month");
  const [bars, setBars] = useState<BarEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await Stats.bars({ granularity: gran });
      setBars(data.bars.slice(-12));
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  }, [gran]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const totals = useMemo(() => {
    return bars.reduce(
      (acc, b) => ({
        income: acc.income + b.income,
        expense: acc.expense + b.expense,
      }),
      { income: 0, expense: 0 }
    );
  }, [bars]);

  return (
    <View style={styles.container}>
      <SafeAreaView edges={["top"]} style={styles.safeTop}>
        <Header
          title="Bagan"
          subtitle="Analisis keuangan"
          onMenu={() => setDrawerOpen(true)}
          testID="header-bagan"
        />
        <View style={styles.tabs}>
          {TABS.map((t) => (
            <TouchableOpacity
              key={t.value}
              style={[styles.tabBtn, mode === t.value && styles.tabBtnActive]}
              onPress={() => setMode(t.value)}
              testID={`bagan-tab-${t.value}`}
            >
              <Text style={[styles.tabLabel, mode === t.value && styles.tabLabelActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>

      <View style={styles.granRow}>
        {GRANS.map((g) => (
          <TouchableOpacity
            key={g.value}
            style={[styles.granBtn, gran === g.value && styles.granBtnActive]}
            onPress={() => setGran(g.value)}
            testID={`bagan-gran-${g.value}`}
          >
            <Text style={[styles.granLabel, gran === g.value && styles.granLabelActive]}>
              berdasar {g.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.statsCard}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Total Pemasukan</Text>
            <Text style={[styles.statValue, { color: colors.success }]}>{formatRp(totals.income)}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Total Pengeluaran</Text>
            <Text style={[styles.statValue, { color: colors.expense }]}>{formatRp(totals.expense)}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Laba/Rugi</Text>
            <Text
              style={[
                styles.statValue,
                { color: totals.income - totals.expense >= 0 ? colors.info : colors.warning },
              ]}
            >
              {formatRp(totals.income - totals.expense)}
            </Text>
          </View>
        </View>

        <View style={styles.chartCard}>
          {loading ? (
            <View style={{ padding: spacing.xl, alignItems: "center" }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <BarChart data={bars} mode={mode} />
          )}
        </View>
      </ScrollView>

      <SideDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  safeTop: { backgroundColor: colors.primary },
  tabs: {
    flexDirection: "row",
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
  },
  tabBtnActive: { backgroundColor: "#FFFFFF" },
  tabLabel: { fontSize: fontSizes.small, fontWeight: "600", color: "rgba(255,255,255,0.9)", letterSpacing: 0.5 },
  tabLabelActive: { color: colors.primary },
  granRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  granBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  granBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  granLabel: { fontSize: fontSizes.small, color: colors.textPrimary, fontWeight: "500" },
  granLabelActive: { color: "#FFFFFF" },
  scroll: { padding: spacing.md, paddingBottom: 40 },
  statsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadow.card,
  },
  stat: { paddingVertical: spacing.sm },
  statLabel: { fontSize: fontSizes.small, color: colors.textSecondary },
  statValue: { fontSize: fontSizes.h3, fontWeight: "700", marginTop: 4 },
  statDivider: { height: 1, backgroundColor: colors.borderLight },
  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadow.card,
  },
});
