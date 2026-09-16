import { useStore } from '../core/store'
import { Footer, EcgDeco } from '../ui/chrome'
import { aggregateResults } from '../core/scoring'
import { ALL_CASES } from '../data/pool'
import { IconStethoscope, IconLungs, IconWave, IconDoc, IconCheckCircle, IconExit } from '../ui/icons'
import type { ScoringWeights } from '../core/types'

/** Sonuç ekranı (§24): skor çemberi + alan bazlı performans barları + rapor. */

const cases = ALL_CASES

export function ResultsScreen() {
  const { state, dispatch, runtime } = useStore()
  const isAssessment = state.mode === 'assessment'
  const agg = aggregateResults(state.caseResults)
  const last = state.caseResults[state.caseResults.length - 1]
  const total = isAssessment ? agg.total : last?.total ?? 0
  const passed = isAssessment ? agg.mastery : last?.mastery ?? false
  const domains = isAssessment ? agg.domains : last?.domains ?? null

  const domainRows: { key: keyof ScoringWeights; label: string; icon: React.ReactNode }[] = [
    { key: 'technique', label: 'Oskültasyon tekniği', icon: <IconStethoscope /> },
    { key: 'localization', label: 'Anatomik lokalizasyon', icon: <IconLungs /> },
    { key: 'recognition', label: 'Ses tanımlama', icon: <IconWave /> },
    { key: 'interpretation', label: 'Klinik yorum', icon: <IconDoc /> },
    { key: 'diagnosis', label: 'Tanı (varsa)', icon: <IconCheckCircle /> },
    { key: 'systematic', label: 'Sistematik muayene', icon: <IconStethoscope /> },
  ]

  // D12: gerçek bir LMS içindeyse oturumu sonlandır ve sekmeyi/penceresini kapatmayı dene;
  // bağımsız/mock modda (LMS yok) yalnız başlangıç ekranına dönülür (terminate edilmez).
  const exit = () => {
    if (runtime?.flags.scormAvailable) {
      runtime.terminate()
      window.close()
    }
    dispatch({ type: 'goto', screen: 'start' })
  }

  return (
    <>
      <EcgDeco />
      <div className="screen" style={{ position: 'relative', zIndex: 1 }}>
        <div className="results-wrap screen-body">
          <img className="results-logo" src="brand/logo-icon-transparent.png" alt="" aria-hidden="true" />
          <h1 className="results-title">
            {isAssessment ? 'Değerlendirme Tamamlandı' : 'Vaka Raporu'}
          </h1>
          <p className="results-sub">
            EGEMED Ausculta oskültasyon modülünü tamamladınız. Gösterdiğiniz çaba, daha iyi bir klinik
            dinleme becerisi için önemli bir adım. Başarılarınızın devamını dileriz.
          </p>
          <div className="results-grid">
            <div className="card score-card">
              <h3 style={{ marginTop: 0 }}>Toplam Puanınız</h3>
              <div className="score-ring">
                <svg viewBox="0 0 210 210">
                  <circle cx="105" cy="105" r="90" fill="none" stroke="#e4edf8" strokeWidth="17" />
                  <circle
                    cx="105" cy="105" r="90" fill="none"
                    stroke={passed ? '#16a34a' : '#e11d48'}
                    strokeWidth="17"
                    strokeLinecap="round"
                    strokeDasharray={`${(total / 100) * 2 * Math.PI * 90} 999`}
                  />
                </svg>
                <div className="val">
                  <b>{total}</b>
                  <span>/ 100</span>
                </div>
              </div>
              <div className={`score-badge ${passed ? 'pass' : 'fail'}`}>
                <IconCheckCircle width={18} height={18} /> {passed ? 'Başarılı' : 'Hedefin altında'}
              </div>
              <div className="score-note">
                {passed ? 'Tebrikler! Hedef puanı (80) geçtiniz.' : 'Hedef puan 80. Öğrenme modunda tekrar çalışmanız önerilir.'}
              </div>
            </div>
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Performans Detayları</h3>
              <div className="perf-rows mt-12">
                {domains &&
                  domainRows.map((d) => {
                    const v = domains[d.key]
                    if (!v || v.max === 0) return null
                    return (
                      <div className="perf-row" key={d.key}>
                        <span className="ic">{d.icon}</span>
                        <span className="lbl">{d.label}</span>
                        <span className="bar"><i style={{ width: `${(v.earned / v.max) * 100}%` }} /></span>
                        <span className="num">{Math.round(v.earned)} / {v.max}</span>
                      </div>
                    )
                  })}
              </div>
            </div>
          </div>

          <div className="card mt-24" style={{ textAlign: 'left' }}>
            <h3 style={{ marginTop: 0 }}>Vaka Raporu</h3>
            <div className="table-scroll">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Vaka</th>
                  <th>Puan</th>
                  <th>Sonuç</th>
                  <th>İpucu</th>
                </tr>
              </thead>
              <tbody>
                {state.caseResults.map((r) => (
                  <tr key={r.caseId}>
                    <td>{cases.find((c) => c.id === r.caseId)?.title ?? r.caseId}</td>
                    <td>{Math.round(r.total)}/100</td>
                    <td className={r.mastery ? 'ok' : 'no'}>{r.mastery ? 'Başarılı' : 'Başarısız'}</td>
                    <td>{r.hintsUsed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          <div className="results-actions">
            <button className="btn primary" onClick={exit}>
              <IconExit /> Modülden Çık
            </button>
          </div>
        </div>
      </div>
      <Footer />
    </>
  )
}
