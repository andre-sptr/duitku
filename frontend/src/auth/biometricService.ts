// Biometric authentication helper using expo-local-authentication
import { Platform } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { storage } from "@/src/utils/storage";

const BIOMETRIC_ENABLED_KEY = "duitku.biometric.enabled";

export type BiometricType = "fingerprint" | "face" | "iris" | "unknown";

export type BiometricSupport = {
  supported: boolean;
  enrolled: boolean;
  type: BiometricType;
};

export async function getBiometricSupport(): Promise<BiometricSupport> {
  if (Platform.OS === "web") {
    return { supported: false, enrolled: false, type: "unknown" };
  }
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      return { supported: false, enrolled: false, type: "unknown" };
    }
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    let type: BiometricType = "unknown";
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      type = "face";
    } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      type = "fingerprint";
    } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      type = "iris";
    }
    return { supported: true, enrolled, type };
  } catch {
    return { supported: false, enrolled: false, type: "unknown" };
  }
}

export async function isBiometricEnabled(): Promise<boolean> {
  const v = await storage.secureGet(BIOMETRIC_ENABLED_KEY, false);
  return v === true;
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  await storage.secureSet(BIOMETRIC_ENABLED_KEY, enabled);
}

export async function authenticateWithBiometrics(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const support = await getBiometricSupport();
    if (!support.supported || !support.enrolled) return false;
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: "Buka kunci DuitKu",
      fallbackLabel: "Gunakan PIN",
      cancelLabel: "Batal",
      disableDeviceFallback: false,
    });
    return !!res.success;
  } catch {
    return false;
  }
}

export function biometricLabel(type: BiometricType): string {
  if (type === "face") {
    return Platform.OS === "ios" ? "Gunakan Face ID" : "Gunakan Wajah";
  }
  if (type === "fingerprint") {
    return Platform.OS === "ios" ? "Gunakan Touch ID" : "Gunakan Sidik Jari";
  }
  if (type === "iris") return "Gunakan Iris";
  return "Gunakan Biometrik";
}
