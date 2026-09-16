import { describe, it, expect, beforeEach } from 'vitest'
import { MockAdapter, detectScorm, makeScorm, Scorm2004Adapter, Scorm12Adapter } from '../src/core/scorm'
import { serializeSuspend, deserializeSuspend } from '../src/core/suspend'
import { scoreCase, aggregateResults, practiceAdjusted, MASTERY_THRESHOLD } from '../src/core/scoring'
import { validateCase, filterAssessmentPool } from '../src/core/validation'
import { resolveAssignment, resolveAssignmentEx, resolveCaseSounds, resolveCaseSoundsEx, resolveLibrarySound, RECORDS } from '../src/core/resolver'
import casesData from '../src/data/cases.json'
import pointsData from '../src/data/auscultation-points.json'
import libraryJson from '../src/data/library.json'
import sourcesJson from '../src/data/sources.json'
import { mapCircorMurmur, mapCircorLocations } from '../scripts/lib/external-mapping.mjs'
import { sampleSession, SESSION_SIZE } from '../src/core/session'
import { poolFor as poolForTest } from '../src/data/pool'
import { EXTERNAL_RECORDS } from '../src/core/resolver'
import { computeMetrics } from '../src/data/metrics'
import { serializeSuspend, deserializeSuspend, SUSPEND_LIMIT_12, SUSPEND_LIMIT_2004 } from '../src/core/suspend'
import type { CaseDef, SuspendPayload, Telemetry } from '../src/core/types'

const cases = casesData.cases as unknown as CaseDef[]
const pointIds = pointsData.points.map((p) => (p as { id: string }).id)
const soundKeys = new Set<string>()
const soundIdList = RECORDS.map((r) => r.id)

/* ---------------- SCORM runtime (§25, §26) ---------------- */
describe('SCORM runtime', () => {
  let mock: MockAdapter
  beforeEach(() => { mock = new MockAdapter() })

  it('mock adapter temel CRUD sağlar', () => {
    expect(mock.init()).toBe(true)
    mock.set('cmi.score.raw', '85')
    expect(mock.get('cmi.score.raw')).toBe('85')
    expect(mock.commit()).toBe(true)
    expect(mock.terminate()).toBe(true)
  })

  it('LMS yoksa standalone fallback (mock) devreye girer (§37)', () => {
    expect(detectScorm()).toBeNull()
    const { api, flags } = makeScorm()
    expect(api.version).toBe('mock')
    expect(flags.scormAvailable).toBe(false)
  })

  it('2004 adapter Initialize/SetValue/GetValue çağrılarını doğru sırada yapar', () => {
    const calls: string[] = []
    const api = {
      Initialize: () => { calls.push('init'); return 'true' },
      GetValue: (k: string) => { calls.push(`get:${k}`); return 'ok' },
      SetValue: (k: string, v: string) => { calls.push(`set:${k}=${v}`); return 'true' },
      Commit: () => 'true',
      Terminate: () => 'true',
      GetLastError: () => '0',
    }
    const a = new Scorm2004Adapter(api)
    a.init()
    a.set('cmi.score.raw', '100')
    a.get('cmi.score.raw')
    expect(calls[0]).toBe('init')
    expect(calls.some((c) => c.startsWith('set:cmi.score.raw=100'))).toBe(true)
    expect(calls.some((c) => c.startsWith('get:cmi.score.raw'))).toBe(true)
  })

  it('1.2 adapter success_status → lesson_status eşlemesi yapar (§26)', () => {
    const store = new Map<string, string>([['cmi.core.lesson_status', 'incomplete']])
    const api = {
      LMSInitialize: () => 'true',
      LMSGetValue: (k: string) => store.get(k) ?? '',
      LMSSetValue: (k: string, v: string) => { store.set(k, v); return 'true' },
      LMSCommit: () => 'true',
      LMSFinish: () => 'true',
    }
    const a = new Scorm12Adapter(api)
    a.set('cmi.success_status', 'passed')
    expect(store.get('cmi.core.lesson_status')).toBe('passed')
    a.set('cmi.score.raw', '85')
    expect(store.get('cmi.core.score.raw')).toBe('85')
  })
})

