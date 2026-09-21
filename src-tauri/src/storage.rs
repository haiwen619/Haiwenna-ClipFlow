use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipItem {
    pub id: i64,
    pub kind: String,
    pub text: Option<String>,
    #[serde(rename = "imagePath")]
    pub image_path: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    pub pinned: bool,
}

fn default_true() -> bool { true }
fn default_max_text() -> u32 { 4 }
fn default_max_image() -> u32 { 50 }
fn default_position_mode() -> String { "caret".to_string() }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    #[serde(rename = "maxCount")]
    pub max_count: u32,
    pub hotkey: String,
    #[serde(rename = "autostartEnabled")]
    pub autostart_enabled: bool,
    #[serde(rename = "replaceSystemClipboard")]
    pub replace_system_clipboard: bool,
    #[serde(rename = "captureText", default = "default_true")]
    pub capture_text: bool,
    #[serde(rename = "captureImages", default = "default_true")]
    pub capture_images: bool,
    #[serde(rename = "maxTextSizeMb", default = "default_max_text")]
    pub max_text_size_mb: u32,
    #[serde(rename = "maxImageSizeMb", default = "default_max_image")]
    pub max_image_size_mb: u32,
    #[serde(rename = "pastePlainText", default)]
    pub paste_plain_text: bool,
    #[serde(rename = "retentionDays", default)]
    pub retention_days: u32,
    #[serde(rename = "positionMode", default = "default_position_mode")]
    pub position_mode: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageStats {
    #[serde(rename = "dbSizeBytes")]
    pub db_size_bytes: u64,
    #[serde(rename = "imagesSizeBytes")]
    pub images_size_bytes: u64,
    #[serde(rename = "totalSizeBytes")]
    pub total_size_bytes: u64,
    #[serde(rename = "itemCount")]
    pub item_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PairedDevice {
    pub id: String,
    pub name: String,
    pub platform: String,
    #[serde(rename = "sharedKey")]
    pub shared_key: String,
    #[serde(rename = "pairedAt")]
    pub paired_at: i64,
    #[serde(rename = "lastActiveAt")]
    pub last_active_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceIdentity {
    #[serde(rename = "deviceId")]
    pub device_id: String,
    #[serde(rename = "deviceName")]
    pub device_name: String,
    pub platform: String,
    #[serde(rename = "syncEnabled")]
    pub sync_enabled: bool,
}

pub struct Store {
    conn: Mutex<Connection>,
    data_dir: PathBuf,
}

impl Store {
    pub fn new(data_dir: PathBuf) -> rusqlite::Result<Self> {
        std::fs::create_dir_all(&data_dir).ok();
        std::fs::create_dir_all(data_dir.join("images")).ok();
        let conn = Connection::open(data_dir.join("clipx.db"))?;
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS clips (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                kind TEXT NOT NULL,
                text TEXT,
                image_path TEXT,
                hash TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_clips_created ON clips(created_at DESC);
            CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
            CREATE TABLE IF NOT EXISTS paired_devices (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                platform TEXT NOT NULL,
                shared_key TEXT NOT NULL,
                paired_at INTEGER NOT NULL,
                last_active_at INTEGER NOT NULL
            );
            INSERT OR IGNORE INTO settings (key, value) VALUES ('max_count', '50');
            INSERT OR IGNORE INTO settings (key, value) VALUES ('hotkey', 'Alt+V');
            INSERT OR IGNORE INTO settings (key, value) VALUES ('autostart_enabled', '0');
            INSERT OR IGNORE INTO settings (key, value) VALUES ('replace_system_clipboard', '0');
            INSERT OR IGNORE INTO settings (key, value) VALUES ('ignored_apps', '[]');
            INSERT OR IGNORE INTO settings (key, value) VALUES ('onboarding_completed', '0');
            INSERT OR IGNORE INTO settings (key, value) VALUES ('capture_text', '1');
            INSERT OR IGNORE INTO settings (key, value) VALUES ('capture_images', '1');
            INSERT OR IGNORE INTO settings (key, value) VALUES ('max_text_size_mb', '4');
            INSERT OR IGNORE INTO settings (key, value) VALUES ('max_image_size_mb', '50');
            INSERT OR IGNORE INTO settings (key, value) VALUES ('paste_plain_text', '0');
            INSERT OR IGNORE INTO settings (key, value) VALUES ('retention_days', '0');
            INSERT OR IGNORE INTO settings (key, value) VALUES ('position_mode', 'caret');
            INSERT OR IGNORE INTO settings (key, value) VALUES ('sync_enabled', '0');
            INSERT OR IGNORE INTO settings (key, value) VALUES ('device_id', '');
            INSERT OR IGNORE INTO settings (key, value) VALUES ('device_name', '');
            "#,
        )?;
        conn.execute(
            "UPDATE settings SET value='Alt+V' WHERE key='hotkey' AND lower(replace(value, ' ', '')) IN ('ctrl+space', 'control+space')",
            [],
        )?;

        // migrate: add pinned column if missing
        let has_pinned: bool = {
            let mut stmt = conn.prepare("PRAGMA table_info(clips)")?;
            let cols: Vec<String> = stmt
                .query_map([], |r| r.get::<_, String>(1))?
                .filter_map(|x| x.ok())
                .collect();
            cols.iter().any(|c| c == "pinned")
        };
        if !has_pinned {
            conn.execute(
                "ALTER TABLE clips ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0",
                [],
            )?;
        }

        Ok(Self {
            conn: Mutex::new(conn),
            data_dir,
        })
    }

    pub fn data_dir(&self) -> &PathBuf {
        &self.data_dir
    }

    pub fn image_dir(&self) -> PathBuf {
        self.data_dir.join("images")
    }

    pub fn get_history(&self, limit: u32) -> rusqlite::Result<Vec<ClipItem>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, kind, text, image_path, created_at, pinned FROM clips \
             ORDER BY pinned DESC, created_at DESC LIMIT ?1",
        )?;
        let items = stmt
            .query_map([limit], |r| {
                Ok(ClipItem {
                    id: r.get(0)?,
                    kind: r.get(1)?,
                    text: r.get(2)?,
                    image_path: r.get(3)?,
                    created_at: r.get(4)?,
                    pinned: r.get::<_, i64>(5)? != 0,
                })
            })?
            .filter_map(|x| x.ok())
            .collect();
        Ok(items)
    }

    pub fn get_item(&self, id: i64) -> rusqlite::Result<Option<ClipItem>> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT id, kind, text, image_path, created_at, pinned FROM clips WHERE id = ?1",
            [id],
            |r| {
                Ok(ClipItem {
                    id: r.get(0)?,
                    kind: r.get(1)?,
                    text: r.get(2)?,
                    image_path: r.get(3)?,
                    created_at: r.get(4)?,
                    pinned: r.get::<_, i64>(5)? != 0,
                })
            },
        )
        .optional()
    }

    pub fn insert_text(&self, text: &str, hash: &str) -> rusqlite::Result<bool> {
        let conn = self.conn.lock().unwrap();
        let latest: Option<String> = conn
            .query_row(
                "SELECT hash FROM clips WHERE pinned=0 ORDER BY created_at DESC LIMIT 1",
                [],
                |r| r.get(0),
            )
            .optional()?;
        if latest.as_deref() == Some(hash) {
            return Ok(false);
        }
        conn.execute(
            "INSERT INTO clips (kind, text, hash, created_at, pinned) VALUES ('text', ?1, ?2, ?3, 0)",
            params![text, hash, now_ms()],
        )?;
        Ok(true)
    }

    pub fn insert_image(&self, path: &str, hash: &str) -> rusqlite::Result<bool> {
        let conn = self.conn.lock().unwrap();
        let latest: Option<String> = conn
            .query_row(
                "SELECT hash FROM clips WHERE pinned=0 ORDER BY created_at DESC LIMIT 1",
                [],
                |r| r.get(0),
            )
            .optional()?;
        if latest.as_deref() == Some(hash) {
            return Ok(false);
        }
        conn.execute(
            "INSERT INTO clips (kind, image_path, hash, created_at, pinned) VALUES ('image', ?1, ?2, ?3, 0)",
            params![path, hash, now_ms()],
        )?;
        Ok(true)
    }

    pub fn delete_item(&self, id: i64) -> rusqlite::Result<()> {
        let conn = self.conn.lock().unwrap();
        let path: Option<String> = conn
            .query_row("SELECT image_path FROM clips WHERE id=?1", [id], |r| {
                r.get(0)
            })
            .optional()?;
        conn.execute("DELETE FROM clips WHERE id = ?1", [id])?;
        if let Some(p) = path {
            std::fs::remove_file(p).ok();
        }
        Ok(())
    }

    pub fn clear_all(&self) -> rusqlite::Result<()> {
        let conn = self.conn.lock().unwrap();
        let mut stmt =
            conn.prepare("SELECT image_path FROM clips WHERE image_path IS NOT NULL AND pinned=0")?;
        let paths: Vec<String> = stmt
            .query_map([], |r| r.get::<_, String>(0))?
            .filter_map(|x| x.ok())
            .collect();
        drop(stmt);
        conn.execute("DELETE FROM clips WHERE pinned=0", [])?;
        for p in paths {
            std::fs::remove_file(p).ok();
        }
        Ok(())
    }

    pub fn trim(&self, max_count: u32) -> rusqlite::Result<()> {
        let conn = self.conn.lock().unwrap();
        // only trim unpinned entries beyond max_count
        let mut stmt = conn.prepare(
            "SELECT id, image_path FROM clips WHERE pinned=0 \
             ORDER BY created_at DESC LIMIT -1 OFFSET ?1",
        )?;
        let rows: Vec<(i64, Option<String>)> = stmt
            .query_map([max_count], |r| Ok((r.get(0)?, r.get(1)?)))?
            .filter_map(|x| x.ok())
            .collect();
        drop(stmt);
        for (id, path) in &rows {
            conn.execute("DELETE FROM clips WHERE id=?1", [id])?;
            if let Some(p) = path {
                std::fs::remove_file(p).ok();
            }
        }
        Ok(())
    }

    pub fn toggle_pin(&self, id: i64) -> rusqlite::Result<bool> {
        let conn = self.conn.lock().unwrap();
        let current: i64 = conn
            .query_row("SELECT pinned FROM clips WHERE id=?1", [id], |r| r.get(0))
            .optional()?
            .unwrap_or(0);
        let new_val = if current == 0 { 1 } else { 0 };
        conn.execute(
            "UPDATE clips SET pinned=?1 WHERE id=?2",
            params![new_val, id],
        )?;
        Ok(new_val == 1)
    }

    pub fn get_settings(&self) -> rusqlite::Result<Settings> {
        let conn = self.conn.lock().unwrap();
        let get = |k: &str, def: &str| -> String {
            conn.query_row("SELECT value FROM settings WHERE key=?1", [k], |r| r.get(0))
                .unwrap_or_else(|_| def.to_string())
        };
        Ok(Settings {
            max_count: get("max_count", "50").parse().unwrap_or(50),
            hotkey: get("hotkey", "Alt+V"),
            autostart_enabled: get("autostart_enabled", "0") == "1",
            replace_system_clipboard: get("replace_system_clipboard", "0") == "1",
            capture_text: get("capture_text", "1") == "1",
            capture_images: get("capture_images", "1") == "1",
            max_text_size_mb: get("max_text_size_mb", "4").parse().unwrap_or(4),
            max_image_size_mb: get("max_image_size_mb", "50").parse().unwrap_or(50),
            paste_plain_text: get("paste_plain_text", "0") == "1",
            retention_days: get("retention_days", "0").parse().unwrap_or(0),
            position_mode: get("position_mode", "caret"),
        })
    }

    pub fn save_settings(&self, s: &Settings) -> rusqlite::Result<()> {
        let conn = self.conn.lock().unwrap();
        let pairs = [
            ("max_count", s.max_count.to_string()),
            ("hotkey", s.hotkey.clone()),
            ("autostart_enabled", if s.autostart_enabled { "1" } else { "0" }.to_string()),
            ("replace_system_clipboard", if s.replace_system_clipboard { "1" } else { "0" }.to_string()),
            ("capture_text", if s.capture_text { "1" } else { "0" }.to_string()),
            ("capture_images", if s.capture_images { "1" } else { "0" }.to_string()),
            ("max_text_size_mb", s.max_text_size_mb.to_string()),
            ("max_image_size_mb", s.max_image_size_mb.to_string()),
            ("paste_plain_text", if s.paste_plain_text { "1" } else { "0" }.to_string()),
            ("retention_days", s.retention_days.to_string()),
            ("position_mode", s.position_mode.clone()),
        ];
        for (k, v) in pairs {
            conn.execute(
                "INSERT INTO settings (key, value) VALUES (?1, ?2) \
                 ON CONFLICT(key) DO UPDATE SET value=?2",
                params![k, v],
            )?;
        }
        Ok(())
    }

    pub fn get_storage_stats(&self) -> rusqlite::Result<StorageStats> {
        let db_path = self.data_dir.join("clipx.db");
        let mut db_size_bytes = std::fs::metadata(&db_path).map(|m| m.len()).unwrap_or(0);
        if let Ok(m) = std::fs::metadata(self.data_dir.join("clipx.db-wal")) {
            db_size_bytes += m.len();
        }
        if let Ok(m) = std::fs::metadata(self.data_dir.join("clipx.db-shm")) {
            db_size_bytes += m.len();
        }

        let mut images_size_bytes = 0u64;
        let img_dir = self.image_dir();
        if let Ok(entries) = std::fs::read_dir(&img_dir) {
            for entry in entries.flatten() {
                if let Ok(meta) = entry.metadata() {
                    if meta.is_file() {
                        images_size_bytes += meta.len();
                    }
                }
            }
        }

        let item_count: u64 = {
            let conn = self.conn.lock().unwrap();
            conn.query_row("SELECT COUNT(*) FROM clips", [], |r| r.get(0))
                .unwrap_or(0)
        };

        Ok(StorageStats {
            db_size_bytes,
            images_size_bytes,
            total_size_bytes: db_size_bytes + images_size_bytes,
            item_count,
        })
    }

    pub fn clean_expired_history(&self, retention_days: u32) -> rusqlite::Result<usize> {
        if retention_days == 0 {
            return Ok(0);
        }
        let cutoff = now_ms() - (retention_days as i64 * 86_400_000);
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, image_path FROM clips WHERE pinned=0 AND created_at < ?1",
        )?;
        let rows: Vec<(i64, Option<String>)> = stmt
            .query_map([cutoff], |r| Ok((r.get(0)?, r.get(1)?)))?
            .filter_map(|x| x.ok())
            .collect();
        drop(stmt);

        let count = rows.len();
        for (id, path) in &rows {
            conn.execute("DELETE FROM clips WHERE id=?1", [id])?;
            if let Some(p) = path {
                std::fs::remove_file(p).ok();
            }
        }
        Ok(count)
    }


    pub fn set_max_count(&self, n: u32) -> rusqlite::Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE settings SET value=?1 WHERE key='max_count'",
            [n.to_string()],
        )?;
        Ok(())
    }

    pub fn set_hotkey(&self, hotkey: &str) -> rusqlite::Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("UPDATE settings SET value=?1 WHERE key='hotkey'", [hotkey])?;
        Ok(())
    }

    pub fn set_autostart_enabled(&self, enabled: bool) -> rusqlite::Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE settings SET value=?1 WHERE key='autostart_enabled'",
            [if enabled { "1" } else { "0" }],
        )?;
        Ok(())
    }

    pub fn set_replace_system_clipboard(&self, enabled: bool) -> rusqlite::Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE settings SET value=?1 WHERE key='replace_system_clipboard'",
            [if enabled { "1" } else { "0" }],
        )?;
        Ok(())
    }

    pub fn get_ignored_apps(&self) -> rusqlite::Result<Vec<String>> {
        let conn = self.conn.lock().unwrap();
        let val: Option<String> = conn
            .query_row("SELECT value FROM settings WHERE key='ignored_apps'", [], |r| r.get(0))
            .optional()?;
        if let Some(json) = val {
            if let Ok(apps) = serde_json::from_str::<Vec<String>>(&json) {
                return Ok(apps);
            }
        }
        Ok(vec![])
    }

    pub fn set_ignored_apps(&self, apps: &[String]) -> rusqlite::Result<()> {
        let conn = self.conn.lock().unwrap();
        let json = serde_json::to_string(apps).unwrap_or_else(|_| "[]".to_string());
        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('ignored_apps', ?1) \
             ON CONFLICT(key) DO UPDATE SET value=?1",
            [json],
        )?;
        Ok(())
    }

    pub fn is_app_ignored(&self, proc_name: &str) -> bool {
        if proc_name.is_empty() {
            return false;
        }
        let lower = proc_name.to_lowercase();
        if let Ok(apps) = self.get_ignored_apps() {
            return apps.iter().any(|a| a.to_lowercase() == lower);
        }
        false
    }

    pub fn is_onboarding_completed(&self) -> bool {
        let conn = self.conn.lock().unwrap();
        let val: Option<String> = conn
            .query_row("SELECT value FROM settings WHERE key='onboarding_completed'", [], |r| r.get(0))
            .optional()
            .ok()
            .flatten();
        val.as_deref() == Some("1")
    }

    pub fn set_onboarding_completed(&self, completed: bool) -> rusqlite::Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('onboarding_completed', ?1) \
             ON CONFLICT(key) DO UPDATE SET value=?1",
            [if completed { "1" } else { "0" }],
        )?;
        Ok(())
    }

    pub fn get_device_identity(&self) -> rusqlite::Result<DeviceIdentity> {
        let conn = self.conn.lock().unwrap();
        let get = |k: &str| -> String {
            conn.query_row("SELECT value FROM settings WHERE key=?1", [k], |r| r.get(0))
                .unwrap_or_default()
        };

        let mut device_id = get("device_id");
        if device_id.is_empty() {
            device_id = crate::crypto::generate_device_id("win");
            conn.execute(
                "INSERT INTO settings (key, value) VALUES ('device_id', ?1) \
                 ON CONFLICT(key) DO UPDATE SET value=?1",
                [&device_id],
            )?;
        }

        let mut device_name = get("device_name");
        if device_name.is_empty() {
            device_name = std::env::var("COMPUTERNAME").unwrap_or_else(|_| "Windows PC".into());
            conn.execute(
                "INSERT INTO settings (key, value) VALUES ('device_name', ?1) \
                 ON CONFLICT(key) DO UPDATE SET value=?1",
                [&device_name],
            )?;
        }

        let sync_enabled = get("sync_enabled") == "1";

        Ok(DeviceIdentity {
            device_id,
            device_name,
            platform: "windows".to_string(),
            sync_enabled,
        })
    }

    pub fn set_device_name(&self, name: &str) -> rusqlite::Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('device_name', ?1) \
             ON CONFLICT(key) DO UPDATE SET value=?1",
            [name],
        )?;
        Ok(())
    }

    pub fn is_sync_enabled(&self) -> bool {
        let conn = self.conn.lock().unwrap();
        let val: Option<String> = conn
            .query_row("SELECT value FROM settings WHERE key='sync_enabled'", [], |r| r.get(0))
            .optional()
            .ok()
            .flatten();
        val.as_deref() == Some("1")
    }

    pub fn set_sync_enabled(&self, enabled: bool) -> rusqlite::Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('sync_enabled', ?1) \
             ON CONFLICT(key) DO UPDATE SET value=?1",
            [if enabled { "1" } else { "0" }],
        )?;
        Ok(())
    }

    pub fn get_paired_devices(&self) -> rusqlite::Result<Vec<PairedDevice>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, platform, shared_key, paired_at, last_active_at FROM paired_devices ORDER BY last_active_at DESC"
        )?;
        let items = stmt
            .query_map([], |r| {
                Ok(PairedDevice {
                    id: r.get(0)?,
                    name: r.get(1)?,
                    platform: r.get(2)?,
                    shared_key: r.get(3)?,
                    paired_at: r.get(4)?,
                    last_active_at: r.get(5)?,
                })
            })?
            .filter_map(|x| x.ok())
            .collect();
        Ok(items)
    }

    pub fn add_paired_device(&self, device: &PairedDevice) -> rusqlite::Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO paired_devices (id, name, platform, shared_key, paired_at, last_active_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6) \
             ON CONFLICT(id) DO UPDATE SET name=?2, platform=?3, shared_key=?4, last_active_at=?6",
            params![
                device.id,
                device.name,
                device.platform,
                device.shared_key,
                device.paired_at,
                device.last_active_at,
            ],
        )?;
        Ok(())
    }

    pub fn remove_paired_device(&self, id: &str) -> rusqlite::Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM paired_devices WHERE id=?1", [id])?;
        Ok(())
    }

    pub fn update_device_active(&self, id: &str) -> rusqlite::Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE paired_devices SET last_active_at=?1 WHERE id=?2",
            params![now_ms(), id],
        )?;
        Ok(())
    }
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}
