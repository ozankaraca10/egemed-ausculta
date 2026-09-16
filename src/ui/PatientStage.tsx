import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import type { AuscultationPoint, PatientView, SoundRecord, StethHead } from '../core/types'
import pointsConfig from '../data/auscultation-points.json'
import { Chestpiece } from './stethoscope'
import { TorsoPediatricFront, TorsoPediatricBack } from './torso-pediatric'

export type BodyType = 'erkek' | 'kadin' | 'pediatrik'
import { AUDIO_CONFIG } from '../audio/audioConfig'
import type { AudioEngine } from '../audio/engine'

/** Etkileşimli hasta sahnesi: gerçekçi fotoğraf + hotspotlar + sürüklenebilir stetoskop (§11, §12, §21).
 *  Görsel aspect oranı korunur; sürükleme sırasında React re-render edilmez (§29). */

export interface StageHandle {
  replay: () => void
  stop: () => void
  placeAt: (pointId: string) => void
}

interface Props {
  points: AuscultationPoint[]
  filterIds?: string[]
  /** hasta gövdesi: yetişkin erkek/kadın fotoğrafı veya pediatrik şematik gövde */
  bodyType?: BodyType
  /** değerlendirme sıkı modu: işaret/etiket yok, tek dinleme */
  strict?: boolean
  view: PatientView
  head: StethHead
  volume: number
  showPoints: boolean
  showLabels: boolean
  mode: 'learn' | 'practice' | 'assessment'
  engine: AudioEngine
  soundFor: (pointId: string) => SoundRecord | null
  onVisit: (pointId: string) => void
  onDwell: (pointId: string, ms: number) => void
  onListen: (pointId: string, ms: number) => void
  onPlayingChange: (playing: boolean, pointId: string | null) => void
}

type ViewCfg = { image?: string; svg?: string; width: number; height: number }
const IMAGES = pointsConfig.images as unknown as Record<PatientView, Record<string, ViewCfg>>
const COORD_KEYS: Record<BodyType, [string, string]> = {
  erkek: ['x', 'y'],
  kadin: ['xf', 'yf'],
  pediatrik: ['xp', 'yp'],
}
const IMAGE_KEY: Record<BodyType, string> = { erkek: 'male', kadin: 'female', pediatrik: 'pediatric' }

