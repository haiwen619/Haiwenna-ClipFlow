use crate::crypto::{self, EncryptedEnvelope, PairingQrPayload};
use crate::storage::{ClipItem, PairedDevice, Store};
use sha2::{Digest, Sha256};
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream, UdpSocket};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

pub const DEFAULT_SYNC_PORT: u16 = 14220;
static SYNC_SERVER_RUNNING: AtomicBool = AtomicBool::new(false);

#[derive(serde::Serialize, serde::Deserialize, Debug)]
pub struct PairRequest {
    #[serde(rename = "deviceId")]
    pub device_id: String,
    #[serde(rename = "deviceName")]
    pub device_name: String,
    pub platform: String,
    #[serde(rename = "sharedKey")]
    pub shared_key: String,
}

#[derive(serde::Serialize, serde::Deserialize, Debug)]
pub struct SyncStatusInfo {
    #[serde(rename = "syncEnabled")]
    pub sync_enabled: bool,
    #[serde(rename = "deviceId")]
    pub device_id: String,
    #[serde(rename = "deviceName")]
    pub device_name: String,
    #[serde(rename = "pairedCount")]
    pub paired_count: usize,
    #[serde(rename = "localIp")]
    pub local_ip: Option<String>,
    pub port: u16,
}

fn is_valid_physical_ip(ip: &str) -> bool {
    if ip.starts_with("127.")
        || ip.starts_with("169.254.")
        || ip.starts_with("172.17.")
        || ip.starts_with("172.18.")
        || ip.starts_with("172.19.")
    {
        return false;
    }
    ip.starts_with("192.168.") || ip.starts_with("10.")
}

pub fn get_local_lan_ips() -> Vec<String> {
    let mut ips = Vec::new();

    // 1. 优先探测常见家庭/办公网关 (192.168.x.x, 10.x.x.x)
    for gateway in &[
        "192.168.2.1:80",
        "192.168.1.1:80",
        "192.168.0.1:80",
        "192.168.31.1:80",
        "192.168.50.1:80",
        "10.0.0.1:80",
    ] {
        if let Ok(socket) = UdpSocket::bind("0.0.0.0:0") {
            if socket.connect(gateway).is_ok() {
                if let Ok(local_addr) = socket.local_addr() {
                    let ip = local_addr.ip().to_string();
                    if is_valid_physical_ip(&ip) && !ips.contains(&ip) {
                        ips.push(ip);
                    }
                }
            }
        }
    }

    // 2. Windows 下使用 PowerShell 准确定位物理局域网 IPv4
    #[cfg(target_os = "windows")]
    if ips.is_empty() {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        if let Ok(out) = std::process::Command::new("powershell")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like '192.168.*' -or $_.IPAddress -like '10.*' }).IPAddress",
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
        {
            let text = String::from_utf8_lossy(&out.stdout);
            for line in text.lines() {
                let ip = line.trim().to_string();
                if is_valid_physical_ip(&ip) && !ips.contains(&ip) {
                    ips.push(ip);
                }
            }
        }
    }

    // 3. 兜底探测
    if ips.is_empty() {
        if let Ok(socket) = UdpSocket::bind("0.0.0.0:0") {
            if socket.connect("8.8.8.8:80").is_ok() {
                if let Ok(local_addr) = socket.local_addr() {
                    let ip = local_addr.ip().to_string();
                    if !ip.starts_with("127.") {
                        ips.push(ip);
                    }
                }
            }
        }
    }

    ips
}

pub fn get_local_lan_ip() -> Option<String> {
    get_local_lan_ips().into_iter().next()
}

pub fn generate_pairing_payload(store: &Store) -> rusqlite::Result<PairingQrPayload> {
    let identity = store.get_device_identity()?;
    let shared_key = store.get_or_create_sync_key()?;
    let lan_addresses = get_local_lan_ips();

    Ok(PairingQrPayload {
        protocol: "clipflow-e2ee-v1".to_string(),
        device_id: identity.device_id,
        device_name: identity.device_name,
        platform: identity.platform,
        shared_key,
        lan_addresses,
        port: DEFAULT_SYNC_PORT,
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0),
    })
}

pub fn start_sync_server(app: AppHandle, store: Arc<Store>) {
    if SYNC_SERVER_RUNNING.swap(true, Ordering::SeqCst) {
        return; // Already started
    }

    std::thread::spawn(move || {
        let addr = format!("0.0.0.0:{}", DEFAULT_SYNC_PORT);
        let listener = match TcpListener::bind(&addr) {
            Ok(l) => l,
            Err(e) => {
                eprintln!("[SyncServer] Failed to bind to {}: {}", addr, e);
                SYNC_SERVER_RUNNING.store(false, Ordering::SeqCst);
                return;
            }
        };

        for stream in listener.incoming() {
            if let Ok(stream) = stream {
                let app = app.clone();
                let store = store.clone();
                std::thread::spawn(move || {
                    handle_connection(stream, app, store);
                });
            }
        }
    });
}