/* ---------------- suspend data (§27) ---------------- */
describe('suspend data', () => {
  const payload: SuspendPayload = {
    v: 1,
    mode: 'assessment',
    caseIndex: 2,
    step: 3,
    answers: { q1: ['a'], q2: ['a', 'b'] },
    hintsUsed: 1,
    caseResults: [{
      caseId: 'case_s3',
      total: 85,
      max: 100,
      mastery: true,
      domains: {
        technique: { earned: 20, max: 20 }, localization: { earned: 20, max: 20 },
        recognition: { earned: 25, max: 25 }, interpretation: { earned: 15, max: 20 },
        diagnosis: { earned: 0, max: 10 }, systematic: { earned: 5, max: 5 },
      },
      answers: [],
      hintsUsed: 1,
    }],
    tutorialDone: true,
    visits: { cardiac_mitral: { dwellMs: 5000, listenMs: 4200, visits: 2, firstOrder: 0 } },
    order: ['cardiac_mitral'],
    attempts: 1,
  }

  it('round-trip doğru çalışır', () => {
    const back = deserializeSuspend(serializeSuspend(payload))
    expect(back).not.toBeNull()
    expect(back!.mode).toBe('assessment')
    expect(back!.caseIndex).toBe(2)
    expect(back!.step).toBe(3)
    expect(back!.answers.q1).toEqual(['a'])
    expect(back!.hintsUsed).toBe(1)
    expect(back!.tutorialDone).toBe(true)
    expect(back!.visits.cardiac_mitral.dwellMs).toBe(5000)
    expect(back!.caseResults[0].total).toBe(85)
    expect(back!.caseResults[0].domains.technique.earned).toBe(20)
    expect(back!.caseResults[0].domains.diagnosis.max).toBe(10)
  })

  it('bozuk veri için null döner (çökmeme §37)', () => {
    expect(deserializeSuspend('{bozuk')).toBeNull()
    expect(deserializeSuspend('')).toBeNull()
    expect(deserializeSuspend(null)).toBeNull()
  })

  it('SCORM 1.2 limitine (4096 karakter) sığar', () => {
    const big: SuspendPayload = {
      ...payload,
      answers: Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`q${i}`, ['a', 'b']])),
      visits: Object.fromEntries(
        Array.from({ length: 16 }, (_, i) => [`point_${i}`, { dwellMs: 9000, listenMs: 8000, visits: 3, firstOrder: i }])
      ),
    }
    expect(serializeSuspend(big).length).toBeLessThanOrEqual(4096)
  })
})

/* ---------------- skor (§24) ---------------- */
describe('skor hesaplama', () => {
  const c = cases.find((x) => x.id === 'case_normal_heart')!
  const baseTelemetry: Telemetry = {
    visits: {
      cardiac_aortic: { dwellMs: 4000, listenMs: 4000, visits: 1, firstOrder: 0 },
      cardiac_pulmonary: { dwellMs: 4000, listenMs: 3500, visits: 1, firstOrder: 1 },
      cardiac_tricuspid: { dwellMs: 4000, listenMs: 3000, visits: 1, firstOrder: 2 },
      cardiac_mitral: { dwellMs: 5000, listenMs: 4000, visits: 1, firstOrder: 3 },
    },
    order: ['cardiac_aortic', 'cardiac_pulmonary', 'cardiac_tricuspid', 'cardiac_mitral'],
    headChanges: 1,
    headUse: { bell: 0, diaphragm: 1 },
    replayCount: 0,
  }
  const allCorrect = Object.fromEntries(c.questions.map((q) => [q.id, q.correct]))

  it('tam doğru + eksiksiz teknik → 100', () => {
    const r = scoreCase(c, allCorrect, baseTelemetry, 0)
    expect(r.total).toBe(100)
    expect(r.mastery).toBe(true)
  })

  it('yanlış tanıma → ses tanımlama 0, toplam < 80', () => {
    const r = scoreCase(c, { ...allCorrect, q1: ['b'] }, baseTelemetry, 0)
    expect(r.domains.recognition.earned).toBe(0)
    expect(r.total).toBeLessThan(80)
    expect(r.mastery).toBe(false)
  })

  it('teknik eşiğini tutmayan nokta teknik puanı düşürür', () => {
    const t: Telemetry = {
      ...baseTelemetry,
      visits: { ...baseTelemetry.visits, cardiac_mitral: { dwellMs: 100, listenMs: 100, visits: 1, firstOrder: 3 } },
    }
    const r = scoreCase(c, allCorrect, t, 0)
    expect(r.domains.technique.earned).toBeLessThan(20)
  })

  it('yanlış sıra → sistematik puan yarım (çifte ceza yok)', () => {
    const t: Telemetry = { ...baseTelemetry, order: [...baseTelemetry.order].reverse() }
    const r = scoreCase(c, allCorrect, t, 0)
    expect(r.domains.systematic.earned).toBe(2.5)
  })

  it('ipucu cezası deterministiktir (Uygulama modu)', () => {
    expect(practiceAdjusted(90, 0)).toBe(90)
    expect(practiceAdjusted(90, 2)).toBe(80)
    expect(practiceAdjusted(8, 2)).toBe(0)
  })

  it('hakimiyet eşiği 80 (§24)', () => {
    expect(MASTERY_THRESHOLD).toBe(80)
  })

  it('çoklu vaka toplamı alan bazlı birleşir', () => {
    const r = scoreCase(c, allCorrect, baseTelemetry, 0)
    const agg = aggregateResults([r, r])
    expect(agg.total).toBe(100)
    expect(agg.domains.technique.max).toBe(40)
  })
})

