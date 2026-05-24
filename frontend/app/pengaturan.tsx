import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Share, Platform, Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Lock, Palette, Sliders, Bell, Globe, Trash2, Download, Info,
  ChevronRight, RefreshCw, Repeat, BellRing, Fingerprint, ScanFace,
} from "lucide-react-native";

import { Header } from "@/src/components/Header";
import { SideDrawer } from "@/src/components/SideDrawer";
import { DataApi } from "@/src/lib/api";
import { useAppLock } from "@/src/auth/AppLockContext";
import {
  getBiometricSupport, setBiometricEnabled, isBiometricEnabled, biometricLabel,
} from "@/src/auth/biometricService";
import { colors, fontSizes, radius, shadow, spacing } from "@/src/lib/theme";

export default function Pengaturan() {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { pinConfigured, biometricType, refreshPinState, resetPinSecurity } = useAppLock();
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioSupport, setBioSupport] = useState<{ supported: boolean; enrolled: boolean; type: string }>(
    { supported: false, enrolled: false, type: "unknown" }
  );

  const loadAuthState = useCallback(async () => {
    setBioEnabled(await isBiometricEnabled());
    setBioSupport(await getBiometricSupport());
  }, []);

  useFocusEffect(useCallback(() => { loadAuthState(); }, [loadAuthState]));

  const onTogglePin = () => {
    if (pinConfigured) {
      router.push({ pathname: "/setup-pin", params: { mode: "edit" } });
    } else {
      router.push("/setup-pin");
    }
  };

  const onToggleBiometric = async (value: boolean) => {
    if (!pinConfigured) {
      Alert.alert("Aktifkan PIN dulu", "Anda harus mengatur PIN sebelum mengaktifkan biometrik.");
      return;
    }
    if (value && (!bioSupport.supported || !bioSupport.enrolled)) {
      Alert.alert(
        "Biometrik tidak tersedia",
        !bioSupport.supported
          ? "Perangkat ini tidak mendukung autentikasi biometrik."
          : "Aktifkan biometrik di Pengaturan sistem terlebih dahulu."
      );
      return;
    }
    await setBiometricEnabled(value);
    setBioEnabled(value);
    await refreshPinState();
  };

  const onReset = () => {
    Alert.alert(
      "Hapus Semua Data?",
      "Aksi ini akan menghapus seluruh transaksi, rekening, kategori, pembayaran reguler dan pengingat. Tidak dapat dikembalikan.",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus Semua",
          style: "destructive",
          onPress: async () => {
            try {
              await DataApi.reset();
              await resetPinSecurity();
              await loadAuthState();
              Alert.alert("Berhasil", "Semua data telah dihapus.");
            } catch (e: any) {
              Alert.alert("Gagal", e?.message || "Coba lagi");
            }
          },
        },
      ]
    );
  };

  const onExport = async () => {
    try {
      const data = await DataApi.export();
      const json = JSON.stringify(data, null, 2);
      if (Platform.OS === "web") {
        Alert.alert("Cadangan", "Buka konsol browser untuk melihat cadangan JSON.");
        console.log(json);
      } else {
        await Share.share({
          message: json,
          title: `DuitKu Backup ${new Date().toISOString().slice(0, 10)}.json`,
        });
      }
    } catch (e: any) {
      Alert.alert("Gagal Export", e?.message || "Coba lagi");
    }
  };

  const BioIcon = biometricType === "face" || bioSupport.type === "face" ? ScanFace : Fingerprint;
  const bioLabel = biometricLabel((biometricType !== "unknown" ? biometricType : (bioSupport.type as any)) || "unknown");

  return (
    <View style={styles.container}>
      <SafeAreaView edges={["top"]} style={styles.safeTop}>
        <Header
          title="Pengaturan"
          subtitle="Kelola preferensi aplikasi"
          onMenu={() => setDrawerOpen(true)}
          testID="header-pengaturan"
        />
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Section title="Keamanan">
          <Row
            icon={Lock}
            title="PIN"
            subtitle={pinConfigured ? "Aktif — ketuk untuk mengubah" : "Belum diatur"}
            onPress={onTogglePin}
            testID="setting-pin"
            rightSlot={
              <View style={[styles.statusPill, pinConfigured && styles.statusPillActive]}>
                <Text style={[styles.statusText, pinConfigured && styles.statusTextActive]}>
                  {pinConfigured ? "ON" : "OFF"}
                </Text>
              </View>
            }
          />
          <BioRow
            label={bioLabel}
            Icon={BioIcon}
            enabled={bioEnabled}
            disabled={!pinConfigured || !bioSupport.supported || !bioSupport.enrolled}
            onChange={onToggleBiometric}
            hint={
              !bioSupport.supported
                ? "Tidak didukung perangkat"
                : !bioSupport.enrolled
                ? "Aktifkan biometrik di Pengaturan sistem"
                : !pinConfigured
                ? "Aktifkan PIN terlebih dahulu"
                : bioEnabled
                ? "Aktif — buka kunci lebih cepat"
                : "Ketuk untuk mengaktifkan"
            }
          />
        </Section>

        <Section title="Otomasi">
          <Row icon={Repeat} title="Pembayaran Reguler" subtitle="Cicilan, sewa, langganan"
            onPress={() => router.push("/pembayaran-reguler")}
            testID="setting-recurring"
          />
          <Row icon={BellRing} title="Pengingat" subtitle="Notifikasi tagihan & pencatatan"
            onPress={() => router.push("/pengingat")}
            testID="setting-reminders"
          />
        </Section>

        <Section title="Personalisasi">
          <Row icon={Sliders} title="Mata Uang" subtitle="IDR (Rp)"
            onPress={() => Alert.alert("Mata Uang", "Saat ini hanya tersedia IDR")}
            testID="setting-currency"
          />
          <Row icon={Globe} title="Bahasa" subtitle="Indonesia"
            onPress={() => Alert.alert("Bahasa", "Saat ini hanya tersedia Bahasa Indonesia")}
            testID="setting-language"
          />
          <Row icon={Palette} title="Tema" subtitle="Light (default)"
            onPress={() => Alert.alert("Segera Hadir", "Tema Dark akan tersedia pada update berikutnya")}
            testID="setting-theme"
          />
          <Row icon={Bell} title="Notifikasi" subtitle="Lihat pengingat aktif"
            onPress={() => router.push("/pengingat")}
            testID="setting-notifications"
          />
        </Section>

        <Section title="Data dan Penyimpanan">
          <Row icon={Download} title="Cadangan (Export JSON)" subtitle="Bagikan/Simpan data Anda"
            onPress={onExport}
            testID="setting-export"
          />
          <Row icon={RefreshCw} title="Hitung Ulang Saldo" subtitle="Perbarui semua saldo rekening"
            onPress={() => Alert.alert("Info", "Saldo dihitung otomatis setiap kali transaksi diubah")}
            testID="setting-recalc"
          />
          <Row icon={Trash2} title="Hapus Semua Data" subtitle="Reset aplikasi" danger
            onPress={onReset}
            testID="setting-reset"
          />
        </Section>

        <Section title="Tentang">
          <Row icon={Info} title="Versi" subtitle="DuitKu v1.2.0 (Phase 3)"
            onPress={() => Alert.alert("DuitKu", "Pelacak Keuangan Pribadi v1.2.0 — Phase 3 (PIN + Biometrik)")}
            testID="setting-version"
          />
        </Section>

        <Text style={styles.footer}>Dibuat dengan ❤️ untuk Anda</Text>
      </ScrollView>

      <SideDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </View>
  );
}

