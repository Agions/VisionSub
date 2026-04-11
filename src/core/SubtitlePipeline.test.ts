import { describe, it, expect, beforeEach } from 'vitest'
import { SubtitlePipeline, textSimilarity } from './SubtitlePipeline'
import type { SubtitleLite } from '@/types/subtitle'

function sub(
  startTime: number,
  endTime: number,
  text: string,
  confidence: number,
  startFrame = 0,
  endFrame = 0,
): SubtitleLite {
  return { startTime, endTime, startFrame, endFrame, text, confidence }
}

describe('SubtitlePipeline', () => {
  let pipeline: SubtitlePipeline

  beforeEach(() => {
    pipeline = new SubtitlePipeline()
    pipeline.clearCache()
  })

  // ─── textSimilarity ─────────────────────────────────────────────
  describe('textSimilarity', () => {
    it('returns 1.0 for identical strings', () => {
      expect(textSimilarity('test', 'test')).toBe(1.0)
    })

    it('returns 1.0 for identical empty strings (early-exit equality)', () => {
      // a === b check fires before the !a.length branch
      expect(textSimilarity('', '')).toBe(1.0)
    })

    it('returns 0 when one string is empty', () => {
      expect(textSimilarity('abc', '')).toBe(0)
    })

    it('returns low similarity for completely different strings', () => {
      const sim = textSimilarity('abc', 'xyz')
      expect(sim).toBeLessThan(0.5)
    })

    it('returns high similarity for similar strings', () => {
      const sim = textSimilarity('Hello world', 'Hello world!')
      expect(sim).toBeGreaterThan(0.8)
    })
  })

  // ─── Stage 1: filterJitter ─────────────────────────────────────
  describe('Stage 1: filterJitter', () => {
    it('keeps normal subtitles untouched', () => {
      const input = [
        sub(0.0, 3.0, 'Hello world', 0.9),
        sub(3.5, 6.0, 'Good morning', 0.85),
      ]
      const result = pipeline.processStage(input, 1)
      expect(result.map(s => s.text)).toEqual(['Hello world', 'Good morning'])
    })

    it('removes jitter when it can be bridged (3 consecutive similar)', () => {
      const input = [
        sub(0.0, 3.0, 'Hello', 0.9),
        sub(3.1, 3.4, 'Hello', 0.5), // jitter, sim=1.0 to both neighbors
        sub(3.5, 6.0, 'Hello', 0.9),
      ]
      const result = pipeline.processStage(input, 1)
      // 3 consecutive similar: bridge through jitter → single merged subtitle
      expect(result).toHaveLength(1)
      expect(result[0].text).toBe('Hello')
      expect(result[0].endTime).toBe(6.0)
    })

    it('absorbs jitter into prev when only prev is similar', () => {
      const input = [
        sub(0.0, 3.0, 'Hello', 0.9),
        sub(3.1, 3.4, 'Hello', 0.5), // jitter, sim=1.0 to prev only
        sub(3.5, 6.0, 'Different', 0.9), // not similar to jitter
      ]
      const result = pipeline.processStage(input, 1)
      // Jitter absorbed into prev (Hello), Different stays separate
      const texts = result.map(s => s.text)
      expect(texts).toContain('Hello')
      expect(texts).toContain('Different')
    })

    it('keeps jitter subtitle when dissimilar to both neighbors', () => {
      const input = [
        sub(0.0, 3.0, 'Hello', 0.9),
        sub(3.1, 3.3, 'Jitter', 0.5), // jitter, dissimilar to neighbors
        sub(3.5, 6.0, 'World', 0.9),
      ]
      const result = pipeline.processStage(input, 1)
      // Jitter is dissimilar to both → kept as-is
      expect(result.map(s => s.text)).toContain('Jitter')
    })
  })

  // ─── Stage 2: mergeSplit ────────────────────────────────────────
  describe('Stage 2: mergeSplit', () => {
    // Use texts that won't be absorbed in stage1 (high duration + high conf)
    // so we can test stage2 in isolation.

    it('keeps unrelated subtitles as separate groups', () => {
      const input = [
        sub(0.0, 1.5, 'Alpha', 0.9, 0, 30),
        sub(5.0, 6.5, 'Beta', 0.85, 120, 156), // gap=3.5s > splitMaxGap=1.5, sim=0
      ]
      const result = pipeline.processStage(input, 2)
      expect(result).toHaveLength(2)
    })

    it('merges split subtitles within gap limit', () => {
      const input = [
        sub(0.0, 1.5, 'Hello', 0.9, 0, 30),
        sub(1.8, 3.0, 'Hello', 0.9, 42, 72), // gap=0.3s ≤ splitMaxGap=1.5, sim=1.0
        sub(3.2, 4.5, 'Hello', 0.9, 76, 108),
      ]
      const result = pipeline.processStage(input, 2)
      expect(result).toHaveLength(1)
      expect(result[0].text).toBe('Hello')
      expect(result[0].startTime).toBe(0.0)
      expect(result[0].endTime).toBe(4.5)
    })

    it('does not merge when gap exceeds splitMaxGap', () => {
      // Using texts that avoid stage1 absorption:
      // - sub[1] duration=1.5 (>0.3) so not jitter
      const input = [
        sub(0.0, 1.5, 'Alpha', 0.9, 0, 30),
        sub(3.1, 4.6, 'Beta', 0.9, 74, 110), // gap=1.6s > splitMaxGap=1.5
      ]
      const result = pipeline.processStage(input, 2)
      expect(result).toHaveLength(2)
    })

    it('does not merge subtitles with different text', () => {
      const input = [
        sub(0.0, 1.5, 'Alpha', 0.9, 0, 30),
        sub(1.8, 3.0, 'Beta', 0.9, 42, 72), // gap=0.3s ok but sim=0
      ]
      const result = pipeline.processStage(input, 2)
      expect(result).toHaveLength(2)
    })
  })

  // ─── Stage 3: mergeSimilar ─────────────────────────────────────
  describe('Stage 3: mergeSimilar', () => {
    it('merges overlapping similar subtitles', () => {
      const input = [
        sub(0.0, 2.0, 'Hello', 0.9, 0, 48),
        sub(1.5, 3.5, 'Hello', 0.9, 36, 84), // overlap + sim=1.0 → merge
      ]
      const result = pipeline.processStage(input, 3)
      expect(result).toHaveLength(1)
    })

    it('keeps subtitles separate when gap exceeds similarMaxGap', () => {
      // Using different texts to avoid stage1 absorption.
      // sub[1] duration=1.5 (>0.3) so not jitter.
      const input = [
        sub(0.0, 1.0, 'Alpha', 0.9, 0, 24),
        sub(3.0, 4.0, 'Beta', 0.9, 72, 96), // gap=2.0s > similarMaxGap=0.5
      ]
      const result = pipeline.processStage(input, 3)
      expect(result).toHaveLength(2)
    })

    it('keeps subtitles separate when text is dissimilar', () => {
      const input = [
        sub(0.0, 2.0, 'Alpha', 0.9, 0, 48),
        sub(1.0, 3.0, 'Beta', 0.9, 24, 72), // overlap but sim≈0
      ]
      const result = pipeline.processStage(input, 3)
      expect(result).toHaveLength(2)
    })
  })

  // ─── Stage 4: computeEndTime ────────────────────────────────────
  describe('Stage 4: computeEndTime', () => {
    it('caps endTime at next subtitle startTime', () => {
      const input = [
        sub(0.0, 99.0, 'First', 0.9),
        sub(2.0, 4.0, 'Second', 0.9),
      ]
      const result = pipeline.processStage(input, 4)
      expect(result[0].endTime).toBe(2.0)
      expect(result[1].endTime).toBe(4.0) // no next → preserved
    })

    it('caps endTime at startTime + 10s maximum', () => {
      const input = [
        sub(0.0, 99.0, 'First', 0.9),
        sub(20.0, 25.0, 'Second', 0.9), // gap=20 > 10 → cap at 10
      ]
      const result = pipeline.processStage(input, 4)
      expect(result[0].endTime).toBe(10.0)
    })

    it('handles single subtitle (preserves endTime)', () => {
      const input = [sub(0.0, 5.0, 'Solo', 0.9)]
      const result = pipeline.processStage(input, 4)
      expect(result[0].endTime).toBe(5.0)
    })

    it('handles empty list', () => {
      expect(pipeline.processStage([], 4)).toHaveLength(0)
    })
  })

  // ─── Full Pipeline ──────────────────────────────────────────────
  describe('Full pipeline', () => {
    it('processes empty input', () => {
      expect(pipeline.process([])).toHaveLength(0)
    })

    it('processes single subtitle', () => {
      const result = pipeline.process([sub(0.0, 3.0, 'Solo', 0.9)])
      expect(result).toHaveLength(1)
      expect(result[0].text).toBe('Solo')
    })

    it('full pipeline removes jitter and merges splits and similar', () => {
      const input = [
        sub(0.0, 0.2, 'X', 0.5),    // jitter → stage 1 removes
        sub(0.3, 1.5, 'Hello', 0.9),
        sub(1.7, 2.5, 'Hello', 0.9), // stage 2: split merge
        sub(2.6, 4.0, 'Hello', 0.9), // stage 3: similar merge
        sub(4.5, 6.0, 'World', 0.9),
      ]
      const result = pipeline.process(input)
      expect(result.length).toBeLessThanOrEqual(3)
      const worldSub = result.find(s => s.text === 'World')
      expect(worldSub).toBeDefined()
    })
  })

  // ─── Cache ─────────────────────────────────────────────────────
  describe('Cache', () => {

    it('caches similarity results for repeated comparisons', () => {
      // First call computes (no cache)
      const sim1 = textSimilarity('Hello world', 'Hello world')
      expect(sim1).toBe(1.0)
      // Second call with same strings hits cache
      const sim2 = textSimilarity('Hello world', 'Hello world')
      expect(sim2).toBe(1.0)
    })

    it('clearCache resets without errors', () => {
      textSimilarity('Hello', 'World')
      pipeline.clearCache() // no error
      expect(textSimilarity('Hello', 'World')).toBeGreaterThanOrEqual(0)
    })
  })

  // ─── Configuration ─────────────────────────────────────────────
  describe('Configuration', () => {
    it('uses default options', () => {
      const opts = new SubtitlePipeline().getOptions()
      expect(opts.jitterMinDuration).toBe(0.3)
      expect(opts.jitterMaxConfidence).toBe(0.75)
      expect(opts.splitMaxGap).toBe(1.5)
      expect(opts.similarMaxGap).toBe(0.5)
    })

    it('configure overrides specific options', () => {
      const p = new SubtitlePipeline({ jitterMinDuration: 1.0 })
      expect(p.getOptions().jitterMinDuration).toBe(1.0)
      expect(p.getOptions().splitMaxGap).toBe(1.5) // default preserved
    })

    it('configure returns this for chaining', () => {
      const p = new SubtitlePipeline()
      const returned = p.configure({ jitterMinDuration: 0.5 })
      expect(returned).toBe(p)
    })
  })
})
