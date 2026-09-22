use std::sync::Arc;
#[cfg(not(any(target_os = "android", target_os = "ios")))]
use tauri::{
    menu::ContextMenu,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, PhysicalPosition,
};
use tauri::Manager;
#[cfg(not(any(target_os = "android", target_os = "ios")))]
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

mod commands;
pub mod crypto;
#[cfg(not(any(target_os = "android", target_os = "ios")))]
mod focus;
#[cfg(not(any(target_os = "android", target_os = "ios")))]
mod hotkey;
#[cfg(not(any(target_os = "android", target_os = "ios")))]
mod listener;
#[cfg(not(any(target_os = "android", target_os = "ios")))]
mod paste;
#[cfg(not(any(target_os = "android", target_os = "ios")))]
mod replacement_hotkey;
mod storage;
pub mod sync;

use commands::AppState;

#[cfg(not(any(target_os = "android", target_os = "ios")))]
const OPEN_SETTINGS_EVENT: &str = "app://open-settings";
#[cfg(not(any(target_os = "android", target_os = "ios")))]
const TRAY_ID: &str = "clipx-tray";
#[cfg(not(any(target_os = "android", target_os = "ios")))]
const TRAY_SHOW_ID: &str = "tray_show";
#[cfg(not(any(target_os = "android", target_os = "ios")))]
const TRAY_SETTINGS_ID: &str = "tray_settings";
#[cfg(not(any(target_os = "android", target_os = "ios")))]
const TRAY_HIDE_ICON_ID: &str = "tray_hide_icon";
#[cfg(not(any(target_os = "android", target_os = "ios")))]
const TRAY_QUIT_ID: &str = "tray_quit";
#[cfg(not(any(target_os = "android", target_os = "ios")))]
const MAIN_WINDOW_WIDTH: i32 = 380;
#[cfg(not(any(target_os = "android", target_os = "ios")))]
const MAIN_WINDOW_HEIGHT: i32 = 540;

