//! Shared utilities for the HardSubX commands layer.

use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

/// RAII guard: automatically removes a temp file when dropped.
pub struct TempFileGuard(PathBuf);

impl TempFileGuard {
    pub fn new(path: PathBuf) -> Self {
        Self(path)
    }

    /// Returns the path being managed as a string slice.
    pub fn path(&self) -> &std::path::Path {
        &self.0
    }

    /// Release ownership without deleting (caller takes responsibility).
    pub fn into_path(self) -> PathBuf {
        let p = self.0.clone();
        std::mem::forget(self);
        p
    }
}

impl Drop for TempFileGuard {
    fn drop(&mut self) {
        if let Err(e) = std::fs::remove_file(&self.0) {
            tracing::warn!("Failed to remove temp file {:?}: {}", self.0, e);
        }
    }
}

/// Generate a unique ID based on current time and process ID.
/// Used for temporary files that need a unique name.
pub fn uuid_v4() -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();

    let random_part = (now.as_nanos() ^ (std::process::id() as u128 * 0x5deece66d)) % 0xfffffffffffff;

    format!(
        "{:012x}-{:04x}-4{:03x}-{:04}-{:012x}",
        (random_part >> 80) & 0xffffffffffff,
        (random_part >> 64) & 0xffff,
        (random_part >> 60) & 0xfff,
        ((random_part >> 48) & 0x3fff) | 0x8000,
        random_part & 0xffffffffffff
    )
}

/// Get the path to a temp directory for this application.
pub fn temp_dir() -> PathBuf {
    std::env::temp_dir().join("hardsubx")
}

/// Build a temp file path under the application temp directory.
pub fn temp_path(suffix: &str) -> PathBuf {
    let dir = temp_dir();
    let _ = std::fs::create_dir_all(&dir);
    dir.join(format!("hardsubx_{}_{}", uuid_v4(), suffix))
}
