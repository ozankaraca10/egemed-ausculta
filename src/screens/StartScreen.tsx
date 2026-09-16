import { useStore } from '../core/store'
import { engine } from '../audio/engineSingleton'
import { bus } from '../core/events'
import { Footer } from '../ui/chrome'
import { IconArrowRight, IconBook, IconHeadphones } from '../ui/icons'
import { computeMetrics } from '../data/metrics'

const M = computeMetrics()

/** Başlangıç ekranı (§44): ortalanmış marka hero'su, envanter metrikleri, kulaklık önerisi,
 *  ses düzeyi kontrolü ve mod seçimine giriş. */

export function StartScreen() {
  const { dispatch } = useStore()

  const playTone = async () => {
    // Nötr, tanısal olmayan ses düzeyi kontrol tonu (§32)
    const ctx = await engine.ensureContext()
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.frequency.value = 440
    osc.type = 'sine'
    osc.connect(g)
    g.connect(ctx.destination)
    const t = ctx.currentTime
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.2, t + 0.05)
    g.gain.setValueAtTime(0.2, t + 0.7)
    g.gain.linearRampToValueAtTime(0, t + 0.8)
    osc.start(t)
    osc.stop(t + 0.85)
  }

  const begin = () => {
    engine.ensureContext().catch(() => undefined)
    bus.emit({ type: 'simulation_started', at: Date.now() })
    dispatch({ type: 'goto', screen: 'modes' })
  }

  const stats: { label: string; tip: string }[] = [
    { label: `${M.datasets} veri seti`, tip: `${M.datasets} açık erişimli veri seti araştırıldı; ${M.datasetsVerified} lisansı doğrulandı, ${M.datasetsPediatric} pediatrik odaklı.` },
    { label: `${M.bundledRecordings} klinik kayıt`, tip: 'Pakete dahil doğrulanmış oskültasyon kaydı (HLS-CMDS v3) + gerçek hasta kayıtları.' },
    { label: `${M.soundClasses} ses sınıfı`, tip: 'Kalp, akciğer ve kombine sınıflar; her biri klinik metafor ve dalga formuyla.' },
    { label: `${M.totalCases} vaka`, tip: `Her oturumda havuzdan rastgele ${10} vaka; ${M.pediatricCases} pediatrik vaka dahil.` },
    { label: `${M.assessmentQuestions} soru`, tip: `Doğrulanmış ${M.assessmentPoolSize} değerlendirme vakasına dağıtılmış soru havuzu.` },
    { label: 'SCORM uyumlu', tip: 'SCORM 2004 4th Ed ve 1.2; puan ve durum LMS’e raporlanır.' },
  ]

  return (
    <div className="screen start-hero-screen">
      <div className="hero-glow" aria-hidden="true" />
      <div className="start-hero">
        <img
          className="hero-logo"
          src="brand/logo-vertical-web.png"
          alt="EGEMED Ausculta — Kardiyopulmoner Oskültasyon Simülatörü"
        />
        <p className="hero-eyebrow">Kardiyopulmoner Oskültasyon Simülatörü</p>
        <h1 className="hero-title">
          Kalbin ve akciğerlerin sesini,
          <br />
          gerçek kayıtlarla birlikte keşfet.
        </h1>
        <p className="hero-sub">
          Yirmi ses sınıfı, yüz doksan dokuz klinik vaka, yetişkin ve pediatrik gövde üzerinde
          sistematik oskültasyon; SCORM uyumlu ölçme ve değerlendirme.
        </p>
        <button className="hero-cta" onClick={begin}>
          Simülatörü başlat <IconArrowRight />
        </button>
        <div className="hero-links">
          <button className="hero-link" onClick={() => dispatch({ type: 'goto', screen: 'tutorial' })}>
            Nasıl kullanılır?
          </button>
          <span className="hero-link-sep" aria-hidden="true" />
          <button className="hero-link" onClick={() => dispatch({ type: 'goto', screen: 'sources' })}>
            <IconBook /> Kaynaklar ve veri setleri
          </button>
        </div>
        <ul className="hero-stats" role="list" aria-label="İçerik metrikleri">
          {stats.map((s, i) => (
            <li key={s.label} title={s.tip}>
              {i > 0 && <span className="stat-dot" aria-hidden="true" />}
              <span>{s.label}</span>
            </li>
          ))}
        </ul>
        <button className="hero-audio-hint" onClick={() => void playTone()}>
          <IconHeadphones />
          Oskültasyon seslerini doğru değerlendirebilmek için kulaklık kullanmanız önerilir.
          <span className="hero-audio-check">Ses düzeyi kontrol</span>
        </button>
      </div>
      <Footer />
    </div>
  )
}
