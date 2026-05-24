import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl,
  Modal, TextInput, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Pencil, Trash2 } from "lucide-react-native";

import { Header } from "@/src/components/Header";
import { FAB } from "@/src/components/FAB";
import { SideDrawer } from "@/src/components/SideDrawer";
import { Icon, ACCOUNT_ICONS, COLOR_PALETTE } from "@/src/lib/icons";
import { Account, Accounts } from "@/src/lib/api";
import { colors, fontSizes, radius, shadow, spacing } from "@/src/lib/theme";
import { formatRp } from "@/src/lib/format";

export default function Rekening() {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await Accounts.list();
      setAccounts(data);
    } catch (e) {
      console.warn(e);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const total = accounts.reduce((a, b) => a + b.balance, 0);

  const onSave = async (payload: any) => {
    try {
      if (editing) {
        await Accounts.update(editing.id, payload);
      } else {
        await Accounts.create(payload);
      }
      setModalOpen(false);
      setEditing(null);
      load();
    } catch (e: any) {
      Alert.alert("Gagal menyimpan", e?.message || "Coba lagi");
    }
  };

  const onDelete = (acc: Account) => {
    Alert.alert(
      "Hapus rekening?",
      `Semua transaksi pada "${acc.name}" akan ikut dihapus.`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            try {
              await Accounts.remove(acc.id);
              load();
            } catch (e: any) {
              Alert.alert("Gagal", e?.message || "Coba lagi");
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={["top"]} style={styles.safeTop}>
        <Header
          title="Rekening"
          subtitle="Total Saldo"
          onMenu={() => setDrawerOpen(true)}
          testID="header-rekening"
        />
        <View style={styles.totalWrap}>
          <Text style={styles.totalLabel}>Total Saldo</Text>
          <Text style={styles.totalAmount} testID="total-balance">{formatRp(total)}</Text>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => {
            setRefreshing(true); await load(); setRefreshing(false);
          }} />
        }
      >
        {accounts.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Belum ada rekening</Text>
            <Text style={styles.emptyDesc}>Tambahkan rekening pertama Anda</Text>
          </View>
        ) : (
          accounts.map((acc) => (
            <View key={acc.id} style={styles.card} testID={`account-${acc.id}`}>
              <View style={[styles.icon, { backgroundColor: acc.color + "22" }]}>
                <Icon name={acc.icon} color={acc.color} size={24} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={styles.name}>{acc.name}</Text>
                <Text style={styles.balance}>{formatRp(acc.balance)}</Text>
              </View>
              <TouchableOpacity
                onPress={() => { setEditing(acc); setModalOpen(true); }}
                style={styles.actionBtn}
                testID={`edit-account-${acc.id}`}
              >
                <Pencil size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onDelete(acc)}
                style={styles.actionBtn}
                testID={`delete-account-${acc.id}`}
              >
                <Trash2 size={18} color={colors.expense} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      <FAB
        onPress={() => { setEditing(null); setModalOpen(true); }}
        testID="fab-add-account"
      />

      <AccountFormModal
        visible={modalOpen}
        editing={editing}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSave={onSave}
      />

      <SideDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </View>
  );
}

function AccountFormModal({ visible, editing, onClose, onSave }: any) {
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [icon, setIcon] = useState(ACCOUNT_ICONS[0]);
  const [color, setColor] = useState(COLOR_PALETTE[0]);

  React.useEffect(() => {
    if (visible) {
      setName(editing?.name || "");
      setBalance(editing ? String(Math.round(editing.balance)) : "0");
      setIcon(editing?.icon || ACCOUNT_ICONS[0]);
      setColor(editing?.color || COLOR_PALETTE[0]);
    }
  }, [visible, editing]);

  const submit = () => {
    if (!name.trim()) {
      Alert.alert("Nama harus diisi");
      return;
    }
    const balNum = parseInt(balance.replace(/\D/g, ""), 10) || 0;
    onSave({ name: name.trim(), balance: balNum, icon, color });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.modalWrap}
      >
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.modalSheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.modalTitle}>
            {editing ? "Edit Rekening" : "Tambah Rekening"}
          </Text>

          <Text style={styles.label}>Nama Rekening</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Contoh: BCA, Tunai, Dana"
            placeholderTextColor={colors.textMuted}
            testID="input-account-name"
          />

          <Text style={styles.label}>Saldo Awal (Rp)</Text>
          <TextInput
            style={styles.input}
            value={balance}
            onChangeText={(t) => setBalance(t.replace(/\D/g, ""))}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            testID="input-account-balance"
          />

          <Text style={styles.label}>Ikon</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.iconRow}>
            {ACCOUNT_ICONS.map((n) => (
              <TouchableOpacity
                key={n}
                onPress={() => setIcon(n)}
                style={[styles.iconPick, icon === n && { backgroundColor: color, borderColor: color }]}
                testID={`icon-${n}`}
              >
                <Icon name={n} color={icon === n ? "#FFF" : colors.textPrimary} size={22} />
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Warna</Text>
          <View style={styles.colorRow}>
            {COLOR_PALETTE.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setColor(c)}
                style={[styles.colorDot, { backgroundColor: c }, color === c && styles.colorActive]}
                testID={`color-${c}`}
              />
            ))}
          </View>

          <View style={styles.btnRow}>
            <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={onClose} testID="cancel-account">
              <Text style={styles.btnGhostText}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={submit} testID="save-account">
              <Text style={styles.btnPrimaryText}>Simpan</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  safeTop: { backgroundColor: colors.primary },
  totalWrap: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    alignItems: "center",
  },
  totalLabel: { color: "rgba(255,255,255,0.85)", fontSize: fontSizes.body },
  totalAmount: {
    color: "#FFFFFF",
    fontSize: fontSizes.display,
    fontWeight: "700",
    marginTop: 4,
  },
  scroll: { padding: spacing.md, paddingBottom: 100 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadow.card,
  },
  icon: {
    width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center",
  },
  name: { fontSize: fontSizes.bodyLarge, fontWeight: "600", color: colors.textPrimary },
  balance: { fontSize: fontSizes.body, color: colors.textSecondary, marginTop: 2 },
  actionBtn: { padding: spacing.sm, marginLeft: 4 },
  empty: { padding: spacing.xl, alignItems: "center" },
  emptyTitle: { fontSize: fontSizes.h3, fontWeight: "600", color: colors.textPrimary },
  emptyDesc: { fontSize: fontSizes.body, color: colors.textSecondary, marginTop: spacing.xs },
  modalWrap: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlay },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  modalTitle: { fontSize: fontSizes.h2, fontWeight: "600", color: colors.textPrimary, marginBottom: spacing.md },
  label: {
    fontSize: fontSizes.small,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    fontWeight: "500",
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: fontSizes.bodyLarge,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconRow: { flexDirection: "row" },
  iconPick: {
    width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.border, marginRight: spacing.sm,
    backgroundColor: colors.surface,
  },
  colorRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  colorActive: { borderWidth: 3, borderColor: colors.textPrimary },
  btnRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  btn: { flex: 1, paddingVertical: 14, borderRadius: radius.md, alignItems: "center" },
  btnGhost: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  btnGhostText: { color: colors.textPrimary, fontWeight: "600", fontSize: fontSizes.body },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryText: { color: "#FFFFFF", fontWeight: "600", fontSize: fontSizes.body },
});
