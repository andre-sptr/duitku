import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { ChevronLeft, ChevronRight, ChevronsRight, Inbox } from "lucide-react-native";

import { Header } from "@/src/components/Header";
import { FAB } from "@/src/components/FAB";
import { SideDrawer } from "@/src/components/SideDrawer";
import { DonutChart } from "@/src/components/DonutChart";
import { Icon } from "@/src/lib/icons";
import { Stats, Summary, SummaryEntry, Recurring } from "@/src/lib/api";
import { colors, fontSizes, radius, shadow, spacing } from "@/src/lib/theme";
import { formatRp, getPeriodRange, Period, shiftPeriod, toIsoDate } from "@/src/lib/format";

const PERIODS: { value: Period; label: string }[] = [
  { value: "day", label: "Hari" },
  { value: "week", label: "Minggu" },
  { value: "month", label: "Bulan" },
  { value: "year", label: "Tahun" },
];

export default function Beranda() {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [type, setType] = useState<"expense" | "income">("expense");
  const [period, setPeriod] = useState<Period>("month");
  const [refDate, setRefDate] = useState<Date>(new Date());
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const range = useMemo(() => getPeriodRange(period, refDate), [period, refDate]);

  const todayIso = toIsoDate(new Date());
  // Tombol "maju" dimatikan kalau periode yang tampil sudah mencakup hari ini,
  // karena periode berikutnya belum waktunya (masih di masa depan).
  const atFutureEdge = range.end >= todayIso;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Auto-create due recurring transactions on each focus
      try { await Recurring.process(); } catch {}
      const data = await Stats.summary({ type, start: range.start, end: range.end });
      setSummary(data);
    } catch (e) {
      console.warn("Failed to load summary", e);
    } finally {
      setLoading(false);
    }
  }, [type, range.start, range.end]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const breakdown = summary?.breakdown || [];
  const total = summary?.total || 0;
  const segments = breakdown.map((b) => ({ value: b.amount, color: b.categoryColor }));

  return (
    <View style={styles.container}>
      <SafeAreaView edges={["top"]} style={styles.safeTop}>
        <Header
          title="Beranda"
          subtitle={range.label}
          onMenu={() => setDrawerOpen(true)}
          testID="header-beranda"
        />

        <View style={styles.tabs}>
          <TabBtn
            label="PENGELUARAN"
            active={type === "expense"}
            onPress={() => setType("expense")}
            testID="tab-pengeluaran"
          />
          <TabBtn
            label="PEMASUKAN"
            active={type === "income"}
            onPress={() => setType("income")}
            testID="tab-pemasukan"
          />
        </View>
      </SafeAreaView>

      <View style={styles.periodRow}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p.value}
            style={[styles.periodBtn, period === p.value && styles.periodBtnActive]}
            onPress={() => setPeriod(p.value)}
            testID={`period-${p.value}`}
          >
            <Text style={[styles.periodLabel, period === p.value && styles.periodLabelActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.navRow}>
        <TouchableOpacity
          onPress={() => setRefDate(shiftPeriod(period, refDate, -1))}
          testID="date-prev"
          hitSlop={10}
          style={styles.navBtn}
        >
          <ChevronLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.dateLabel}>{range.label}</Text>
        <TouchableOpacity
          onPress={() => setRefDate(shiftPeriod(period, refDate, 1))}
          disabled={atFutureEdge}
          testID="date-next"
          hitSlop={10}
          style={styles.navBtn}
        >
          <ChevronRight size={22} color={atFutureEdge ? colors.textMuted : colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setRefDate(new Date())}
          disabled={atFutureEdge}
          testID="date-today"
          hitSlop={10}
          style={styles.navBtn}
        >
          <ChevronsRight size={22} color={atFutureEdge ? colors.textMuted : colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.chartCard}>
          {loading && !summary ? (
            <ActivityIndicator color={colors.primary} size="large" />
          ) : (
            <DonutChart
              segments={segments}
              total={total}
              size={220}
              strokeWidth={28}
              label={type === "expense" ? "Total Pengeluaran" : "Total Pemasukan"}
            />
          )}
        </View>

        {breakdown.length === 0 ? (
          <View style={styles.emptyCard}>
            <Inbox size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Belum ada transaksi</Text>
            <Text style={styles.emptyDesc}>
              Tekan tombol kuning di kanan bawah untuk menambah transaksi pertama
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {breakdown.map((b) => (
              <CategoryRow key={b.categoryId} item={b} total={total} />
            ))}
          </View>
        )}
      </ScrollView>

      <FAB
        onPress={() => router.push({ pathname: "/transaction", params: { type } } as any)}
        testID="fab-add-transaction"
      />

      <SideDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </View>
  );
}

function TabBtn({ label, active, onPress, testID }: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.tabBtn, active && styles.tabBtnActive]}
      testID={testID}
    >
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function CategoryRow({ item, total }: { item: SummaryEntry; total: number }) {
  const pct = total > 0 ? (item.amount / total) * 100 : 0;
  return (
    <View style={styles.row} testID={`category-row-${item.categoryId}`}>
      <View style={[styles.catIcon, { backgroundColor: item.categoryColor + "22" }]}>
        <Icon name={item.categoryIcon} color={item.categoryColor} size={22} />
      </View>
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        <Text style={styles.catName}>{item.categoryName}</Text>
        <View style={styles.progressBg}>
          <View
            style={[styles.progressFill, { width: `${pct}%`, backgroundColor: item.categoryColor }]}
          />
        </View>
      </View>
      <View style={{ alignItems: "flex-end", marginLeft: spacing.sm }}>
        <Text style={styles.catAmount}>{formatRp(item.amount)}</Text>
        <Text style={styles.catPct}>{pct.toFixed(1)}%</Text>
      </View>
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
    gap: spacing.sm,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.full,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
  },
  tabBtnActive: { backgroundColor: "#FFFFFF" },
  tabLabel: {
    fontSize: fontSizes.small,
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
    letterSpacing: 0.5,
  },
  tabLabelActive: { color: colors.primary },
  periodRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.full,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  periodBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  periodLabel: { fontSize: fontSizes.body, fontWeight: "500", color: colors.textPrimary },
  periodLabelActive: { color: "#FFFFFF" },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  navBtn: {
    width: 32, height: 32, alignItems: "center", justifyContent: "center",
  },
  dateLabel: {
    fontSize: fontSizes.body,
    fontWeight: "500",
    color: colors.textPrimary,
    minWidth: 180,
    textAlign: "center",
  },
  scroll: { paddingHorizontal: spacing.md, paddingBottom: 100 },
  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadow.card,
  },
  list: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadow.card,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  catIcon: {
    width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center",
  },
  catName: {
    fontSize: fontSizes.body,
    color: colors.textPrimary,
    fontWeight: "500",
    marginBottom: 4,
  },
  progressBg: {
    height: 4,
    backgroundColor: colors.borderLight,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: { height: 4, borderRadius: 2 },
  catAmount: {
    fontSize: fontSizes.body,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  catPct: { fontSize: fontSizes.small, color: colors.textSecondary, marginTop: 2 },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadow.card,
  },
  emptyTitle: {
    fontSize: fontSizes.h3,
    fontWeight: "600",
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  emptyDesc: {
    fontSize: fontSizes.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.xs,
    lineHeight: 20,
  },
});