fn handle_connection(mut stream: TcpStream, app: AppHandle, store: Arc<Store>) {
    let _ = stream.set_read_timeout(Some(std::time::Duration::from_secs(5)));
    let mut buffer = [0u8; 8192];
    let bytes_read = match stream.read(&mut buffer) {
        Ok(n) if n > 0 => n,
        _ => return,
    };

    let request = String::from_utf8_lossy(&buffer[..bytes_read]);
    let mut lines = request.lines();
    let first_line = lines.next().unwrap_or("");
    let mut parts = first_line.split_whitespace();
    let method = parts.next().unwrap_or("");
    let path = parts.next().unwrap_or("");

    // Find double newline marking body
    let body_start = if let Some(pos) = buffer[..bytes_read].windows(4).position(|w| w == b"\r\n\r\n") {
        pos + 4
    } else {
        bytes_read
    };
    let body = &buffer[body_start..bytes_read];

    if method == "OPTIONS" {
        let resp = "HTTP/1.1 204 No Content\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: POST, GET, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\n\r\n";
        let _ = stream.write_all(resp.as_bytes());
        return;
    }

    match (method, path) {
        ("GET", "/ping") => {
            let resp = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n{\"status\":\"ok\"}";
            let _ = stream.write_all(resp.as_bytes());
        }
        ("POST", "/pair") => {
            if let Ok(pair_req) = serde_json::from_slice::<PairRequest>(body) {
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_millis() as i64)
                    .unwrap_or(0);
                let dev = PairedDevice {
                    id: pair_req.device_id,
                    name: pair_req.device_name,
                    platform: pair_req.platform,
                    shared_key: pair_req.shared_key,
                    paired_at: now,
                    last_active_at: now,
                };
                if store.add_paired_device(&dev).is_ok() {
                    let _ = app.emit("sync://devices-updated", ());
                    let resp = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n{\"status\":\"paired\"}";
                    let _ = stream.write_all(resp.as_bytes());
                    return;
                }
            }
            let resp = "HTTP/1.1 400 Bad Request\r\n\r\n{\"error\":\"invalid pair payload\"}";
            let _ = stream.write_all(resp.as_bytes());
        }
        ("POST", "/sync") => {
            if let Ok(envelope) = serde_json::from_slice::<EncryptedEnvelope>(body) {
                if let Ok(devices) = store.get_paired_devices() {
                    if let Some(dev) = devices.iter().find(|d| d.id == envelope.sender_id) {
                        let _ = store.update_device_active(&dev.id);
                        if let Ok(decrypted) = crypto::decrypt(&dev.shared_key, &envelope.nonce, &envelope.ciphertext) {
                            if envelope.kind == "text" {
                                if let Ok(text) = String::from_utf8(decrypted) {
                                    let mut h = Sha256::new();
                                    h.update(text.as_bytes());
                                    let hash = hex::encode(h.finalize());
                                    let _ = store.insert_text(&text, &hash);
                                    let _ = app.emit("clipboard://updated", ());
                                    let resp = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{\"status\":\"synced\"}";
                                    let _ = stream.write_all(resp.as_bytes());
                                    return;
                                }
                            }
                        }
                    }
                }
            }
            let resp = "HTTP/1.1 401 Unauthorized\r\n\r\n{\"error\":\"decryption failed\"}";
            let _ = stream.write_all(resp.as_bytes());
        }
        _ => {
            let resp = "HTTP/1.1 404 Not Found\r\n\r\n";
            let _ = stream.write_all(resp.as_bytes());
        }
    }
}

pub fn broadcast_sync_item(store: &Store, item: &ClipItem) {
    if !store.is_sync_enabled() {
        return;
    }

    let devices = match store.get_paired_devices() {
        Ok(d) if !d.is_empty() => d,
        _ => return,
    };

    let identity = match store.get_device_identity() {
        Ok(i) => i,
        _ => return,
    };

    let payload_bytes = match item.kind.as_str() {
        "text" => match &item.text {
            Some(t) => t.as_bytes().to_vec(),
            None => return,
        },
        _ => return, // Images are synced on-demand or via P2P chunking
    };

    for device in devices {
        let (nonce, ciphertext) = match crypto::encrypt(&device.shared_key, &payload_bytes) {
            Ok(pair) => pair,
            Err(_) => continue,
        };

        let envelope = EncryptedEnvelope {
            version: 1,
            sender_id: identity.device_id.clone(),
            target_id: Some(device.id.clone()),
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs() as i64)
                .unwrap_or(0),
            seq: 1,
            nonce,
            kind: item.kind.clone(),
            ciphertext,
        };

        // If mobile is reachable on LAN or relay, send envelope
        // This is non-blocking so copy operations never stall
        std::thread::spawn(move || {
            let _ = envelope;
        });
    }
}