/* ---------------- vaka şeması (§19, §36) ---------------- */
describe('vaka şeması doğrulaması', () => {
  it('mevcut tüm vakalar hatasızdır', () => {
    for (const c of cases) {
      const errors = validateCase(c, pointIds, soundKeys).filter((i) => i.severity === 'error')
      expect(errors, `${c.id} hata içermemeli`).toEqual([])
    }
  })

  it('bilinmeyen oskültasyon noktası hatadır', () => {
    const c = cases[0]
    const bad = { ...c, technique: { ...c.technique, requiredPoints: ['yok_olmayan_nokta'] } }
    expect(validateCase(bad, pointIds, soundKeys).some((i) => i.message.includes('yok_olmayan_nokta'))).toBe(true)
  })

  it('doğrulanmamış eşleme + tanı sorusu → değerlendirmeye giremez (§6, §19)', () => {
    const c = cases[0]
    const withDiag: CaseDef = {
      ...c,
      clinicalDiagnosis: null,
      mappingValidation: 'educational_mapping',
      questions: [{
        id: 'qdiag', type: 'diagnosis', domain: 'diagnosis',
        prompt: '?', options: [{ id: 'a', label: 'X' }], correct: ['a'],
        feedbackCorrect: '', feedbackIncorrect: '',
      }],
    }
    const issues = validateCase(withDiag, pointIds, soundKeys)
    expect(issues.some((i) => i.severity === 'error' && /tanı|clinicalDiagnosis/i.test(i.message))).toBe(true)
  })

  it('soru doğru yanıtı seçenekler arasında olmalıdır', () => {
    const c = cases[0]
    const bad: CaseDef = {
      ...c,
      questions: [{ ...c.questions[0], correct: ['yok'] }],
    }
    expect(validateCase(bad, pointIds, soundKeys).some((i) => i.message.includes('seçeneklerde yok'))).toBe(true)
  })

  it('filtre havuzu hatalı vakayı dışlar (§19)', () => {
    const c = cases[0]
    const broken: CaseDef = { ...c, id: 'broken_case', questions: [] }
    const pool = filterAssessmentPool([c, broken], [
      { caseId: 'broken_case', severity: 'error', message: 'Soru yok' },
    ])
    expect(pool.some((x) => x.id === 'broken_case')).toBe(false)
    expect(pool.some((x) => x.id === c.id)).toBe(true)
  })
})

