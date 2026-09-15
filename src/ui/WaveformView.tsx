import { useEffect, useRef, useState } from 'react'
import type { SoundRecord } from '../core/types'
import type { AudioEngine } from '../audio/engine'
import { computePeaks, drawWave } from '../audio/waveform'
import { IconBack10, IconFwd10, IconPause, IconPlay } from './icons'

/** Hafif dalga formu + oynatıcı (§22). Etiketler (S1/S2 vb.) yalnız Öğrenme modunda ve
 *  onaylı açıkalam sonrası gösterilir; değerlendirmede annotation gönderilmez. */

interface Props {
  sound: SoundRecord
  engine: AudioEngine
  head: 'bell' | 'diaphragm'
  annotations?: { at: number; label: string; color: string }[]
  title?: string
  height?: number
}

export function WaveformView({ sound, engine, head, annotations, title, height }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const peaksRef = useRef<Float32Array | null>(null)
  const annRef = useRef(annotations)
  annRef.current = annotations
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const progRef = useRef(0)
  const headRef = useRef(head)
  headRef.current = head

  useEffect(() => {
    let cancelled = false
    peaksRef.current = null
    ;(async () => {
      try {
        const buf = await engine.load(sound)
        if (cancelled) return
        peaksRef.current = computePeaks(sound, buf)
      } catch {
        peaksRef.current = null
      }
    })()
    return () => { cancelled = true }
  }, [sound, engine])

  // bileşen kaldırılırsa çalan sesi durdur
  useEffect(() => {
    return () => {
      const active = engine.getActive()
      if (active && active.soundId === sound.id) engine.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sound])

  useEffect(() => {
    let raf = 0
    const draw = () => {
      const c = canvasRef.current
      const peaks = peaksRef.current
      if (c && peaks) {
        const active = engine.getActive()
        if (active && active.soundId === sound.id) {
          const dur = sound.durationSec || 15
          const p = ((performance.now() - active.startedAt) / 1000 / dur) % 1
          drawWave(c, peaks, { progress: p, annotations: annRef.current })
          progRef.current = p
        } else {
          drawWave(c, peaks, { progress: progRef.current, annotations: annRef.current })
        }
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    const sync = window.setInterval(() => {
      const active = engine.getActive()
      setPlaying(!!active && active.soundId === sound.id)
      setProgress(progRef.current)
    }, 220)
    return () => {
      cancelAnimationFrame(raf)
      window.clearInterval(sync)
    }
  }, [sound, engine])

  const toggle = async () => {
    const active = engine.getActive()
    if (active && active.soundId === sound.id) {
      engine.stop()
      setPlaying(false)
      return
    }
    await engine.play('library', sound, head)
    setPlaying(true)
  }

  const fmt = (s: number) => {
    const m = Math.floor(s / 60)
    const ss = Math.floor(s % 60)
    return `${m}:${String(ss).padStart(2, '0')}`
  }
  const dur = sound.durationSec || 15

  return (
    <div className="wave-panel">
      {title && <div className="small muted mb-8">{title}</div>}
      <canvas ref={canvasRef} style={height ? { height } : undefined} />
      <div className="transport">
        <button className="t-btn" aria-label="10 saniye geri" disabled title="10 saniye geri (yakında)">
          <IconBack10 />
        </button>
        <button className="t-btn main" aria-label={playing ? 'Durdur' : 'Oynat'} onClick={() => void toggle()}>
          {playing ? <IconPause /> : <IconPlay />}
        </button>
        <button className="t-btn" aria-label="10 saniye ileri" disabled title="10 saniye ileri (yakında)">
          <IconFwd10 />
        </button>
        <span className="t-time">{fmt(progress * dur)} / {fmt(dur)}</span>
        <div
          className="seek"
          role="slider"
          aria-label="Ses konumu"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          tabIndex={0}
        >
          <i style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
    </div>
  )
}

/** Statik dalga formu (oynatıcı yok) */
export function WaveformStatic({ sound, engine, height = 64 }: { sound: SoundRecord; engine: AudioEngine; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const buf = await engine.load(sound)
        if (cancelled || !canvasRef.current) return
        const peaks = computePeaks(sound, buf)
        drawWave(canvasRef.current, peaks, {})
      } catch { /* sessizce yut */ }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sound])
  return <canvas ref={canvasRef} style={{ width: '100%', height }} />
}
