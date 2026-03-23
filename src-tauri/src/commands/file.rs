use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileFilter {
    pub name: String,
    pub extensions: Vec<String>,
}

impl FileFilter {
    pub fn to_filter_tuple(&self) -> (&str, &[&str]) {
        (
            self.name.as_str(),
            self.extensions.iter().map(|s| s.as_str()).collect::<Vec<_>>().as_slice()
        )
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportOptions {
    pub formats: Vec<String>,
    pub include_thumbnails: bool,
    pub include_confidence: bool,
}

#[tauri::command]
pub async fn save_file_dialog(
    app: AppHandle,
    title: String,
    default_name: String,
    filters: Vec<FileFilter>,
) -> Result<String, String> {
    let dialog = app.dialog().file().set_title(&title).set_file_name(&default_name);
    
    // Add filters if provided, otherwise use default "All Files"
    if filters.is_empty() {
        dialog.add_filter("All Files", &["*"]);
    } else {
        for filter in filters {
            let (name, extensions) = filter.to_filter_tuple();
            dialog.add_filter(name, extensions);
        }
    }
    
    let file_path = dialog.blocking_save_file();
    
    match file_path {
        Some(path) => Ok(path.to_string()),
        None => Err("No file selected".to_string()),
    }
}

#[tauri::command]
pub async fn open_file_dialog(
    app: AppHandle,
    title: String,
    filters: Vec<FileFilter>,
) -> Result<String, String> {
    let dialog = app.dialog().file().set_title(&title);
    
    // Add filters if provided, otherwise use defaults
    if filters.is_empty() {
        dialog
            .add_filter("Video Files", &["mp4", "mkv", "avi", "mov", "webm", "flv"])
            .add_filter("All Files", &["*"]);
    } else {
        for filter in filters {
            let (name, extensions) = filter.to_filter_tuple();
            dialog.add_filter(name, extensions);
        }
    }
    
    let file_path = dialog.blocking_pick_file();
    
    match file_path {
        Some(path) => Ok(path.to_string()),
        None => Err("No file selected".to_string()),
    }
}

#[tauri::command]
pub fn write_text_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, &content)
        .map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
pub fn get_file_info(path: String) -> Result<serde_json::Value, String> {
    let metadata = std::fs::metadata(&path)
        .map_err(|e| format!("Failed to get file info: {}", e))?;
    
    let file_name = std::path::Path::new(&path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();
    
    Ok(serde_json::json!({
        "path": path,
        "name": file_name,
        "size": metadata.len(),
        "is_file": metadata.is_file(),
        "is_dir": metadata.is_dir(),
    }))
}
