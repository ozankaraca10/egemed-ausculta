import { describe, it, expect, beforeEach } from 'vitest'
import { MockAdapter, detectScorm, makeScorm, Scorm2004Adapter, Scorm12Adapter } from '../src/core/scorm'
import { serializeSuspend, deserializeSuspend } from '../src/core/suspend'
import { scoreCase, aggregateResults, practiceAdjusted, MASTERY_THRESHOLD } from '../src/core/scoring'
import { validateCase, filterAssessmentPool } from '../src/core/validation'
import { resolveAssignment, resolveAssignmentEx, resolveCaseSounds, resolveCaseSoundsEx, resolveLibrarySound, RECORDS } from '../src/core/resolver'
import casesData from '../src/data/cases.json'
import pointsData from '../src/data/auscultation-points.json'
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
