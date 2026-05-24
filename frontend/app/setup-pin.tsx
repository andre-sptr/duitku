import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, Vibration, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Delete, Lock, ArrowLeft } from "lucide-react-native";

import { setPin as savePin, clearPin } from "@/src/auth/pinService";
import {
  getBiometricSupport, setBiometricEnabled, isBiometricEnabled,
} from "@/src/auth/biometricService";
import { useAppLock } from "@/src/auth/AppLockContext";
import { colors, fontSizes, radius, spacing } from "@/src/lib/theme";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export default function SetupPinScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const { refreshPinState, bypassLock, pinConfigured } = useAppLock();
  const isEditMode = params.mode === "edit";

  const [stage, setStage] = useState<"enter" | "confirm">("enter");
  const [pin, setPin] = useState("");
  const [firstPin, setFirstPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (pin.length === 4 && !busy) {
      if (stage === "enter") {
        setFirstPin(pin);
        setStage("confirm");
        setPin("");
      } else {
        // confirm
        if (pin !== firstPin) {
          setError("PIN tidak sama. Coba lagi.");
          Vibration.vibrate(200);
          setTimeout(() => {
            setPin("");
            setFirstPin("");
            setStage("enter");
            setError(null);
          }, 800);
        } else {
          (async () => {
            setBusy(true);
            try {
              await savePin(pin);
              await refreshPinState();
              bypassLock();
              // Ask about biometric
              if (Platform.OS !== "web") {
                const support = await getBiometricSupport();
                if (support.supported && support.enrolled) {
                  const label = support.type === "face" ? "Face ID" : "biometrik/sidik jari";
                  Alert.alert(
                    "Aktifkan biometrik?",
                    `Perangkat Anda mendukung ${label}. Aktifkan untuk membuka kunci lebih cepat?`,
                    [
                      {
                        text: "Tidak",
                        style: "cancel",
                        onPress: async () => {
                          await setBiometricEnabled(false);
                          await refreshPinState();
                          router.replace("/");
                        },
                      },
                      {
                        text: "Aktifkan",
                        onPress: async () => {
                          await setBiometricEnabled(true);
                          await refreshPinState();
                          router.replace("/");
                        },
                      },
                    ]
                  );
                } else {
                  router.replace("/");
                }
              } else {
                router.replace("/");
              }
            } catch (e: any) {
              Alert.alert("Gagal", e?.message || "Coba lagi");
            } finally {
              setBusy(false);
            }
          })();
        }
      }
    }
  }, [pin, stage, firstPin, busy]);

  const onKey = (k: string) => {
    setError(null);
    setPin((p) => (p.length >= 4 ? p : p + k));
  };

  const onBack = () => {
    setError(null);
    setPin((p) => p.slice(0, -1));
  };

  const onDisablePin = () => {
    Alert.alert(
      "Nonaktifkan PIN?",
      "Aplikasi tidak akan terkunci lagi. Yakin?",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Ya, Nonaktifkan",
          style: "destructive",
          onPress: async () => {
            await clearPin();
            await setBiometricEnabled(false);
            await refreshPinState();
            router.replace("/");
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {isEditMode && pinConfigured && (
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          testID="setup-back"
        >
          <ArrowLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      <View style={styles.brand}>
        <View style={styles.logoCircle}>
          <Lock size={28} color="#FFF" />
        </View>
        <Text style={styles.title}>
          {stage === "enter" ? "Buat PIN" : "Konfirmasi PIN"}
        </Text>
        <Text style={styles.subtitle}>
          {stage === "enter"
            ? "Buat 4 digit PIN untuk mengunci DuitKu"
            : "Masukkan ulang PIN untuk konfirmasi"}
        </Text>
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

      {error ? <Text style={styles.errorText}>{error}</Text> : <View style={{ height: 18 }} />}

      <View style={styles.keypad}>
        {KEYS.map((k) => (
          <TouchableOpacity
            key={k}
            style={styles.key}
            onPress={() => onKey(k)}
            activeOpacity={0.6}
            testID={`setup-key-${k}`}
          >
            <Text style={styles.keyText}>{k}</Text>
          </TouchableOpacity>
        ))}
        <View style={styles.key} />
        <TouchableOpacity style={styles.key} onPress={() => onKey("0")} testID="setup-key-0">
          <Text style={styles.keyText}>0</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.key} onPress={onBack} testID="setup-key-back">
          <Delete size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {isEditMode && pinConfigured ? (
        <TouchableOpacity onPress={onDisablePin} style={styles.disableBtn} testID="disable-pin">
          <Text style={styles.disableText}>Nonaktifkan PIN</Text>
        </TouchableOpacity>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg,
  },
  backBtn: {
    position: "absolute",
    top: 60, left: spacing.md, padding: 8,
    zIndex: 2,
  },
  brand: { alignItems: "center", marginBottom: spacing.lg },
  logoCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
    marginBottom: spacing.sm,
  },
  title: { fontSize: 26, fontWeight: "700", color: "#FFFFFF" },
  subtitle: {
    fontSize: fontSizes.body, color: "rgba(255,255,255,0.85)",
    marginTop: 6, textAlign: "center",
  },
  dots: { flexDirection: "row", gap: 18, marginTop: spacing.md },
  dot: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.7)",
  },
  dotFilled: { backgroundColor: colors.accent, borderColor: colors.accent },
  dotError: { borderColor: colors.expense },
  errorText: { color: "#FFE0E0", fontSize: fontSizes.body, marginTop: 12, fontWeight: "500" },
  keypad: {
    flexDirection: "row", flexWrap: "wrap",
    width: 280, justifyContent: "center",
    marginTop: spacing.lg, gap: 14,
  },
  key: {
    width: 76, height: 76, borderRadius: 38,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  keyText: { fontSize: 28, fontWeight: "600", color: "#FFFFFF" },
  disableBtn: { marginTop: spacing.lg, padding: 12 },
  disableText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: fontSizes.body,
    textDecorationLine: "underline",
  },
});