#[cfg(target_os = "windows")]
fn kill_other_instances() {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    let my_pid = std::process::id();

    // 终止除了自身之外的其他 clipx.exe 进程，释放热键占用与网络端口
    let _ = std::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            &format!(
                "Get-Process -Name clipx -ErrorAction SilentlyContinue | Where-Object {{ $_.Id -ne {} }} | Stop-Process -Force",
                my_pid
            ),
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    std::thread::sleep(std::time::Duration::from_millis(150));
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "windows")]
    kill_other_instances();

    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default();

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        builder = builder
            .plugin(tauri_plugin_autostart::init(
                tauri_plugin_autostart::MacosLauncher::LaunchAgent,
                None,
            ))
            .plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_handler(|app, _shortcut, event| {
                        if event.state() == ShortcutState::Pressed {
                            toggle_main_window(app, false);
                        }
                    })
                    .build(),
            );
    }

    builder
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let default_data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::env::temp_dir().join("clipx"));
            // Check for data dir override
            let override_file = default_data_dir.join("data_dir.conf");
            let data_dir = if override_file.exists() {
                let content = std::fs::read_to_string(&override_file).unwrap_or_default();
                let custom = content.trim().to_string();
                if !custom.is_empty() && std::path::Path::new(&custom).exists() {
                    std::path::PathBuf::from(custom)
                } else {
                    default_data_dir.clone()
                }
            } else {
                default_data_dir.clone()
            };
            app.manage(default_data_dir);
            let store = Arc::new(storage::Store::new(data_dir).expect("init store"));

            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            {
                let settings = store.get_settings().expect("read settings");
                replacement_hotkey::start(app.handle().clone(), settings.replace_system_clipboard);

                if settings.replace_system_clipboard {
                    let _ = commands::set_windows_clipboard_history(false);
                }

                if !settings.hotkey.eq_ignore_ascii_case("Win+V") {
                    let shortcut = hotkey::parse(&settings.hotkey)
                        .unwrap_or_else(|_| Shortcut::new(Some(Modifiers::ALT), Code::KeyV));
                    
                    // 如果已占用/已注册，先卸载后强行抢占注册
                    if app.global_shortcut().is_registered(shortcut) {
                        let _ = app.global_shortcut().unregister(shortcut);
                    }

                    if let Err(_) = app.global_shortcut().register(shortcut) {
                        let _ = app.global_shortcut().unregister_all();
                        if let Err(err) = app.global_shortcut().register(shortcut) {
                            eprintln!("[WARN] 快捷键 {} 强制注册失败: {}", settings.hotkey, err);
                        }
                    }
                }

                let mut tray_builder = TrayIconBuilder::with_id(TRAY_ID)
                    .tooltip("ClipX")
                    .show_menu_on_left_click(false)
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button,
                            button_state,
                            ..
                        } = event
                        {
                            if button == MouseButton::Left && button_state == MouseButtonState::Up {
                                toggle_main_window(tray.app_handle(), false);
                            } else if button == MouseButton::Right
                                && button_state == MouseButtonState::Up
                            {
                                show_tray_context_menu(tray.app_handle());
                            }
                        }
                    });

                if let Some(icon) = app.default_window_icon().cloned() {
                    tray_builder = tray_builder.icon(icon);
                }
                let _tray = tray_builder.build(app)?;

                app.on_menu_event(|app, event| match event.id().0.as_str() {
                    TRAY_SHOW_ID => show_main_window(app, false),
                    TRAY_SETTINGS_ID => show_main_window(app, true),
                    TRAY_HIDE_ICON_ID => hide_tray_icon(app),
                    TRAY_QUIT_ID => app.exit(0),
                    _ => {}
                });

                listener::spawn(app.handle().clone(), store.clone());
                sync::start_sync_server(app.handle().clone(), store.clone());

                if let Some(win) = app.get_webview_window("main") {
                    let w2 = win.clone();
                    win.on_window_event(move |event| {
                        if let tauri::WindowEvent::Focused(false) = event {
                            let _ = w2.hide();
                        }
                    });
                }

                // Check if onboarding has been completed
                if !store.is_onboarding_completed() {
                    let _ = commands::open_onboarding_window(app.handle().clone());
                }
            }

            app.manage(AppState {
                store: store.clone(),
                tray_icon_hidden: std::sync::Mutex::new(false),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_history,
            commands::paste_item,
            commands::delete_item,
            commands::clear_all,
            commands::toggle_pin,
            commands::copy_item,
            commands::get_settings,
            commands::set_max_count,
            commands::set_hotkey,
            commands::set_autostart,
            commands::set_replace_system_clipboard,
            commands::hide_window,
            commands::get_data_dir,
            commands::open_data_dir,
            commands::change_data_dir,
            commands::is_listener_paused,
            commands::set_listener_paused,
            commands::paste_clean_text,
            commands::open_browser_url,
            commands::get_running_apps,
            commands::get_ignored_apps,
            commands::set_ignored_apps,
            commands::is_onboarding_completed,
            commands::set_onboarding_completed,
            commands::open_onboarding_window,
            commands::finish_onboarding,
            commands::save_settings,
            commands::get_storage_stats,
            commands::clean_expired_history,
            commands::get_sync_status,
            commands::get_pairing_qr_data,
            commands::get_paired_devices,
            commands::remove_paired_device,
            commands::set_sync_enabled,
            commands::set_device_name,
            commands::receive_remote_text,
            commands::get_sync_key,
            commands::add_paired_device,
            commands::read_image_base64,
            commands::receive_remote_image,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub(crate) fn toggle_main_window(app: &AppHandle, open_settings: bool) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) && !open_settings {
            let _ = window.hide();
            return;
        }
    }

    show_main_window(app, open_settings);
}

