// Subtitle Types
import type { ROI } from './video'

export interface SubtitleItem {
  id: string
  index: number
  startTime: number      // seconds
  endTime: number        // seconds
  startFrame: number
  endFrame: number
  text: string
  confidence: number     // 0-1
  language?: string
  roi: ROI
  thumbnailUrls: string[]
  edited: boolean         // has been manually edited
}

export interface SubtitleEdit {
  id: string
  field: 'text' | 'startTime' | 'endTime'
  oldValue: string | number
  newValue: string | number
}

export interface SubtitleExportOptions {
  format: ExportFormat
  includeThumbnails: boolean
  includeConfidence: boolean
  outputPath: string
}

export type ExportFormat = 'srt' | 'vtt' | 'ass' | 'json' | 'txt'

export interface ExportFormats {
  srt: boolean
  vtt: boolean
  ass: boolean
  json: boolean
  txt: boolean
}

// SRT Format
export function formatSRT(subtitles: SubtitleItem[]): string {
  return subtitles.map((sub, i) => {
    const start = formatTimestamp(sub.startTime, ',')
    const end = formatTimestamp(sub.endTime, ',')
    return `${i + 1}\n${start} --> ${end}\n${sub.text}\n`
  }).join('\n')
}

// VTT Format
export function formatWebVTT(subtitles: SubtitleItem[]): string {
  const header = 'WEBVTT\n\n'
  const content = subtitles.map((sub, i) => {
    const start = formatTimestamp(sub.startTime, '.')
    const end = formatTimestamp(sub.endTime, '.')
    return `${i + 1}\n${start} --> ${end}\n${sub.text}\n`
  }).join('\n')
  return header + content
}

// JSON Format (with frame mapping)
export function formatJSON(subtitles: SubtitleItem[]): string {
  return JSON.stringify({
    version: '3.0',
    generatedAt: new Date().toISOString(),
    subtitles: subtitles.map(sub => ({
      id: sub.id,
      index: sub.index,
      startTime: sub.startTime,
      endTime: sub.endTime,
      startFrame: sub.startFrame,
      endFrame: sub.endFrame,
      text: sub.text,
      confidence: sub.confidence,
      language: sub.language,
      roi: sub.roi,
      thumbnailUrls: sub.thumbnailUrls
    }))
  }, null, 2)
}

// Timestamp formatter
function formatTimestamp(seconds: number, separator: string): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)
  
  const pad = (n: number, len = 2) => n.toString().padStart(len, '0')
  
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}${separator}${pad(ms, 3)}`
}
