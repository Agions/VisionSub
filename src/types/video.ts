// Video Types

export interface VideoMetadata {
  path: string
  width: number
  height: number
  duration: number
  fps: number
  totalFrames: number
  codec: string
}

export interface Frame {
  index: number
  timestamp: number
  width: number
  height: number
  data?: Uint8Array
  thumbnailUrl?: string
}

export interface ROIPreset {
  id: string
  name: string
  icon: string
  rect: ROI
}

export const ROI_PRESETS: ROIPreset[] = [
  { id: 'bottom', name: '底部字幕', icon: '⬇️', rect: { x: 0, y: 0, width: 100, height: 15, unit: 'percent' } },
  { id: 'top', name: '顶部字幕', icon: '⬆️', rect: { x: 0, y: 85, width: 100, height: 15, unit: 'percent' } },
  { id: 'left', name: '左侧字幕', icon: '⬅️', rect: { x: 0, y: 30, width: 40, height: 40, unit: 'percent' } },
  { id: 'right', name: '右侧字幕', icon: '➡️', rect: { x: 60, y: 30, width: 40, height: 40, unit: 'percent' } },
  { id: 'center', name: '中心字幕', icon: '⭕', rect: { x: 20, y: 70, width: 60, height: 20, unit: 'percent' } },
]

export interface ROI {
  id: string
  name: string
  type: 'top' | 'bottom' | 'left' | 'right' | 'center' | 'custom'
  x: number
  y: number
  width: number
  height: number
  unit: 'percent' | 'pixel'
  enabled: boolean
}

export interface ExtractOptions {
  sceneThreshold: number
  frameInterval: number
  ocrEngine: OCREngine
  languages: string[]
  confidenceThreshold: number
}

export type OCREngine = 'paddle' | 'easyocr' | 'tesseract'

export interface OCRConfig {
  engine: OCREngine
  language: string[]
  confidenceThreshold: number
}
