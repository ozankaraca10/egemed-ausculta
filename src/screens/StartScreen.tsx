import { useStore } from '../core/store'
import { engine } from '../audio/engineSingleton'
import { bus } from '../core/events'
import { Footer, HeadphoneBanner, EcgDeco } from '../ui/chrome'
import { IconDatabase, IconNetwork, IconMonitor, IconShieldCheck, IconArrowRight, IconBook, IconStethoscope } from '../ui/icons'
import { useState } from 'react'
import { computeMetrics } from '../data/metrics'

const M = computeMetrics()

/** Başlangıç ekranı (§44): marka kilidi, kulaklık önerisi, ses düzeyi kontrolü, mod seçimine giriş. */

export function StartScreen() {
  const { dispatch, runtime } = useStore()
  const [tonePlayed, setTonePlayed] = useState(false)

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
    setTonePlayed(true)
  }

  const begin = () => {
    engine.ensureContext().catch(() => undefined)
    bus.emit({ type: 'simulation_started', at: Date.now() })
    dispatch({ type: 'goto', screen: 'modes' })
  }

  return (
    <>
      <EcgDeco />
      <div className="screen" style={{ position: 'relative', zIndex: 1 }}>
        <div className="container screen-body">
          <div className="start-wrap">
            <div className="start-left">
              <img
                className="hero-logo"
                src="brand/ausculta-horizontal.svg"
                alt="EGEMED Ausculta — Kardiyopulmoner Oskültasyon Simülatörü"
              />
              <p className="start-desc">
                Gerçek klinik seslerle kalp ve akciğer oskültasyonunu öğrenin. Normal ve patolojik sesleri
                dinleyin, karşılaştırın, yorumlayın; yetişkin kadın/erkek ve pediatrik gövde üzerinde çalışın.
              </p>
              <div className="start-actions">
                <button className="btn primary large" onClick={begin}>
                  Başla <IconArrowRight />
                </button>
                <span className="start-links-sep" />
                <button className="start-link" onClick={() => dispatch({ type: 'goto', screen: 'tutorial' })}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" fill="none" /><path d="M10 8.5v7l5-3.5z" fill="currentColor" /></svg>
                  Nasıl Kullanılır?
                </button>
                <span className="start-links-sep" />
                <button className="start-link" onClick={() => dispatch({ type: 'goto', screen: 'sources' })}>
                  <IconBook /> Kaynaklar
                </button>
              </div>
              <div className="metric-strip" role="list" aria-label="Simülatör içerik metrikleri">
                <Metric value={M.datasets} label="veri seti envanteri" tip={`${M.datasets} açık erişimli veri seti araştırıldı; ${M.datasetsVerified} tanesinin lisansı doğrulandı. ${M.datasetsPediatric} tanesi pediatrik odaklı.`} />
                <Metric value={M.bundledRecordings} label="paketlenmiş klinik kayıt" tip="Pakete dahil doğrulanmış kayıt sayısı (HLS-CMDS v3)." />
                <Metric value={M.externalRecordings} label="envanter kaydı (gerçek hasta)" tip="Gerçek hastalardan alınmış envanter kayıtları (ör. CirCor, ODC-BY 1.0)." />
                <Metric value={M.soundClasses} label="ses sınıfı ve metafor" tip="Kalp, akciğer ve kombine ses sınıfları; her biri için klinik metafor ve dalga formu." />
                <Metric value={M.auscultationPoints} label="oskültasyon noktası" tip="Ön/arka, yetişkin ve pediatrik gövdede konumlandırılmış noktalar." />
                <Metric value={M.practicePoolSize} label="vaka havuzu" tip={`Her oturumda havuzdan rastgele 10 vaka sunulur. Toplam havuz: ${M.totalCases} vaka (${M.mixedCases} kombine).`} />
                <Metric value={M.assessmentPoolSize} label="değerlendirme vakası" tip={`Doğrulanmış eşlemeli ${M.assessmentPoolSize} vaka ve toplam ${M.assessmentQuestions} soru; her oturumda rastgele 10 vaka.`} />
                <Metric value={M.pediatricCases} label="pediatrik vaka" tip="Pediatrik gövde, yaşa uygun vitaller ve pediatrik bağlam bilgisiyle vaka seti." />
              </div>
              <div className="vol-check">
                <button className="btn outline small" onClick={() => void playTone()}>
                  <IconStethoscope width={16} height={16} /> &nbsp;Ses düzeyi kontrol
                </button>
                <span>{tonePlayed ? 'Kısa bir test tonu çalındı (tanısal değildir).' : 'Kulaklığınızı takın, düzeyi kontrol edin.'}</span>
              </div>
            </div>

            <div>
              <div className="feature-cards">
                <Feature icon={<IconDatabase />} title="Gerçek veri setleri" text="Klinik manikinden alınmış yüksek kaliteli oskültasyon sesleri (HLS-CMDS v3)." />
                <Feature icon={<IconNetwork />} title="Etkileşimli simülasyon" text="Gerçekçi senaryolarla uygulayarak öğrenme deneyimi." />
                <Feature icon={<IconMonitor />} title="SCORM uyumlu" text="LMS sistemleriyle tam uyumlu, standartlara uygun eğitim içeriği." />
                <Feature icon={<IconShieldCheck />} title="Tıbbi doğruluk" text="Kayıtlı veri seti tabanlı, doğrulanmış akustik eşleme." />
              </div>
              <HeadphoneBanner onCheck={() => void playTone()} />
              {runtime?.flags.dev && (
                <p className="start-note">Geliştirme modu: SCORM API bulunamadı; bağımsız çalışma (mock) etkin.</p>
              )}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  )
}

function Metric({ value, label, tip }: { value: number; label: string; tip: string }) {
  return (
    <div className="metric" role="listitem" title={tip}>
      <b>{value.toLocaleString('tr-TR')}</b>
      <span>{label}</span>
    </div>
  )
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="feature-card">
      <div className="ic">{icon}</div>
      <h4>{title}</h4>
      <p>{text}</p>
    </div>
  )
}
