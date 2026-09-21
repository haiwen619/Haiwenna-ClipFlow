#[cfg(target_os = "windows")]
mod platform {
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::{mpsc, Mutex, OnceLock};
    use tauri::AppHandle;
    use windows::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
    use windows::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows::Win32::UI::WindowsAndMessaging::{
        CallNextHookEx, DispatchMessageW, GetMessageW, SetWindowsHookExW, TranslateMessage,
        UnhookWindowsHookEx, HC_ACTION, HHOOK, KBDLLHOOKSTRUCT, MSG, WH_KEYBOARD_LL, WM_KEYDOWN,
        WM_KEYUP, WM_SYSKEYDOWN, WM_SYSKEYUP,
    };

    const VK_V: u32 = 0x56;
    const VK_LWIN: u32 = 0x5B;
    const VK_RWIN: u32 = 0x5C;

    static ENABLED: AtomicBool = AtomicBool::new(false);
    static WIN_DOWN: AtomicBool = AtomicBool::new(false);
    static COMBO_ACTIVE: AtomicBool = AtomicBool::new(false);
    static OPEN_TX: OnceLock<Mutex<mpsc::Sender<()>>> = OnceLock::new();
    static HOOK_STARTED: AtomicBool = AtomicBool::new(false);

    pub fn start(app: AppHandle, enabled: bool) {
        ENABLED.store(enabled, Ordering::Relaxed);

        if HOOK_STARTED.swap(true, Ordering::SeqCst) {
            return;
        }

        let (tx, rx) = mpsc::channel();
        let _ = OPEN_TX.set(Mutex::new(tx));

        std::thread::spawn(move || {
            while rx.recv().is_ok() {
                crate::toggle_main_window(&app, false);
            }
        });

        std::thread::spawn(|| unsafe {
            let instance = match GetModuleHandleW(None) {
                Ok(handle) => handle,
                Err(_) => return,
            };
            let hook = match SetWindowsHookExW(WH_KEYBOARD_LL, Some(hook_proc), instance, 0) {
                Ok(h) => h,
                Err(_) => return,
            };

            let mut msg = MSG::default();
            while GetMessageW(&mut msg, None, 0, 0).into() {
                let _ = TranslateMessage(&msg);
                DispatchMessageW(&msg);
            }

            let _ = UnhookWindowsHookEx(hook);
        });
    }

    pub fn set_enabled(enabled: bool) {
        ENABLED.store(enabled, Ordering::Relaxed);
        if !enabled {
            reset_combo_state();
        }
    }

    pub fn reset_state() {
        reset_combo_state();
    }

    unsafe extern "system" fn hook_proc(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
        if code == HC_ACTION as i32 {
            let event = wparam.0 as u32;
            let hook = &*(lparam.0 as *const KBDLLHOOKSTRUCT);
            let key = hook.vkCode;

            match event {
                WM_KEYDOWN | WM_SYSKEYDOWN => match key {
                    VK_LWIN | VK_RWIN => {
                        WIN_DOWN.store(true, Ordering::Relaxed);
                    }
                    VK_V if ENABLED.load(Ordering::Relaxed) && WIN_DOWN.load(Ordering::Relaxed) => {
                        let already_active = COMBO_ACTIVE.swap(true, Ordering::SeqCst);
                        if !already_active {
                            crate::focus::remember_foreground_window();
                            trigger_open();
                        }
                        return LRESULT(1);
                    }
                    _ => {}
                },
                WM_KEYUP | WM_SYSKEYUP => match key {
                    VK_V if COMBO_ACTIVE.load(Ordering::Relaxed) => {
                        COMBO_ACTIVE.store(false, Ordering::Relaxed);
                        return LRESULT(1);
                    }
                    VK_LWIN | VK_RWIN => {
                        WIN_DOWN.store(false, Ordering::Relaxed);
                        COMBO_ACTIVE.store(false, Ordering::Relaxed);
                    }
                    _ => {}
                },
                _ => {}
            }
        }

        CallNextHookEx(HHOOK::default(), code, wparam, lparam)
    }

    fn trigger_open() {
        if let Some(tx) = OPEN_TX.get() {
            if let Ok(sender) = tx.lock() {
                let _ = sender.send(());
            }
        }
    }

    fn reset_combo_state() {
        WIN_DOWN.store(false, Ordering::Relaxed);
        COMBO_ACTIVE.store(false, Ordering::Relaxed);
    }
}

#[cfg(target_os = "windows")]
pub use platform::{reset_state, set_enabled, start};

#[cfg(not(target_os = "windows"))]
pub fn start(_app: tauri::AppHandle, _enabled: bool) {}

#[cfg(not(target_os = "windows"))]
pub fn set_enabled(_enabled: bool) {}

#[cfg(not(target_os = "windows"))]
pub fn reset_state() {}
