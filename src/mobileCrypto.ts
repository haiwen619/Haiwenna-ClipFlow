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
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
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
