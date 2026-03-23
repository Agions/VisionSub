# 更新日志

## [3.1.0] - 2026-03-23

### 新增

- ✨ **导出格式扩展**：新增 TXT、Markdown (MD) 格式支持
- ✨ **字幕处理工具函数**：
  - `mergeConsecutiveSubtitles()` - 合并相邻相同字幕
  - `deduplicateSubtitles()` - 去除重复字幕
  - `splitByLanguage()` - 按语言分割字幕
  - `filterByConfidence()` - 按置信度过滤
  - `sortByTime()` - 按时间排序
- ✨ **格式工具**：`getSupportedFormats()`、`getFormatDisplayName()`

### 改进

- ⚡️ 导出选项支持 `includeTimecode` 参数
- 📦 支持 12 种导出格式（SRT/VTT/ASS/JSON/TXT/MD/LRC/SBV/CSV/SSA/STL/TTML）

## [3.0.2] - 之前版本

- 初始版本发布
- OCR 引擎集成（Tesseract.js + CLI）
- 多种字幕格式导出
- 系统诊断面板
