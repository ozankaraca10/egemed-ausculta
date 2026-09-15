import { useEffect, useRef, useState } from 'react'
import type { AuscultationPoint, CaseDef, Question, SoundRecord } from '../core/types'
import pointsData from '../data/auscultation-points.json'
import casesData from '../data/cases.json'
import { engine } from '../audio/engineSingleton'
import { resolveCaseSounds } from '../core/resolver'
import { useStore, computeAggregate } from '../core/store'
import { bus } from '../core/events'
import { PatientStage, type StageHandle } from '../ui/PatientStage'
import { Toolbar } from '../ui/Toolbar'
import { QuestionCard, FeedbackCard } from '../ui/Questions'
import { Footer, EcgDeco } from '../ui/chrome'
import { IconDoc, IconTarget, IconArrowRight, IconInfo, IconBodyFront, IconBodyBack } from '../ui/icons'

/** Simülasyon ekranı — Uygulama & Değerlendirme (§3B, §3C): hasta solda, olgu/görev/soru sağda. */

const cases = casesData.cases as unknown as CaseDef[]
const points = pointsData.points as AuscultationPoint[]

export function SimulationScreen() {
  const { state, dispatch, runtime } = useStore()
  const caseList = state.mode === 'assessment' ? cases.filter((c) => c.modes.includes('assessment')) : cases
  const caseDef = caseList[state.caseIndex] ?? caseList[0]
  const stageRef = useRef<StageHandle>(null)
  const [playing, setPlaying] = useState(false)
  const [activePoint, setActivePoint] = useState<string | null>(null)

  const resolved = useMemoSounds(caseDef)
  const q: Question | undefined = caseDef.questions[state.step]
  const canSubmit = !!q && (state.answers[q.id]?.length ?? 0) > 0
  const revealed = q ? !!state.revealed[q.id] : false

  // vaka bitince: aggregate + SCORM raporu + sonuç ekranı
  useEffect(() => {
    if (state.caseIndex < caseList.length) return
    const agg = computeAggregate(state.caseResults)
    if (state.mode === 'assessment') {
      runtime?.reportScore(agg.total, agg.mastery, true)
      bus.emit({ type: 'assessment_completed', total: agg.total, at: Date.now() })
    }
    runtime?.saveInteractions([], {})
    dispatch({ type: 'setResults', results: state.caseResults })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.caseIndex])

  const primaryAction = () => {
    if (!q) return
    if (state.mode === 'practice' && revealed) {
      dispatch({ type: 'advance' })
      return
    }
    if (!canSubmit) return
    const given = state.answers[q.id] ?? []
    const correct = isCorrect(q, given)
    dispatch({ type: 'submitAnswer', qid: q.id, correct })
    if (isLastQuestion(caseDef, q)) runtime?.saveInteractions(caseDef.questions, state.answers)
    dispatch({ type: 'advance' })
  }

  return (
    <>
      <EcgDeco />
      <div className="screen" style={{ position: 'relative', zIndex: 1 }}>
        <div className="container tall screen-body no-scroll">
          <div className={`sim-grid ${state.mode === 'assessment' ? 'wide-left' : ''}`}>
            <div className="sim-main">
              <div className="stage-card">
                <div className="stage-top">
                  <div className="view-toggle">
                    <button className={state.view === 'front' ? 'active' : ''} onClick={() => dispatch({ type: 'setView', view: 'front' })}>
                      <IconBodyFront /> Ön Görünüm
                    </button>
                    <button className={state.view === 'back' ? 'active' : ''} onClick={() => dispatch({ type: 'setView', view: 'back' })}>
                      <IconBodyBack /> Arka Görünüm
                    </button>
                  </div>
                  <label className="points-toggle">
                    <input type="checkbox" checked={state.showPoints} onChange={(e) => dispatch({ type: 'togglePoints', show: e.target.checked })} />
                    {state.mode === 'assessment' ? 'Bölge işaretleri' : 'Dinleme noktalarını göster'}
                  </label>
                </div>
                <PatientStage
                  ref={stageRef}
                  points={points}
                  filterIds={caseDef.soundAssignments.map((a) => a.pointId)}
                  view={state.view}
                  head={state.head}
                  volume={state.volume}
                  showPoints={state.showPoints}
                  showLabels={state.mode !== 'assessment' && state.showPoints}
                  mode={state.mode}
                  engine={engine}
                  soundFor={(pointId) => resolved[pointId] ?? null}
                  onVisit={(pointId) => { dispatch({ type: 'visit', pointId }); bus.emit({ type: 'auscultation_started', pointId, at: Date.now() }) }}
                  onDwell={(pointId, dwellMs) => dispatch({ type: 'dwell', pointId, dwellMs })}
                  onListen={(pointId, listenMs) => dispatch({ type: 'listen', pointId, listenMs })}
                  onPlayingChange={(pl, pt) => { setPlaying(pl); setActivePoint(pt) }}
                />
              </div>
              <Toolbar
                caseDef={caseDef}
                stageRef={stageRef}
                playing={playing}
                activePoint={activePoint}
                question={state.mode === 'practice' ? q : undefined}
                onHint={() => dispatch({ type: 'useHint' })}
              />
            </div>

            <div className="sim-side">
              <div className="card">
                <div className="card-title-row">
                  <div className="ic"><IconDoc /></div>
                  <h3>Olgu</h3>
                  <span className="badge blue">Vaka {state.caseIndex + 1}/{caseList.length}</span>
                </div>
                <p style={{ marginTop: 0 }}>
                  <strong>{caseDef.patient.age} yaşında {caseDef.patient.sex} hasta.</strong> {caseDef.chiefComplaint.toLowerCase()} ile başvuruyor. {caseDef.history}
                </p>
                <div className="kv-grid">
                  {caseDef.vitalSigns.hr && <KV k="Kalp hızı" v={`${caseDef.vitalSigns.hr}/dk`} />}
                  {caseDef.vitalSigns.rr && <KV k="Solunum" v={`${caseDef.vitalSigns.rr}/dk`} />}
                  {caseDef.vitalSigns.bp && <KV k="TA" v={caseDef.vitalSigns.bp} />}
                  {caseDef.vitalSigns.spo2 && <KV k="SpO₂" v={`%${caseDef.vitalSigns.spo2}`} />}
                  {caseDef.vitalSigns.temp && <KV k="Ateş" v={caseDef.vitalSigns.temp} />}
                </div>
              </div>

              <div className="card">
                <div className="card-title-row">
                  <div className="ic"><IconTarget /></div>
                  <h3>Görev</h3>
                </div>
                <ul className="task-list">
                  {caseDef.tasks.map((t, i) => (
                    <li key={t}><span className="n">{i + 1}</span> {t}</li>
                  ))}
                </ul>
              </div>

              {q && (
                <div className="card">
                  <QuestionCard
                    q={q}
                    value={state.answers[q.id] ?? []}
                    onChange={(values) => dispatch({ type: 'answer', qid: q.id, values })}
                    revealed={revealed}
                  />
                  {state.mode === 'practice' && revealed && (
                    <FeedbackCard correct={isCorrect(q, state.answers[q.id] ?? [])} q={q} given={state.answers[q.id] ?? []} />
                  )}
                  <div className="q-nav">
                    <button
                      className="btn primary"
                      style={{ flex: 1 }}
                      onClick={primaryAction}
                      disabled={!canSubmit && !(state.mode === 'practice' && revealed)}
                    >
                      {state.mode === 'practice' && revealed
                        ? isLastQuestion(caseDef, q) ? 'Vakayı tamamla' : 'Devam Et'
                        : 'Yanıtla'} <IconArrowRight />
                    </button>
                  </div>
                </div>
              )}

              {state.mode === 'practice' && (
                <div className="note-strip">
                  <IconInfo />
                  <span>İpucu kullanmak uygulama puanınızı düşürür. Değerlendirme modunda ipucu yoktur.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  )
}

/* soru başına çalışacak ses haritası — useMemo ile vaka bazında */
function useMemoSounds(caseDef: CaseDef) {
  return useRef(
    (() => {
      let cache: { def: CaseDef; map: Record<string, SoundRecord | null> } | null = null
      return (def: CaseDef) => {
        if (cache?.def !== def) cache = { def, map: resolveCaseSounds(def.soundAssignments) }
        return cache.map
      }
    })()
  ).current(caseDef)
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="kv">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
    </div>
  )
}

function isCorrect(q: Question, given: string[]): boolean {
  return given.length > 0 && q.correct.length === given.length && given.every((g) => q.correct.includes(g))
}

function isLastQuestion(caseDef: CaseDef, q?: Question): boolean {
  return !!q && caseDef.questions[caseDef.questions.length - 1]?.id === q.id
}
