import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, TextInput,
  KeyboardAvoidingView, Platform, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { X, Calendar, Delete, ChevronDown, Trash2 } from "lucide-react-native";

import { Icon } from "@/src/lib/icons";
import { Accounts, Categories, Transactions, Account, Category } from "@/src/lib/api";
import { colors, fontSizes, radius, shadow, spacing } from "@/src/lib/theme";
import { formatRp, formatDateId, toIsoDate, fromIsoDate } from "@/src/lib/format";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "DEL"];

export default function TransactionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; type?: string }>();
  const editId = params.id;
  const [type, setType] = useState<"expense" | "income">(
    (params.type as any) || "expense"
  );
  const [amountStr, setAmountStr] = useState("0");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accountId, setAccountId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const loadMeta = useCallback(async () => {
    const [accs, cats] = await Promise.all([
      Accounts.list(),
      Categories.list(type),
    ]);
    setAccounts(accs);
    setCategories(cats);
    if (!accountId && accs.length > 0) setAccountId(accs[0].id);
    if (!categoryId && cats.length > 0) setCategoryId(cats[0].id);
  }, [type]);

  useEffect(() => { loadMeta(); }, [loadMeta]);

  // Load existing if editing
  useEffect(() => {
    if (!editId) return;
    (async () => {
      try {
        const all = await Transactions.list({});
        const tx = all.find((t) => t.id === editId);
        if (tx) {
          setType(tx.type);
          setAmountStr(String(Math.round(tx.amount)));
          setAccountId(tx.accountId);
          setCategoryId(tx.categoryId);
          setNote(tx.note || "");
          setDate(fromIsoDate(tx.date));
        }
      } catch (e) { console.warn(e); }
    })();
  }, [editId]);

  // Filter categories on type switch
  useEffect(() => {
    Categories.list(type).then((cats) => {
      setCategories(cats);
      if (cats.length > 0 && !cats.find((c) => c.id === categoryId)) {
        setCategoryId(cats[0].id);
      }
    });
  }, [type]);

  const onKey = (k: string) => {
    if (k === "DEL") {
      setAmountStr((prev) => (prev.length <= 1 ? "0" : prev.slice(0, -1)));
    } else if (k === "000") {
      setAmountStr((prev) => {
        const n = prev === "0" ? "0" : prev + "000";
        return n.replace(/^0+(?=\d)/, "") || "0";
      });
    } else {
      setAmountStr((prev) => {
        const next = prev === "0" ? k : prev + k;
        return next.slice(0, 12);
      });
    }
  };

  const submit = async () => {
    const amount = parseInt(amountStr.replace(/\D/g, ""), 10);
    if (!amount || amount <= 0) {
      Alert.alert("Jumlah harus lebih dari 0");
      return;
    }
    if (!accountId || !categoryId) {
      Alert.alert("Pilih akun dan kategori");
      return;
    }
    try {
      const payload = {
        amount,
        accountId,
        categoryId,
        type,
        note,
        date: toIsoDate(date),
      };
      if (editId) {
        await Transactions.update(editId, payload as any);
      } else {
        await Transactions.create(payload as any);
      }
      router.back();
    } catch (e: any) {
      Alert.alert("Gagal Menyimpan", e?.message || "Coba lagi");
    }
  };

  const onDelete = () => {
    if (!editId) return;
    Alert.alert("Hapus Transaksi?", "Aksi tidak dapat dibatalkan.", [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: async () => {
          try {
            await Transactions.remove(editId);
            router.back();
          } catch (e: any) {
            Alert.alert("Gagal", e?.message);
          }
        },
      },
    ]);
  };

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const selectedCategory = categories.find((c) => c.id === categoryId);
  const amountNum = parseInt(amountStr.replace(/\D/g, ""), 10) || 0;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="close-transaction" hitSlop={10}>
          <X size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{editId ? "Edit Transaksi" : "Tambah Transaksi"}</Text>
        {editId ? (
          <TouchableOpacity onPress={onDelete} testID="delete-transaction" hitSlop={10}>
            <Trash2 size={22} color={colors.expense} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 22 }} />
        )}
      </View>

      <View style={styles.typeTabs}>
        <TouchableOpacity
          style={[styles.typeBtn, type === "expense" && styles.typeBtnExpense]}
          onPress={() => setType("expense")}
          testID="type-expense"
        >
          <Text style={[styles.typeLabel, type === "expense" && { color: "#FFF" }]}>
            PENGELUARAN
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.typeBtn, type === "income" && styles.typeBtnIncome]}
          onPress={() => setType("income")}
          testID="type-income"
        >
          <Text style={[styles.typeLabel, type === "income" && { color: "#FFF" }]}>
            PEMASUKAN
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
          <View style={styles.amountWrap}>
            <Text style={styles.amountLabel}>Jumlah</Text>
            <Text
              style={[
                styles.amountText,
                { color: type === "expense" ? colors.expense : colors.success },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              testID="amount-display"
            >
              {formatRp(amountNum)}
            </Text>
          </View>

          {/* Account */}
          <TouchableOpacity
            style={styles.field}
            onPress={() => setAccountPickerOpen(true)}
            testID="field-account"
          >
            <Text style={styles.fieldLabel}>Akun</Text>
            <View style={styles.fieldValue}>
              {selectedAccount ? (
                <>
                  <View style={[styles.fieldIcon, { backgroundColor: selectedAccount.color + "22" }]}>
                    <Icon name={selectedAccount.icon} color={selectedAccount.color} size={18} />
                  </View>
                  <Text style={styles.fieldText}>{selectedAccount.name}</Text>
                </>
              ) : (
                <Text style={styles.fieldPlaceholder}>Pilih akun</Text>
              )}
              <ChevronDown size={18} color={colors.textMuted} />
            </View>
          </TouchableOpacity>

          {/* Date */}
          <TouchableOpacity
            style={styles.field}
            onPress={() => setDatePickerOpen(true)}
            testID="field-date"
          >
            <Text style={styles.fieldLabel}>Tanggal</Text>
            <View style={styles.fieldValue}>
              <Calendar size={18} color={colors.primary} />
              <Text style={[styles.fieldText, { marginLeft: 8 }]}>
                {formatDateId(date, { long: true, withDay: true })}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Note */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Catatan</Text>
            <TextInput
              style={styles.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder="Opsional"
              placeholderTextColor={colors.textMuted}
              testID="input-note"
            />
          </View>

          {/* Category Grid */}
          <Text style={styles.sectionLabel}>Kategori</Text>
          <View style={styles.catGrid}>
            {categories.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={styles.catItem}
                onPress={() => setCategoryId(c.id)}
                testID={`cat-pick-${c.id}`}
              >
                <View
                  style={[
                    styles.catCircle,
                    { backgroundColor: c.color },
                    categoryId === c.id && styles.catCircleActive,
                  ]}
                >
                  <Icon name={c.icon} color="#FFFFFF" size={22} />
                </View>
                <Text
                  style={[
                    styles.catName,
                    categoryId === c.id && { color: colors.primary, fontWeight: "700" },
                  ]}
                  numberOfLines={1}
                >
                  {c.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Numeric Keypad */}
        <View style={styles.keypad}>
          {KEYS.map((k) => (
            <TouchableOpacity
              key={k}
              style={styles.key}
              onPress={() => onKey(k)}
              testID={`key-${k}`}
            >
              {k === "DEL" ? (
                <Delete size={24} color={colors.expense} />
              ) : (
                <Text style={styles.keyText}>{k}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={submit} testID="save-transaction">
          <Text style={styles.saveBtnText}>SIMPAN</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>

      {/* Account picker modal */}
      <Modal visible={accountPickerOpen} transparent animationType="slide" onRequestClose={() => setAccountPickerOpen(false)}>
        <TouchableOpacity style={styles.pickBackdrop} activeOpacity={1} onPress={() => setAccountPickerOpen(false)} />
        <View style={styles.pickSheet}>
          <Text style={styles.modalTitle}>Pilih Akun</Text>
          {accounts.map((a) => (
            <TouchableOpacity
              key={a.id}
              style={styles.pickRow}
              onPress={() => { setAccountId(a.id); setAccountPickerOpen(false); }}
              testID={`pick-account-${a.id}`}
            >
              <View style={[styles.fieldIcon, { backgroundColor: a.color + "22" }]}>
                <Icon name={a.icon} color={a.color} size={20} />
              </View>
              <Text style={[styles.pickText, { flex: 1, marginLeft: spacing.md }]}>{a.name}</Text>
              <Text style={styles.pickBalance}>{formatRp(a.balance)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Modal>

      {/* Date picker (simple inline) */}
      <DatePickerModal
        visible={datePickerOpen}
        date={date}
        onClose={() => setDatePickerOpen(false)}
        onSelect={(d) => { setDate(d); setDatePickerOpen(false); }}
      />
    </SafeAreaView>
  );
}

function DatePickerModal({ visible, date, onClose, onSelect }: any) {
  const [cur, setCur] = useState(new Date(date));

  useEffect(() => { setCur(new Date(date)); }, [date, visible]);

  const monthsId = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];

  const year = cur.getFullYear();
  const month = cur.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  // Indonesian: Monday=0
  const startWeekday = (firstDay.getDay() + 6) % 7;
  const grid: (number | null)[] = Array.from({ length: startWeekday }, () => null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(d);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.pickBackdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.dateSheet}>
        <View style={styles.dateNav}>
          <TouchableOpacity
            onPress={() => setCur(new Date(year, month - 1, 1))}
            testID="date-month-prev"
            hitSlop={10}
          >
            <Text style={styles.dateNavBtn}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.dateNavTitle}>{monthsId[month]} {year}</Text>
          <TouchableOpacity
            onPress={() => setCur(new Date(year, month + 1, 1))}
            testID="date-month-next"
            hitSlop={10}
          >
            <Text style={styles.dateNavBtn}>›</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.dayHeader}>
          {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((d) => (
            <Text key={d} style={styles.dayHeaderText}>{d}</Text>
          ))}
        </View>
        <View style={styles.dayGrid}>
          {grid.map((d, i) => {
            const selected =
              d && d === date.getDate() && month === date.getMonth() && year === date.getFullYear();
            return (
              <TouchableOpacity
                key={i}
                style={[styles.dayCell, selected && styles.dayCellActive]}
                disabled={!d}
                onPress={() => d && onSelect(new Date(year, month, d))}
                testID={d ? `day-${d}` : undefined}
              >
                <Text style={[styles.dayCellText, selected && { color: "#FFF", fontWeight: "700" }]}>
                  {d || ""}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity
          style={[styles.saveBtn, { marginTop: spacing.md, marginHorizontal: 0 }]}
          onPress={() => onSelect(new Date())}
          testID="date-today"
        >
          <Text style={styles.saveBtnText}>HARI INI</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    justifyContent: "space-between",
  },
  headerTitle: { fontSize: fontSizes.h3, fontWeight: "600", color: colors.textPrimary },
  typeTabs: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  typeBtn: {
    flex: 1, paddingVertical: 10, borderRadius: radius.full, alignItems: "center",
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  typeBtnExpense: { backgroundColor: colors.expense, borderColor: colors.expense },
  typeBtnIncome: { backgroundColor: colors.success, borderColor: colors.success },
  typeLabel: { fontWeight: "600", fontSize: fontSizes.small, color: colors.textPrimary, letterSpacing: 0.5 },
  amountWrap: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    margin: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
    ...shadow.card,
  },
  amountLabel: { fontSize: fontSizes.small, color: colors.textSecondary },
  amountText: {
    fontSize: 36,
    fontWeight: "800",
    marginTop: 6,
  },
  field: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    ...shadow.card,
  },
  fieldLabel: { fontSize: fontSizes.body, color: colors.textSecondary, width: 80 },
  fieldValue: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end" },
  fieldIcon: {
    width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center",
    marginRight: 8,
  },
  fieldText: { fontSize: fontSizes.body, color: colors.textPrimary, fontWeight: "500" },
  fieldPlaceholder: { fontSize: fontSizes.body, color: colors.textMuted, flex: 1, textAlign: "right" },
  noteInput: {
    flex: 1, fontSize: fontSizes.body, color: colors.textPrimary,
    textAlign: "right", paddingVertical: 4,
  },
  sectionLabel: {
    fontSize: fontSizes.small, color: colors.textSecondary, fontWeight: "600",
    marginTop: spacing.md, marginLeft: spacing.md, marginBottom: spacing.sm,
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  catGrid: {
    flexDirection: "row", flexWrap: "wrap",
    paddingHorizontal: spacing.sm,
  },
  catItem: {
    width: "25%",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  catCircle: {
    width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center",
    marginBottom: 6,
  },
  catCircleActive: {
    borderWidth: 3, borderColor: colors.primary,
  },
  catName: { fontSize: fontSizes.small, color: colors.textPrimary, textAlign: "center" },
  keypad: {
    flexDirection: "row", flexWrap: "wrap",
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  key: {
    width: "33.333%",
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  keyText: { fontSize: 24, color: colors.textPrimary, fontWeight: "600" },
  saveBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
    ...shadow.fab,
  },
  saveBtnText: { fontWeight: "700", fontSize: fontSizes.bodyLarge, color: colors.textPrimary, letterSpacing: 1 },
  pickBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlay },
  pickSheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: spacing.lg, paddingBottom: spacing.xl,
    maxHeight: "70%",
  },
  modalTitle: { fontSize: fontSizes.h3, fontWeight: "600", color: colors.textPrimary, marginBottom: spacing.md },
  pickRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  pickText: { fontSize: fontSizes.bodyLarge, color: colors.textPrimary, fontWeight: "500" },
  pickBalance: { fontSize: fontSizes.body, color: colors.textSecondary },
  dateSheet: {
    position: "absolute",
    top: "20%",
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.card,
  },
  dateNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  dateNavBtn: { fontSize: 28, color: colors.primary, paddingHorizontal: 12 },
  dateNavTitle: { fontSize: fontSizes.h3, fontWeight: "600", color: colors.textPrimary },
  dayHeader: { flexDirection: "row", paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  dayHeaderText: {
    flex: 1, textAlign: "center", fontSize: fontSizes.small,
    color: colors.textSecondary, fontWeight: "600",
  },
  dayGrid: { flexDirection: "row", flexWrap: "wrap", paddingTop: 6 },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.full,
  },
  dayCellActive: { backgroundColor: colors.primary },
  dayCellText: { fontSize: fontSizes.body, color: colors.textPrimary },
});
