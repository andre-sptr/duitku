// PIN security service - hashes PIN with SHA-256 + random salt, stores in SecureStore
import * as Crypto from "expo-crypto";
import { storage } from "@/src/utils/storage";

const PIN_HASH_KEY = "duitku.pin.hash";
const PIN_SALT_KEY = "duitku.pin.salt";

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
  const hash = await storage.secureGet(PIN_HASH_KEY, "");
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
}

export async function verifyPin(pin: string): Promise<boolean> {
  const salt = (await storage.secureGet(PIN_SALT_KEY, "")) as string;
  const storedHash = (await storage.secureGet(PIN_HASH_KEY, "")) as string;
  if (!salt || !storedHash) return false;
  const hash = await hashPin(pin, salt);
  return hash === storedHash;
}

export async function clearPin(): Promise<void> {
  await storage.secureRemove(PIN_HASH_KEY);
  await storage.secureRemove(PIN_SALT_KEY);
}
