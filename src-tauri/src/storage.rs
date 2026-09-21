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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    #[serde(rename = "maxCount")]
    pub max_count: u32,
    pub hotkey: String,
    #[serde(rename = "autostartEnabled")]
    pub autostart_enabled: bool,
    #[serde(rename = "replaceSystemClipboard")]
    pub replace_system_clipboard: bool,
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
            INSERT OR IGNORE INTO settings (key, value) VALUES ('max_count', '50');
            INSERT OR IGNORE INTO settings (key, value) VALUES ('hotkey', 'Alt+V');
            INSERT OR IGNORE INTO settings (key, value) VALUES ('autostart_enabled', '0');
            INSERT OR IGNORE INTO settings (key, value) VALUES ('replace_system_clipboard', '0');
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
        let get = |k: &str| -> rusqlite::Result<String> {
            conn.query_row("SELECT value FROM settings WHERE key=?1", [k], |r| r.get(0))
        };
        Ok(Settings {
            max_count: get("max_count")?.parse().unwrap_or(50),
            hotkey: get("hotkey")?,
            autostart_enabled: get("autostart_enabled")? == "1",
            replace_system_clipboard: get("replace_system_clipboard")? == "1",
        })
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
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}
