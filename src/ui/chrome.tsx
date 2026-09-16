import { useEffect, useState } from 'react'
import { HelpModal } from './HelpModal'
import { useStore } from '../core/store'
import { IconBook, IconGlobe, IconHelpCircle, IconEcg, IconFullscreen, IconFullscreenExit, IconSwap } from './icons'
import { ALL_CASES } from '../data/pool'

export function BrandMark({ size = 30 }: { size?: number }) {
  return <img src="brand/logo-icon-white-web.png" alt="" width={size} height={size} className="brand-mark" />
}

export function Header() {
  const { state, dispatch, runtime } = useStore()
  const [fs, setFs] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
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
          {(state.screen === 'simulation' || state.screen === 'learn') && (
            <button
              className="eg-header-chip clickable"
              onClick={() => dispatch({ type: 'goto', screen: 'modes' })}
              title="Mod seçim ekranına dön"
            >
              <IconSwap /> <span className="chip-text">Mod Değiştir</span>
            </button>
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
      <button className="eg-header-chip clickable" onClick={() => setHelpOpen(true)}>
        <IconHelpCircle /> <span className="chip-text">Yardım</span>
      </button>
      <button className="eg-header-chip clickable" onClick={() => dispatch({ type: 'goto', screen: 'sources' })}>
        <IconBook /> <span className="chip-text">Kaynaklar</span>
      </button>
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </header>
  )
}

function currentTotal(state: ReturnType<typeof useStore>['state']): number {
  const c = ALL_CASES.find((x) => x.id === state.currentCaseId)
  return c?.questions.length ?? 1
}
function fmtTimer(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export function Footer() {
  return (
    <footer className="eg-footer">
      <img src="brand/logo-icon-web.png" alt="" className="footer-seal" />
      <span className="footer-inst">Ege Üniversitesi Tıp Fakültesi Dekanlığı</span>
      <span className="footer-sub">EGEMED Ausculta — Kardiyopulmoner Oskültasyon Simülatörü · Tüm hakları saklıdır © 2026</span>
      <span className="spacer" />
      <span className="footer-attr small">Ses kayıtları: HLS-CMDS v3 · CC BY 4.0</span>
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