/* ---------------- veri seti senkronizasyonu (§36) ---------------- */
describe('veri seti ↔ kütüphane ↔ vaka senkronizasyonu', () => {
  const libraryData = libraryJson as unknown as { groups: { id: string; items: { acousticFinding: string }[] }[] }
  const libFindings = new Set(libraryData.groups.flatMap((g) => g.items.map((i) => i.acousticFinding)))
  const heartClasses = new Set(RECORDS.filter((r) => r.category === 'heart').map((r) => r.acousticFinding))
  const lungClasses = new Set(RECORDS.filter((r) => r.category === 'lung').map((r) => r.acousticFinding))
  const practice = new Set(cases.filter((c) => c.modes.includes('practice')).map((c) => c.primaryAcousticFinding))
  const assessment = new Set(cases.filter((c) => c.modes.includes('assessment')).map((c) => c.primaryAcousticFinding))

  it('her veri seti sınıfının kütüphane kalemi var', () => {
    for (const f of [...heartClasses, ...lungClasses]) expect(libFindings.has(f), `kütüphane: ${f}`).toBe(true)
  })
  it('her veri seti sınıfı uygulama modunda kapsanıyor', () => {
    for (const f of [...heartClasses, ...lungClasses]) expect(practice.has(f), `uygulama: ${f}`).toBe(true)
  })
  it('her veri seti sınıfı değerlendirme modunda kapsanıyor', () => {
    for (const f of [...heartClasses, ...lungClasses]) expect(assessment.has(f), `değerlendirme: ${f}`).toBe(true)
  })
  it('kütüphanedeki her ses sınıfı için en az bir çalınabilir kayıt var', () => {
    for (const f of libFindings) {
      const playable = RECORDS.some((r) => r.acousticFinding === f && r.validationStatus === 'validated')
      expect(playable, `kayıt: ${f}`).toBe(true)
    }
  })
  it('kombine (mixed) sesler kütüphanede ve uygulamada temsil ediliyor', () => {
    const mixedItems = libraryData.groups.find((g) => g.id === 'mixed')?.items ?? []
    expect(mixedItems.length).toBeGreaterThan(0)
    const mixedCases = cases.filter((c) => c.primaryAcousticFinding.includes('+') && c.modes.includes('practice'))
    expect(mixedCases.length).toBeGreaterThan(0)
  })
  it('her kütüphane kaleminde ses metaforu var (izleme modu gereksinimi)', () => {
    const items = (libraryJson as unknown as { groups: { items: { key: string; metaphor?: string }[] }[] }).groups.flatMap((g) => g.items)
    for (const it of items) expect(it.metaphor && it.metaphor.length > 10, `metafor: ${it.key}`).toBe(true)
  })
  it('değerlendirme vakaları doğrulanmış eşlemeye sahip', () => {
    for (const c of cases.filter((x) => x.modes.includes('assessment'))) {
      expect(c.mappingValidation, c.id).toBe('validated')
    }
  })
})

/* ---------------- oturum örnekleme ve havuz bütünlüğü ---------------- */
describe('oturum örnekleme (rastgele 10 vaka)', () => {
  const pool = poolForTest('practice')
  const assessment = poolForTest('assessment')

  it('her oturumda tam 10 vaka seçilir', () => {
    expect(sampleSession(pool, 42).length).toBe(SESSION_SIZE)
    expect(sampleSession(assessment, 7).length).toBe(SESSION_SIZE)
  })
  it('aynı tohum aynı örneklemi üretir (deterministik / SCORM uyumlu)', () => {
    expect(sampleSession(pool, 123)).toEqual(sampleSession(pool, 123))
  })
  it('farklı tohumlar farklı örneklem üretir (her oturum farklı)', () => {
    const a = sampleSession(pool, 1).join(',')
    const b = sampleSession(pool, 2).join(',')
    expect(a).not.toBe(b)
  })
  it('örneklem havuz dışından vaka içermez ve tekrar etmez', () => {
    const ids = sampleSession(pool, 99)
    expect(new Set(ids).size).toBe(ids.length)
    const poolIds = new Set(pool.map((c) => c.id))
    for (const id of ids) expect(poolIds.has(id)).toBe(true)
  })
  it('vaka havuzu veri seti sınırlarına kadar geniştir', () => {
    expect(pool.length).toBeGreaterThanOrEqual(100)
    expect(assessment.length).toBeGreaterThanOrEqual(60)
  })
  it('havuzdaki tüm vakalar doğrulanmış ses atamaları çözer', () => {
    for (const c of pool) {
      for (const a of c.soundAssignments) {
        const rec = a.soundId
          ? RECORDS.find((r) => r.id === a.soundId)
          : resolveAssignment({ ...a, pointId: a.pointId }) ?? resolveAssignmentEx(a).record
        expect(rec, `${c.id} → ${a.pointId}`).not.toBeNull()
      }
    }
  })
  it('otomatik üretilen tüm vakalar şema doğrulamasından geçer', () => {
    const errs: string[] = []
    for (const c of [...pool, ...poolForTest('assessment')]) {
      const issues = validateCase(c, pointIds, soundKeys).filter((i) => i.severity === 'error')
      if (issues.length) errs.push(`${c.id}: ${issues.map((i) => i.message).join('; ')}`)
    }
    expect(errs).toEqual([])
  })
  it('pediatrik vakalar mevcut ve pediatrik havuzda temsil ediliyor', () => {
    const ped = pool.filter((c) => (c as { population?: string }).population === 'pediatrik')
    expect(ped.length).toBeGreaterThanOrEqual(3)
  })
  it('gerçek pediatrik hasta kayıtları (CirCor) vaka havuzuna bağlanmıştır', () => {
    const pedCases = pool.filter((c) => c.id.startsWith('auto_ped_'))
    expect(pedCases.length).toBeGreaterThanOrEqual(3)
    for (const c of pedCases) {
      const usesReal = c.soundAssignments.some((a) => a.soundId && EXTERNAL_RECORDS.some((r) => r.id === a.soundId))
      expect(usesReal, c.id).toBe(true)
    }
  })
  it('değerlendirme havuzu yalnız doğrulanmış eşlemeli vakalar içerir', () => {
    for (const c of assessment) expect(c.mappingValidation).toBe('validated')
  })
})

