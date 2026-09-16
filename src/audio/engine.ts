import { AUDIO_CONFIG, type StethHead } from './audioConfig'
import type { SoundRecord } from '../core/types'

/** WebAudio tabanlı tek yönetimli ses motoru (§9, §10, §29).
 *  - Tek AudioContext (autoplay kısıtına uygun: kullanıcı jestiyle resume)
 *  - Tek aktif oskültasyon; nokta değişiminde ~120 ms çapraz geçiş
 *  - Tam segment döngü (15 s fizyolojik kayıt)
 *  - Bell/Diyafram DSP her iki kafa için de her zaman uygulanır (bypass yoktur)
 *  - Lazy yükleme + node temizliği */

export type EngineState = 'idle' | 'loading' | 'playing'

interface ActiveChannel {
  pointId: string
  soundId: string
  source: AudioBufferSourceNode
  gain: GainNode
  head: StethHead
  startedAt: number
  listenMs: number
}

export class AudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private buffers = new Map<string, AudioBuffer>()
  private active: ActiveChannel | null = null
  private volume = AUDIO_CONFIG.defaultVolume
  private muted = false

  /** Kullanıcı etkileşimi içinde çağrılmalı (autoplay uyumu §41). */
  async ensureContext(): Promise<AudioContext> {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new Ctx()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.muted ? 0 : this.volume * AUDIO_CONFIG.clipGuardGain
      // klinik bant koruması
      const lp = this.ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = AUDIO_CONFIG.masterLowpassHz
      // kırpılma koruması (limiter)
      const lim = this.ctx.createDynamicsCompressor()
      lim.threshold.value = AUDIO_CONFIG.limiter.thresholdDb
      lim.knee.value = AUDIO_CONFIG.limiter.kneeDb
      lim.ratio.value = AUDIO_CONFIG.limiter.ratio
      lim.attack.value = AUDIO_CONFIG.limiter.attackSec
      lim.release.value = AUDIO_CONFIG.limiter.releaseSec
      this.master.connect(lp)
      lp.connect(lim)
      lim.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume()
    return this.ctx
  }

  async load(sound: SoundRecord): Promise<AudioBuffer> {
    const cached = this.buffers.get(sound.id)
    if (cached) return cached
    const ctx = await this.ensureContext()
    const res = await fetch(sound.runtimeUrl, { cache: 'force-cache' })
    if (!res.ok) throw new Error(`audio fetch failed: ${sound.runtimeUrl} (${res.status})`)
    const buf = await ctx.decodeAudioData(await res.arrayBuffer())
    this.buffers.set(sound.id, buf)
    return buf
  }

  getVolume() {
    return this.volume
  }
  setVolume(v: number) {
    this.volume = Math.min(1, Math.max(0, v))
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume * AUDIO_CONFIG.clipGuardGain, this.ctx.currentTime, 0.03)
    }
  }
  setMuted(m: boolean) {
    this.muted = m
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : this.volume * AUDIO_CONFIG.clipGuardGain, this.ctx.currentTime, 0.03)
    }
  }
  isMuted() {
    return this.muted
  }

  getActive(): ActiveChannel | null {
    return this.active
  }
  getState(): EngineState {
    return this.active ? 'playing' : 'idle'
  }

  /** Bir noktanın sesini başlat (çapraz geçişli). Aynı ses zaten çalıyorsa işlem yapmaz. */
  async play(pointId: string, sound: SoundRecord, head: StethHead): Promise<void> {
    if (this.active && this.active.soundId === sound.id && this.active.head === head) return
    const ctx = await this.ensureContext()
    const buffer = await this.load(sound).catch((e) => {
      console.error('[Ausculta] ses yüklenemedi:', sound.runtimeUrl, e)
      throw e
    })
    this.stopAll()
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.loop = AUDIO_CONFIG.loopWholeSegment

    const gain = ctx.createGain()
    gain.gain.value = 0

    // DSP fallback yalnızca istenen head, kayıt doğal filtresinden farklıysa uygulanır (§10)
    // D10: son düğüm (high) her dalda tam olarak bir kez gain'e bağlanır (çift connect() = çift kazanç riski).
    if (head === 'bell') {
      const dsp = AUDIO_CONFIG.dsp.bell
      const low = ctx.createBiquadFilter()
      low.type = 'lowshelf'
      low.frequency.value = dsp.lowshelfHz
      low.gain.value = dsp.lowshelfDb
      const peak = ctx.createBiquadFilter()
      peak.type = 'peaking'
      peak.frequency.value = dsp.peakingHz
      peak.gain.value = dsp.peakingDb
      peak.Q.value = dsp.peakingQ
      const high = ctx.createBiquadFilter()
      high.type = 'highshelf'
      high.frequency.value = dsp.highshelfHz
      high.gain.value = dsp.highshelfDb
      src.connect(low); low.connect(peak); peak.connect(high); high.connect(gain)
    } else {
      const dsp = AUDIO_CONFIG.dsp.diaphragm
      const low = ctx.createBiquadFilter()
      low.type = 'lowshelf'
      low.frequency.value = dsp.lowshelfHz
      low.gain.value = dsp.lowshelfDb
      const high = ctx.createBiquadFilter()
      high.type = 'highshelf'
      high.frequency.value = dsp.highshelfHz
      high.gain.value = dsp.highshelfDb
      src.connect(low); low.connect(high); high.connect(gain)
    }

    gain.connect(this.master!)

    const t0 = ctx.currentTime
    const xf = AUDIO_CONFIG.crossfadeMs / 1000
    gain.gain.setValueAtTime(0, t0)
    gain.gain.linearRampToValueAtTime(1, t0 + xf)

    src.onended = () => {
      if (this.active?.source === src) this.active = null
      try { src.disconnect() } catch { /* disposed */ }
      try { gain.disconnect() } catch { /* disposed */ }
    }
    src.start()
    this.active = { pointId, soundId: sound.id, source: src, gain, head, startedAt: performance.now(), listenMs: 0 }
  }

  stop() {
    this.stopAll()
  }

  private stopAll() {
    if (!this.active) return
    const { source, gain, listenMs } = this.active
    const ctx = this.ctx
    if (ctx) {
      const t = ctx.currentTime
      const xf = AUDIO_CONFIG.crossfadeMs / 1000
      try {
        gain.gain.cancelScheduledValues(t)
        gain.gain.setValueAtTime(gain.gain.value, t)
        gain.gain.linearRampToValueAtTime(0.0001, t + xf)
      } catch { /* ignore */ }
      const src = source
      setTimeout(() => {
        try { src.stop() } catch { /* already stopped */ }
      }, Math.ceil(xf * 1000) + 30)
    } else {
      try { source.stop() } catch { /* ignore */ }
    }
    try { gain.disconnect() } catch { /* ignore */ }
    this.active = { ...this.active, listenMs: listenMs + (performance.now() - this.active.startedAt) }
    const ended = this.active
    this.active = null
    // listenMs dışarıdan okunabilsin
    this.lastListenMs = ended.listenMs
  }

  lastListenMs = 0

  /** Tekrar dinleme (§28 sound_replayed) — aynı nokta sesini yeniden başlatır. */
  async replay(pointId: string, sound: SoundRecord, head: StethHead) {
    this.stop()
    await this.play(pointId, sound, head)
  }

  dispose() {
    this.stopAll()
    this.buffers.clear()
    this.ctx?.close().catch(() => undefined)
    this.ctx = null
  }
}
