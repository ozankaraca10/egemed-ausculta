import { useEffect } from 'react'
import { IconClose, IconStethoscope, IconWave, IconDoc, IconCheckCircle } from './icons'

/** Yardım penceresi (popup). Üstteki "Yardım" düğmesinden açılır; X, ESC veya
 *  arka plana tıklayarak kapanır. İçerik: hızlı kullanım rehberi (§ UX). */
export function HelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Yardım" onClick={onClose}>
      <div className="modal-card help-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Nasıl Kullanılır?</h3>
          <button className="modal-close" onClick={onClose} aria-label="Yardım penceresini kapat" title="Kapat">
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
                <p>Göğüs üzerindeki oskültasyon bölgelerine bırakın; ses otomatik çalınır. Ön/arka görünümü ve hasta gövdesini (erkek/kadın/çocuk) alttaki araç çubuğundan değiştirin.</p>
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
              <li>En iyi deneyim için kulaklık kullanın; ses düzeyi denetimi başlangıç ekranındadır.</li>
              <li>Bölge listesini klavyeyle de kullanabilirsiniz (Tab ile odaklanın).</li>
              <li>Çalma sırasında sol üstteki dalga formu ve turuncu ipucu düğmesi öğrenmeyi destekler.</li>
              <li>Kaynaklar ve veri seti lisansları için üstteki “Kaynaklar” düğmesine bakın.</li>
            </ul>
          </div>
          <p className="help-note">Bu simülatör eğitim amaçlıdır; tanı koydurmaz. Klinik karar her zaman hasta bağlamıyla verilir.</p>
        </div>
      </div>
    </div>
  )
}
