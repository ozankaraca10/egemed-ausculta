import { useEffect, useMemo, useRef, useState } from 'react'
import type { AuscultationPoint, SoundRecord } from '../core/types'
import pointsData from '../data/auscultation-points.json'
import libraryData from '../data/library.json'
import { engine } from '../audio/engineSingleton'
import { resolveLibrarySound, resolveLibrarySoundEx } from '../core/resolver'
import { useStore } from '../core/store'
import { heartLabel, heartLibrarySub, lungLabel, lungLibrarySub } from '../data/terminology'
import { PatientStage, type StageHandle } from '../ui/PatientStage'
import { WaveformView } from '../ui/WaveformView'
import { Toolbar } from '../ui/Toolbar'
import { Footer, EcgDeco } from '../ui/chrome'
import { IconHeart, IconLungs, IconWave, IconDoc, IconStethoscope, IconInfo } from '../ui/icons'

/** Öğrenme modu (§3A): kütüphane + simülatör. Skor yok; rehberli, sınırsız dinleme. */

interface LibItemFull {
  key: string
  category: string
  acousticFinding: string
  description: string
  s1?: string
  s2?: string
  phase?: string
  clinical: string
  bestPoints: string[]
  group: string
}

export function LearnScreen() {
  const { state, dispatch } = useStore()
  const [selectedKey, setSelectedKey] = useState<string>('heart.normal')
  const [tab, setTab] = useState<'desc' | 'wave' | 'clin'>('desc')
  const stageRef = useRef<StageHandle>(null)
  const [playing, setPlaying] = useState(false)
  const [activePoint, setActivePoint] = useState<string | null>(null)

  const points = pointsData.points as AuscultationPoint[]
  const items = useMemo(() => {
    const out: Record<string, LibItemFull> = {}
    for (const g of libraryData.groups)
      for (const it of g.items) out[it.key] = { ...(it as unknown as LibItemFull), group: g.id }
    return out
  }, [])
  const item = items[selectedKey]
  const isHeart = item.group === 'heart'

  // kalem değişince önceki sesi durdur
  useEffect(() => {
    engine.stop()
  }, [selectedKey])

  const stageSounds = useMemo(() => {
    const cache = new Map<string, ReturnType<typeof resolveLibrarySoundEx>>()
    const resolve = (pointId: string) => {
      if (cache.has(pointId)) return cache.get(pointId)!
      const res = resolveLibrarySoundEx(item.category, item.acousticFinding, pointId)
      cache.set(pointId, res)
      return res
    }
    return { resolve }
  }, [item])

  const soundsForStage = (pointId: string): SoundRecord | null => stageSounds.resolve(pointId).record
  const activeFallback = activePoint ? stageSounds.resolve(activePoint).fallbackFrom : undefined

  const title = isHeart ? heartLabel(item.key) : lungLabel(item.key)
  const libSound = resolveLibrarySound(item.category, item.acousticFinding)

  return (
    <>
      <EcgDeco />
      <div className="screen" style={{ position: 'relative', zIndex: 1 }}>
        <div className="container tall screen-body no-scroll">
          <div className="learn-grid">
            <div className="lib-col">
              <h2>{isHeart ? 'Kalp Sesleri' : 'Akciğer Sesleri'}</h2>
              <p className="lib-sub">Dinle, tanı, öğren.</p>
              {libraryData.groups.map((g) => (
                <div className="lib-group" key={g.id}>
                  <div className="g-title">
                    {g.id === 'heart' ? <IconHeart /> : <IconLungs />}
                    {g.id === 'heart' ? 'Kalp Sesleri' : 'Akciğer Sesleri'}
                  </div>
                  <div className="lib-items">
                    {g.items.map((it) => (
                      <button
                        key={it.key}
                        className={`lib-item ${it.key === selectedKey ? 'active' : ''}`}
                        onClick={() => { setSelectedKey(it.key); setTab('desc') }}
                      >
                        <span className="ic">{g.id === 'heart' ? <IconHeart /> : <IconLungs />}</span>
                        <span>
                          <b>{it.key.startsWith('heart') ? heartLabel(it.key) : lungLabel(it.key)}</b>
                          <span>{it.key.startsWith('heart') ? heartLibrarySub(it.key) : lungLibrarySub(it.key)}</span>
                        </span>
                        <span className="chev">›</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="sim-main">
              <div className="stage-card">
                <div className="stage-top">
                  <div className="view-toggle">
                    <button className={state.view === 'front' ? 'active' : ''} onClick={() => dispatch({ type: 'setView', view: 'front' })}>
                      <IconStethoscope /> Ön Görünüm
                    </button>
                    <button className={state.view === 'back' ? 'active' : ''} onClick={() => dispatch({ type: 'setView', view: 'back' })}>
                      <IconStethoscope /> Arka Görünüm
                    </button>
                  </div>
                </div>
                <PatientStage
                  ref={stageRef}
                  points={points}
                  filterIds={item.bestPoints}
                  view={state.view}
                  head={state.head}
                  volume={state.volume}
                  showPoints
                  showLabels
                  mode="learn"
                  engine={engine}
                  soundFor={soundsForStage}
                  onVisit={() => undefined}
                  onDwell={() => undefined}
                  onListen={() => undefined}
                  onPlayingChange={(pl, pt) => { setPlaying(pl); setActivePoint(pt) }}
                />
                <div className="region-list-title">Bölge listesi (klavye ile erişim)</div>
                <div className="region-list">
                  {points.filter((p) => p.view === state.view && item.bestPoints.includes(p.id)).map((p) => (
                    <button key={p.id} onClick={() => stageRef.current?.placeAt(p.id)}>
                      {p.fullLabel}
                    </button>
                  ))}
                </div>
                {activeFallback && (
                  <div className="note-strip" style={{ marginTop: 8 }}>
                    <IconInfo width={17} height={17} />
                    <span className="small">
                      Bu bölge için veri setinde doğrudan kayıt yok; aynı bulgunun{' '}
                      <strong>{points.find((x) => x.id === activeFallback)?.fullLabel}</strong> kaydı çalınmaktadır
                      (kayıt konumu dürüstçe belirtilir).
                    </span>
                  </div>
                )}
              </div>
              <Toolbar stageRef={stageRef} playing={playing} activePoint={activePoint} />
            </div>

            <div className="sim-side">
              <div className="card">
                <div className="card-title-row">
                  <div className="ic">{isHeart ? <IconHeart /> : <IconLungs />}</div>
                  <h3>{title}</h3>
                  <span className="badge blue">{findingBadge(item.key)}</span>
                </div>
                <div className="tabbar info-tabs">
                  <button className={tab === 'desc' ? 'active' : ''} onClick={() => setTab('desc')}>
                    <IconDoc /> Açıklama
                  </button>
                  <button className={tab === 'wave' ? 'active' : ''} onClick={() => setTab('wave')}>
                    <IconWave /> Dalga Formu
                  </button>
                  <button className={tab === 'clin' ? 'active' : ''} onClick={() => setTab('clin')}>
                    <IconStethoscope /> Klinik Bilgi
                  </button>
                </div>
                {tab === 'desc' && (
                  <div className="info-body">
                    <p>{item.description}</p>
                    {isHeart && item.s1 && item.s2 && (
                      <div className="exp-cards mt-12">
                        <div className="exp-card">
                          <span className="chip s1">S1</span>
                          <p><b>S1:</b> {item.s1}</p>
                        </div>
                        <div className="exp-card">
                          <span className="chip s2">S2</span>
                          <p><b>S2:</b> {item.s2}</p>
                        </div>
                      </div>
                    )}
                    {!isHeart && item.phase && (
                      <div className="note-strip mt-12">
                        <IconWave />
                        <span>{item.phase}</span>
                      </div>
                    )}
                  </div>
                )}
                {tab === 'wave' && (
                  libSound ? (
                    <WaveformView sound={libSound} engine={engine} head={state.head} title="Örnek ses kaydı (tam segment)" />
                  ) : (
                    <div className="note-strip">
                      <IconInfo /> Bu bulgu için kullanılabilir kayıt bulunamadı (veri seti eksikliği). Kütüphanenin diğer kalemlerini deneyin.
                    </div>
                  )
                )}
                {tab === 'clin' && (
                  <div className="info-body">
                    <div className="klin-strip">
                      <IconStethoscope />
                      <span>{item.clinical}</span>
                    </div>
                    <p className="src-line">
                      <IconInfo />
                      Kaynak: HLS-CMDS v3 — CC BY 4.0 (DOI 10.17632/8972jxbpmp.3)
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  )
}

function findingBadge(key: string): string {
  if (key === 'heart.normal') return 'S1 – S2'
  if (key === 'heart.s3') return 'S3'
  if (key === 'heart.s4') return 'S4'
  if (key.startsWith('heart.murmur')) return 'Üfürüm'
  if (key === 'heart.atrial_fibrillation') return 'Ritim'
  if (key === 'heart.tachycardia') return 'Hız'
  if (key === 'heart.av_block') return 'İletim'
  return 'Ses'
}
