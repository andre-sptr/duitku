import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, Platform, Vibration,
} from "react-native";
import { Fingerprint, ScanFace, Delete, Lock } from "lucide-react-native";

import { useAppLock } from "./AppLockContext";
import { biometricLabel } from "./biometricService";
import { DataApi } from "@/src/lib/api";
import { colors, fontSizes, radius, spacing, shadow } from "@/src/lib/theme";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function LockOverlay() {
  const {
    locked, pinConfigured, biometricAvailable, biometricType, pinLockedUntil,
    unlockWithPin, unlockWithBiometrics, resetPinSecurity,
  } = useAppLock();

  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  const lockedOut = now < pinLockedUntil;
  const remainingSec = lockedOut ? Math.ceil((pinLockedUntil - now) / 1000) : 0;

  // Tick the countdown every second while locked out.
  useEffect(() => {
    if (!lockedOut) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [lockedOut]);

  // Auto-trigger biometric prompt when overlay appears
  useEffect(() => {
    if (!locked) {
      setPin("");
      setError(null);
      return;
    }
    if (locked && biometricAvailable) {
      // Small delay so the overlay renders first
      const t = setTimeout(() => {
        unlockWithBiometrics().catch(() => {});
      }, 300);
      return () => clearTimeout(t);
    }
  }, [locked, biometricAvailable, unlockWithBiometrics]);

  // Auto-verify when 4 digits entered
  useEffect(() => {
    if (pin.length === 4 && !busy && !lockedOut) {
      (async () => {
        setBusy(true);
        const ok = await unlockWithPin(pin);
        if (!ok) {
          setError("PIN salah. Coba lagi.");
          Vibration.vibrate(200);
          setTimeout(() => setPin(""), 250);
        }
        setBusy(false);
      })();
    }
  }, [pin, busy, unlockWithPin, lockedOut]);

  if (!locked || !pinConfigured) return null;

  const press = (k: string) => {
    if (lockedOut) return;
    setError(null);
    setPin((prev) => (prev.length >= 4 ? prev : prev + k));
  };

  const back = () => {
    setError(null);
    setPin((prev) => prev.slice(0, -1));
  };

  const onForgot = () => {
    Alert.alert(
      "Lupa PIN?",
      "Karena DuitKu menyimpan data hanya di perangkat ini, opsi 'Lupa PIN' akan MENGHAPUS PIN dan SEMUA DATA (transaksi, rekening, kategori). Tindakan ini tidak dapat dibatalkan.",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus & Reset",
          style: "destructive",
          onPress: async () => {
            try {
              await DataApi.reset();
              await resetPinSecurity();
            } catch (e: any) {
              Alert.alert("Gagal", e?.message || "Coba lagi");
            }
          },
        },
      ]
    );
  };

  const BiometricIcon = biometricType === "face" ? ScanFace : Fingerprint;

  return (
    <View style={styles.root} testID="lock-overlay">
      <View style={styles.brand}>
        <View style={styles.logoCircle}>
          <Lock size={28} color="#FFF" />
        </View>
        <Text style={styles.appName}>DuitKu</Text>
        <Text style={styles.subtitle}>Masukkan PIN untuk membuka</Text>
      </View>

      <View style={styles.dots}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < pin.length && styles.dotFilled,
              error ? styles.dotError : null,
            ]}
          />
        ))}
      </View>

      {lockedOut ? (
        <Text style={styles.errorText} testID="pin-lockout">
          Terlalu banyak percobaan. Coba lagi dalam {remainingSec}s
        </Text>
      ) : error ? (
        <Text style={styles.errorText} testID="pin-error">{error}</Text>
      ) : (
        <View style={{ height: 18 }} />
      )}

      <View style={styles.keypad}>
        {KEYS.map((k) => (
          <TouchableOpacity
            key={k}
            style={[styles.key, lockedOut && styles.keyDisabled]}
            onPress={() => press(k)}
            disabled={lockedOut}
            activeOpacity={0.6}
            testID={`lock-key-${k}`}
          >
            <Text style={styles.keyText}>{k}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={styles.key}
          onPress={biometricAvailable ? () => unlockWithBiometrics() : undefined}
          activeOpacity={biometricAvailable ? 0.6 : 1}
          testID="lock-key-biometric"
        >
          {biometricAvailable ? (
            <BiometricIcon size={28} color="#FFFFFF" />
          ) : null}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.key, lockedOut && styles.keyDisabled]} onPress={() => press("0")} disabled={lockedOut} testID="lock-key-0">
          <Text style={styles.keyText}>0</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.key, lockedOut && styles.keyDisabled]} onPress={back} disabled={lockedOut} testID="lock-key-back">
          <Delete size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {biometricAvailable && (
        <TouchableOpacity
          style={styles.bioBtn}
          onPress={() => unlockWithBiometrics()}
          testID="lock-biometric-btn"
        >
          <BiometricIcon size={18} color={colors.accent} />
          <Text style={styles.bioBtnText}>{biometricLabel(biometricType)}</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity onPress={onForgot} style={styles.forgotBtn} testID="lock-forgot-pin">
        <Text style={styles.forgotText}>Lupa PIN?</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    paddingTop: 40,
    paddingBottom: 30,
  },
  brand: { alignItems: "center", marginBottom: spacing.lg },
  logoCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
    marginBottom: spacing.sm,
  },
  appName: { fontSize: 28, fontWeight: "700", color: "#FFFFFF" },
  subtitle: { fontSize: fontSizes.body, color: "rgba(255,255,255,0.85)", marginTop: 6 },
  dots: {
    flexDirection: "row", gap: 18,
    marginTop: spacing.md,
  },
  dot: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.7)",
    backgroundColor: "transparent",
  },
  dotFilled: { backgroundColor: colors.accent, borderColor: colors.accent },
  dotError: { borderColor: colors.expense },
  errorText: { color: "#FFE0E0", fontSize: fontSizes.body, marginTop: 12, fontWeight: "500" },
  keypad: {
    flexDirection: "row", flexWrap: "wrap",
    width: 280, justifyContent: "center",
    marginTop: spacing.lg,
    gap: 14,
  },
  key: {
    width: 76, height: 76, borderRadius: 38,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  keyDisabled: { opacity: 0.35 },
  keyText: { fontSize: 28, fontWeight: "600", color: "#FFFFFF" },
  bioBtn: {
    marginTop: spacing.lg,
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: radius.full,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  bioBtnText: { color: "#FFFFFF", fontWeight: "600", fontSize: fontSizes.body },
  forgotBtn: { marginTop: spacing.md, padding: 10 },
  forgotText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: fontSizes.body,
    textDecorationLine: "underline",
  },
});
