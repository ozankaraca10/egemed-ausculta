import { useStore } from '../core/store'
import { Footer, EcgDeco } from '../ui/chrome'

import { IconDrag, IconBell, IconDiaphragm, IconVolume, IconCompare, IconDoc, IconArrowRight, IconTarget } from '../ui/icons'
import { useState } from 'react'

/** İlk kullanım öğreticisi (§45): 6 adım, tek sefer gösterilir, tekrar oynatılabilir. */

const STEPS = [
  { n: 1, title: 'Stetoskopu sürükleyin', desc: 'Ekrandaki stetoskopu tıklayıp sürükleyerek hareket ettirin.', icon: 'drag' },
  { n: 2, title: 'Oskültasyon alanını bulun', desc: 'Hastanın göğsü üzerindeki işaretli oskültasyon alanlarından birine stetoskopu yerleştirin.', icon: 'target' },
  { n: 3, title: 'Bell veya Diyaframı seçin', desc: 'Oskültasyon yapmak için stetoskopun bell veya diyafram tarafını seçin.', icon: 'heads' },
  { n: 4, title: 'Sesi dinleyin', desc: 'Gerçek klinik kayıtlardan elde edilmiş oskültasyon sesini dinleyin.', icon: 'vol' },
  { n: 5, title: 'Karşılaştırın', desc: 'Sesi normal ve patolojik örneklerle karşılaştırarak farklı bölgeleri inceleyin.', icon: 'compare' },
  { n: 6, title: 'Yorumlayın', desc: 'Duyduğunuz sese göre klinik bulguları değerlendirip yorumunuzu yapın.', icon: 'doc' },
]

function StepIcon({ kind }: { kind: string }) {
  switch (kind) {
    case 'drag': return <IconDrag width={20} height={20} />
    case 'target': return <IconTarget width={20} height={20} />
    case 'heads':
      return (
        <span style={{ display: 'inline-flex', gap: 2 }}>
          <IconBell width={16} height={16} />
          <IconDiaphragm width={16} height={16} />
        </span>
      )
    case 'vol': return <IconVolume width={20} height={20} />
    case 'compare': return <IconCompare width={20} height={20} />
    default: return <IconDoc width={20} height={20} />
  }
}

export function TutorialScreen() {
  const { dispatch } = useStore()
  const [dontShow, setDontShow] = useState(false)
  const begin = () => {
    if (dontShow) dispatch({ type: 'tutorialDone', done: true })
    dispatch({ type: 'goto', screen: 'modes' })
  }
  return (
    <>
      <EcgDeco />
      <div className="screen" style={{ position: 'relative', zIndex: 1 }}>
        <div className="container screen-body">
          <div className="tutorial-wrap">
            <div>
              <h1 className="tut-title">Nasıl Kullanılır?</h1>
              <p className="tut-lead">Ausculta ile gerçek oskültasyon deneyimini adım adım keşfedin.</p>
              <p className="tut-sub">Aşağıdaki adımları takip ederek simülatörde etkili bir şekilde pratik yapabilirsiniz.</p>
              <div className="tut-steps">
                {STEPS.map((s) => (
                  <div className="tut-step" key={s.n}>
                    <span className="num">{s.n}</span>
                    <span className="ic"><StepIcon kind={s.icon} /></span>
                    <div>
                      <h5>{s.title}</h5>
                      <p>{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="tut-footer">
                <label className="tut-again">
                  <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} />
                  Tekrar gösterme
                </label>
                <button className="btn primary" onClick={begin}>
                  Anladım, Başlayalım <IconArrowRight />
                </button>
              </div>
            </div>
            <div className="stage-card" aria-hidden="true">
              <div className="tut-stage-fit">
                <img src="assets/body/front.jpg" alt="Hasta ön görünüm örneği" />
              </div>
              <div className="note-strip" style={{ marginTop: 0 }}>
                <IconTarget width={18} height={18} />
                <span>Oskültasyon noktaları gövde üzerinde işaretlidir; stetoskopu bu noktalara sürükleyin.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  )
}
