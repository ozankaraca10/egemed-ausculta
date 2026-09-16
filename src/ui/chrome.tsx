import { useEffect, useState } from 'react'
import { useStore } from '../core/store'
import { IconBook, IconGlobe, IconHelpCircle, IconEcg, IconFullscreen, IconFullscreenExit } from './icons'
import casesData from '../data/cases.json'
import type { CaseDef } from '../core/types'

const cases = casesData.cases as unknown as CaseDef[]

export function BrandMark({ size = 30 }: { size?: number }) {
  return <img src="brand/logo-icon-white-web.png" alt="" width={size} height={size} className="brand-mark" />
}

export function Header() {
  const { state, dispatch, runtime } = useStore()
  const [fs, setFs] = useState(false)
  const modeLabel = state.mode === 'learn' ? 'Öğrenme Modu' : state.mode === 'practice' ? 'Uygulama Modu' : 'Değerlendirme Modu'

  useEffect(() => {
    const onFs = () => setFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  const toggleFs = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => undefined)
    else document.exitFullscreen?.().catch(() => undefined)
  }

  return (
    <header className="eg-header">
      <button className="eg-brand" onClick={() => dispatch({ type: 'goto', screen: 'start' })} aria-label="Ana ekran">
        <BrandMark size={32} />
        <span className="brand-block">
          <span className="brand-top">EGEMED</span>
          <span className="brand-name">Ausculta</span>
        </span>
      </button>
      <span className="app-subtitle">Kardiyopulmoner Oskültasyon Simülatörü</span>
      <div className="spacer" />
      {(state.screen === 'simulation' || state.screen === 'learn') && (
        <>
          {state.screen === 'simulation' && (
            <span className={`eg-mode-chip ${state.mode}`}>{modeLabel}</span>
          )}
          {(state.mode === 'assessment' && state.screen === 'simulation') && (
            <span className="eg-progress-chip" aria-live="polite">
              Soru {Math.min(state.step + 1, currentTotal(state))}/{currentTotal(state)}
              <span className="bar"><i style={{ width: `${((state.step + 1) / currentTotal(state)) * 100}%` }} /></span>
            </span>
          )}
          {state.mode === 'assessment' && state.screen === 'simulation' && (
            <span className="eg-timer" aria-live="off">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></svg>
              {fmtTimer(state.assessmentTimer)}
            </span>
          )}
        </>
      )}
      {runtime?.flags.dev && <span className="eg-dev-badge">DEV</span>}
      <button className="eg-header-chip clickable" onClick={toggleFs} aria-label={fs ? 'Tam ekrandan çık' : 'Tam ekran'} title={fs ? 'Tam ekrandan çık' : 'Tam ekran'}>
        {fs ? <IconFullscreenExit /> : <IconFullscreen />}
        <span className="chip-text">{fs ? 'Normal' : 'Tam Ekran'}</span>
      </button>
      <span className="divider-v" />
      <span className="eg-header-chip eg-lang" title="Arayüz dili">
        <IconGlobe /> TR
      </span>
      <span className="divider-v" />
      <button className="eg-header-chip clickable" onClick={() => dispatch({ type: 'goto', screen: 'help' })}>
        <IconHelpCircle /> <span className="chip-text">Yardım</span>
      </button>
      <button className="eg-header-chip clickable" onClick={() => dispatch({ type: 'goto', screen: 'sources' })}>
        <IconBook /> <span className="chip-text">Kaynaklar</span>
      </button>
    </header>
  )
}

function currentTotal(state: ReturnType<typeof useStore>['state']): number {
  const list = state.mode === 'assessment' ? cases.filter((c) => c.modes.includes('assessment')) : cases
  const c = list[state.caseIndex]
  return c?.questions.length ?? 1
}
function fmtTimer(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export function Footer() {
  return (
    <footer className="eg-footer">
      <img src="brand/logo-compact-web.png" alt="EGEMED Ausculta" className="footer-logo" height={34} />
      <span className="sep">|</span>
      <span>Kardiyopulmoner Oskültasyon Simülatörü</span>
      <span className="spacer" />
      <span className="small">Ses kayıtları: HLS-CMDS v3 · CC BY 4.0</span>
    </footer>
  )
}

export function EcgDeco() {
  return (
    <div className="app-bg" aria-hidden="true">
      <div className="bg-wash" />
      <IconEcg className="ecg" />
    </div>
  )
}

export function HeadphoneBanner({ compact, onCheck }: { compact?: boolean; onCheck?: () => void }) {
  return (
    <div className="headphone-banner" style={compact ? { padding: '10px 16px' } : undefined}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 14v-2a9 9 0 0 1 18 0v2" /><rect x="3" y="14" width="4" height="7" rx="2" /><rect x="17" y="14" width="4" height="7" rx="2" /></svg>
      <span className="vsep" />
      <span style={compact ? { fontSize: 13.5 } : undefined}>
        Oskültasyon seslerini doğru değerlendirebilmek için <strong>kulaklık kullanmanız önerilir.</strong>
      </span>
      {onCheck && (
        <button className="btn outline small" onClick={onCheck}>Ses düzeyi kontrol</button>
      )}
    </div>
  )
}
