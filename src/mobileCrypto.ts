// WebCrypto API AES-256-GCM helper for mobile client

function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000;
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    chunks.push(
      String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK_SIZE) as unknown as number[])
    );
  }
  return btoa(chunks.join(""));
}

export async function importKey(base64Key: string): Promise<CryptoKey> {
  const rawKey = base64ToBytes(base64Key);
  return window.crypto.subtle.importKey(
    "raw",
    rawKey.buffer as ArrayBuffer,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function decryptEnvelope(
  base64Key: string,
  nonceB64: string,
  ciphertextB64: string
): Promise<string> {
  const key = await importKey(base64Key);
  const nonce = base64ToBytes(nonceB64);
  const ciphertextAndTag = base64ToBytes(ciphertextB64);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: nonce as unknown as BufferSource,
    },
    key,
    ciphertextAndTag as unknown as BufferSource
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

export async function encryptPayload(
  base64Key: string,
  plaintext: string
): Promise<{ nonce: string; ciphertext: string }> {
  const key = await importKey(base64Key);
  const nonce = window.crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: nonce as unknown as BufferSource,
    },
    key,
    data as unknown as BufferSource
  );

  return {
    nonce: bytesToBase64(nonce),
    ciphertext: bytesToBase64(new Uint8Array(encryptedBuffer)),
  };
}

export async function deriveRoomId(base64Key: string): Promise<string> {
  const enc = new TextEncoder().encode(base64Key);
  const hashBuf = await window.crypto.subtle.digest("SHA-256", enc);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  return hashArr.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

