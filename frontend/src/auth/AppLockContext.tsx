import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from "react";
import { AppState, AppStateStatus } from "react-native";

import {
  isPinSet, verifyPin, clearPin,
  getPinLockStatus, registerFailedPin, resetPinAttempts,
} from "./pinService";
import {
  getBiometricSupport, isBiometricEnabled, authenticateWithBiometrics,
  setBiometricEnabled, BiometricType,
} from "./biometricService";

type Ctx = {
  ready: boolean;
  pinConfigured: boolean;
  locked: boolean;
  pinLockedUntil: number;
  biometricAvailable: boolean;
  biometricType: BiometricType;
  refreshPinState: () => Promise<void>;
  unlockWithPin: (pin: string) => Promise<boolean>;
  unlockWithBiometrics: () => Promise<boolean>;
  bypassLock: () => void;        // Used right after PIN setup completes
  lockNow: () => void;
  resetPinSecurity: () => Promise<void>;
};

const AppLockCtx = createContext<Ctx | null>(null);

export function AppLockProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [pinConfigured, setPinConfigured] = useState(false);
  const [locked, setLocked] = useState(true);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<BiometricType>("unknown");
  const [pinLockedUntil, setPinLockedUntil] = useState(0);

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const refreshPinState = useCallback(async () => {
    const set = await isPinSet();
    setPinConfigured(set);
    if (set) {
      const enabled = await isBiometricEnabled();
      if (enabled) {
        const support = await getBiometricSupport();
        setBiometricAvailable(support.supported && support.enrolled);
        setBiometricType(support.type);
      } else {
        setBiometricAvailable(false);
      }
    } else {
      setBiometricAvailable(false);
    }
  }, []);

  // Bootstrap
  useEffect(() => {
    (async () => {
      await refreshPinState();
      const set = await isPinSet();
      setLocked(set); // locked only if PIN is configured
      const status = await getPinLockStatus();
      setPinLockedUntil(status.lockedUntil);
      setReady(true);
    })();
  }, [refreshPinState]);

  // Lock on background → foreground
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (prev.match(/inactive|background/) && next === "active") {
        if (pinConfigured) setLocked(true);
      }
    });
    return () => sub.remove();
  }, [pinConfigured]);

  const unlockWithPin = useCallback(async (pin: string) => {
    if (Date.now() < pinLockedUntil) return false;
    const ok = await verifyPin(pin);
    if (ok) {
      await resetPinAttempts();
      setPinLockedUntil(0);
      setLocked(false);
      return true;
    }
    const status = await registerFailedPin();
    setPinLockedUntil(status.lockedUntil);
    return false;
  }, [pinLockedUntil]);

  const unlockWithBiometrics = useCallback(async () => {
    if (!biometricAvailable) return false;
    const ok = await authenticateWithBiometrics();
    if (ok) setLocked(false);
    return ok;
  }, [biometricAvailable]);

  const bypassLock = useCallback(() => setLocked(false), []);
  const lockNow = useCallback(() => {
    if (pinConfigured) setLocked(true);
  }, [pinConfigured]);

  const resetPinSecurity = useCallback(async () => {
    await clearPin();
    await setBiometricEnabled(false);
    setPinConfigured(false);
    setBiometricAvailable(false);
    setLocked(false);
    setPinLockedUntil(0);
  }, []);

  return (
    <AppLockCtx.Provider
      value={{
        ready,
        pinConfigured,
        locked,
        pinLockedUntil,
        biometricAvailable,
        biometricType,
        refreshPinState,
        unlockWithPin,
        unlockWithBiometrics,
        bypassLock,
        lockNow,
        resetPinSecurity,
      }}
    >
      {children}
    </AppLockCtx.Provider>
  );
}

export function useAppLock(): Ctx {
  const v = useContext(AppLockCtx);
  if (!v) throw new Error("useAppLock must be used inside AppLockProvider");
  return v;
}
