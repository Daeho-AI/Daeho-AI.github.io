const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBinary(bytes: Uint8Array): string {
  let output = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    output += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return output;
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  return btoa(bytesToBinary(bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid base64url value");
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function randomToken(byteLength = 32): string {
  if (!Number.isInteger(byteLength) || byteLength < 16 || byteLength > 64) {
    throw new Error("Random token length is out of range");
  }
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

export async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

export function createPkceVerifier(): string {
  return randomToken(32);
}

export async function createPkceChallenge(verifier: string): Promise<string> {
  return sha256Base64Url(verifier);
}

async function encryptionKey(secret: string): Promise<CryptoKey> {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new Error("SESSION_ENCRYPTION_KEY must contain at least 32 characters");
  }
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function sealJson(value: unknown, secret: string): Promise<string> {
  const key = await encryptionKey(secret);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const plaintext = encoder.encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return `v1.${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(ciphertext))}`;
}

export async function openJson<T>(sealed: string, secret: string): Promise<T> {
  const parts = sealed.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") throw new Error("Invalid encrypted payload");
  const key = await encryptionKey(secret);
  const iv = base64UrlToBytes(parts[1]);
  if (iv.length !== 12) throw new Error("Invalid encrypted payload IV");
  const ciphertext = base64UrlToBytes(parts[2]);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return JSON.parse(decoder.decode(plaintext)) as T;
}
