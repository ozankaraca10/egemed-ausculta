import { useEffect, useMemo, useRef, useState } from 'react'
import type { AuscultationPoint, CaseDef, Question } from '../core/types'
import pointsData from '../data/auscultation-points.json'
import { ALL_CASES, poolFor } from '../data/pool'
import type { BodyType } from '../ui/PatientStage'
import { engine } from '../audio/engineSingleton'
import { resolveCaseSoundsEx, resolveCaseSounds } from '../core/resolver'
import { useStore, computeAggregate } from '../core/store'
import { bus } from '../core/events'
import { PatientStage, type StageHandle } from '../ui/PatientStage'
import { Toolbar } from '../ui/Toolbar'
import { QuestionCard, FeedbackCard } from '../ui/Questions'
import { Footer, EcgDeco } from '../ui/chrome'
import { IconDoc, IconTarget, IconArrowRight, IconInfo, IconBodyFront, IconBodyBack } from '../ui/icons'

/** Simülasyon ekranı — Uygulama & Değerlendirme (§3B, §3C): hasta solda, olgu/görev/soru sağda. */

const cases = ALL_CASES
const points = pointsData.points as AuscultationPoint[]

export function SimulationScreen() {
  const { state, dispatch, runtime } = useStore()
  // oturum örneklemi: rastgele 10 vaka (yoksa havuzun tamamı)
  const sessionIds = state.mode === 'assessment' ? state.session.assessmentIds : state.session.practiceIds
  const byId = new Map(cases.map((c) => [c.id, c]))
  const sessionCases = sessionIds.map((id) => byId.get(id)).filter((c): c is CaseDef => !!c)
  const caseList = sessionCases.length ? sessionCases : poolFor(state.mode)
  const caseDef = caseList[state.caseIndex] ?? caseList[0]
  const stageRef = useRef<StageHandle>(null)
  const [playing, setPlaying] = useState(false)
  const [activePoint, setActivePoint] = useState<string | null>(null)

  const isAssessment = state.mode === 'assessment'
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
    dispatch({ type: 'setResults', results: state.caseResults })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.caseIndex])

  const shownAtRef = useRef<Record<string, number>>({})

  // görüntülenen vakayı store'a bildir (havuz/ders fark edilmez; tek doğruluk kaynağı)
  useEffect(() => {
    if (!caseDef) return
    dispatch({ type: 'caseMount', caseDef })
    bus.emit({ type: 'case_started', caseId: caseDef.id, mode: state.mode, at: Date.now() })
    void resolveCaseSounds(caseDef.soundAssignments)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseDef.id])

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
    if (isLastQuestion(caseDef, q)) {
      const now = Date.now()
      const latency: Record<string, number> = {}
      for (const qq of caseDef.questions) {
        const t0 = shownAtRef.current[qq.id]
        if (t0) latency[qq.id] = now - t0
      }
      runtime?.saveInteractions(caseDef.questions, state.answers, latency)
    }
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
                  {state.mode !== 'assessment' ? (
                    <label className="points-toggle">
                      <input type="checkbox" checked={state.showPoints} onChange={(e) => dispatch({ type: 'togglePoints', show: e.target.checked })} />
                      Dinleme noktalarını göster
                    </label>
                  ) : (
                    <span className="strict-note" title="Değerlendirmede işaret, ipucu ve tekrar dinleme yoktur; muayene tamamen manueldir.">
                      Manuel muayene modu — işaret/ipucu yok
                    </span>
                  )}
                </div>
                <PatientStage
                  key={state.caseIndex}
                  ref={stageRef}
                  points={points}
                  filterIds={caseDef.soundAssignments.map((a) => a.pointId)}
                  bodyType={((caseDef as CaseDef & { population?: string }).population === 'pediatrik' ? 'pediatrik' : caseDef.patient.sex === 'kadın' ? 'kadin' : 'erkek') as BodyType}
                  strict={isAssessment}
                  view={state.view}
                  head={state.head}
                  volume={state.volume}
                  showPoints={state.mode !== 'assessment' && state.showPoints}
                  showLabels={state.mode !== 'assessment' && state.showPoints}
                  mode={state.mode}
                  engine={engine}
                  soundFor={(pointId) => resolved.sounds[pointId] ?? null}
                  onVisit={(pointId) => { dispatch({ type: 'visit', pointId }); bus.emit({ type: 'auscultation_started', pointId, at: Date.now() }) }}
                  onDwell={(pointId, dwellMs) => dispatch({ type: 'dwell', pointId, dwellMs })}
                  onListen={(pointId, listenMs) => dispatch({ type: 'listen', pointId, listenMs })}
                  onPlayingChange={(pl, pt) => { setPlaying(pl); setActivePoint(pt) }}
                />
                <div className="region-list-title sr-only-until-focus">Bölge listesi (klavye ile erişim)</div>
                <div className="region-list sr-only-until-focus">
                  {points
                    .filter((pt) => pt.view === state.view && caseDef.soundAssignments.some((a) => a.pointId === pt.id))
                    .map((pt) => (
                      <button key={pt.id} onClick={() => stageRef.current?.placeAt(pt.id)}>
                        {pt.fullLabel}
                      </button>
                    ))}
                </div>
                {!isAssessment && activePoint && resolved.fallbacks[activePoint] && (
                  <div className="note-strip" style={{ marginTop: 0 }}>
                    <IconInfo width={16} height={16} />
                    <span className="small">
                      Bu bölge için doğrulanmış posterior kayıt yok; aynı bulgunun{' '}
                      <strong>{points.find((x) => x.id === resolved.fallbacks[activePoint])?.fullLabel}</strong> kaydı
                      çalınmaktadır (kaynak bölge dürüstçe belirtilir).
                    </span>
                  </div>
                )}
              </div>
              <Toolbar
                caseDef={caseDef}
                stageRef={stageRef}
                playing={playing}
                activePoint={activePoint}
                question={state.mode === 'practice' ? q : undefined}
                onHint={() => dispatch({ type: 'useHint' })}
                strict={isAssessment}
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

/* vaka bazında ses haritası + fallback bilgisi (dürüst posterior eğitimi §14) */
function useMemoSounds(caseDef: CaseDef) {
  return useMemo(() => resolveCaseSoundsEx(caseDef.soundAssignments), [caseDef])
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
