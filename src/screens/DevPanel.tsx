import { useMemo } from 'react'
import { useStore } from '../core/store'
import { bus } from '../core/events'
import { resolveCaseSounds } from '../core/resolver'
import casesData from '../data/cases.json'
import type { CaseDef } from '../core/types'

/** Geliştirici teşhis paneli (§38). Üretim öğrenci arayüzünde GÖRÜNMEZ; yalnız dev build + ?dev=1. */

const cases = casesData.cases as unknown as CaseDef[]

export function DevPanel() {
  const { state, runtime } = useStore()
  const current = cases[state.caseIndex]
  const resolved = useMemo(
    () => (current ? resolveCaseSounds(current.soundAssignments) : {}),
    [current]
  )
  const log = bus.getLog().slice(-8)

  // yalnız dev build + ?dev=1 ile açılır (§38)
  if (!runtime?.flags.dev) return null
  if (typeof window !== 'undefined' && !window.location.search.includes('dev=1')) return null

  return (
    <aside className="dev-panel" aria-label="Geliştirici teşhisi">
      <h4>
        <span>Ausculta DEV</span>
        <button className="close" title="Kapat">✕</button>
      </h4>
      <dl>
        <dt>Ekran</dt>
        <dd>{state.screen}</dd>
        <dt>Mod</dt>
        <dd>{state.mode}</dd>
        <dt>Vaka</dt>
        <dd>{current?.id ?? '-'}</dd>
        <dt>Adım</dt>
        <dd>{state.step}</dd>
        <dt>SCORM</dt>
        <dd>{runtime.flags.scormVersion} {runtime.flags.scormAvailable ? '(algılandı)' : '(mock)'}</dd>
        <dt>Head</dt>
        <dd>{state.head}</dd>
        <dt>View</dt>
        <dd>{state.view}</dd>
      </dl>
      <div className="scroller">
        {log.map((e, i) => (
          <div key={i}>· {e.type}{(e as { caseId?: string }).caseId ? ` ${String((e as { caseId?: string }).caseId)}` : ''}</div>
        ))}
      </div>
      {current && (
        <div style={{ padding: '0 14px 14px' }}>
          <strong style={{ color: '#93c5fd' }}>Ses haritası</strong>
          {current.soundAssignments.map((a) => {
            const rec = resolved[a.pointId]
            return (
              <div key={a.pointId} style={{ marginBottom: 6 }}>
                <div style={{ color: '#facc15' }}>{a.pointId}</div>
                {rec ? (
                  <>
                    <div>→ {rec.id}</div>
                    <div style={{ color: '#94a3b8' }}>
                      src: {rec.sourceFile} | lok: {rec.recordedLocation} | dur: {rec.durationSec}s
                    </div>
                  </>
                ) : (
                  <div style={{ color: '#f87171' }}>→ kayıt yok (eksik)</div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </aside>
  )
}
