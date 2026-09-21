use crate::storage::{ClipItem, Settings, Store};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_global_shortcut::GlobalShortcutExt;

const DEFAULT_HOTKEY: &str = "Alt+V";
const REPLACEMENT_HOTKEY: &str = "Win+V";

pub struct AppState {
    pub store: Arc<Store>,
    pub tray_icon_hidden: std::sync::Mutex<bool>,
}

#[tauri::command]
pub fn get_history(state: State<'_, AppState>, limit: u32) -> Result<Vec<ClipItem>, String> {
    state.store.get_history(limit).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn paste_item(app: AppHandle, state: State<'_, AppState>, id: i64) -> Result<(), String> {
    crate::paste::paste(&state.store, id).map_err(|e| e.to_string())?;
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.hide();
    }
    std::thread::spawn(|| {
        crate::replacement_hotkey::reset_state();
        std::thread::sleep(std::time::Duration::from_millis(120));
        crate::focus::restore_foreground_window();
        std::thread::sleep(std::time::Duration::from_millis(80));
        let _ = crate::paste::send_ctrl_v();
    });
    Ok(())
}

#[tauri::command]
pub fn delete_item(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    state.store.delete_item(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_all(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    state.store.clear_all().map_err(|e| e.to_string())?;
    let _ = app.emit("clipboard://updated", ());
    Ok(())
}

#[tauri::command]
pub fn toggle_pin(app: AppHandle, state: State<'_, AppState>, id: i64) -> Result<bool, String> {
    let pinned = state.store.toggle_pin(id).map_err(|e| e.to_string())?;
    let _ = app.emit("clipboard://updated", ());
    Ok(pinned)
}

#[tauri::command]
pub fn copy_item(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    // copy back to system clipboard without triggering paste
    crate::paste::paste(&state.store, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_settings(app: AppHandle, state: State<'_, AppState>) -> Result<Settings, String> {
    let mut settings = state.store.get_settings().map_err(|e| e.to_string())?;
    if let Ok(enabled) = app.autolaunch().is_enabled().map_err(|e| e.to_string()) {
        settings.autostart_enabled = enabled;
    }
    Ok(settings)
}

#[tauri::command]
pub fn set_max_count(state: State<'_, AppState>, n: u32) -> Result<(), String> {
    state.store.set_max_count(n).map_err(|e| e.to_string())?;
    state.store.trim(n).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_hotkey(
    app: AppHandle,
    state: State<'_, AppState>,
    hotkey: String,
) -> Result<(), String> {
    apply_hotkey(&app, &state, &hotkey)
}

#[tauri::command]
pub fn set_autostart(
    app: AppHandle,
    state: State<'_, AppState>,
    enabled: bool,
) -> Result<(), String> {
    let mgr = app.autolaunch();
    if enabled {
        mgr.enable().map_err(|e| e.to_string())?;
    } else {
        mgr.disable().map_err(|e| e.to_string())?;
    }
    state
        .store
        .set_autostart_enabled(enabled)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn set_replace_system_clipboard(
    app: AppHandle,
    state: State<'_, AppState>,
    enabled: bool,
) -> Result<(), String> {
    set_windows_clipboard_history(!enabled)?;

    let result = if enabled {
        apply_hotkey(&app, &state, REPLACEMENT_HOTKEY)
    } else {
        let current_hotkey = state
            .store
            .get_settings()
            .map(|s| s.hotkey)
            .unwrap_or_else(|_| DEFAULT_HOTKEY.into());

        if current_hotkey.eq_ignore_ascii_case(REPLACEMENT_HOTKEY) {
            apply_hotkey(&app, &state, DEFAULT_HOTKEY)
        } else {
            Ok(())
        }
    };

    if let Err(err) = result {
        let _ = set_windows_clipboard_history(enabled);
        return Err(err);
    }

    crate::replacement_hotkey::set_enabled(enabled);

    state
        .store
        .set_replace_system_clipboard(enabled)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn hide_window(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.hide();
    }
    Ok(())
}

#[tauri::command]
pub fn get_data_dir(state: State<'_, AppState>) -> Result<String, String> {
    Ok(state.store.data_dir().to_string_lossy().to_string())
}

#[tauri::command]
pub fn open_data_dir(state: State<'_, AppState>) -> Result<(), String> {
    let dir = state.store.data_dir();
    std::process::Command::new("explorer")
        .arg(dir.as_os_str())
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn change_data_dir(
    app: AppHandle,
    state: State<'_, AppState>,
    default_dir: State<'_, PathBuf>,
    new_dir: String,
) -> Result<(), String> {
    let new_path = PathBuf::from(&new_dir);
    let current = state.store.data_dir();

    if new_path == *current {
        return Ok(());
    }

    // Create target directory
    std::fs::create_dir_all(&new_path).map_err(|e| format!("创建目录失败: {e}"))?;
    std::fs::create_dir_all(new_path.join("images"))
        .map_err(|e| format!("创建图片目录失败: {e}"))?;

    // Copy database
    let src_db = current.join("clipx.db");
    if src_db.exists() {
        std::fs::copy(&src_db, new_path.join("clipx.db"))
            .map_err(|e| format!("复制数据库失败: {e}"))?;
    }

    // Copy images
    let src_images = current.join("images");
    if src_images.is_dir() {
        if let Ok(entries) = std::fs::read_dir(&src_images) {
            for entry in entries.flatten() {
                let dest = new_path.join("images").join(entry.file_name());
                std::fs::copy(entry.path(), dest).ok();
            }
        }
    }

    // Write override config
    let override_file = default_dir.join("data_dir.conf");
    std::fs::create_dir_all(default_dir.as_path()).ok();
    std::fs::write(&override_file, &new_dir).map_err(|e| format!("保存配置失败: {e}"))?;

    // Restart app
    app.restart();
}

fn apply_hotkey(app: &AppHandle, state: &AppState, hotkey: &str) -> Result<(), String> {
    let current = state
        .store
        .get_settings()
        .map(|s| s.hotkey)
        .unwrap_or_else(|_| DEFAULT_HOTKEY.into());

    if !current.eq_ignore_ascii_case(REPLACEMENT_HOTKEY) {
        if let Ok(old_sc) = crate::hotkey::parse(&current) {
            let _ = app.global_shortcut().unregister(old_sc);
        }
    }

    if !hotkey.eq_ignore_ascii_case(REPLACEMENT_HOTKEY) {
        let new_sc = crate::hotkey::parse(hotkey).map_err(|e| e.to_string())?;
        app.global_shortcut()
            .register(new_sc)
            .map_err(|e| e.to_string())?;
    }

    state.store.set_hotkey(hotkey).map_err(|e| e.to_string())
}

pub(crate) fn set_windows_clipboard_history(enabled: bool) -> Result<(), String> {
    let value = if enabled { "1" } else { "0" };
    let status = std::process::Command::new("reg")
        .args([
            "add",
            r"HKCU\Software\Microsoft\Clipboard",
            "/v",
            "EnableClipboardHistory",
            "/t",
            "REG_DWORD",
            "/d",
            value,
            "/f",
        ])
        .status()
        .map_err(|e| format!("修改 Windows 剪贴板历史失败: {e}"))?;

    if status.success() {
        Ok(())
    } else {
        Err("修改 Windows 剪贴板历史失败".into())
    }
}

#[tauri::command]
pub fn is_listener_paused() -> Result<bool, String> {
    Ok(crate::listener::is_paused())
}

#[tauri::command]
pub fn set_listener_paused(paused: bool) -> Result<bool, String> {
    crate::listener::set_paused(paused);
    Ok(crate::listener::is_paused())
}

#[tauri::command]
pub fn paste_clean_text(app: AppHandle, text: String) -> Result<(), String> {
    let mut cb = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    cb.set_text(text).map_err(|e| e.to_string())?;
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.hide();
    }
    std::thread::spawn(|| {
        crate::replacement_hotkey::reset_state();
        std::thread::sleep(std::time::Duration::from_millis(120));
        crate::focus::restore_foreground_window();
        std::thread::sleep(std::time::Duration::from_millis(80));
        let _ = crate::paste::send_ctrl_v();
    });
    Ok(())
}

#[tauri::command]
pub fn open_browser_url(url: String) -> Result<(), String> {
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("Invalid URL protocol".into());
    }
    std::process::Command::new("rundll32")
        .args(["url.dll,FileProtocolHandler", &url])
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(serde::Serialize, Clone, Debug)]
pub struct RunningAppInfo {
    pub name: String,
    pub title: String,
    pub process_name: String,
}

#[tauri::command]
pub fn get_running_apps() -> Result<Vec<RunningAppInfo>, String> {
    #[cfg(target_os = "windows")]
    {
        use std::collections::HashSet;
        use windows::Win32::Foundation::{CloseHandle, BOOL, HWND, LPARAM, WPARAM};
        use windows::Win32::System::Threading::{
            OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_FORMAT,
            PROCESS_QUERY_LIMITED_INFORMATION,
        };
        use windows::Win32::UI::WindowsAndMessaging::{
            EnumWindows, GetWindowThreadProcessId, IsWindowVisible, SendMessageTimeoutW,
            SMTO_ABORTIFHUNG, WM_GETTEXT,
        };

        let mut raw_windows: Vec<HWND> = Vec::new();

        unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
            let vec_ptr = lparam.0 as *mut Vec<HWND>;
            if IsWindowVisible(hwnd).as_bool() {
                (*vec_ptr).push(hwnd);
            }
            BOOL(1)
        }

        unsafe {
            let _ = EnumWindows(Some(enum_proc), LPARAM(&mut raw_windows as *mut _ as isize));
        }

        let mut seen = HashSet::new();
        let mut result = Vec::new();

        for hwnd in raw_windows {
            let mut pid = 0u32;
            unsafe {
                GetWindowThreadProcessId(hwnd, Some(&mut pid));
            }
            if pid == 0 {
                continue;
            }

            let mut process_name = String::new();
            unsafe {
                if let Ok(handle) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) {
                    let mut buf = [0u16; 1024];
                    let mut size = buf.len() as u32;
                    if QueryFullProcessImageNameW(
                        handle,
                        PROCESS_NAME_FORMAT(0),
                        windows::core::PWSTR(buf.as_mut_ptr()),
                        &mut size,
                    )
                    .is_ok()
                        && size > 0
                    {
                        let path_str = String::from_utf16_lossy(&buf[..size as usize]);
                        if let Some(fname) = std::path::Path::new(&path_str).file_name().and_then(|f| f.to_str()) {
                            process_name = fname.to_string();
                        }
                    }
                    let _ = CloseHandle(handle);
                }
            }

            if !process_name.is_empty() {
                let lower_proc = process_name.to_lowercase();
                if lower_proc == "clipx.exe" || lower_proc == "haiwenna-clipflow.exe" {
                    continue;
                }

                if seen.insert(lower_proc) {
                    // Safely query window title with 15ms timeout and SMTO_ABORTIFHUNG so we never freeze
                    let mut title = String::new();
                    unsafe {
                        let mut title_buf = [0u16; 128];
                        let mut res = 0usize;
                        let _ = SendMessageTimeoutW(
                            hwnd,
                            WM_GETTEXT,
                            WPARAM(title_buf.len()),
                            LPARAM(title_buf.as_mut_ptr() as isize),
                            SMTO_ABORTIFHUNG,
                            15,
                            Some(&mut res),
                        );
                        if res > 0 {
                            title = String::from_utf16_lossy(&title_buf[..res]).trim().to_string();
                        }
                    }

                    let name = process_name
                        .trim_end_matches(".exe")
                        .trim_end_matches(".EXE")
                        .to_string();
                    result.push(RunningAppInfo {
                        name,
                        title,
                        process_name,
                    });
                }
            }
        }

        result.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        Ok(result)
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(vec![])
    }
}

#[tauri::command]
pub fn get_ignored_apps(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    state.store.get_ignored_apps().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_ignored_apps(state: State<'_, AppState>, apps: Vec<String>) -> Result<(), String> {
    state.store.set_ignored_apps(&apps).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn is_onboarding_completed(state: State<'_, AppState>) -> Result<bool, String> {
    Ok(state.store.is_onboarding_completed())
}

#[tauri::command]
pub fn set_onboarding_completed(state: State<'_, AppState>, completed: bool) -> Result<(), String> {
    state.store.set_onboarding_completed(completed).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_onboarding_window(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("onboarding") {
        let _ = w.show();
        let _ = w.set_focus();
        return Ok(());
    }
    let _ = tauri::WebviewWindowBuilder::new(
        &app,
        "onboarding",
        tauri::WebviewUrl::App("onboarding.html".into()),
    )
    .title("Haiwenna ClipFlow - 欢迎设置向导")
    .inner_size(760.0, 540.0)
    .center()
    .resizable(false)
    .decorations(true)
    .always_on_top(true)
    .build()
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn finish_onboarding(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    state
        .store
        .set_onboarding_completed(true)
        .map_err(|e| e.to_string())?;

    if let Some(w) = app.get_webview_window("onboarding") {
        let _ = w.close();
    }

    crate::show_main_window(&app, false);
    Ok(())
}

#[tauri::command]
pub fn save_settings(
    app: AppHandle,
    state: State<'_, AppState>,
    settings: Settings,
) -> Result<(), String> {
    let current = state.store.get_settings().map_err(|e| e.to_string())?;

    // 1. Hotkey update
    if !settings.hotkey.eq_ignore_ascii_case(&current.hotkey) {
        let _ = apply_hotkey(&app, &state, &settings.hotkey);
    }

    // 2. Autostart update
    if settings.autostart_enabled != current.autostart_enabled {
        let mgr = app.autolaunch();
        if settings.autostart_enabled {
            let _ = mgr.enable();
        } else {
            let _ = mgr.disable();
        }
    }

    // 3. Replace system clipboard update
    if settings.replace_system_clipboard != current.replace_system_clipboard {
        let _ = set_windows_clipboard_history(!settings.replace_system_clipboard);
        crate::replacement_hotkey::set_enabled(settings.replace_system_clipboard);
        if settings.replace_system_clipboard {
            let _ = apply_hotkey(&app, &state, REPLACEMENT_HOTKEY);
        } else if settings.hotkey.eq_ignore_ascii_case(REPLACEMENT_HOTKEY) {
            let _ = apply_hotkey(&app, &state, DEFAULT_HOTKEY);
        }
    }

    // 4. Save to store
    state.store.save_settings(&settings).map_err(|e| e.to_string())?;

    // 5. Trim to max_count
    let _ = state.store.trim(settings.max_count);

    // 6. Retention clean if days > 0
    let _ = state.store.clean_expired_history(settings.retention_days);

    let _ = app.emit("clipboard://updated", ());
    Ok(())
}

#[tauri::command]
pub fn get_storage_stats(
    state: State<'_, AppState>,
) -> Result<crate::storage::StorageStats, String> {
    state.store.get_storage_stats().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clean_expired_history(
    app: AppHandle,
    state: State<'_, AppState>,
    days: u32,
) -> Result<usize, String> {
    let count = state.store.clean_expired_history(days).map_err(|e| e.to_string())?;
    let _ = app.emit("clipboard://updated", ());
    Ok(count)
}


