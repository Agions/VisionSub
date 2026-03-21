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
            language: vec!["ch".to_string(), "en".to_string()],
            confidence_threshold: 0.7,
            use_gpu: true,
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
            // PaddleOCR would be initialized here
            // For now, return mock
            Ok("paddleocr-initialized".to_string())
        }
        "tesseract" => {
            // Tesseract is used via WASM on frontend
            Ok("tesseract-wasm".to_string())
        }
        "easyocr" => {
            Ok("easyocr-initialized".to_string())
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
    
    let start = std::time::Instant::now();
    
    // Mock result for demonstration
    // Real implementation would call native OCR library
    let result = OCRProcessResult {
        items: vec![
            OCRResultItem {
                text: "Sample Text".to_string(),
                confidence: 0.95,
                bounding_box: BoundingBox {
                    x: 10,
                    y: 10,
                    width: 200,
                    height: 40,
                },
            },
        ],
        full_text: "Sample Text".to_string(),
        language_detected: "en".to_string(),
        processing_time_ms: start.elapsed().as_millis() as u64,
    };
    
    Ok(result)
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
    
    let start = std::time::Instant::now();
    
    // Extract ROI from image data
    // Real implementation would handle this properly
    
    let result = OCRProcessResult {
        items: vec![],
        full_text: String::new(),
        language_detected: "unknown".to_string(),
        processing_time_ms: start.elapsed().as_millis() as u64,
    };
    
    Ok(result)
}

#[tauri::command]
pub fn get_available_ocr_engines() -> HashMap<String, bool> {
    let mut engines = HashMap::new();
    engines.insert("tesseract".to_string(), true); // Always available (WASM)
    engines.insert("paddle".to_string(), false); // Requires native binding
    engines.insert("easyocr".to_string(), false); // Requires native binding
    engines
}

#[tauri::command]
pub fn get_ocr_engine_info(engine: String) -> Result<serde_json::Value, String> {
    match engine.as_str() {
        "tesseract" => Ok(serde_json::json!({
            "name": "Tesseract.js",
            "type": "wasm",
            "languages": ["eng", "chi_sim", "chi_tra", "jpn", "kor"],
            "gpu_support": false,
            "accuracy": "medium",
            "speed": "fast",
            "description": "Pure JavaScript OCR using WebAssembly. Fast and works in browser."
        })),
        "paddle" => Ok(serde_json::json!({
            "name": "PaddleOCR",
            "type": "native",
            "languages": ["ch", "en", "ja", "ko", "fr", "de", "es"],
            "gpu_support": true,
            "accuracy": "high",
            "speed": "medium",
            "description": "BAIDU's OCR engine. High accuracy, requires native installation."
        })),
        "easyocr" => Ok(serde_json::json!({
            "name": "EasyOCR",
            "type": "native",
            "languages": ["ch", "en", "ja", "ko", "fr", "de", "es", "it", "pt", "ru"],
            "gpu_support": true,
            "accuracy": "high",
            "speed": "slow",
            "description": "Python-based OCR. Supports many languages but slower."
        })),
        _ => Err(format!("Unknown OCR engine: {}", engine))
    }
}
