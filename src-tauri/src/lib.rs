use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Window;

#[derive(Serialize, Deserialize, Debug)]
pub struct FilterCategory {
    pub name: String,
    pub icon: String,
    pub keywords: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct FiltersConfig {
    pub categories: Vec<FilterCategory>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ShortcutItem {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub icon_base64: Option<String>,
}

#[cfg(target_os = "windows")]
fn get_native_icon_base64(path_str: &str) -> Option<String> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use winapi::shared::windef::HBITMAP;
    use winapi::um::shellapi::{SHGetFileInfoW, SHGFI_ICON, SHGFI_LARGEICON, SHFILEINFOW};
    use winapi::um::wingdi::{GetBitmapBits, GetObjectW, BITMAP};
    use winapi::um::winuser::{DestroyIcon, GetIconInfo, ICONINFO};

    let wide: Vec<u16> = OsStr::new(path_str).encode_wide().chain(std::iter::once(0)).collect();
    let mut shfi: SHFILEINFOW = unsafe { std::mem::zeroed() };

    let result = unsafe {
        SHGetFileInfoW(
            wide.as_ptr(),
            0,
            &mut shfi,
            std::mem::size_of::<SHFILEINFOW>() as u32,
            SHGFI_ICON | SHGFI_LARGEICON,
        )
    };

    if result == 0 || shfi.hIcon.is_null() {
        return None;
    }

    let mut icon_info: ICONINFO = unsafe { std::mem::zeroed() };
    if unsafe { GetIconInfo(shfi.hIcon, &mut icon_info) } == 0 {
        unsafe { DestroyIcon(shfi.hIcon) };
        return None;
    }

    let h_bmp: HBITMAP = icon_info.hbmColor;
    let mut bmp: BITMAP = unsafe { std::mem::zeroed() };
    unsafe { GetObjectW(h_bmp as _, std::mem::size_of::<BITMAP>() as i32, &mut bmp as *mut _ as _) };

    let width = bmp.bmWidth as u32;
    let height = bmp.bmHeight as u32;

    if width == 0 || height == 0 {
        unsafe {
            if !icon_info.hbmColor.is_null() { winapi::um::wingdi::DeleteObject(icon_info.hbmColor as _); }
            if !icon_info.hbmMask.is_null() { winapi::um::wingdi::DeleteObject(icon_info.hbmMask as _); }
            DestroyIcon(shfi.hIcon);
        }
        return None;
    }

    let mut buffer: Vec<u8> = vec![0; (width * height * 4) as usize];
    unsafe {
        GetBitmapBits(h_bmp, buffer.len() as i32, buffer.as_mut_ptr() as _);
    }

    unsafe {
        if !icon_info.hbmColor.is_null() { winapi::um::wingdi::DeleteObject(icon_info.hbmColor as _); }
        if !icon_info.hbmMask.is_null() { winapi::um::wingdi::DeleteObject(icon_info.hbmMask as _); }
        DestroyIcon(shfi.hIcon);
    }

    // Convert BGRA to RGBA
    for chunk in buffer.chunks_exact_mut(4) {
        let b = chunk[0];
        let r = chunk[2];
        chunk[0] = r;
        chunk[2] = b;
    }

    let mut png_bytes: Vec<u8> = Vec::new();
    let mut cursor = std::io::Cursor::new(&mut png_bytes);
    if image::write_buffer_with_format(
        &mut cursor,
        &buffer,
        width,
        height,
        image::ColorType::Rgba8,
        image::ImageFormat::Png,
    ).is_ok() {
        use base64::Engine;
        Some(format!("data:image/png;base64,{}", base64::engine::general_purpose::STANDARD.encode(png_bytes)))
    } else {
        None
    }
}

#[cfg(not(target_os = "windows"))]
fn get_native_icon_base64(_path_str: &str) -> Option<String> {
    None
}

#[tauri::command]
fn scan_shortcuts() -> Vec<ShortcutItem> {
    let mut shortcuts = Vec::new();
    let mut target_dirs = Vec::new();

    if let Some(user_desktop) = dirs::desktop_dir() {
        target_dirs.push(user_desktop);
    }

    let public_desktop = PathBuf::from("C:\\Users\\Public\\Desktop");
    if public_desktop.exists() {
        target_dirs.push(public_desktop);
    }

    for dir in target_dirs {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                let is_dir = path.is_dir();

                if let Some(file_name) = path.file_name().and_then(|s| s.to_str()) {
                    if file_name.starts_with('.') || file_name.eq_ignore_ascii_case("desktop.ini") {
                        continue;
                    }

                    let display_name = path
                        .file_stem()
                        .map(|s| s.to_string_lossy().into_owned())
                        .unwrap_or_else(|| "Unknown".into());

                    let path_str = path.to_string_lossy().into_owned();
                    let icon_base64 = get_native_icon_base64(&path_str);

                    shortcuts.push(ShortcutItem {
                        name: display_name,
                        path: path_str,
                        is_dir,
                        icon_base64,
                    });
                }
            }
        }
    }
    shortcuts
}

#[tauri::command]
fn launch_item(path: String) -> Result<(), String> {
    open::that(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn snap_window_to_zone(window: Window, zone: String) -> Result<(), String> {
    if let Some(monitor) = window.current_monitor().map_err(|e| e.to_string())? {
        let size = monitor.size();
        let scale_factor = monitor.scale_factor();
        let screen_width = (size.width as f64 / scale_factor) as i32;
        let screen_height = (size.height as f64 / scale_factor) as i32;

        let win_outer_size = window.outer_size().map_err(|e| e.to_string())?;
        let win_w = (win_outer_size.width as f64 / scale_factor) as i32;
        let win_h = (win_outer_size.height as f64 / scale_factor) as i32;

        let (x, y) = match zone.as_str() {
            "bottom-center" => ((screen_width - win_w) / 2, screen_height - win_h - 40),
            "top-center" => ((screen_width - win_w) / 2, 40),
            "bottom-left" => (20, screen_height - win_h - 40),
            "bottom-right" => (screen_width - win_w - 20, screen_height - win_h - 40),
            _ => return Ok(()),
        };

        window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
            x: (x as f64 * scale_factor) as i32,
            y: (y as f64 * scale_factor) as i32,
        })).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn load_filters() -> FiltersConfig {
    FiltersConfig {
        categories: vec![
            FilterCategory {
                name: "Apps".into(),
                icon: "⚙️".into(),
                keywords: vec!["exe".into(), "lnk".into(), "url".into()],
            },
            FilterCategory {
                name: "Games".into(),
                icon: "🎮".into(),
                keywords: vec!["steam".into(), "epic".into(), "riot".into(), "game".into()],
            },
            FilterCategory {
                name: "Docs".into(),
                icon: "📄".into(),
                keywords: vec!["pdf".into(), "doc".into(), "docx".into(), "txt".into(), "notes".into()],
            },
            FilterCategory {
                name: "Folders".into(),
                icon: "📁".into(),
                keywords: vec!["folder".into()],
            },
        ],
    }
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            scan_shortcuts,
            load_filters,
            launch_item,
            snap_window_to_zone
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}