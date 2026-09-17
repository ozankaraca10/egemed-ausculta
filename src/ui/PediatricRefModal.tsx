import { useEffect, useRef } from 'react'
import { IconClose } from './icons'
import pediatricRef from '../data/pediatric-reference.json'

/** Madde 6: Pediatrik referans modalı — HelpModal ile aynı erişilebilirlik deseni:
 *  role="dialog" aria-modal, sağ üstte ✕ (aria-label="Kapat"), ESC ve arka plan tıklamasıyla
 *  kapanır, açılışta odak kapat düğmesine, kapanışta tetikleyen düğmeye geri döner, Tab odak
 *  tuzağı. Öğrenme modunda (her kalem için) ve Uygulama modunda pediatrik vakalarda kullanılır;
 *  Değerlendirme modunda hiç gösterilmez. */
export function PediatricRefModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const prevFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
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
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Pediatrik referans değerleri" onClick={onClose}>
      <div className="modal-card" ref={cardRef} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Pediatrik referans değerleri</h3>
          <button ref={closeRef} className="modal-close" onClick={onClose} aria-label="Pediatrik referans penceresini kapat" title="Kapat">
            <IconClose />
          </button>
        </div>
        <div className="modal-body">
          <p className="ped-note">{pediatricRef.note}</p>
          <table className="ped-table">
            <thead>
              <tr><th>Yaş</th><th>Kalp hızı</th><th>Solunum</th></tr>
            </thead>
            <tbody>
              {pediatricRef.rows.map((r) => (
                <tr key={r.age}><td>{r.age}</td><td>{r.hr}/dk</td><td>{r.rr}/dk</td></tr>
              ))}
            </tbody>
          </table>
          <ul className="ped-notes">
            {pediatricRef.auscultationNotes.map((n) => <li key={n}>{n}</li>)}
          </ul>
        </div>
      </div>
    </div>
  )
}
