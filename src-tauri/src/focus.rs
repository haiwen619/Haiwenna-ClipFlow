#[cfg(target_os = "windows")]
mod platform {
    use std::sync::{Mutex, OnceLock};
    use windows::Win32::Foundation::{BOOL, HWND};
    use windows::Win32::System::Threading::{AttachThreadInput, GetCurrentThreadId};
    use windows::Win32::UI::Input::KeyboardAndMouse::{SetActiveWindow, SetFocus};
    use windows::Win32::UI::WindowsAndMessaging::{
        BringWindowToTop, GetForegroundWindow, GetWindowThreadProcessId, IsWindow, IsWindowVisible,
        SetForegroundWindow,
    };

    static LAST_FOREGROUND: OnceLock<Mutex<Option<isize>>> = OnceLock::new();

    pub fn remember_foreground_window() {
        let hwnd = unsafe { GetForegroundWindow() };
        if hwnd.is_invalid() {
            return;
        }

        if let Ok(mut last) = storage().lock() {
            *last = Some(hwnd.0 as isize);
        }
    }

    pub fn restore_foreground_window() {
        let hwnd = storage()
            .lock()
            .ok()
            .and_then(|last| last.map(|value| HWND(value as *mut core::ffi::c_void)));

        if let Some(hwnd) = hwnd {
            unsafe {
                if IsWindow(hwnd).as_bool() && IsWindowVisible(hwnd).as_bool() {
                    activate_window(hwnd);
                }
            }
        }
    }

    unsafe fn activate_window(hwnd: HWND) {
        let current_thread = GetCurrentThreadId();
        let foreground = GetForegroundWindow();
        let foreground_thread = if foreground.is_invalid() {
            0
        } else {
            GetWindowThreadProcessId(foreground, None)
        };
        let target_thread = GetWindowThreadProcessId(hwnd, None);

        let attach_foreground = foreground_thread != 0 && foreground_thread != current_thread;
        let attach_target = target_thread != 0 && target_thread != current_thread;

        if attach_foreground {
            let _ = AttachThreadInput(current_thread, foreground_thread, BOOL(1));
        }
        if attach_target {
            let _ = AttachThreadInput(current_thread, target_thread, BOOL(1));
        }

        let _ = BringWindowToTop(hwnd);
        let _ = SetActiveWindow(hwnd);
        let _ = SetFocus(hwnd);
        let _ = SetForegroundWindow(hwnd);

        if attach_target {
            let _ = AttachThreadInput(current_thread, target_thread, BOOL(0));
        }
        if attach_foreground {
            let _ = AttachThreadInput(current_thread, foreground_thread, BOOL(0));
        }
    }

    fn storage() -> &'static Mutex<Option<isize>> {
        LAST_FOREGROUND.get_or_init(|| Mutex::new(None))
    }
}

#[cfg(target_os = "windows")]
pub use platform::{remember_foreground_window, restore_foreground_window};

#[cfg(not(target_os = "windows"))]
pub fn remember_foreground_window() {}

#[cfg(not(target_os = "windows"))]
pub fn restore_foreground_window() {}
