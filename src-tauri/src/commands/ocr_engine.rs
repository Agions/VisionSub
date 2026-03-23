use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OCREngineConfig {
    pub engine: String,
    pub language: Vec<String>,
    pub confidence_threshold: f32,
    pub use_gpu: bool,
}

impl Default for OCREngineConfig {
    fn default() -> Self {
        Self {
            engine: "tesseract".to_string(),
            language: vec!["eng".to_string()],
            confidence_threshold: 0.7,
            use_gpu: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OCRResultItem {
    pub text: String,
    pub confidence: f32,
    pub bounding_box: BoundingBox,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoundingBox {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OCRProcessResult {
    pub items: Vec<OCRResultItem>,
    pub full_text: String,
    pub language_detected: String,
    pub processing_time_ms: u64,
}

#[tauri::command]
pub async fn init_ocr_engine(config: OCREngineConfig) -> Result<String, String> {
    tracing::info!("Initializing OCR engine: {} with {:?}", config.engine, config.language);
    
    match config.engine.as_str() {
        "paddle" => {
            Err("PaddleOCR native integration not yet implemented".to_string())
        }
        "tesseract" => {
            // Tesseract is used via WASM on frontend
            Ok("tesseract-wasm".to_string())
        }
        "easyocr" => {
            Err("EasyOCR native integration not yet implemented".to_string())
        }
        _ => Err(format!("Unknown OCR engine: {}", config.engine))
    }
}

#[tauri::command]
pub async fn process_image_ocr(
    image_data: Vec<u8>,
    width: u32,
    height: u32,
    config: OCREngineConfig,
) -> Result<OCRProcessResult, String> {
    tracing::info!("Processing image with {} OCR engine", config.engine);
    
    if image_data.is_empty() {
        return Err("Image data is empty".to_string());
    }
    
    if width == 0 || height == 0 {
        return Err("Invalid image dimensions".to_string());
    }
    
    let start = std::time::Instant::now();
    
    // OCR processing requires native library integration
    // Native Rust OCR libraries are limited, so we recommend using Tesseract.js on frontend
    
    Err(format!(
        "Native OCR processing not yet implemented. Use Tesseract.js on frontend for {} engine",
        config.engine
    ))
}

#[tauri::command]
pub async fn process_roi_ocr(
    image_data: Vec<u8>,
    width: u32,
    height: u32,
    roi_x: u32,
    roi_y: u32,
    roi_width: u32,
    roi_height: u32,
    config: OCREngineConfig,
) -> Result<OCRProcessResult, String> {
    tracing::info!("Processing ROI ({}, {}) {}x{} with {} engine", 
        roi_x, roi_y, roi_width, roi_height, config.engine);
    
    if image_data.is_empty() {
        return Err("Image data is empty".to_string());
    }
    
    if roi_width == 0 || roi_height == 0 {
        return Err("ROI has invalid dimensions".to_string());
    }
    
    let start = std::time::Instant::now();
    
    Err(format!(
        "ROI-based OCR processing not yet implemented for {} engine",
        config.engine
    ))
}

#[tauri::command]
pub fn get_available_ocr_engines() -> HashMap<String, bool> {
    let mut engines = HashMap::new();
    // Tesseract.js is available via frontend WASM
    engines.insert("tesseract".to_string(), true);
    // Native engines require library integration
    engines.insert("paddle".to_string(), false);
    engines.insert("easyocr".to_string(), false);
    engines
}

#[tauri::command]
pub fn get_ocr_engine_info(engine: String) -> Result<serde_json::Value, String> {
    match engine.as_str() {
        "tesseract" => Ok(serde_json::json!({
            "name": "Tesseract.js",
            "type": "wasm",
            "languages": ["eng", "chi_sim", "chi_tra", "jpn", "kor", "fra", "deu", "spa", "por", "ita"],
            "gpu_support": false,
            "accuracy": "medium",
            "speed": "fast",
            "description": "Pure JavaScript OCR using WebAssembly. Works in browser without native installation."
        })),
        "paddle" => Ok(serde_json::json!({
            "name": "PaddleOCR",
            "type": "native",
            "languages": ["ch", "en", "ja", "ko", "fr", "de", "es", "ru", "ar"],
            "gpu_support": true,
            "accuracy": "high",
            "speed": "medium",
            "description": "BAIDU's OCR engine. High accuracy, especially for Chinese. Requires native Rust bindings."
        })),
        "easyocr" => Ok(serde_json::json!({
            "name": "EasyOCR",
            "type": "native",
            "languages": ["ch", "en", "ja", "ko", "fr", "de", "es", "it", "pt", "ru"],
            "gpu_support": true,
            "accuracy": "high",
            "speed": "slow",
            "description": "Python-based OCR with broad language support. Requires Python integration."
        })),
        _ => Err(format!("Unknown OCR engine: {}. Available: tesseract, paddle, easyocr", engine))
    }
}

/// OCR an image using Tesseract CLI (if available on the system)
/// This provides native OCR without requiring WASM
#[tauri::command]
pub async fn ocr_image_tesseract(
    image_path: String,
    language: String,
    tesseract_path: Option<String>,
) -> Result<OCRProcessResult, String> {
    use std::process::Command;
    use std::time::Instant;
    
    let start = Instant::now();
    
    // First, try using native Rust tesseract crate if available
    if let Ok(result) = try_native_tesseract(&image_path, &language) {
        let processing_time_ms = start.elapsed().as_millis() as u64;
        return Ok(OCRProcessResult {
            items: result.0,
            full_text: result.1,
            language_detected: language.clone(),
            processing_time_ms,
        });
    }
    
    // Fallback to CLI tesseract
    tracing::info!("Native tesseract crate not available, using CLI");
    
    // Determine tesseract binary path
    let tesseract = tesseract_path.unwrap_or_else(|| "tesseract".to_string());
    
    // Check if tesseract is available
    let version_check = Command::new(&tesseract)
        .args(["--version"])
        .output();
    
    if version_check.is_err() {
        return Err(format!(
            "Tesseract not found. Install Tesseract OCR and ensure it's in your PATH, \
            or use Tesseract.js on the frontend."
        ));
    }
    
    // Build tesseract command - output TSV format for detailed results
    let output = Command::new(&tesseract)
        .arg(&image_path)
        .arg("stdout")
        .arg("-l")
        .arg(&language)
        .arg("tsv")
        .output()
        .map_err(|e| format!("Failed to run tesseract: {}", e))?;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Tesseract OCR failed: {}", stderr));
    }
    
    // Parse TSV output to extract text, confidence, and bounding boxes
    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut items = Vec::new();
    let mut full_text = String::new();
    
    for (idx, line) in stdout.lines().enumerate() {
        if idx == 0 {
            // First line is header, skip
            continue;
        }
        
        let fields: Vec<&str> = line.split('\t').collect();
        if fields.len() < 12 {
            continue;
        }
        
        // Parse TSV fields: level page_num block_num par_num line_num word_num 
        //                   left top width height conf text
        // Index:            0      1        2         3       4         5
        //                   6     7      8      9       10      11
        let text = fields[11].to_string();
        if text.is_empty() {
            continue;
        }
        
        let conf: f32 = fields[10].parse().unwrap_or(0.0);
        
        let bbox = BoundingBox {
            x: fields[6].parse().unwrap_or(0),
            y: fields[7].parse().unwrap_or(0),
            width: fields[8].parse().unwrap_or(0),
            height: fields[9].parse().unwrap_or(0),
        };
        
        items.push(OCRResultItem {
            text: text.clone(),
            confidence: conf / 100.0,
            bounding_box: bbox,
        });
        
        if !full_text.is_empty() {
            full_text.push(' ');
        }
        full_text.push_str(&text);
    }
    
    let processing_time_ms = start.elapsed().as_millis() as u64;
    
    // Detect language (best effort based on what was requested)
    let language_detected = if language.contains("chi") {
        "chinese".to_string()
    } else if language.contains("jpn") {
        "japanese".to_string()
    } else if language.contains("kor") {
        "korean".to_string()
    } else {
        language.clone()
    };
    
    Ok(OCRProcessResult {
        items,
        full_text,
        language_detected,
        processing_time_ms,
    })
}

/// Try native Rust tesseract bindings (requires tesseract-sys crate)
/// Returns Ok with (items, full_text) or Err if not available
fn try_native_tesseract(image_path: &str, language: &str) -> Result<(Vec<OCRResultItem>, String), String> {
    // Try to use tesseract crate if compiled with TESSERACT_SUPPORT
    // This is a compile-time feature, so we check at runtime instead
    
    // For now, just return error to use CLI fallback
    // In production, you would enable the "tesseract" feature in Cargo.toml
    // and use the tesseract crate directly
    Err("Native tesseract not enabled".to_string())
}

/// Process base64-encoded image directly with OCR
#[tauri::command]
pub async fn ocr_base64_image(
    image_data: String,
    language: String,
) -> Result<OCRProcessResult, String> {
    use std::time::Instant;
    use std::io::Write;
    use std::process::Command;
    
    let start = Instant::now();
    
    // Decode base64 to image
    let image_bytes = base64::engine::general_purpose::STANDARD
        .decode(&image_data)
        .map_err(|e| format!("Failed to decode base64 image: {}", e))?;
    
    // Write to temp file
    let temp_path = std::env::temp_dir().join(format!(
        "visionsub_ocr_{}.png",
        uuid_v4()
    ));
    
    {
        let mut file = std::fs::File::create(&temp_path)
            .map_err(|e| format!("Failed to create temp file: {}", e))?;
        file.write_all(&image_bytes)
            .map_err(|e| format!("Failed to write image data: {}", e))?;
    }
    
    // Process with Tesseract CLI
    let result = ocr_image_tesseract(
        temp_path.to_string_lossy().to_string(),
        language,
        None,
    ).await;
    
    // Cleanup temp file
    let _ = std::fs::remove_file(&temp_path);
    
    match result {
        Ok(mut r) => {
            r.processing_time_ms = start.elapsed().as_millis() as u64;
            Ok(r)
        }
        Err(e) => Err(e)
    }
}