#[cfg(target_os = "windows")]
fn get_mouse_point(window: &tauri::WebviewWindow) -> (i32, i32) {
    use windows::Win32::Foundation::POINT;
    use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;
    unsafe {
        let mut pt = POINT::default();
        if GetCursorPos(&mut pt).is_ok() {
            return (pt.x, pt.y);
        }
    }
    window
        .cursor_position()
        .map(|p| (p.x as i32, p.y as i32))
        .unwrap_or((0, 0))
}

#[cfg(all(not(target_os = "windows"), not(any(target_os = "android", target_os = "ios"))))]
fn get_mouse_point(window: &tauri::WebviewWindow) -> (i32, i32) {
    window
        .cursor_position()
        .map(|p| (p.x as i32, p.y as i32))
        .unwrap_or((0, 0))
}

#[cfg(target_os = "windows")]
fn get_anchor_point(window: &tauri::WebviewWindow) -> (i32, i32) {
    use windows::Win32::Foundation::{POINT, RECT};
    use windows::Win32::UI::WindowsAndMessaging::{
        GetCursorPos, GetForegroundWindow, GetGUIThreadInfo, GetWindowRect,
        GetWindowThreadProcessId, GUITHREADINFO,
    };

    unsafe {
        // 1. Try to get text caret position from the currently active foreground window
        let foreground = GetForegroundWindow();
        if !foreground.is_invalid() {
            let thread_id = GetWindowThreadProcessId(foreground, None);
            let mut gui_info = GUITHREADINFO {
                cbSize: std::mem::size_of::<GUITHREADINFO>() as u32,
                ..Default::default()
            };
            if GetGUIThreadInfo(thread_id, &mut gui_info).is_ok()
                && !gui_info.hwndCaret.is_invalid()
            {
                if gui_info.rcCaret.right > gui_info.rcCaret.left
                    || gui_info.rcCaret.bottom > gui_info.rcCaret.top
                {
                    let mut rect = RECT::default();
                    if GetWindowRect(gui_info.hwndCaret, &mut rect).is_ok() {
                        let x = rect.left + gui_info.rcCaret.left;
                        let y = rect.top + gui_info.rcCaret.bottom;
                        if x > 0 || y > 0 {
                            return (x, y);
                        }
                    }
                }
            }
        }

        // 2. Fallback to mouse cursor position via Win32 GetCursorPos
        let mut pt = POINT::default();
        if GetCursorPos(&mut pt).is_ok() {
            return (pt.x, pt.y);
        }
    }

    // 3. Fallback to window's cursor_position() or (0, 0)
    window
        .cursor_position()
        .map(|p| (p.x as i32, p.y as i32))
        .unwrap_or((0, 0))
}

