use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemDependency {
    pub name: String,
    pub command: String,
    pub required: bool,
    pub version_args: Vec<String>,
    pub version_pattern: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DependencyCheckResult {
    pub name: String,
    pub installed: bool,
    pub version: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemCheckResult {
    pub all_satisfied: bool,
    pub dependencies: Vec<DependencyCheckResult>,
    pub recommendations: Vec<String>,
}

const SYSTEM_DEPENDENCIES: [SystemDependency; 4] = [
    SystemDependency {
        name: "ffmpeg".to_string(),
        command: "ffmpeg".to_string(),
        required: true,
        version_args: vec!["-version".to_string()],
        version_pattern: "ffmpeg version".to_string(),
    },
    SystemDependency {
        name: "ffprobe".to_string(),
        command: "ffprobe".to_string(),
        required: true,
        version_args: vec!["-version".to_string()],
        version_pattern: "ffprobe version".to_string(),
    },
    SystemDependency {
        name: "tesseract".to_string(),
        command: "tesseract".to_string(),
        required: true,
        version_args: vec!["--version".to_string()],
        version_pattern: "tesseract".to_string(),
    },
    SystemDependency {
        name: "ImageMagick".to_string(),
        command: "convert".to_string(),
        required: false,
        version_args: vec!["--version".to_string()],
        version_pattern: "ImageMagick".to_string(),
    },
];

#[tauri::command]
pub fn check_system_dependencies() -> SystemCheckResult {
    let mut results = Vec::new();
    let mut all_satisfied = true;
    let mut recommendations = Vec::new();
    
    for dep in &SYSTEM_DEPENDENCIES {
        let result = check_single_dependency(dep);
        
        if !result.installed && dep.required {
            all_satisfied = false;
            recommendations.push(format!(
                "{} is required but not found. Please install {} to enable full functionality.",
                dep.name, dep.name
            ));
        } else if !result.installed && !dep.required {
            recommendations.push(format!(
                "{} is optional. Install ImageMagick for better image format support.",
                dep.name
            ));
        }
        
        results.push(result);
    }
    
    SystemCheckResult {
        all_satisfied,
        dependencies: results,
        recommendations,
    }
}

fn check_single_dependency(dep: &SystemDependency) -> DependencyCheckResult {
    let output = Command::new(&dep.command)
        .args(&dep.version_args)
        .output();
    
    match output {
        Ok(out) => {
            if out.status.success() {
                let stdout = String::from_utf8_lossy(&out.stdout);
                let stderr = String::from_utf8_lossy(&out.stderr);
                let output_str = if stdout.contains(&dep.version_pattern) {
                    stdout.to_string()
                } else {
                    stderr.to_string()
                };
                
                // Extract version string (simple heuristic)
                let version = extract_version(&output_str);
                
                DependencyCheckResult {
                    name: dep.name.clone(),
                    installed: true,
                    version,
                    error: None,
                }
            } else {
                DependencyCheckResult {
                    name: dep.name.clone(),
                    installed: false,
                    version: None,
                    error: Some("Command exited with error".to_string()),
                }
            }
        }
        Err(e) => {
            DependencyCheckResult {
                name: dep.name.clone(),
                installed: false,
                version: None,
                error: Some(format!("Command not found: {}", e)),
            }
        }
    }
}

fn extract_version(output: &str) -> Option<String> {
    // Try to find version number in output
    // Common patterns: "X.Y.Z", "version X.Y", etc.
    for line in output.lines() {
        let line = line.trim();
        if line.starts_with("ffmpeg version") || line.starts_with("ffprobe version") {
            // Extract version from "ffmpeg version X.Y.Z ..."
            if let Some(version_part) = line.split_whitespace().nth(2) {
                return Some(version_part.to_string());
            }
        }
        if line.starts_with("tesseract") {
            // Extract version from "tesseract X.Y.Z"
            if let Some(version_part) = line.split_whitespace().nth(1) {
                return Some(version_part.to_string());
            }
        }
        if line.contains("ImageMagick") && line.contains("version") {
            // Extract version from "ImageMagick X.Y.Z ..." or similar
            let parts: Vec<&str> = line.split_whitespace().collect();
            for (i, part) in parts.iter().enumerate() {
                if *part == "version" && i + 1 < parts.len() {
                    return Some(parts[i + 1].to_string());
                }
            }
        }
    }
    
    // Fallback: just return the first line if it looks like version info
    let first_line = output.lines().next().unwrap_or("");
    if first_line.contains("version") || first_line.contains("Version") {
        Some(first_line.trim().to_string())
    } else {
        None
    }
}

#[tauri::command]
pub fn get_tesseract_languages() -> Vec<String> {
    let output = Command::new("tesseract")
        .args(["--list-langs"])
        .output();
    
    match output {
        Ok(out) if out.status.success() => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            stdout.lines()
                .skip(1) // Skip header line
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect()
        }
        _ => {
            vec!["eng".to_string(), "chi_sim".to_string()] // Default languages
        }
    }
}
