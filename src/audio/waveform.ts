import type { SoundRecord } from '../core/types'

/** Hafif dalga formu/PCG görselleştirme (§22). Ağır framework yok; peaks bir kez hesaplanır. */

const peaksCache = new Map<string, Float32Array>()

export function computePeaks(sound: SoundRecord, buffer: AudioBuffer, buckets = 240): Float32Array {
  const cached = peaksCache.get(sound.id)
  if (cached) return cached
  const ch = buffer.getChannelData(0)
  const per = Math.floor(ch.length / buckets)
  const peaks = new Float32Array(buckets)
  for (let i = 0; i < buckets; i++) {
    let max = 0
    const start = i * per
    for (let j = 0; j < per; j += 2) {
      const a = Math.abs(ch[start + j] || 0)
      if (a > max) max = a
    }
    peaks[i] = max
  }
  peaksCache.set(sound.id, peaks)
  return peaks
}

export function drawWave(
  canvas: HTMLCanvasElement,
  peaks: Float32Array,
  opts: { color?: string; progress?: number; annotations?: { at: number; label: string; color: string }[]; progressColor?: string }
) {
  const ctx2d = canvas.getContext('2d')
  if (!ctx2d) return
  const dpr = window.devicePixelRatio || 1
  const w = canvas.clientWidth
  const h = canvas.clientHeight
  canvas.width = Math.floor(w * dpr)
  canvas.height = Math.floor(h * dpr)
  ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx2d.clearRect(0, 0, w, h)

  const mid = h / 2
  const n = peaks.length
  const barW = Math.max(1, w / n - 0.35)
  const progress = opts.progress ?? 0

  for (let i = 0; i < n; i++) {
    const x = (i / n) * w
    const amp = Math.pow(peaks[i], 0.72) * (h / 2 - 6)
    const inProgress = i / n <= progress
    ctx2d.fillStyle = inProgress ? (opts.progressColor ?? '#1673e6') : (opts.color ?? '#b9cfeb')
    ctx2d.fillRect(x, mid - amp, barW, amp * 2 || 1)
  }

  if (opts.annotations?.length) {
    ctx2d.font = '600 11px ' + getComputedStyle(document.body).fontFamily
    for (const a of opts.annotations) {
      const x = a.at * w
      ctx2d.fillStyle = a.color
      ctx2d.fillRect(x - 0.5, 0, 1, h)
      ctx2d.fillText(a.label, Math.min(x + 4, w - 30), 12)
    }
  }
}

/** Basit ilerleme hesabı: aktif kanal başlangıç anından itibaren geçen süre / toplam süre (döngüsel). */
export function progressOf(startedAtMs: number, durationSec: number, nowMs: number): number {
  const t = ((nowMs - startedAtMs) / 1000) % durationSec
  return t / durationSec
}
