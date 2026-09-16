import { useEffect, useRef } from 'react'
import { IconClose, IconStethoscope, IconWave, IconDoc, IconCheckCircle } from './icons'

/** Yardım penceresi (popup). Üstteki "Yardım" düğmesinden açılır; X, ESC veya
 *  arka plana tıklayarak kapanır. İçerik: hızlı kullanım rehberi (§ UX). */
export function HelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const prevFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    // D2: açılışta odak kapat düğmesine taşınır, kapanışta önceki odağa döner
    prevFocusRef.current = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === 'Tab' && cardRef.current) {
        const focusables = Array.from(
          cardRef.current.querySelectorAll<HTMLElement>('button, a[href], input, [tabindex]:not([tabindex="-1"])')
        ).filter((el) => !el.hasAttribute('disabled'))
        if (!focusables.length) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      prevFocusRef.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Yardım" onClick={onClose}>
      <div className="modal-card help-modal" ref={cardRef} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Nasıl Kullanılır?</h3>
          <button ref={closeRef} className="modal-close" onClick={onClose} aria-label="Yardım penceresini kapat" title="Kapat">
            <IconClose />
          </button>
        </div>
        <div className="modal-body">
          <ol className="help-steps">
            <li>
              <IconDoc />
              <div>
                <b>Mod seçin</b>
                <p>Öğrenme (rehberli dinleme), Uygulama (ipuçlu vakalar) veya Değerlendirme (ipuçsuz, tek dinleme). Her oturumda havuzdan rastgele 10 vaka gelir.</p>
              </div>
            </li>
            <li>
              <IconStethoscope />
              <div>
                <b>Stetoskobu bölgeye sürükleyin</b>
                <p>Göğüs üzerindeki oskültasyon bölgelerine bırakın; ses otomatik çalınır. Ön/arka görünümü alttaki araç çubuğundan değiştirin.</p>
              </div>
            </li>
            <li>
              <IconWave />
              <div>
                <b>Bell / Diyafram seçin</b>
                <p>Düşük frekanslı ek sesler (S3, S4) için bell; üfürüm ve solunum sesleri için diyafram daha iyi duyurur.</p>
              </div>
            </li>
            <li>
              <IconCheckCircle />
              <div>
                <b>Soruları yanıtlayın</b>
                <p>Uygulamada geri bildirim ve ipucu vardır (ipucu -5 puan). Değerlendirmede ipucu, tekrar dinleme ve bölge işareti YOKTUR; her bölge yalnız bir kez dinlenebilir.</p>
              </div>
            </li>
          </ol>
          <div className="help-tips">
            <b>İpuçları</b>
            <ul>
              <li>En iyi deneyim için kulaklık kullanın; ses düzeyi denetimi alt araç çubuğundadır, başlangıç ekranında kulaklık test tonu vardır.</li>
              <li>Bölge listesini klavyeyle de kullanabilirsiniz (Tab ile odaklanın).</li>
              <li>Çalma sırasında sağdaki paneldeki Dalga Formu sekmesi ve turuncu ipucu düğmesi öğrenmeyi destekler.</li>
              <li>Kaynaklar ve veri seti lisansları için üstteki “Kaynaklar” düğmesine bakın.</li>
            </ul>
          </div>
          <p className="help-note">Bu simülatör eğitim amaçlıdır; tanı koydurmaz. Klinik karar her zaman hasta bağlamıyla verilir.</p>
        </div>
      </div>
    </div>
  )
}
