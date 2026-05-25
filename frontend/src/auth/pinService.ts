// PIN security service - hashes PIN with SHA-256 + random salt, stores in SecureStore
import * as Crypto from "expo-crypto";
import { storage } from "@/src/utils/storage";

const PIN_HASH_KEY = "duitku.pin.hash";
const PIN_SALT_KEY = "duitku.pin.salt";
const PIN_ATTEMPTS_KEY = "duitku.pin.attempts";
const PIN_LOCK_UNTIL_KEY = "duitku.pin.lockUntil";

// Brute-force throttle: 4 free misses, then an escalating cooldown on each further miss.
const ATTEMPTS_BEFORE_LOCKOUT = 5;
const COOLDOWNS_MS = [30_000, 60_000, 300_000, 900_000]; // 30s, 1m, 5m, 15m

function cooldownFor(attempts: number): number {
  if (attempts < ATTEMPTS_BEFORE_LOCKOUT) return 0;
  const over = attempts - ATTEMPTS_BEFORE_LOCKOUT;
  return COOLDOWNS_MS[Math.min(over, COOLDOWNS_MS.length - 1)];
}

export type PinLockStatus = { attempts: number; lockedUntil: number };

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

async function generateSalt(bytes = 16): Promise<string> {
  try {
    const random = await Crypto.getRandomBytesAsync(bytes);
    return bytesToHex(random);
  } catch {
    // Web fallback
    const arr = new Uint8Array(bytes);
    for (let i = 0; i < bytes; i++) arr[i] = Math.floor(Math.random() * 256);
    return bytesToHex(arr);
  }
}

async function hashPin(pin: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${pin}`
  );
}

export async function isPinSet(): Promise<boolean> {
  const hash = await storage.secureGet<string>(PIN_HASH_KEY, "");
  return !!hash && typeof hash === "string" && hash.length > 0;
}

export async function setPin(pin: string): Promise<void> {
  if (!/^\d{4}$/.test(pin)) {
    throw new Error("PIN harus 4 digit angka");
  }
  const salt = await generateSalt();
  const hash = await hashPin(pin, salt);
  await storage.secureSet(PIN_SALT_KEY, salt);
  await storage.secureSet(PIN_HASH_KEY, hash);
  await resetPinAttempts();
}

export async function verifyPin(pin: string): Promise<boolean> {
  const salt = await storage.secureGet<string>(PIN_SALT_KEY, "");
  const storedHash = await storage.secureGet<string>(PIN_HASH_KEY, "");
  if (!salt || !storedHash) return false;
  const hash = await hashPin(pin, salt);
  return hash === storedHash;
}

export async function clearPin(): Promise<void> {
  await storage.secureRemove(PIN_HASH_KEY);
  await storage.secureRemove(PIN_SALT_KEY);
  await resetPinAttempts();
}

export async function getPinLockStatus(): Promise<PinLockStatus> {
  const attempts = (await storage.secureGet<number>(PIN_ATTEMPTS_KEY, 0)) ?? 0;
  const lockedUntil = (await storage.secureGet<number>(PIN_LOCK_UNTIL_KEY, 0)) ?? 0;
  return { attempts, lockedUntil };
}

export async function registerFailedPin(): Promise<PinLockStatus> {
  const { attempts } = await getPinLockStatus();
  const next = attempts + 1;
  const cooldown = cooldownFor(next);
  const lockedUntil = cooldown > 0 ? Date.now() + cooldown : 0;
  await storage.secureSet(PIN_ATTEMPTS_KEY, next);
  await storage.secureSet(PIN_LOCK_UNTIL_KEY, lockedUntil);
  return { attempts: next, lockedUntil };
}

export async function resetPinAttempts(): Promise<void> {
  await storage.secureSet(PIN_ATTEMPTS_KEY, 0);
  await storage.secureSet(PIN_LOCK_UNTIL_KEY, 0);
}
