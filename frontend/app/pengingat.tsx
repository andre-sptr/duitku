import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl,
  Modal, TextInput, KeyboardAvoidingView, Platform, Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { BellRing, Trash2, Pencil, ArrowDownUp } from "lucide-react-native";

import { Header } from "@/src/components/Header";
import { FAB } from "@/src/components/FAB";
import { SideDrawer } from "@/src/components/SideDrawer";
import { Reminders, Reminder } from "@/src/lib/api";
import {
  scheduleReminderNotification, cancelNotification, ensureNotificationPermission,
} from "@/src/lib/notifications";
import { colors, fontSizes, radius, shadow, spacing } from "@/src/lib/theme";
import { formatDateId } from "@/src/lib/format";

const REPEAT_LABEL: Record<string, string> = {
  none: "Sekali",
  daily: "Harian",
  weekly: "Mingguan",
  monthly: "Bulanan",
  yearly: "Tahunan",
};

export default function PengingatScreen() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [items, setItems] = useState<Reminder[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Reminder | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await Reminders.list("date");
      setItems(list);
    } catch (e) { console.warn(e); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onSave = async (payload: any) => {
    try {
      // Schedule local notification
      let notificationId: string | null = null;
      if (payload.isActive) {
        const date = new Date(payload.dateTime);
        notificationId = await scheduleReminderNotification({
          title: payload.title,
          body: payload.description || "Pengingat dari DuitKu",
          date,
          repeat: payload.repeat,
        });
      }
      // Cancel previous if editing
      if (editing?.notificationId) {
        await cancelNotification(editing.notificationId);
      }
      const finalPayload = { ...payload, notificationId };
      if (editing) await Reminders.update(editing.id, finalPayload);
      else await Reminders.create(finalPayload);
      setModalOpen(false);
      setEditing(null);
      load();
    } catch (e: any) {
      Alert.alert("Gagal", e?.message || "Coba lagi");
    }
  };

  const onDelete = (item: Reminder) => {
    Alert.alert("Hapus Pengingat?", item.title, [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: async () => {
          try {
            if (item.notificationId) await cancelNotification(item.notificationId);
            await Reminders.remove(item.id);
            load();
          } catch (e: any) { Alert.alert("Gagal", e?.message); }
        },
      },
    ]);
  };

  const toggleActive = async (item: Reminder) => {
    try {
      let notificationId = item.notificationId;
      if (item.isActive) {
        // Was active → cancel
        if (notificationId) await cancelNotification(notificationId);
        notificationId = null;
      } else {
        // Was inactive → reschedule
        const date = new Date(item.dateTime);
        notificationId = await scheduleReminderNotification({
          title: item.title,
          body: item.description,
          date,
          repeat: item.repeat,
        });
      }
      await Reminders.update(item.id, { isActive: !item.isActive, notificationId });
      load();
    } catch (e: any) { Alert.alert("Gagal", e?.message); }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={["top"]} style={styles.safeTop}>
        <Header
          title="Pengingat"
          subtitle="Pengingat dengan notifikasi"
          onMenu={() => setDrawerOpen(true)}
          testID="header-reminders"
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
            <BellRing size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Tambahkan pengingat</Text>
            <Text style={styles.emptyDesc}>
              Buat pengingat agar tidak lupa membayar tagihan atau mencatat pengeluaran.
            </Text>
          </View>
        ) : (
          items.map((item) => {
            const dt = new Date(item.dateTime);
            const timeStr =
              `${dt.getHours().toString().padStart(2, "0")}:${dt.getMinutes().toString().padStart(2, "0")}`;
            return (
              <View key={item.id} style={styles.card} testID={`reminder-${item.id}`}>
                <View style={[styles.icon, { backgroundColor: colors.accent + "33" }]}>
                  <BellRing size={22} color={colors.accentDark} />
                </View>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={styles.name} numberOfLines={1}>{item.title}</Text>
                  {item.description ? (
                    <Text style={styles.meta} numberOfLines={2}>{item.description}</Text>
                  ) : null}
                  <Text style={styles.dt}>
                    {formatDateId(dt, { long: true, withDay: true })} • {timeStr} • {REPEAT_LABEL[item.repeat]}
                  </Text>
                  <View style={styles.actions}>
                    <View style={styles.toggleWrap}>
                      <Switch
                        value={item.isActive}
                        onValueChange={() => toggleActive(item)}
                        trackColor={{ false: colors.border, true: colors.primary }}
                        thumbColor="#FFF"
                        testID={`toggle-reminder-${item.id}`}
                      />
                      <Text style={styles.toggleLabel}>
                        {item.isActive ? "Aktif" : "Nonaktif"}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => { setEditing(item); setModalOpen(true); }}
                      style={styles.actionBtn}
                      testID={`edit-reminder-${item.id}`}
                    >
                      <Pencil size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => onDelete(item)}
                      style={styles.actionBtn}
                      testID={`delete-reminder-${item.id}`}
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
        onPress={async () => {
          if (Platform.OS !== "web") await ensureNotificationPermission();
          setEditing(null);
          setModalOpen(true);
        }}
        testID="fab-add-reminder"
      />

      <ReminderFormModal
        visible={modalOpen}
        editing={editing}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSave={onSave}
      />

      <SideDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </View>
  );
}