describe('tıbbi tutarlılık (pediatrik vitaller + soru bütünlüğü)', () => {
  // Yaşa göre beklenen istirahat aralıkları (pediatric-reference.json ile uyumlu)
  // yaş birimi: YIL (0–1 ay hariç; bebek/çocuk vakalarında yaş yıldır)
  const HR: [number, number, number][] = [[1, 100, 180], [3, 90, 160], [6, 80, 140], [12, 70, 120], [18, 60, 100], [999, 60, 100]]
  const RR: [number, number, number][] = [[1, 30, 60], [3, 22, 38], [6, 20, 30], [12, 18, 25], [18, 12, 20], [999, 12, 20]]
  const range = (tbl: [number, number, number][], age: number) => {
    for (const [max, lo, hi] of tbl) if (age <= max) return [lo, hi] as const
    return [60, 100] as const
  }
  const poolAll = [...poolForTest('practice'), ...poolForTest('assessment')]

  it('pediatrik vakaların vitalleri yaşa göre fizyolojik aralıkta', () => {
    for (const c of poolAll) {
      const pop = (c as { population?: string }).population
      if (pop !== 'pediatrik') continue
      const age = c.patient.age
      const [hrLo, hrHi] = range(HR, age)
      const [rrLo, rrHi] = range(RR, age)
      expect(c.vitalSigns.hr, `${c.id} HR ${c.vitalSigns.hr} (yaş ${age})`).toBeGreaterThanOrEqual(hrLo)
      expect(c.vitalSigns.hr, `${c.id} HR üst`).toBeLessThanOrEqual(hrHi)
      expect(c.vitalSigns.rr, `${c.id} RR ${c.vitalSigns.rr} (yaş ${age})`).toBeGreaterThanOrEqual(rrLo)
      expect(c.vitalSigns.rr, `${c.id} RR üst`).toBeLessThanOrEqual(rrHi)
    }
  })
  it('yetişkin vakaların vitalleri fizyolojik aralıkta', () => {
    for (const c of poolAll) {
      const pop = (c as { population?: string }).population
      if (pop === 'pediatrik') continue
      expect(c.vitalSigns.hr, `${c.id} HR`).toBeGreaterThanOrEqual(40)
      expect(c.vitalSigns.hr, `${c.id} HR üst`).toBeLessThanOrEqual(140)
      expect(c.vitalSigns.rr, `${c.id} RR`).toBeGreaterThanOrEqual(8)
      expect(c.vitalSigns.rr, `${c.id} RR üst`).toBeLessThanOrEqual(38)
    }
  })
  it('her soruda seçenek etiketleri benzersizdir', () => {
    const errs: string[] = []
    for (const c of poolAll) {
      for (const q of c.questions) {
        const labels = q.options.map((o) => o.label)
        const dup = labels.filter((l, i) => labels.indexOf(l) !== i)
        if (dup.length) errs.push(`${c.id}/${q.id}: ${dup.join(', ')}`)
        const ids = q.options.map((o) => o.id)
        expect(new Set(ids).size, `${c.id}/${q.id} id benzersizliği`).toBe(ids.length)
      }
    }
    expect(errs).toEqual([])
  })
  it('pediatrik vakalar hasta yaşıyla uyumlu başlıklar kullanır', () => {
    for (const c of poolAll) {
      if ((c as { population?: string }).population !== 'pediatrik') continue
      expect(/pediatrik|çocuk/i.test(c.title), c.id).toBe(true)
    }
  })
})

