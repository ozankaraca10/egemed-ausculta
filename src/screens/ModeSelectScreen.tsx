import { useStore } from '../core/store'
import { Footer, EcgDeco } from '../ui/chrome'
import { IconGraduation, IconStethoscope, IconChart, IconCheck, IconHeadphones } from '../ui/icons'
import type { Mode } from '../core/types'
import libraryData from '../data/library.json'
import { ALL_CASES, poolFor } from '../data/pool'
import { sampleSession, SESSION_SIZE } from '../core/session'

const practiceCases = poolFor('practice')
const assessmentCases = poolFor('assessment')
const assessmentQuestions = assessmentCases.reduce((s2, c) => s2 + c.questions.length, 0)
const libraryCount = libraryData.groups.reduce((s2, g) => s2 + g.items.length, 0)
const totalCases = ALL_CASES.length

/** Mod seçim ekranı (§44): Öğrenme / Uygulama / Değerlendirme kartları + adım göstergesi. */

export function ModeSelectScreen() {
  const { state, dispatch } = useStore()
  const pick = (mode: Mode) => {
    // oturum başına rastgele 10 vaka: tohum oturum başında üretilir, suspend ile korunur
    if (mode !== 'learn') {
      const seed = (Date.now() % 2147483647) | 0
      const practiceIds = sampleSession(poolFor('practice'), seed, SESSION_SIZE)
      const assessmentIds = sampleSession(poolFor('assessment'), seed + 1, SESSION_SIZE)
      dispatch({ type: 'startSession', practiceIds, assessmentIds, seed })
    }
    dispatch({ type: 'startMode', mode })
    if (mode === 'learn') dispatch({ type: 'goto', screen: 'learn' })
  }
  void state
  return (
    <>
      <EcgDeco />
      <div className="screen" style={{ position: 'relative', zIndex: 1 }}>
        <div className="container screen-body">
          <Stepper active={1} labels={['Mod Seçimi', 'Çalışma', 'Tamamla']} />
          <h1 className="mode-title">Çalışma Modunu Seçin</h1>
          <p className="mode-sub">Hangi modda çalışmak istersiniz?</p>
          <div className="mode-cards">
            <ModeCard
              kind="learn"
              icon={<IconGraduation />}
              title="Öğrenme Modu"
              text={`${libraryCount} ses sınıfı: kalp, akciğer ve kombine kayıtlar; metaforlar ve dalga formlarıyla rehberli öğrenme.`}
              items={['Rehberli öğrenme', 'Ses metaforları', 'Sınırsız dinleme']}
              tooltip="Kütüphanedeki her ses sınıfı için metafor, dalga formu ve klinik bilgi; sınırsız dinleme."
              cta="Bu modu seç"
              onPick={() => pick('learn')}
            />
            <ModeCard
              kind="practice"
              icon={<IconStethoscope />}
              title="Uygulama Modu"
              text={`${practiceCases.length} vakalık havuzdan her oturumda rastgele ${SESSION_SIZE} vaka sunulur; ön/arka bölge dinlemesi ve geri bildirim.`}
              items={['Rastgele 10 vaka', 'İpucu desteği', 'Detaylı geri bildirim']}
              tooltip={`Her oturumda ${totalCases} vakalık havuzdan rastgele ${SESSION_SIZE} vaka seçilir; her oturum farklı varyantlarla çalışılır.`}
              cta="Bu modu seç"
              onPick={() => pick('practice')}
            />
            <ModeCard
              kind="assessment"
              icon={<IconChart />}
              title="Değerlendirme Modu"
              text={`${assessmentCases.length} doğrulanmış vakalık havuzdan her oturumda rastgele ${SESSION_SIZE} vaka; ipuçsuz, tek dinleme, SCORM puanlı.`}
              items={['Rastgele 10 vaka', 'İpuçsuz + tek dinleme', 'SCORM puanı']}
              tooltip={`Her oturumda ${assessmentCases.length} doğrulanmış vaka havuzundan rastgele ${SESSION_SIZE} vaka gelir. Toplam ${assessmentQuestions} soruluk havuzdan seçilen sorularla maksimum zorlukta ölçüm yapılır.`}
              cta="Bu modu seç"
              onPick={() => pick('assessment')}
            />
          </div>
          <div className="mode-note">
            <div className="headphone-banner">
              <IconHeadphones />
              <span className="vsep" />
              <span>
                Tüm modlarda gerçek hasta sesleri kullanılmaktadır.
                <br />
                <span className="muted">Kulaklıkla çalışmanız, en iyi deneyim için önerilir.</span>
              </span>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  )
}

export function Stepper({ active, labels }: { active: number; labels: string[] }) {
  return (
    <div className="stepper" aria-label="İlerleme">
      {labels.map((l, i) => (
        <div key={l} className={`step ${i + 1 === active ? 'active' : i + 1 < active ? 'done' : ''}`}>
          {i > 0 && <span className="line" />}
          <span className="dot">{i + 1 < active ? '✓' : i + 1}</span>
          <span className="lbl">{l}</span>
        </div>
      ))}
    </div>
  )
}

const ArrowRight = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 12h15" /><path d="m13 6 6 6-6 6" /></svg>
)

function ModeCard({ kind, icon, title, text, items, cta, onPick, tooltip }: {
  kind: Mode
  icon: React.ReactNode
  title: string
  text: string
  items: string[]
  cta: string
  onPick: () => void
  tooltip?: string
}) {
  return (
    <div className={`mode-card ${kind}`} title={tooltip}>
      <div className="ic">{icon}</div>
      <h3>{title}</h3>
      <p className="desc">{text}</p>
      {tooltip && <p className="mode-tip" title={tooltip}>ⓘ {tooltip}</p>}
      <ul>
        {items.map((i) => (
          <li key={i}>
            <span className="ck"><IconCheck /></span>
            {i}
          </li>
        ))}
      </ul>
      <button className={`btn ${kind === 'learn' ? 'green' : kind === 'assessment' ? 'purple' : 'primary'}`} onClick={onPick}>
        {cta} <ArrowRight />
      </button>
    </div>
  )
}