#[cfg(all(not(target_os = "windows"), not(any(target_os = "android", target_os = "ios"))))]
fn get_anchor_point(window: &tauri::WebviewWindow) -> (i32, i32) {
    window
        .cursor_position()
        .map(|p| (p.x as i32, p.y as i32))
        .unwrap_or((0, 0))
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub(crate) fn show_main_window(app: &AppHandle, open_settings: bool) {
    restore_tray_icon(app);
    focus::remember_foreground_window();

    if let Some(window) = app.get_webview_window("main") {
        let position_mode = app
            .try_state::<AppState>()
            .and_then(|s| s.store.get_settings().ok())
            .map(|s| s.position_mode)
            .unwrap_or_else(|| "caret".to_string());

        let size = window.outer_size().ok();
        let width = size
            .as_ref()
            .map(|s| s.width as i32)
            .unwrap_or(MAIN_WINDOW_WIDTH);
        let height = size
            .as_ref()
            .map(|s| s.height as i32)
            .unwrap_or(MAIN_WINDOW_HEIGHT);

        let mouse_pt = get_mouse_point(&window);

        // Find the monitor containing the mouse/anchor point
        let (mon_x, mon_y, mon_w, mon_h) = window
            .available_monitors()
            .ok()
            .and_then(|monitors| {
                monitors.into_iter().find(|m| {
                    let pos = m.position();
                    let size = m.size();
                    mouse_pt.0 >= pos.x
                        && mouse_pt.0 < pos.x + size.width as i32
                        && mouse_pt.1 >= pos.y
                        && mouse_pt.1 < pos.y + size.height as i32
                })
            })
            .map(|m| (m.position().x, m.position().y, m.size().width as i32, m.size().height as i32))
            .unwrap_or((0, 0, 1920, 1080));

        let (x, y) = if position_mode == "center" {
            (
                mon_x + (mon_w - width) / 2,
                mon_y + (mon_h - height) / 2,
            )
        } else {
            let (anchor_x, anchor_y) = if position_mode == "cursor" {
                mouse_pt
            } else {
                get_anchor_point(&window)
            };

            let margin = 12;
            let bottom_margin = 64; // Reserved space for Windows Taskbar
            let offset = 8; // Gap from anchor

            // Calculate horizontal position (align left edge with anchor, constrained to screen)
            let mut px = anchor_x;
            let max_x = mon_x + mon_w - width - margin;
            let min_x = mon_x + margin;
            if px > max_x {
                px = max_x;
            }
            if px < min_x {
                px = min_x;
            }

            // Calculate vertical position:
            let space_below = (mon_y + mon_h - bottom_margin) - (anchor_y + offset);
            let py = if space_below >= height {
                anchor_y + offset
            } else {
                let y_above = anchor_y - height - offset;
                y_above.max(mon_y + margin)
            };
            (px, py)
        };

        let _ = window.set_position(PhysicalPosition::new(x, y));
        let _ = window.show();
        let _ = window.set_focus();
        if open_settings {
            let _ = app.emit(OPEN_SETTINGS_EVENT, ());
        }
    }
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn build_tray_menu<M: Manager<tauri::Wry>>(manager: &M) -> tauri::Result<Menu<tauri::Wry>> {
    let tray_show = MenuItem::with_id(manager, TRAY_SHOW_ID, "显示面板", true, None::<&str>)?;
    let tray_settings = MenuItem::with_id(manager, TRAY_SETTINGS_ID, "设置", true, None::<&str>)?;
    let tray_hide_icon = MenuItem::with_id(
        manager,
        TRAY_HIDE_ICON_ID,
        "隐藏托盘图标",
        true,
        None::<&str>,
    )?;
    let tray_separator = PredefinedMenuItem::separator(manager)?;
    let tray_quit = MenuItem::with_id(manager, TRAY_QUIT_ID, "退出", true, None::<&str>)?;
    Menu::with_items(
        manager,
        &[
            &tray_show,
            &tray_settings,
            &tray_hide_icon,
            &tray_separator,
            &tray_quit,
        ],
    )
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn show_tray_context_menu(app: &AppHandle) {
    let state = app.state::<AppState>();
    let hidden = state.tray_icon_hidden.lock().map(|v| *v).unwrap_or(false);
    if hidden {
        return;
    }

    if let (Ok(menu), Some(window)) = (
        build_tray_menu(app),
        app.get_webview_window("main")
            .map(|webview_window| webview_window.as_ref().window()),
    ) {
        let _ = menu.popup(window);
    }
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn hide_tray_icon(app: &AppHandle) {
    let state = app.state::<AppState>();
    let lock = state.tray_icon_hidden.lock();
    if let Ok(mut hidden) = lock {
        *hidden = true;
    }
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let _ = tray.set_visible(false);
    }
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn restore_tray_icon(app: &AppHandle) {
    let state = app.state::<AppState>();
    let lock = state.tray_icon_hidden.lock();
    if let Ok(mut hidden) = lock {
        *hidden = false;
    }
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let _ = tray.set_visible(true);
    }
}