function Section({ title, children }: any) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function Row({ icon: IconCmp, title, subtitle, onPress, danger, testID, rightSlot }: any) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} testID={testID}>
      <View style={[styles.rowIcon, danger && { backgroundColor: colors.expense + "22" }]}>
        <IconCmp size={20} color={danger ? colors.expense : colors.primary} />
      </View>
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        <Text style={[styles.rowTitle, danger && { color: colors.expense }]}>{title}</Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
      {rightSlot ? rightSlot : <ChevronRight size={18} color={colors.textMuted} />}
    </TouchableOpacity>
  );
}

function BioRow({ label, Icon, enabled, disabled, onChange, hint }: any) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Icon size={20} color={colors.primary} />
      </View>
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        <Text style={[styles.rowTitle, disabled && { color: colors.textMuted }]}>{label}</Text>
        <Text style={styles.rowSub}>{hint}</Text>
      </View>
      <Switch
        value={enabled}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor="#FFF"
        testID="setting-biometric-switch"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  safeTop: { backgroundColor: colors.primary },
  scroll: { padding: spacing.md, paddingBottom: 40 },
  section: { marginBottom: spacing.md },
  sectionTitle: {
    fontSize: fontSizes.small,
    fontWeight: "600",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
    marginLeft: spacing.xs,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    ...shadow.card,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  rowIcon: {
    width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.primary + "15",
  },
  rowTitle: { fontSize: fontSizes.bodyLarge, color: colors.textPrimary, fontWeight: "500" },
  rowSub: { fontSize: fontSizes.small, color: colors.textSecondary, marginTop: 2 },
  statusPill: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.borderLight,
  },
  statusPillActive: { backgroundColor: colors.success + "22" },
  statusText: { fontSize: 11, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.5 },
  statusTextActive: { color: colors.success },
  footer: {
    textAlign: "center",
    color: colors.textMuted,
    fontSize: fontSizes.small,
    marginTop: spacing.lg,
  },
});
