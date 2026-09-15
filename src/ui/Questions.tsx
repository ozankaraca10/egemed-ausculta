import { useState } from 'react'
import type { Question } from '../core/types'
import { IconCheck } from './icons'

/** Yeniden kullanılabilir soru bileşenleri (§23): tek/çok seçim, ses tanıma,
 *  lokalizasyon, bell/diyafram, yorum, tanı, sıralama. */

interface Props {
  q: Question
  value: string[]
  onChange: (values: string[]) => void
  revealed: boolean
  disabled?: boolean
  showEyebrow?: boolean
}

export function QuestionCard({ q, value, onChange, revealed, disabled, showEyebrow = true }: Props) {
  const toggle = (id: string) => {
    if (disabled || revealed) return
    if (q.type === 'multi_choice') {
      const cur = new Set(value)
      if (cur.has(id)) cur.delete(id)
      else cur.add(id)
      onChange([...cur])
    } else {
      onChange([id])
    }
  }

  const isMulti = q.type === 'multi_choice'
  const eyebrowLabel: Record<string, string> = {
    sound_identify: 'Ses tanımlama',
    localization: 'Lokalizasyon',
    bell_diaphragm: 'Stetoskop kafası',
    interpretation: 'Klinik yorum',
    diagnosis: 'Tanı',
    recognition: 'Ses tanımlama',
    sequence: 'Sıralama',
    single_choice: 'Soru',
    multi_choice: 'Çok seçmeli',
  }

  return (
    <div className="q-block">
      {showEyebrow && <div className="q-eyebrow">{eyebrowLabel[q.type] ?? 'Soru'}</div>}
      <p className="q-text">{q.prompt}</p>
      {q.help && <p className="q-help">{q.help}</p>}
      <div className="opt-list" role={isMulti ? 'group' : 'radiogroup'} aria-label={q.prompt}>
        {q.options.map((o) => {
          const selected = value.includes(o.id)
          return (
            <button
              key={o.id}
              type="button"
              className={`opt ${selected ? 'selected' : ''}`}
              onClick={() => toggle(o.id)}
              aria-pressed={selected}
              disabled={disabled}
            >
              <span className={isMulti ? 'check' : 'radio'}>
                {isMulti && <IconCheck />}
              </span>
              <span>{o.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Yanıt sonrası eğitim geri bildirimi (§46) — sadece Doğru/Yanlış değil. */
export function FeedbackCard({ correct, q, given }: { correct: boolean; q: Question; given: string[] }) {
  const correctLabels = q.correct.map((cid) => q.options.find((o) => o.id === cid)?.label ?? '').filter(Boolean)
  return (
    <div className="card mt-12">
      <div className={`feedback-head ${correct ? 'good' : 'bad'}`}>
        <div className={`ic ${correct ? 'good' : 'bad'}`}>
          {correct ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><circle cx="12" cy="12" r="10" fill="none" /><path d="m8 12.5 2.6 2.6L16.5 9" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><circle cx="12" cy="12" r="10" fill="none" /><path d="M9 9l6 6M15 9l-6 6" /></svg>
          )}
        </div>
        <h2>{correct ? 'Doğru!' : 'Yanlış'}</h2>
      </div>
      {!correct && given.length > 0 && (
        <p className="feedback-verdict">Yanıtınız: {given.map((id) => q.options.find((o) => o.id === id)?.label).filter(Boolean).join(', ')}</p>
      )}
      {!correct && (
        <p className="feedback-verdict" style={{ color: 'var(--green-600)' }}>
          Doğru yanıt: {correctLabels.join(', ')}
        </p>
      )}
      <p className="feedback-text">{correct ? q.feedbackCorrect : q.feedbackIncorrect}</p>
    </div>
  )
}

/** Cevaplanan soruların özet çipi */
export function QuestionProgress({ total, done }: { total: number; done: number }) {
  return (
    <div className="eg-progress-chip" aria-label={`Soru ${done} / ${total}`}>
      <span>Soru {done}/{total}</span>
      <span className="bar"><i style={{ width: `${(done / total) * 100}%` }} /></span>
    </div>
  )
}

/** Soru sayısı istatistiği (vaka içinde) */
export function useShuffled<T>(arr: T[], seed = 1): T[] {
  const [out] = useState(() => {
    let s = seed
    const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
    return [...arr].sort(() => rand() - 0.5)
  })
  return out
}
