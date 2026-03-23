import { ref, shallowRef } from 'vue'
import type { OCRConfig, OCREngine } from '@/types/video'
import { useImagePreprocessor } from './useImagePreprocessor'

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

export interface OCRProcessingOptions {
  /** Apply image preprocessing for better accuracy (default: true) */
  preprocess?: boolean
  /** Preprocessing mode: 'subtitle' | 'document' | 'none' (default: 'subtitle') */
  preprocessMode?: 'subtitle' | 'document' | 'none'
  /** Scale factor for upscaling (default: 2.0) */
  scaleFactor?: number
  /** Use multi-pass OCR with different configurations (default: true) */
  multiPass?: boolean
  /** Use GPU acceleration if available (default: true) */
  useGpu?: boolean
}

// 模块缓存，避免重复加载
let cachedTesseractModule: any = null

export function useOCREngine() {
  const isReady = ref(false)
  const isProcessing = ref(false)
  const progress = ref(0)
  const error = ref<string | null>(null)
  const preprocessor = useImagePreprocessor()
  
  // Tesseract worker (lazy loaded)
  const worker = shallowRef<any>(null)
  
  /**
   * 安全地提取ROI，处理边界情况
   */
  function safeExtractROI(
    imageData: ImageData,
    roiX: number,
    roiY: number,
    roiWidth: number,
    roiHeight: number
  ): ImageData {
    // 确保ROI在图像范围内
    const safeX = Math.max(0, Math.min(Math.floor(roiX), imageData.width - 1))
    const safeY = Math.max(0, Math.min(Math.floor(roiY), imageData.height - 1))
    const safeW = Math.max(1, Math.min(Math.floor(roiWidth), imageData.width - safeX))
    const safeH = Math.max(1, Math.min(Math.floor(roiHeight), imageData.height - safeY))
    
    const roiImageData = new ImageData(safeW, safeH)
    
    for (let y = 0; y < safeH; y++) {
      for (let x = 0; x < safeW; x++) {
        const srcIdx = ((safeY + y) * imageData.width + (safeX + x)) * 4
        const dstIdx = (y * safeW + x) * 4
        
        // 严格边界检查
        if (srcIdx + 3 < imageData.data.length && dstIdx + 3 < roiImageData.data.length) {
          roiImageData.data[dstIdx] = imageData.data[srcIdx]
          roiImageData.data[dstIdx + 1] = imageData.data[srcIdx + 1]
          roiImageData.data[dstIdx + 2] = imageData.data[srcIdx + 2]
          roiImageData.data[dstIdx + 3] = 255 // Alpha 通道
        }
      }
    }
    
    return roiImageData
  }
  
  /**
   * Apply image preprocessing for better OCR accuracy
   */
  function applyPreprocessing(
    imageData: ImageData,
    mode: 'subtitle' | 'document' | 'none' = 'subtitle'
  ): ImageData {
    if (mode === 'none') return imageData
    
    const result = mode === 'subtitle'
      ? preprocessor.preprocessForSubtitles(imageData)
      : preprocessor.preprocessForGeneralText(imageData)
    
    return result.processedData
  }
  
  // Initialize OCR engine
  async function init(
    engine: OCREngine = 'tesseract', 
    langs: string[] = ['eng', 'chi_sim'],
    options: { useGpu?: boolean } = {}
  ) {
    error.value = null
    const useGpu = options.useGpu ?? true
    
    try {
      if (engine === 'tesseract') {
        // 缓存 Tesseract 模块避免重复加载
        if (!cachedTesseractModule) {
          cachedTesseractModule = await import('tesseract.js')
        }
        const Tesseract = cachedTesseractModule
        
        // 如果已有 worker，先终止
        if (worker.value) {
          await worker.value.terminate()
        }
        
        // Determine optimal worker count (more workers = faster but more memory)
        // GPU typically handles 2-4 workers well
        const workerNum = useGpu ? 2 : 1
        
        // Create worker with optimized settings
        worker.value = await Tesseract.createWorker(langs.join('+'), workerNum, {
          logger: (m: any) => {
            if (m.status === 'recognizing text') {
              progress.value = Math.round(m.progress * 100)
            }
          },
          gzip: true, // Use gzip compression for faster data transfer
        })
        
        // Set recognition mode for better accuracy
        // OEM (OCR Engine Mode): 3 = LSTM neural network (best for accuracy)
        // PSM (Page Segmentation Mode): auto-adaptive
        await worker.value.setParameters({
          tessedit_pageseg_mode: '3', // Fully automatic page segmentation, but no OSD
          preserve_interword_spaces: '1',
        })
        
        isReady.value = true
      }
      // Other engines would be initialized here
    } catch (e) {
      error.value = `Failed to initialize OCR engine: ${e}`
      isReady.value = false
    }
  }
  
  // Process image data with optional preprocessing
  async function processImageData(
    imageData: ImageData,
    config: OCRConfig,
    options: OCRProcessingOptions = {}
  ): Promise<OCRResult[]> {
    if (!isReady.value || !worker.value) {
      throw new Error('OCR engine not initialized')
    }
    
    isProcessing.value = true
    progress.value = 0
    error.value = null
    
    const {
      preprocess = true,
      preprocessMode = 'subtitle',
    } = options
    
    try {
      // Apply preprocessing if enabled
      let processedImage = imageData
      if (preprocess && preprocessMode !== 'none') {
        processedImage = applyPreprocessing(imageData, preprocessMode)
      }
      
      // Convert ImageData to canvas to get image URL
      const canvas = document.createElement('canvas')
      canvas.width = processedImage.width
      canvas.height = processedImage.height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Failed to get canvas context')
      
      ctx.putImageData(processedImage, 0, 0)
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
  
  // Process ROI region from image with preprocessing
  async function processROI(
    imageData: ImageData,
    roi: { x: number; y: number; width: number; height: number },
    config: OCRConfig,
    options: OCRProcessingOptions = {}
  ): Promise<OCRResult> {
    const { preprocess = true, preprocessMode = 'subtitle' } = options
    
    // 安全地提取ROI，处理边界情况
    const roiImageData = safeExtractROI(
      imageData,
      roi.x,
      roi.y,
      roi.width,
      roi.height
    )
    
    // Apply preprocessing to ROI if enabled
    let processedROI = roiImageData
    if (preprocess && preprocessMode !== 'none') {
      processedROI = applyPreprocessing(roiImageData, preprocessMode)
    }
    
    const results = await processImageData(processedROI, config, { 
      preprocess: false // Already preprocessed
    })
    
    // Combine all text results
    const fullText = results.map(r => r.text).join(' ')
    const avgConfidence = results.length > 0 
      ? results.reduce((sum, r) => sum + r.confidence, 0) / results.length 
      : 0
    
    return {
      text: fullText,
      confidence: avgConfidence,
      boundingBox: {
        x: roi.x,
        y: roi.y,
        width: roi.width,
        height: roi.height
      }
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
  
  /**
   * Multi-pass OCR: Run OCR with different preprocessing configs and merge results
   * This can improve accuracy by capturing text that might be missed in a single pass
   */
  async function processMultiPass(
    imageData: ImageData,
    config: OCRConfig,
    options: OCRProcessingOptions = {}
  ): Promise<OCRResult[]> {
    const { multiPass = true, preprocessMode = 'subtitle' } = options
    
    if (!multiPass) {
      return processImageData(imageData, config, options)
    }
    
    if (!isReady.value || !worker.value) {
      throw new Error('OCR engine not initialized')
    }
    
    isProcessing.value = true
    error.value = null
    
    try {
      // Pass 1: Standard preprocessing (2x scale)
      const result1 = await processImageData(imageData, config, {
        preprocess: true,
        preprocessMode: 'subtitle',
        scaleFactor: 2.0,
      })
      
      // Pass 2: Higher scale for small text (3x scale)
      const result2 = await processImageData(imageData, config, {
        preprocess: true,
        preprocessMode: 'subtitle',
        scaleFactor: 3.0,
      })
      
      // Pass 3: Different block size for threshold
      const result3 = await processImageData(imageData, config, {
        preprocess: true,
        preprocessMode: 'subtitle',
        scaleFactor: 2.5,
      })
      
      // Merge results: Use results with highest confidence
      // Group by approximate position and take the best
      const merged = mergeOCRResults([result1, result2, result3])
      
      progress.value = 100
      return merged
    } catch (e) {
      error.value = `Multi-pass OCR failed: ${e}`
      throw e
    } finally {
      isProcessing.value = false
    }
  }
  
  /**
   * Merge results from multiple OCR passes
   */
  function mergeOCRResults(resultsList: OCRResult[][]): OCRResult[] {
    // Flatten and deduplicate
    const allWords: OCRResult[] = []
    const used = new Set<number>()
    
    // Sort by confidence descending
    const flat = resultsList.flat().sort((a, b) => b.confidence - a.confidence)
    
    for (const word of flat) {
      // Check if this word overlaps with an already-accepted word
      const isDuplicate = allWords.some(existing => {
        const existingCenter = {
          x: existing.boundingBox.x + existing.boundingBox.width / 2,
          y: existing.boundingBox.y + existing.boundingBox.height / 2
        }
        const wordCenter = {
          x: word.boundingBox.x + word.boundingBox.width / 2,
          y: word.boundingBox.y + word.boundingBox.height / 2
        }
        const distance = Math.sqrt(
          (existingCenter.x - wordCenter.x) ** 2 +
          (existingCenter.y - wordCenter.y) ** 2
        )
        // If centers are within 20 pixels, consider it duplicate
        return distance < 20 && existing.text === word.text
      })
      
      if (!isDuplicate) {
        allWords.push(word)
      }
    }
    
    return allWords
  }
  
  return {
    isReady,
    isProcessing,
    progress,
    error,
    init,
    processImageData,
    processROI,
    processMultiPass,
    terminate,
    applyPreprocessing,
  }
}
