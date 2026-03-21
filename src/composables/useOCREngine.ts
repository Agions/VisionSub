import { ref, shallowRef } from 'vue'
import type { OCRConfig, OCREngine } from '@/types/video'

export interface OCRResult {
  text: string
  confidence: number
  boundingBox: {
    x: number
    y: number
    width: number
    height: number
  }
}

export function useOCREngine() {
  const isReady = ref(false)
  const isProcessing = ref(false)
  const progress = ref(0)
  const error = ref<string | null>(null)
  
  // Tesseract worker (lazy loaded)
  const worker = shallowRef<any>(null)
  
  // Initialize OCR engine
  async function init(engine: OCREngine = 'tesseract', langs: string[] = ['eng', 'chi_sim']) {
    error.value = null
    
    try {
      if (engine === 'tesseract') {
        // Dynamically import Tesseract.js
        const Tesseract = await import('tesseract.js')
        
        // Create worker
        worker.value = await Tesseract.createWorker(langs.join('+'), 1, {
          logger: (m: any) => {
            if (m.status === 'recognizing text') {
              progress.value = Math.round(m.progress * 100)
            }
          }
        })
        
        isReady.value = true
      }
      // Other engines would be initialized here
    } catch (e) {
      error.value = `Failed to initialize OCR engine: ${e}`
      isReady.value = false
    }
  }
  
  // Process image data
  async function processImageData(
    imageData: ImageData,
    config: OCRConfig
  ): Promise<OCRResult[]> {
    if (!isReady.value || !worker.value) {
      throw new Error('OCR engine not initialized')
    }
    
    isProcessing.value = true
    progress.value = 0
    error.value = null
    
    try {
      // Convert ImageData to canvas to get image URL
      const canvas = document.createElement('canvas')
      canvas.width = imageData.width
      canvas.height = imageData.height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Failed to get canvas context')
      
      ctx.putImageData(imageData, 0, 0)
      const imageUrl = canvas.toDataURL('image/png')
      
      // Process with Tesseract
      const result = await worker.value.recognize(imageUrl)
      
      progress.value = 100
      
      return result.data.words.map((word: any) => ({
        text: word.text,
        confidence: word.confidence / 100,
        boundingBox: {
          x: word.bbox.x0,
          y: word.bbox.y0,
          width: word.bbox.x1 - word.bbox.x0,
          height: word.bbox.y1 - word.bbox.y0
        }
      }))
    } catch (e) {
      error.value = `OCR processing failed: ${e}`
      throw e
    } finally {
      isProcessing.value = false
    }
  }
  
  // Process ROI region from image
  async function processROI(
    imageData: ImageData,
    roi: { x: number; y: number; width: number; height: number },
    config: OCRConfig
  ): Promise<OCRResult> {
    // Extract ROI from image data
    const roiImageData = new ImageData(roi.width, roi.height)
    
    for (let y = 0; y < roi.height; y++) {
      for (let x = 0; x < roi.width; x++) {
        const srcIdx = ((roi.y + y) * imageData.width + (roi.x + x)) * 4
        const dstIdx = (y * roi.width + x) * 4
        
        roiImageData.data[dstIdx] = imageData.data[srcIdx]
        roiImageData.data[dstIdx + 1] = imageData.data[srcIdx + 1]
        roiImageData.data[dstIdx + 2] = imageData.data[srcIdx + 2]
        roiImageData.data[dstIdx + 3] = imageData.data[srcIdx + 3]
      }
    }
    
    const results = await processImageData(roiImageData, config)
    
    // Combine all text results
    const fullText = results.map(r => r.text).join(' ')
    const avgConfidence = results.length > 0 
      ? results.reduce((sum, r) => sum + r.confidence, 0) / results.length 
      : 0
    
    return {
      text: fullText,
      confidence: avgConfidence,
      boundingBox: roi
    }
  }
  
  // Terminate worker
  async function terminate() {
    if (worker.value) {
      await worker.value.terminate()
      worker.value = null
      isReady.value = false
    }
  }
  
  return {
    isReady,
    isProcessing,
    progress,
    error,
    init,
    processImageData,
    processROI,
    terminate
  }
}