export const PatientStage = forwardRef<StageHandle, Props>(function PatientStage(
  {
    points, filterIds, bodyType = 'erkek', strict = false,
    view, head, volume, showPoints, showLabels, mode, engine, soundFor,
    onVisit, onDwell, onListen, onPlayingChange,
  },
  ref
) {
  const fitRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const stethRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  const posRef = useRef({ x: 0.5, y: 0.75 })
  const dragRef = useRef(false)
  const snappedRef = useRef<string | null>(null)
  const playingRef = useRef(false)
  const timersRef = useRef<{ dwell?: number; playDelay?: number; dwellAcc: number; listenAcc: number }>({ dwellAcc: 0, listenAcc: 0 })
  /** strict (değerlendirme): her nokta yalnızca bir kez dinlenebilir */
  const listenedRef = useRef<Set<string>>(new Set())
  /** O12: her place()/unplace() çağrısında artar — ses yükleme sırası yarışını yakalar */
  const placeSeqRef = useRef(0)
  const [spentNotice, setSpentNotice] = useState(false)
  /** ses hazırlama / yükleme hatası geri bildirimi (§ UX) */
  const [audioStatus, setAudioStatus] = useState<{ pointId: string; status: 'loading' | 'error' } | null>(null)
  const lastHeadRef = useRef(head)

  const [snapped, setSnapped] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [pulseKey, setPulseKey] = useState(0)

  const cfg = IMAGES[view][IMAGE_KEY[bodyType]] ?? IMAGES[view].male
  const [ckx, cky] = COORD_KEYS[bodyType]
  const coordOf = useCallback(
    (p: AuscultationPoint & Record<string, unknown>) => ({
      x: Number(p[ckx] ?? p.x),
      y: Number(p[cky] ?? p.y),
    }),
    [ckx, cky]
  )

  // görseli, kapsayıcıya sığan en büyük dikdörtgen olarak ölçekle (letterbox yok → hotspot hizası tam)
  useEffect(() => {
    const el = fitRef.current
    if (!el) return
    const compute = () => {
      const { width, height } = el.getBoundingClientRect()
      if (width < 10 || height < 10) return
      const ar = cfg.width / cfg.height
      let w = width
      let h = w / ar
      if (h > height) {
        h = height
        w = h * ar
      }
      setBox({ w: Math.floor(w), h: Math.floor(h) })
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    return () => ro.disconnect()
  }, [cfg])

  const applyPos = useCallback(() => {
    const el = stethRef.current
    if (!el) return
    el.style.left = `${posRef.current.x * 100}%`
    el.style.top = `${posRef.current.y * 100}%`
  }, [])
  useEffect(() => { applyPos() }, [applyPos, view])

  useEffect(() => {
    engine.setVolume(volume)
  }, [volume, engine])

  const clearTimers = useCallback(() => {
    const t = timersRef.current
    if (t.dwell) window.clearInterval(t.dwell)
    if (t.playDelay) window.clearTimeout(t.playDelay)
    t.dwell = undefined
    t.playDelay = undefined
  }, [])

  const unplace = useCallback(() => {
    placeSeqRef.current++
    const t = timersRef.current
    const prev = snappedRef.current
    if (prev) {
      if (t.dwellAcc > 0) onDwell(prev, t.dwellAcc)
      if (t.listenAcc > 0) onListen(prev, t.listenAcc)
    }
    t.dwellAcc = 0
    t.listenAcc = 0
    clearTimers()
    if (playingRef.current || engine.getActive()) engine.stop()
    playingRef.current = false
    setPlaying(false)
    onPlayingChange(false, null)
    snappedRef.current = null
    setSnapped(null)
  }, [clearTimers, engine, onDwell, onListen, onPlayingChange])

  const place = useCallback(
    (pointId: string) => {
      const p = points.find((x) => x.id === pointId)
      if (!p || p.view !== view) return
      // O12: bu yerleştirmenin sırası — await sonrası hâlâ geçerli mi diye kontrol edilir
      const seq = ++placeSeqRef.current
      posRef.current = coordOf(p as AuscultationPoint & Record<string, unknown>)
      applyPos()
      setPulseKey((k) => k + 1)
      onVisit(pointId)
      snappedRef.current = pointId
      setSnapped(pointId)
      const t = timersRef.current
      t.dwellAcc = 0
      t.listenAcc = 0
      t.dwell = window.setInterval(() => {
        t.dwellAcc += 500
        if (snappedRef.current) onDwell(snappedRef.current, 500)
        if (playingRef.current) t.listenAcc += 500
      }, 500)
      if (strict && listenedRef.current.has(pointId)) {
        setSpentNotice(true)
        onPlayingChange(false, pointId)
        return
      }
      t.playDelay = window.setTimeout(async () => {
        setAudioStatus({ pointId, status: 'loading' })
        const snd = soundFor(pointId)
        if (!snd) {
          onPlayingChange(false, pointId)
          return
        }
        try {
          await engine.play(pointId, snd, head)
          // O12: await sırasında stetoskop kaldırılmış/başka noktaya taşınmışsa (sıra değişti)
          // sesi durdur ve state'e dokunma — yerleştirme olmadan ses çalınmaz.
          if (seq !== placeSeqRef.current) {
            engine.stop()
            return
          }
          listenedRef.current.add(pointId)
          setSpentNotice(false)
          setAudioStatus(null)
          playingRef.current = true
          setPlaying(true)
          onPlayingChange(true, pointId)
        } catch {
          if (seq !== placeSeqRef.current) return
          playingRef.current = false
          setPlaying(false)
          setAudioStatus({ pointId, status: 'error' })
          onPlayingChange(false, pointId)
        }
      }, AUDIO_CONFIG.dwellToPlayMs)
    },
    [points, view, onVisit, onDwell, engine, head, soundFor, onPlayingChange, applyPos, strict, coordOf]
  )
  const placeRef = useRef(place)
  placeRef.current = place

  // head değişince aktif sesi yeni filtreyle tekrar başlat
  useEffect(() => {
    if (lastHeadRef.current !== head && snappedRef.current) {
      const pointId = snappedRef.current
      // O4: tek dinleme kuralı — hak zaten kullanılmış ve o an ses çalmıyorsa (dinleme
      // bitmiş) head değişimi yeni bir dinleme başlatmaz. Ses hâlâ çalıyorsa o dinleme
      // hakkı zaten kullanılıyor sayılır; head değişimiyle devam eder.
      if (strict && listenedRef.current.has(pointId) && !playingRef.current) {
        lastHeadRef.current = head
        return
      }
      const snd = soundFor(pointId)
      if (snd) engine.replay(pointId, snd, head).catch(() => undefined)
    }
    lastHeadRef.current = head
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [head])

  useImperativeHandle(
    ref,
    () => ({
      replay: () => {
        const pointId = snappedRef.current
        if (!pointId) return
        if (strict && listenedRef.current.has(pointId)) {
          setSpentNotice(true)
          return
        }
        const snd = soundFor(pointId)
        if (!snd) return
        engine.replay(pointId, snd, head).catch(() => undefined)
        setPulseKey((k) => k + 1)
      },
      stop: () => {
        engine.stop()
        playingRef.current = false
        setPlaying(false)
        onPlayingChange(false, snappedRef.current)
      },
      placeAt: (pointId: string) => {
        unplace()
        placeRef.current(pointId)
      },
    }),
    [soundFor, head, engine, unplace, onPlayingChange, strict]
  )

  /* --- pointer sürükleme (görsel kutusu referans alınır) --- */
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    dragRef.current = true
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    setDragging(true)
    unplace()
    engine.ensureContext().catch(() => undefined)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !wrapRef.current) return
    const rect = wrapRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    posRef.current = { x: Math.min(0.99, Math.max(0.01, x)), y: Math.min(0.98, Math.max(0.02, y)) }
    applyPos()
  }
  /** D1: geçerli konuma en yakın, tolerans içindeki noktayı bulur (pointer ve klavye ile paylaşılır) */
  const findNearestPoint = useCallback((): string | null => {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return null
    const px = posRef.current.x * rect.width
    const py = posRef.current.y * rect.height
    let best: { id: string; d: number } | null = null
    for (const p of points) {
      if (p.view !== view) continue
      if (filterIds && !filterIds.includes(p.id)) continue
      const c = coordOf(p as AuscultationPoint & Record<string, unknown>)
      const d = Math.hypot(c.x * rect.width - px, c.y * rect.height - py)
      if (!best || d < best.d) best = { id: p.id, d }
    }
    const tol = Math.min(60, rect.width * 0.07)
    return best && best.d <= tol ? best.id : null
  }, [points, view, filterIds, coordOf])
  const onPointerUp = () => {
    if (!dragRef.current) return
    dragRef.current = false
    setDragging(false)
    const id = findNearestPoint()
    if (id) placeRef.current(id)
  }
  /** D1: klavye erişilebilirliği — ok tuşları %2 adımla taşır, Enter/Space en yakın noktaya yerleştirir */
  const onStethKeyDown = (e: React.KeyboardEvent) => {
    const step = 0.02
    const arrows: Record<string, () => void> = {
      ArrowUp: () => { posRef.current = { ...posRef.current, y: Math.max(0.02, posRef.current.y - step) } },
      ArrowDown: () => { posRef.current = { ...posRef.current, y: Math.min(0.98, posRef.current.y + step) } },
      ArrowLeft: () => { posRef.current = { ...posRef.current, x: Math.max(0.01, posRef.current.x - step) } },
      ArrowRight: () => { posRef.current = { ...posRef.current, x: Math.min(0.99, posRef.current.x + step) } },
    }
    if (arrows[e.key]) {
      e.preventDefault()
      unplace()
      arrows[e.key]()
      applyPos()
      return
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      const id = findNearestPoint()
      if (id) placeRef.current(id)
    }
  }

  useEffect(() => {
    unplace()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  // ekran/bileşen kaldırıldığında ses ve zamanlayıcılar kesin olarak durdurulur (§29)
  const unplaceRef = useRef(unplace)
  unplaceRef.current = unplace
  useEffect(() => {
    return () => {
      clearTimers()
      if (playingRef.current || engine.getActive()) engine.stop()
      playingRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const visiblePoints = useMemo(
    () => points.filter((p) => p.view === view && (!filterIds || filterIds.includes(p.id))),
    [points, view, filterIds]
  )
  const hideTags = mode === 'assessment' // §21

  return (
    <div className={`stage ${dragging ? 'dragging' : ''}`}>
      <div ref={fitRef} className="stage-fit">
      <div ref={wrapRef} className="body-wrap" style={{ width: box.w || undefined, height: box.h || undefined }}>
        {cfg.svg === 'pediatric-front' || cfg.svg === 'pediatric-back' ? (
          view === 'front' ? <TorsoPediatricFront /> : <TorsoPediatricBack />
        ) : (
          <img
            src={cfg.image ?? 'assets/body/front.jpg'}
            alt={view === 'front' ? 'Hasta ön gövde görünümü' : 'Hasta arka gövde görünümü'}
            draggable={false}
            className="body-img"
          />
        )}
        {visiblePoints.map((p) => (
          <div
            key={p.id}
            className={['hotspot', p.color, snapped === p.id ? 'active-point' : ''].join(' ')}
            style={{
              left: `${coordOf(p as AuscultationPoint & Record<string, unknown>).x * 100}%`,
              top: `${coordOf(p as AuscultationPoint & Record<string, unknown>).y * 100}%`,
              display: showPoints || snapped === p.id ? 'flex' : 'none',
            }}
          >
            <span className="ring" />
            <span className="dot" />
            {showLabels && showPoints && !hideTags && !strict && (
              <span className={`tag ${p.tagSide}`}>{p.label}</span>
            )}
          </div>
        ))}
        <div
          ref={stethRef}
          className={`steth ${snapped ? 'snap-ok placed' : ''}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onStethKeyDown}
          role="button"
          aria-label="Stetoskop göğüs parçası — sürükleyerek veya ok tuşlarıyla oskültasyon bölgesine taşıyın, Enter/Space ile yerleştirin"
          tabIndex={0}
        >
          <span className="contact-pulse" key={pulseKey} />
          <Chestpiece onBody={!!snapped} />
        </div>
        {playing && (
          <div className="play-state playing stage-badge">
            <span className="eq"><i /><i /><i /><i /></span>
            <span>Oskültasyon</span>
          </div>
        )}
        {!snapped && !playing && visiblePoints.length > 0 && (
          <div className="dwell-hint">Stetoskopu oskültasyon bölgesine sürükleyin</div>
        )}
        {visiblePoints.length === 0 && (
          <div className="dwell-hint">
            Bu görünümde bu içerik için işaretli oskültasyon bölgesi yok — diğer görünümü kullanın.
          </div>
        )}
        {strict && snapped && spentNotice && (
          <div className="dwell-hint">Bu bölge için dinleme hakkı kullanıldı — manuel muayenede tek dinleme kuralı.</div>
        )}
        {audioStatus?.status === 'loading' && <div className="dwell-hint">Ses hazırlanıyor…</div>}
        {audioStatus?.status === 'error' && (
          <div className="dwell-hint dwell-error" role="alert">
            Ses yüklenemedi. Bağlantınızı/LMS oturumunu kontrol edip bölgeyi yeniden dinleyin.
          </div>
        )}
      </div>
      </div>
    </div>
  )
})
