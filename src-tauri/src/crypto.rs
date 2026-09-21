use anyhow::{anyhow, Result};
use base64::prelude::*;
use chacha20poly1305::{
    aead::{Aead, KeyInit},
    ChaCha20Poly1305, Key, Nonce,
};
use rand::RngCore;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedEnvelope {
    pub version: u8,
    #[serde(rename = "senderId")]
    pub sender_id: String,
    #[serde(rename = "targetId")]
    pub target_id: Option<String>,
    pub timestamp: i64,
    pub seq: u64,
    pub nonce: String,
    pub kind: String, // "text" or "image"
    pub ciphertext: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PairingQrPayload {
    pub protocol: String, // "clipflow-e2ee-v1"
    #[serde(rename = "deviceId")]
    pub device_id: String,
    #[serde(rename = "deviceName")]
    pub device_name: String,
    pub platform: String,
    #[serde(rename = "sharedKey")]
    pub shared_key: String,
    #[serde(rename = "lanAddresses")]
    pub lan_addresses: Vec<String>,
    pub port: u16,
    pub timestamp: i64,
}

pub fn generate_shared_key() -> String {
    let mut key_bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut key_bytes);
    BASE64_STANDARD.encode(key_bytes)
}

pub fn generate_device_id(platform: &str) -> String {
    let mut id_bytes = [0u8; 6];
    rand::thread_rng().fill_bytes(&mut id_bytes);
    format!("{}-{}", platform.to_lowercase(), hex::encode(id_bytes))
}

pub fn encrypt(key_b64: &str, plaintext: &[u8]) -> Result<(String, String)> {
    let key_bytes = BASE64_STANDARD
        .decode(key_b64)
        .map_err(|e| anyhow!("Invalid key base64: {e}"))?;
    if key_bytes.len() != 32 {
        return Err(anyhow!("Key must be 32 bytes, got {}", key_bytes.len()));
    }

    let key = Key::from_slice(&key_bytes);
    let cipher = ChaCha20Poly1305::new(key);

    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext_bytes = cipher
        .encrypt(nonce, plaintext)
        .map_err(|e| anyhow!("Encryption error: {e}"))?;

    let nonce_b64 = BASE64_STANDARD.encode(nonce_bytes);
    let ciphertext_b64 = BASE64_STANDARD.encode(ciphertext_bytes);

    Ok((nonce_b64, ciphertext_b64))
}

pub fn decrypt(key_b64: &str, nonce_b64: &str, ciphertext_b64: &str) -> Result<Vec<u8>> {
    let key_bytes = BASE64_STANDARD
        .decode(key_b64)
        .map_err(|e| anyhow!("Invalid key base64: {e}"))?;
    if key_bytes.len() != 32 {
        return Err(anyhow!("Key must be 32 bytes, got {}", key_bytes.len()));
    }

    let nonce_bytes = BASE64_STANDARD
        .decode(nonce_b64)
        .map_err(|e| anyhow!("Invalid nonce base64: {e}"))?;
    if nonce_bytes.len() != 12 {
        return Err(anyhow!("Nonce must be 12 bytes, got {}", nonce_bytes.len()));
    }

    let ciphertext_bytes = BASE64_STANDARD
        .decode(ciphertext_b64)
        .map_err(|e| anyhow!("Invalid ciphertext base64: {e}"))?;

    let key = Key::from_slice(&key_bytes);
    let cipher = ChaCha20Poly1305::new(key);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let plaintext = cipher
        .decrypt(nonce, ciphertext_bytes.as_ref())
        .map_err(|e| anyhow!("Decryption / authentication tag failed: {e}"))?;

    Ok(plaintext)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let key = generate_shared_key();
        let message = "Haiwenna ClipFlow 端到端加密剪贴板传输测试 🔒🚀";
        let (nonce, ciphertext) = encrypt(&key, message.as_bytes()).unwrap();

        let decrypted_bytes = decrypt(&key, &nonce, &ciphertext).unwrap();
        let decrypted_str = String::from_utf8(decrypted_bytes).unwrap();
        assert_eq!(decrypted_str, message);
    }

    #[test]
    fn test_tampered_fails() {
        let key = generate_shared_key();
        let message = "Original Message";
        let (nonce, mut ciphertext) = encrypt(&key, message.as_bytes()).unwrap();

        // Tamper with ciphertext
        let mut raw = BASE64_STANDARD.decode(&ciphertext).unwrap();
        if let Some(first) = raw.first_mut() {
            *first ^= 0x55;
        }
        ciphertext = BASE64_STANDARD.encode(raw);

        let result = decrypt(&key, &nonce, &ciphertext);
        assert!(result.is_err(), "Tampered ciphertext must fail authentication!");
    }
}
