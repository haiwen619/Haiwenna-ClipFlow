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

        // small delay to let owner finish writing
        std::thread::sleep(std::time::Duration::from_millis(30));

        let mut cb = match arboard::Clipboard::new() {
            Ok(c) => c,
            Err(_) => return CallbackResult::Next,
        };

        if let Ok(text) = cb.get_text() {
            if !text.is_empty() {
                let hash = sha256_hex(text.as_bytes());
                if let Ok(true) = self.store.insert_text(&text, &hash) {
                    self.trim_and_emit();
                }
                return CallbackResult::Next;
            }
        }

        if let Ok(img) = cb.get_image() {
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
        }
        let _ = self.app.emit("clipboard://updated", ());
    }
}

fn sha256_hex(bytes: &[u8]) -> String {
    let mut h = Sha256::new();
    h.update(bytes);
    hex::encode(h.finalize())
}