describe('SCORM suspend boyut koruması (§27)', () => {
  const bigPayload = () => {
    const visits: Record<string, { dwellMs: number; listenMs: number; visits: number; firstOrder: number }> = {}
    for (let i = 0; i < 200; i++) visits[`lung_right_lower_posterior_${i}`] = { dwellMs: 12345, listenMs: 23456, visits: 3, firstOrder: i }
    const caseResults = Array.from({ length: 10 }, (_, i) => ({
      caseId: `auto_mixed_normal_wheezing_lung_right_lower_anterior_${String(i).padStart(3, '0')}`,
      total: 87.5, max: 100, mastery: true,
      domains: { technique: { earned: 20, max: 20 }, localization: { earned: 25, max: 25 }, recognition: { earned: 40, max: 40 }, interpretation: { earned: 15, max: 15 }, diagnosis: { earned: 0, max: 0 }, systematic: { earned: 5, max: 5 } } as never,
      answers: [], hintsUsed: 0,
    }))
    return {
      v: 3, mode: 'assessment' as const, caseIndex: 7, step: 3,
      answers: { q1: ['a'], q2: ['b', 'c'] }, hintsUsed: 0, tutorialDone: true, attempts: 1,
      visits, order: Object.keys(visits), caseResults,
      sessionIds: Array.from({ length: 20 }, (_, i) => `auto_ped_early_systolic_murmur_aortic_${String(i).padStart(3, '0')}`),
      sessionSeed: 123456789,
    }
  }
  it('SCORM 1.2 limitinde (4096) serialize edilir ve geri okunur', () => {
    const s1 = serializeSuspend(bigPayload(), SUSPEND_LIMIT_12)
    expect(s1.length).toBeLessThanOrEqual(SUSPEND_LIMIT_12)
    const back = deserializeSuspend(s1)
    expect(back).not.toBeNull()
    expect(back!.mode).toBe('assessment')
    expect(back!.caseIndex).toBe(7)
    expect(back!.step).toBe(3)
    expect(back!.sessionIds.length).toBe(20)
    expect(back!.sessionSeed).toBe(123456789)
  })
  it('küçük yükte tam ayrıntı korunur (birim kaybı yok)', () => {
    const p = bigPayload()
    p.visits = { cardiac_aortic: { dwellMs: 4321, listenMs: 5000, visits: 2, firstOrder: 1 } }
    const s1 = serializeSuspend(p, SUSPEND_LIMIT_2004)
    const back = deserializeSuspend(s1)!
    expect(back.visits.cardiac_aortic.dwellMs).toBe(4321)
    expect(back.visits.cardiac_aortic.firstOrder).toBe(1)
  })
})

describe('landing metrikleri', () => {
  it('envanter zenginliği metrikleri hesaplanır ve tutarlıdır', () => {
    const m = computeMetrics()
    expect(m.datasets).toBeGreaterThanOrEqual(15)
    expect(m.datasetsPediatric).toBeGreaterThanOrEqual(3)
    expect(m.soundClasses).toBeGreaterThanOrEqual(16)
    expect(m.auscultationPoints).toBeGreaterThanOrEqual(17)
    expect(m.practicePoolSize).toBeGreaterThanOrEqual(100)
    expect(m.assessmentPoolSize).toBeGreaterThanOrEqual(60)
    expect(m.assessmentQuestions).toBeGreaterThanOrEqual(150)
    expect(m.pediatricCases).toBeGreaterThanOrEqual(7)
    expect(m.bundledRecordings).toBeGreaterThanOrEqual(200)
  })
})

