use crate::storage::Store;
use anyhow::{anyhow, Result};
use enigo::{Direction, Enigo, Key, Keyboard, Settings};

pub fn paste(store: &Store, id: i64) -> Result<()> {
    let item = store
        .get_item(id)
        .map_err(|e| anyhow!(e.to_string()))?
        .ok_or_else(|| anyhow!("clip item {} not found", id))?;
    let mut cb = arboard::Clipboard::new().map_err(|e| anyhow!(e.to_string()))?;
    match item.kind.as_str() {
        "text" => {
            if let Some(t) = item.text {
                cb.set_text(t).map_err(|e| anyhow!(e.to_string()))?;
            }
        }
        "image" => {
            if let Some(p) = item.image_path {
                let img = image::open(&p)?.to_rgba8();
                let (w, h) = img.dimensions();
                cb.set_image(arboard::ImageData {
                    width: w as usize,
                    height: h as usize,
                    bytes: std::borrow::Cow::Owned(img.into_raw()),
                })
                .map_err(|e| anyhow!(e.to_string()))?;
            }
        }
        _ => {}
    }
    Ok(())
}

pub fn send_ctrl_v() -> Result<()> {
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| anyhow!(e.to_string()))?;
    enigo
        .key(Key::Control, Direction::Press)
        .map_err(|e| anyhow!(e.to_string()))?;
    let click_result = enigo
        .key(Key::Unicode('v'), Direction::Click)
        .map_err(|e| anyhow!(e.to_string()));
    let release_result = enigo
        .key(Key::Control, Direction::Release)
        .map_err(|e| anyhow!(e.to_string()));
    click_result.and(release_result)
}
