use crate::storage::Store;
use clipboard_master::{CallbackResult, ClipboardHandler, Master};
use sha2::{Digest, Sha256};
use std::io;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

pub static PAUSED: AtomicBool = AtomicBool::new(false);

pub fn is_paused() -> bool {
    PAUSED.load(Ordering::Relaxed)
}

pub fn set_paused(paused: bool) {
    PAUSED.store(paused, Ordering::Relaxed);
}

pub fn spawn(app: AppHandle, store: Arc<Store>) {
    std::thread::spawn(move || {
        let handler = Handler { app, store };
        if let Ok(mut master) = Master::new(handler) {
            let _ = master.run();
        }
    });
}

struct Handler {
    app: AppHandle,
    store: Arc<Store>,
}

impl ClipboardHandler for Handler {
    fn on_clipboard_change(&mut self) -> CallbackResult {
        if is_paused() {
            return CallbackResult::Next;
        }

        if let Some(proc_name) = get_active_process_name() {
            if self.store.is_app_ignored(&proc_name) {
                return CallbackResult::Next;
            }
        }

        // small delay to let owner finish writing
        std::thread::sleep(std::time::Duration::from_millis(30));

        let mut cb = match arboard::Clipboard::new() {
            Ok(c) => c,
            Err(_) => return CallbackResult::Next,
        };

        let settings = self.store.get_settings().ok();
        let capture_text = settings.as_ref().map(|s| s.capture_text).unwrap_or(true);
        let capture_images = settings.as_ref().map(|s| s.capture_images).unwrap_or(true);
        let max_text_bytes = settings
            .as_ref()
            .map(|s| (s.max_text_size_mb as usize) * 1024 * 1024)
            .unwrap_or(4 * 1024 * 1024);
        let max_image_bytes = settings
            .as_ref()
            .map(|s| (s.max_image_size_mb as usize) * 1024 * 1024)
            .unwrap_or(50 * 1024 * 1024);

        if capture_text {
            if let Ok(text) = cb.get_text() {
                if !text.is_empty() && text.len() <= max_text_bytes {
                    let hash = sha256_hex(text.as_bytes());
                    if let Ok(true) = self.store.insert_text(&text, &hash) {
                        self.trim_and_emit();
                    }
                    return CallbackResult::Next;
                }
            }
        }

        if capture_images {
            if let Ok(img) = cb.get_image() {
                if img.bytes.len() <= max_image_bytes {
                    let hash = sha256_hex(&img.bytes);
                    let filename = format!("{}.png", &hash[..16]);
                    let path = self.store.image_dir().join(&filename);
                    if !path.exists() {
                        if let Some(rgba) = image::RgbaImage::from_raw(
                            img.width as u32,
                            img.height as u32,
                            img.bytes.into_owned(),
                        ) {
                            let _ = rgba.save(&path);
                        }
                    }
                    if let Some(p) = path.to_str() {
                        if let Ok(true) = self.store.insert_image(p, &hash) {
                            self.trim_and_emit();
                        }
                    }
                }
            }
        }

        CallbackResult::Next
    }

    fn on_clipboard_error(&mut self, _error: io::Error) -> CallbackResult {
        CallbackResult::Next
    }
}

impl Handler {
    fn trim_and_emit(&self) {
        if let Ok(s) = self.store.get_settings() {
            let _ = self.store.trim(s.max_count);
            let _ = self.store.clean_expired_history(s.retention_days);
        }
        let _ = self.app.emit("clipboard://updated", ());
    }
}

fn sha256_hex(bytes: &[u8]) -> String {
    let mut h = Sha256::new();
    h.update(bytes);
    hex::encode(h.finalize())
}

#[cfg(target_os = "windows")]
fn get_active_process_name() -> Option<String> {
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_FORMAT,
        PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowThreadProcessId,
    };

    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0.is_null() {
            return None;
        }
        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        if pid == 0 {
            return None;
        }
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
        let mut buf = [0u16; 1024];
        let mut size = buf.len() as u32;
        let res = QueryFullProcessImageNameW(
            handle,
            PROCESS_NAME_FORMAT(0),
            windows::core::PWSTR(buf.as_mut_ptr()),
            &mut size,
        );
        let _ = CloseHandle(handle);
        if res.is_ok() && size > 0 {
            let path_str = String::from_utf16_lossy(&buf[..size as usize]);
            let file_name = std::path::Path::new(&path_str)
                .file_name()
                .and_then(|f| f.to_str())
                .unwrap_or(&path_str)
                .to_string();
            return Some(file_name);
        }
        None
    }
}

#[cfg(not(target_os = "windows"))]
fn get_active_process_name() -> Option<String> {
    None
}