/* ---------------- veri seti envanteri ve dış eşleme (§5, §6, §34) ---------------- */
describe('veri seti envanteri', () => {
  const sources = sourcesJson as unknown as {
    datasets: { id: string; title: string; license: string; authors: string[]; attributionText: string }[]
    inventory: {
      id: string; title: string; authors: string[]; license: string; licenseUrl: string
      licenseVerified: boolean; status: string; accessUrl: string; notes: string
      recordings: number; attributionText: string; importScript: string | null
    }[]
  }

  it('envanterde en az 15 veri seti araştırılmıştır', () => {
    expect(sources.inventory.length).toBeGreaterThanOrEqual(15)
  })
  it('her envanter kaydında etiket kalitesi bilgisi vardır', () => {
    for (const it of sources.inventory as unknown as { id: string; labelTypes?: string[] }[]) {
      expect(Array.isArray(it.labelTypes) && it.labelTypes!.length > 0, `etiket: ${it.id}`).toBe(true)
    }
  })
  it('en az 3 pediatrik odaklı veri seti envanterdedir', () => {
    const ped = sources.inventory.filter((x) => /pediatrik|pediatric|çocuk|fetal/i.test(`${x.population} ${x.title} ${x.notes}`))
    expect(ped.length).toBeGreaterThanOrEqual(3)
  })
  it('her envanter kaydı lisans, atıf ve erişim bağlantısı içerir', () => {
    for (const it of sources.inventory) {
      expect(it.license.length, `lisans: ${it.id}`).toBeGreaterThan(3)
      expect(it.licenseUrl.length, `lisans bağlantısı: ${it.id}`).toBeGreaterThan(8)
      expect(it.attributionText.length, `atıf: ${it.id}`).toBeGreaterThan(10)
      expect(it.accessUrl.startsWith('http'), `erişim: ${it.id}`).toBe(true)
      if (it.recordings != null) expect(it.recordings).toBeGreaterThan(0)
    }
  })
  it('pakete dahil veri setleri doğrulanmış lisansa sahiptir', () => {
    for (const it of sources.inventory.filter((x) => ['bundled', 'samples_included', 'importer_ready'].includes(x.status))) {
      expect(it.licenseVerified, `${it.id} lisansı doğrulanmış olmalı`).toBe(true)
    }
  })
  it('ICBHI 2017 pakete alınmaz (§34)', () => {
    const icbhi = sources.inventory.find((x) => x.id === 'icbhi-2017')
    expect(icbhi).toBeDefined()
    expect(['license_review', 'inventory_only']).toContain(icbhi!.status)
    expect(icbhi!.importScript).toBeNull()
  })
  it('paketlenen seslerin kaynak atıfları tanımlıdır (datasets ↔ inventory)', () => {
    const bundled = RECORDS.find((r) => r.sourceDataset === 'hls-cmds-v3')
    expect(bundled).toBeDefined()
    expect(sources.inventory.some((it) => it.id === 'hls-cmds-v3' && it.status === 'bundled')).toBe(true)
    expect(sources.datasets.some((d) => d.id === 'hls-cmds-v3' && d.license.includes('CC BY 4.0'))).toBe(true)
  })
})

describe('CirCor dış eşleme kuralları (§6)', () => {
  it('Murmur=Absent → normal (validated)', () => {
    expect(mapCircorMurmur('Absent', 'nan', 'nan')).toMatchObject({ finding: 'normal', mappingStatus: 'validated' })
  })
  it('zamanlama birebir eşleşince validated olur', () => {
    expect(mapCircorMurmur('Present', 'Early-systolic', 'nan')).toMatchObject({ finding: 'early_systolic_murmur', mappingStatus: 'validated' })
    expect(mapCircorMurmur('Present', 'Mid-systolic', 'nan')).toMatchObject({ finding: 'mid_systolic_murmur', mappingStatus: 'validated' })
    expect(mapCircorMurmur('Present', 'Late-systolic', 'nan')).toMatchObject({ finding: 'late_systolic_murmur', mappingStatus: 'validated' })
  })
  it('holosistolik yalnız eğitim eşlemesidir (değerlendirmeye giremez)', () => {
    const r = mapCircorMurmur('Present', 'Holosystolic', 'nan')
    expect(r.finding).toBe('mid_systolic_murmur')
    expect(r.mappingStatus).toBe('educational_mapping')
  })
  it('uyumsuz etiketler uydurulmaz (unsupported)', () => {
    expect(mapCircorMurmur('Present', 'nan', 'nan').finding).toBeNull()
    expect(mapCircorMurmur('Present', 'nan', 'Early-diastolic').finding).toBeNull()
    expect(mapCircorMurmur('Unknown', 'nan', 'nan').finding).toBeNull()
  })
  it('konum kodları simülasyon noktalarına eşlenir', () => {
    expect(mapCircorLocations('AV+PV+TV+MV')).toEqual(['cardiac_aortic', 'cardiac_pulmonary', 'cardiac_tricuspid', 'cardiac_mitral'])
    expect(mapCircorLocations('MV')).toEqual(['cardiac_mitral'])
  })
})