function ReminderFormModal({ visible, editing, onClose, onSave }: any) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState<Date>(new Date(Date.now() + 60 * 60 * 1000));
  const [hour, setHour] = useState("09");
  const [minute, setMinute] = useState("00");
  const [repeat, setRepeat] = useState<"none" | "daily" | "weekly" | "monthly" | "yearly">("none");
  const [isActive, setIsActive] = useState(true);

  React.useEffect(() => {
    if (!visible) return;
    if (editing) {
      const dt = new Date(editing.dateTime);
      setTitle(editing.title);
      setDescription(editing.description);
      setDate(dt);
      setHour(dt.getHours().toString().padStart(2, "0"));
      setMinute(dt.getMinutes().toString().padStart(2, "0"));
      setRepeat(editing.repeat);
      setIsActive(editing.isActive);
    } else {
      const def = new Date(Date.now() + 60 * 60 * 1000);
      setTitle("");
      setDescription("");
      setDate(def);
      setHour(def.getHours().toString().padStart(2, "0"));
      setMinute("00");
      setRepeat("none");
      setIsActive(true);
    }
  }, [visible, editing]);

  const submit = () => {
    if (!title.trim()) { Alert.alert("Judul harus diisi"); return; }
    const h = Math.max(0, Math.min(23, parseInt(hour || "0", 10)));
    const m = Math.max(0, Math.min(59, parseInt(minute || "0", 10)));
    const dt = new Date(date);
    dt.setHours(h, m, 0, 0);
    if (dt.getTime() < Date.now() && repeat === "none") {
      Alert.alert("Waktu Sudah Lewat", "Pengingat 'Sekali' harus di masa depan");
      return;
    }
    onSave({
      title: title.trim(),
      description: description.trim(),
      dateTime: dt.toISOString(),
      repeat,
      isActive,
    });
  };

  const shiftDate = (days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d);
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
              {editing ? "Edit Pengingat" : "Tambah Pengingat"}
            </Text>

            <Text style={styles.label}>Judul</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Contoh: Bayar tagihan listrik"
              placeholderTextColor={colors.textMuted}
              testID="input-reminder-title"
            />

            <Text style={styles.label}>Deskripsi (opsional)</Text>
            <TextInput
              style={[styles.input, { minHeight: 60, textAlignVertical: "top" }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Tambah catatan..."
              placeholderTextColor={colors.textMuted}
              multiline
              testID="input-reminder-desc"
            />

            <Text style={styles.label}>Tanggal</Text>
            <View style={styles.dateRow}>
              <TouchableOpacity onPress={() => shiftDate(-1)} style={styles.shiftBtn} testID="reminder-date-prev">
                <ArrowDownUp size={16} color={colors.textPrimary} style={{ transform: [{ rotate: "90deg" }] }} />
              </TouchableOpacity>
              <Text style={styles.dateText}>{formatDateId(date, { long: true, withDay: true })}</Text>
              <TouchableOpacity onPress={() => shiftDate(1)} style={styles.shiftBtn} testID="reminder-date-next">
                <ArrowDownUp size={16} color={colors.textPrimary} style={{ transform: [{ rotate: "-90deg" }] }} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Waktu (24-jam)</Text>
            <View style={styles.timeRow}>
              <TextInput
                style={styles.timeInput}
                value={hour}
                onChangeText={(v) => setHour(v.replace(/\D/g, "").slice(0, 2))}
                keyboardType="number-pad"
                placeholder="HH"
                placeholderTextColor={colors.textMuted}
                testID="input-reminder-hour"
              />
              <Text style={styles.timeSep}>:</Text>
              <TextInput
                style={styles.timeInput}
                value={minute}
                onChangeText={(v) => setMinute(v.replace(/\D/g, "").slice(0, 2))}
                keyboardType="number-pad"
                placeholder="MM"
                placeholderTextColor={colors.textMuted}
                testID="input-reminder-minute"
              />
            </View>

            <Text style={styles.label}>Ulangi</Text>
            <View style={styles.row2}>
              {(["none", "daily", "weekly", "monthly", "yearly"] as const).map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.pillSmall, repeat === r && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  onPress={() => setRepeat(r)}
                  testID={`repeat-${r}`}
                >
                  <Text style={[styles.pillTextSmall, repeat === r && { color: "#FFF" }]}>
                    {REPEAT_LABEL[r]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.row3}>
              <Text style={styles.label}>Aktifkan notifikasi</Text>
              <Switch
                value={isActive}
                onValueChange={setIsActive}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFF"
                testID="toggle-reminder-active"
              />
            </View>

            <View style={styles.btnRow}>
              <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={onClose} testID="cancel-reminder">
                <Text style={styles.btnGhostText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={submit} testID="save-reminder">
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
  name: { fontSize: fontSizes.bodyLarge, fontWeight: "600", color: colors.textPrimary },
  meta: { fontSize: fontSizes.body, color: colors.textSecondary, marginTop: 2 },
  dt: { fontSize: fontSizes.small, color: colors.textMuted, marginTop: 4 },
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
  dateRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    paddingVertical: 8, paddingHorizontal: 12,
  },
  shiftBtn: { padding: 6 },
  dateText: { flex: 1, textAlign: "center", fontSize: fontSizes.body, color: colors.textPrimary, fontWeight: "500" },
  timeRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  timeInput: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    width: 80, paddingVertical: 12, textAlign: "center",
    fontSize: fontSizes.h3, fontWeight: "600", color: colors.textPrimary,
    borderWidth: 1, borderColor: colors.border,
  },
  timeSep: { fontSize: fontSizes.h2, fontWeight: "700", color: colors.textPrimary },
  row2: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  row3: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginTop: spacing.md,
  },
  pillSmall: {
    paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.full,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  pillTextSmall: { fontSize: fontSizes.small, color: colors.textPrimary, fontWeight: "500" },
  btnRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  btn: { flex: 1, paddingVertical: 14, borderRadius: radius.md, alignItems: "center" },
  btnGhost: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  btnGhostText: { color: colors.textPrimary, fontWeight: "600", fontSize: fontSizes.body },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryText: { color: "#FFFFFF", fontWeight: "600", fontSize: fontSizes.body },
});
