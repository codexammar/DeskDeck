use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

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
    pub icon_type: String,
}

fn determine_icon_type(path: &Path) -> String {
    if path.is_dir() {
        return "folder".into();
    }
    match path.extension().and_then(|s| s.to_str()).map(|s| s.to_lowercase()).as_deref() {
        Some("lnk") | Some("url") | Some("exe") => "app".into(),
        Some("pdf") | Some("doc") | Some("docx") | Some("txt") | Some("xlsx") => "document".into(),
        Some("png") | Some("jpg") | Some("jpeg") | Some("gif") | Some("webp") => "image".into(),
        Some("mp4") | Some("mkv") | Some("avi") | Some("mov") => "video".into(),
        Some("zip") | Some("rar") | Some("7z") => "archive".into(),
        _ => "generic".into(),
    }
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
                    // Ignore hidden files and desktop.ini
                    if file_name.starts_with('.') || file_name.eq_ignore_ascii_case("desktop.ini") {
                        continue;
                    }

                    let display_name = path
                        .file_stem()
                        .map(|s| s.to_string_lossy().into_owned())
                        .unwrap_or_else(|| "Unknown".into());

                    let icon_type = determine_icon_type(&path);

                    shortcuts.push(ShortcutItem {
                        name: display_name,
                        path: path.to_string_lossy().into_owned(),
                        is_dir,
                        icon_type,
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
            launch_item
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}