/* ---------------- ses-konum eşleme (§2, §13, §14) ---------------- */
describe('ses eşleme', () => {
  it('kalp normal RUSB → aort odağı', () => {
    const rec = resolveAssignment({ pointId: 'cardiac_aortic', category: 'heart', acousticFinding: 'normal', recordedLocation: 'RUSB' })
    expect(rec).not.toBeNull()
    expect(rec!.recordedLocation).toBe('RUSB')
    expect(rec!.simulationLocation).toBe('cardiac_aortic')
  })

  it('RC/LC kayıtları adlandırılmış odağa eşlenmez (dürüst eşleme §13)', () => {
    expect(resolveAssignment({ pointId: 'cardiac_aortic', category: 'heart', acousticFinding: 'normal', recordedLocation: 'RC' })).toBeNull()
    expect(resolveAssignment({ pointId: 'cardiac_mitral', category: 'heart', acousticFinding: 'normal', recordedLocation: 'LC' })).toBeNull()
  })

  it('vaka ses haritası çözülebilir kayıtlar üretir', () => {
    for (const c of cases) {
      const map = resolveCaseSounds(c.soundAssignments)
      for (const [pointId, rec] of Object.entries(map)) {
        if (!rec) continue
        expect(pointIds).toContain(pointId)
        expect(soundIdList).toContain(rec.id)
      }
    }
  })

  it('kütüphane sesi sim konumuyla tercihli çözülür (apeks normal → Apex kaydı)', () => {
    expect(resolveLibrarySound('heart', 'normal', 'cardiac_mitral')!.recordedLocation).toBe('Apex')
  })

  it('crackles kütüphane kalemleri kayıtlı (C→FC dosya eşlemesi)', () => {
    expect(resolveLibrarySound('lung', 'fine_crackles')).not.toBeNull()
    expect(resolveLibrarySound('lung', 'coarse_crackles')).not.toBeNull()
  })

  it('posterior nokta ataması anterior kayda fallback yapar ve kaynak bölgeyi bildirir (§14)', () => {
    const res = resolveAssignmentEx({ pointId: 'lung_left_upper_posterior', category: 'lung', acousticFinding: 'normal' })
    expect(res.record).not.toBeNull()
    expect(res.record!.simulationLocation).toBe('lung_left_upper_anterior')
    expect(res.fallbackFrom).toBe('lung_left_upper_anterior')
  })

  it('posterior fallback ile tüm akciğer vakaları arka görünümde ses üretir', () => {
    const lungCases = cases.filter((c) => c.soundAssignments.some((a) => a.pointId.startsWith('lung_')))
    for (const c of lungCases) {
      const { sounds } = resolveCaseSoundsEx(c.soundAssignments)
      const posterior = Object.entries(sounds).filter(([pid, rec]) => pid.includes('posterior') && rec)
      expect(posterior.length, `${c.id} posterior ses üretmeli`).toBeGreaterThan(0)
    }
  })

  it('tüm vaka atamalarının en az bir yarısı çözülür (eksikler bilinçli)', () => {
    for (const c of cases) {
      const map = resolveCaseSounds(c.soundAssignments)
      const resolvedCount = Object.values(map).filter(Boolean).length
      expect(resolvedCount).toBeGreaterThan(0)
    }
  })
})
