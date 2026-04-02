# 更新日志

## [3.1.1] - 2026-04-02

### 新增

- ✨ **OCR 准确度预估仪表盘**：基于引擎+语言+设置组合实时预估准确率，颜色编码（绿/黄/红）
- ✨ **引擎选择卡片**：星级评分（精度/速度各1-5星）、支持语言数量、技术栈标签（PP-OCRv5 / LSTM+WASM 等）
- ✨ **语言选择器（分组）**：按语系分组（CJK / 欧洲 / 其他），emoji 国旗图标
- ✨ **高级选项面板（可折叠）**：
  - 多通道 OCR（多次识别取最优）
  - 文字后处理（标点修正、繁简转换、去除重复字符）
  - 字幕合并（Levenshtein 相似度阈值可调）
  - 场景检测灵敏度滑块
  - 帧间隔步进器

### 改进

- ⚡️ **提取链路打通**：`开始提取` 按钮现在真正触发完整 OCR 流程（之前只设置标志位）
- ⚡️ **OCR 引擎后处理管道**：
  - 全角→半角标点自动转换
  - 置信度校准（混合语言/超短文本/重复字符自动降分）
  - 字幕自动合并（相似度≥80% + 时间间隙≤0.5s）
- ⚡️ **场景检测**：从逐像素 diff 升级为 16-bin 量化直方图 + chi-square 测试，更快更稳
- 🎨 **UI 全面升级**：VideoPreview 呼吸边框 + timeline 气泡、SubtitleList 置信度徽章 + 内联编辑、SidePanel 四标签设计
- 🎨 **ToolBar 主题切换**：暗色/亮色模式一键切换，SVG 图标系统
- 🎨 **BatchProcessView 批量处理**：双栏布局、SVG 图标、任务队列可视化
- 🔧 **代码质量**：消除全部 `any` 类型滥用、switch → dispatch table、O(n) → O(log n) 插入优化

### 修复

- 🐛 修复 `开始提取` 不触发实际 OCR 的 bug
- 🐛 修复 `redo()` 越界检查缺失
- 🐛 修复场景检测对噪动帧误判

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
