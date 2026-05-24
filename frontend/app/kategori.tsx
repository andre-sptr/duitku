import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal,
  TextInput, KeyboardAvoidingView, Platform, Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Plus, Pencil, Trash2 } from "lucide-react-native";

import { Header } from "@/src/components/Header";
import { SideDrawer } from "@/src/components/SideDrawer";
import { Icon, CATEGORY_ICONS, COLOR_PALETTE } from "@/src/lib/icons";
import { Categories, Category } from "@/src/lib/api";
import { colors, fontSizes, radius, shadow, spacing } from "@/src/lib/theme";

const { width } = Dimensions.get("window");
const COL = 3;
const ITEM_W = (width - spacing.md * 2 - spacing.md * (COL - 1)) / COL;

export default function Kategori() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [type, setType] = useState<"expense" | "income">("expense");
  const [items, setItems] = useState<Category[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await Categories.list(type);
      setItems(data);
    } catch (e) { console.warn(e); }
  }, [type]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onSave = async (payload: any) => {
    try {
      if (editing) await Categories.update(editing.id, payload);
      else await Categories.create({ ...payload, type });
      setModalOpen(false);
      setEditing(null);
      load();
    } catch (e: any) {
      Alert.alert("Gagal", e?.message || "Coba lagi");
    }
  };

  const onLongPress = (cat: Category) => {
    Alert.alert(cat.name, "Pilih aksi", [
      { text: "Batal", style: "cancel" },
      { text: "Edit", onPress: () => { setEditing(cat); setModalOpen(true); } },
      {
        text: "Hapus",
        style: "destructive",
        onPress: async () => {
          try {
            await Categories.remove(cat.id);
            load();
          } catch (e: any) { Alert.alert("Gagal", e?.message); }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={["top"]} style={styles.safeTop}>
        <Header
          title="Kategori"
          subtitle="Kelola kategori transaksi"
          onMenu={() => setDrawerOpen(true)}
          testID="header-kategori"
        />
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tabBtn, type === "expense" && styles.tabBtnActive]}
            onPress={() => setType("expense")}
            testID="kategori-tab-pengeluaran"
          >
            <Text style={[styles.tabLabel, type === "expense" && styles.tabLabelActive]}>
              PENGELUARAN
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, type === "income" && styles.tabBtnActive]}
            onPress={() => setType("income")}
            testID="kategori-tab-pemasukan"
          >
            <Text style={[styles.tabLabel, type === "income" && styles.tabLabelActive]}>
              PEMASUKAN
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.grid}>
          {items.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[styles.cell, { width: ITEM_W }]}
              onLongPress={() => onLongPress(c)}
              onPress={() => { setEditing(c); setModalOpen(true); }}
              testID={`category-${c.id}`}
            >
              <View style={[styles.cellIcon, { backgroundColor: c.color }]}>
                <Icon name={c.icon} color="#FFFFFF" size={26} />
              </View>
              <Text style={styles.cellLabel} numberOfLines={1}>{c.name}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.cell, { width: ITEM_W }]}
            onPress={() => { setEditing(null); setModalOpen(true); }}
            testID="add-category-cell"
          >
            <View style={[styles.cellIcon, styles.addCell]}>
              <Plus size={26} color={colors.primary} />
            </View>
            <Text style={[styles.cellLabel, { color: colors.primary, fontWeight: "600" }]}>
              Buat
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <CategoryFormModal
        visible={modalOpen}
        editing={editing}
        type={type}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSave={onSave}
      />
      <SideDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </View>
  );
}

function CategoryFormModal({ visible, editing, type, onClose, onSave }: any) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(CATEGORY_ICONS[0]);
  const [color, setColor] = useState(COLOR_PALETTE[0]);

  React.useEffect(() => {
    if (visible) {
      setName(editing?.name || "");
      setIcon(editing?.icon || CATEGORY_ICONS[0]);
      setColor(editing?.color || COLOR_PALETTE[0]);
    }
  }, [visible, editing]);

  const submit = () => {
    if (!name.trim()) {
      Alert.alert("Nama harus diisi");
      return;
    }
    onSave({ name: name.trim(), icon, color });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.modalWrap}
      >
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.modalSheet}>
          <Text style={styles.modalTitle}>
            {editing ? "Edit Kategori" : `Buat Kategori ${type === "expense" ? "Pengeluaran" : "Pemasukan"}`}
          </Text>

          <Text style={styles.label}>Nama Kategori</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Contoh: Makanan"
            placeholderTextColor={colors.textMuted}
            testID="input-category-name"
          />

          <Text style={styles.label}>Ikon</Text>
          <ScrollView style={{ maxHeight: 160 }} showsVerticalScrollIndicator={false}>
            <View style={styles.iconGrid}>
              {CATEGORY_ICONS.map((n) => (
                <TouchableOpacity
                  key={n}
                  onPress={() => setIcon(n)}
                  style={[styles.iconCell, icon === n && { backgroundColor: color, borderColor: color }]}
                  testID={`cat-icon-${n}`}
                >
                  <Icon name={n} color={icon === n ? "#FFF" : colors.textPrimary} size={20} />
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <Text style={styles.label}>Warna</Text>
          <View style={styles.colorRow}>
            {COLOR_PALETTE.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setColor(c)}
                style={[styles.colorDot, { backgroundColor: c }, color === c && styles.colorActive]}
                testID={`cat-color-${c}`}
              />
            ))}
          </View>

          <View style={styles.btnRow}>
            <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={onClose} testID="cancel-category">
              <Text style={styles.btnGhostText}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={submit} testID="save-category">
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
  tabs: {
    flexDirection: "row",
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  tabBtn: {
    flex: 1, paddingVertical: 10, borderRadius: radius.full,
    backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center",
  },
  tabBtnActive: { backgroundColor: "#FFFFFF" },
  tabLabel: { fontSize: fontSizes.small, fontWeight: "600", color: "rgba(255,255,255,0.9)", letterSpacing: 0.5 },
  tabLabelActive: { color: colors.primary },
  scroll: { padding: spacing.md, paddingBottom: 40 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  cell: { alignItems: "center", paddingVertical: spacing.sm },
  cellIcon: {
    width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center",
    marginBottom: spacing.xs,
  },
  addCell: {
    backgroundColor: colors.surface,
    borderWidth: 2, borderColor: colors.primary, borderStyle: "dashed",
  },
  cellLabel: { fontSize: fontSizes.small, color: colors.textPrimary, textAlign: "center" },
  modalWrap: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg, paddingBottom: spacing.xl,
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
  iconGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  iconCell: {
    width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
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
