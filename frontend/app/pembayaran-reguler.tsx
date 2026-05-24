import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl,
  Modal, TextInput, KeyboardAvoidingView, Platform, Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Repeat, Trash2, Pencil, Calendar } from "lucide-react-native";

import { Header } from "@/src/components/Header";
import { FAB } from "@/src/components/FAB";
import { SideDrawer } from "@/src/components/SideDrawer";
import { Icon } from "@/src/lib/icons";
import {
  Recurring, RegularPayment, Accounts, Categories, Account, Category,
} from "@/src/lib/api";
import { colors, fontSizes, radius, shadow, spacing } from "@/src/lib/theme";
import { formatRp, formatDateId, toIsoDate, fromIsoDate } from "@/src/lib/format";

const FREQ_LABEL: Record<string, string> = {
  daily: "Harian",
  weekly: "Mingguan",
  monthly: "Bulanan",
  yearly: "Tahunan",
};

export default function PembayaranRegulerScreen() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [items, setItems] = useState<RegularPayment[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RegularPayment | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, accs, cats] = await Promise.all([
        Recurring.list(),
        Accounts.list(),
        Categories.list(),
      ]);
      setItems(list);
      setAccounts(accs);
      setCategories(cats);
    } catch (e) {
      console.warn(e);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onSave = async (payload: any) => {
    try {
      if (editing) await Recurring.update(editing.id, payload);
      else await Recurring.create(payload);
      setModalOpen(false);
      setEditing(null);
      load();
    } catch (e: any) {
      Alert.alert("Gagal", e?.message || "Coba lagi");
    }
  };

  const onDelete = (item: RegularPayment) => {
    Alert.alert("Hapus Pembayaran Reguler?", item.name, [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: async () => {
          try {
            await Recurring.remove(item.id);
            load();
          } catch (e: any) { Alert.alert("Gagal", e?.message); }
        },
      },
    ]);
  };

  const toggleActive = async (item: RegularPayment) => {
    try {
      await Recurring.update(item.id, { isActive: !item.isActive });
      load();
    } catch (e: any) { Alert.alert("Gagal", e?.message); }
  };

  const findCat = (id: string) => categories.find((c) => c.id === id);
  const findAcc = (id: string) => accounts.find((a) => a.id === id);

  return (
    <View style={styles.container}>
      <SafeAreaView edges={["top"]} style={styles.safeTop}>
        <Header
          title="Pembayaran Reguler"
          subtitle="Otomatis tambah transaksi berulang"
          onMenu={() => setDrawerOpen(true)}
          testID="header-recurring"
        />
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => {
            setRefreshing(true); await load(); setRefreshing(false);
          }} />
        }
      >
        {items.length === 0 ? (
          <View style={styles.empty}>
            <Repeat size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Tambahkan pembayaran reguler</Text>
            <Text style={styles.emptyDesc}>
              Cicilan, sewa kos, langganan — DuitKu akan otomatis mencatatnya saat jatuh tempo.
            </Text>
          </View>
        ) : (
          items.map((item) => {
            const cat = findCat(item.categoryId);
            const acc = findAcc(item.accountId);
            return (
              <View key={item.id} style={styles.card} testID={`recurring-${item.id}`}>
                <View style={[styles.icon, { backgroundColor: (cat?.color || colors.primary) + "22" }]}>
                  <Icon name={cat?.icon || "Repeat"} color={cat?.color || colors.primary} size={22} />
                </View>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <View style={styles.rowTop}>
                    <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                    <Text
                      style={[
                        styles.amount,
                        { color: item.type === "expense" ? colors.expense : colors.success },
                      ]}
                    >
                      {item.type === "expense" ? "-" : "+"}{formatRp(item.amount)}
                    </Text>
                  </View>
                  <Text style={styles.meta}>
                    {FREQ_LABEL[item.frequency]} • {acc?.name || "—"}
                  </Text>
                  <Text style={styles.due}>
                    Jatuh tempo berikutnya: {formatDateId(fromIsoDate(item.nextDueDate), { long: true })}
                  </Text>
                  <View style={styles.actions}>
                    <View style={styles.toggleWrap}>
                      <Switch
                        value={item.isActive}
                        onValueChange={() => toggleActive(item)}
                        trackColor={{ false: colors.border, true: colors.primary }}
                        thumbColor="#FFF"
                        testID={`toggle-recurring-${item.id}`}
                      />
                      <Text style={styles.toggleLabel}>
                        {item.isActive ? "Aktif" : "Nonaktif"}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => { setEditing(item); setModalOpen(true); }}
                      style={styles.actionBtn}
                      testID={`edit-recurring-${item.id}`}
                    >
                      <Pencil size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => onDelete(item)}
                      style={styles.actionBtn}
                      testID={`delete-recurring-${item.id}`}
                    >
                      <Trash2 size={18} color={colors.expense} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <FAB
        onPress={() => { setEditing(null); setModalOpen(true); }}
        testID="fab-add-recurring"
      />

      <RecurringFormModal
        visible={modalOpen}
        editing={editing}
        accounts={accounts}
        categories={categories}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSave={onSave}
      />

      <SideDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </View>
  );
}

function RecurringFormModal({ visible, editing, accounts, categories, onClose, onSave }: any) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("0");
  const [type, setType] = useState<"expense" | "income">("expense");
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly" | "yearly">("monthly");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [autoCreate, setAutoCreate] = useState(true);

  React.useEffect(() => {
    if (!visible) return;
    if (editing) {
      setName(editing.name);
      setAmount(String(Math.round(editing.amount)));
      setType(editing.type);
      setFrequency(editing.frequency);
      setAccountId(editing.accountId);
      setCategoryId(editing.categoryId);
      setStartDate(fromIsoDate(editing.nextDueDate));
      setAutoCreate(editing.autoCreate);
    } else {
      setName("");
      setAmount("0");
      setType("expense");
      setFrequency("monthly");
      setAccountId(accounts[0]?.id || "");
      const firstCat = categories.find((c: Category) => c.type === "expense");
      setCategoryId(firstCat?.id || "");
      setStartDate(new Date());
      setAutoCreate(true);
    }
  }, [visible, editing]);

  // Filter categories by type
  const filteredCats = categories.filter((c: Category) => c.type === type);

  React.useEffect(() => {
    if (!filteredCats.find((c: Category) => c.id === categoryId)) {
      setCategoryId(filteredCats[0]?.id || "");
    }
  }, [type]);

  const submit = () => {
    if (!name.trim()) { Alert.alert("Nama harus diisi"); return; }
    const amt = parseInt(amount.replace(/\D/g, ""), 10) || 0;
    if (amt <= 0) { Alert.alert("Jumlah harus > 0"); return; }
    if (!accountId || !categoryId) { Alert.alert("Pilih akun dan kategori"); return; }
    onSave({
      name: name.trim(),
      amount: amt,
      type,
      frequency,
      accountId,
      categoryId,
      startDate: toIsoDate(startDate),
      autoCreate,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.modalWrap}
      >
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.modalSheet}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>
              {editing ? "Edit Pembayaran Reguler" : "Tambah Pembayaran Reguler"}
            </Text>

            <Text style={styles.label}>Nama</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Contoh: Cicilan motor, Langganan Netflix"
              placeholderTextColor={colors.textMuted}
              testID="input-recurring-name"
            />

            <Text style={styles.label}>Tipe</Text>
            <View style={styles.row2}>
              <TouchableOpacity
                style={[styles.pill, type === "expense" && { backgroundColor: colors.expense, borderColor: colors.expense }]}
                onPress={() => setType("expense")}
                testID="recurring-type-expense"
              >
                <Text style={[styles.pillText, type === "expense" && { color: "#FFF" }]}>Pengeluaran</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pill, type === "income" && { backgroundColor: colors.success, borderColor: colors.success }]}
                onPress={() => setType("income")}
                testID="recurring-type-income"
              >
                <Text style={[styles.pillText, type === "income" && { color: "#FFF" }]}>Pemasukan</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Jumlah (Rp)</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/\D/g, ""))}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              testID="input-recurring-amount"
            />

            <Text style={styles.label}>Frekuensi</Text>
            <View style={styles.row2}>
              {(["daily", "weekly", "monthly", "yearly"] as const).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.pillSmall, frequency === f && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  onPress={() => setFrequency(f)}
                  testID={`freq-${f}`}
                >
                  <Text style={[styles.pillTextSmall, frequency === f && { color: "#FFF" }]}>
                    {FREQ_LABEL[f]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Akun</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              {accounts.map((a: Account) => (
                <TouchableOpacity
                  key={a.id}
                  style={[styles.chip, accountId === a.id && { backgroundColor: a.color, borderColor: a.color }]}
                  onPress={() => setAccountId(a.id)}
                  testID={`recurring-acc-${a.id}`}
                >
                  <Icon name={a.icon} color={accountId === a.id ? "#FFF" : colors.textPrimary} size={16} />
                  <Text style={[styles.chipText, accountId === a.id && { color: "#FFF" }]}>{a.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Kategori</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {filteredCats.map((c: Category) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.chip, categoryId === c.id && { backgroundColor: c.color, borderColor: c.color }]}
                  onPress={() => setCategoryId(c.id)}
                  testID={`recurring-cat-${c.id}`}
                >
                  <Icon name={c.icon} color={categoryId === c.id ? "#FFF" : colors.textPrimary} size={16} />
                  <Text style={[styles.chipText, categoryId === c.id && { color: "#FFF" }]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.row3}>
              <Text style={styles.label}>Otomatis catat transaksi</Text>
              <Switch
                value={autoCreate}
                onValueChange={setAutoCreate}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFF"
                testID="toggle-auto-create"
              />
            </View>

            <View style={styles.btnRow}>
              <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={onClose} testID="cancel-recurring">
                <Text style={styles.btnGhostText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={submit} testID="save-recurring">
                <Text style={styles.btnPrimaryText}>Simpan</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  safeTop: { backgroundColor: colors.primary },
  scroll: { padding: spacing.md, paddingBottom: 100 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: "row",
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  icon: {
    width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center",
  },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { fontSize: fontSizes.bodyLarge, fontWeight: "600", color: colors.textPrimary, flex: 1 },
  amount: { fontSize: fontSizes.body, fontWeight: "700", marginLeft: 8 },
  meta: { fontSize: fontSizes.small, color: colors.textSecondary, marginTop: 4 },
  due: { fontSize: fontSizes.small, color: colors.textMuted, marginTop: 2 },
  actions: {
    flexDirection: "row", alignItems: "center", marginTop: spacing.sm, justifyContent: "space-between",
  },
  toggleWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  toggleLabel: { fontSize: fontSizes.small, color: colors.textSecondary },
  actionBtn: { padding: 6 },
  empty: { padding: spacing.xl, alignItems: "center", marginTop: spacing.xl },
  emptyTitle: { fontSize: fontSizes.h3, fontWeight: "600", color: colors.textPrimary, marginTop: spacing.md },
  emptyDesc: {
    fontSize: fontSizes.body, color: colors.textSecondary,
    textAlign: "center", marginTop: spacing.xs, lineHeight: 20,
    paddingHorizontal: spacing.md,
  },
  modalWrap: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: spacing.lg, paddingBottom: spacing.xl,
    maxHeight: "85%",
  },
  modalTitle: { fontSize: fontSizes.h2, fontWeight: "600", color: colors.textPrimary, marginBottom: spacing.md },
  label: {
    fontSize: fontSizes.small, color: colors.textSecondary,
    marginTop: spacing.sm, marginBottom: spacing.xs, fontWeight: "500",
  },
  input: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    fontSize: fontSizes.bodyLarge, color: colors.textPrimary,
    borderWidth: 1, borderColor: colors.border,
  },
  row2: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  row3: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginTop: spacing.md,
  },
  pill: {
    flex: 1, paddingVertical: 10, borderRadius: radius.full,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: "center",
  },
  pillText: { fontWeight: "500", color: colors.textPrimary, fontSize: fontSizes.body },
  pillSmall: {
    paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.full,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  pillTextSmall: { fontSize: fontSizes.small, color: colors.textPrimary, fontWeight: "500" },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: radius.full, marginRight: spacing.sm,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  chipText: { fontSize: fontSizes.small, color: colors.textPrimary, fontWeight: "500" },
  btnRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  btn: { flex: 1, paddingVertical: 14, borderRadius: radius.md, alignItems: "center" },
  btnGhost: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  btnGhostText: { color: colors.textPrimary, fontWeight: "600", fontSize: fontSizes.body },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryText: { color: "#FFFFFF", fontWeight: "600", fontSize: fontSizes.body },
});
