import type { CaseResult, SuspendPayload } from './types'

/** Suspend data serileştirme (§27). Kompakt; 1.2 limitine (≤4096 karakter) uygun. */

export function serializeSuspend(p: SuspendPayload): string {
  // örnek şeklini küçült
  const visits: [string, number, number, number, number][] = Object.entries(p.visits).map(
    ([k, v]) => [k, v.dwellMs, v.listenMs, v.visits, v.firstOrder]
  )
  const obj = {
    v: p.v,
    m: p.mode[0], // l | p | a
    c: p.caseIndex,
    s: p.step,
    a: p.answers,
    h: p.hintsUsed,
    t: p.tutorialDone ? 1 : 0,
    at: p.attempts,
    v2: visits,
    o: p.order,
    si: p.sessionIds,
    sd: p.sessionSeed,
    r: p.caseResults.map((r) => [
      r.caseId,
      Math.round(r.total),
      r.mastery ? 1 : 0,
      Object.entries(r.domains).map(([k, d]) => [k, Math.round(d.earned * 100) / 100, d.max]),
    ]),
  }
  return JSON.stringify(obj)
}

export function deserializeSuspend(raw: string | null | undefined): SuspendPayload | null {
  if (!raw) return null
  try {
    const o = JSON.parse(raw) as {
      v: number
      m: string
      c: number
      s: number
      a: Record<string, string[]>
      h: number
      t: number
      at: number
      v2: [string, number, number, number, number][]
      o: string[]
      si?: string[]
      sd?: number
      r: [string, number, number, [string, number, number][]][]
    }
    const modes: Record<string, SuspendPayload['mode']> = { l: 'learn', p: 'practice', a: 'assessment' }
    const visits: SuspendPayload['visits'] = {}
    for (const [k, dwell, listen, n, first] of o.v2 ?? []) {
      visits[k] = { dwellMs: dwell, listenMs: listen, visits: n, firstOrder: first }
    }
    return {
      v: o.v,
      mode: modes[o.m] ?? 'practice',
      caseIndex: o.c ?? 0,
      step: o.s ?? 0,
      answers: o.a ?? {},
      hintsUsed: o.h ?? 0,
      caseResults: (o.r ?? []).map(([caseId, total, m, doms]) => {
        const domains: CaseResult['domains'] = {} as CaseResult['domains']
        for (const [k, earned, max] of doms ?? []) {
          ;(domains as Record<string, { earned: number; max: number }>)[k] = { earned, max }
        }
        return {
          caseId,
          total,
          max: 100,
          mastery: m === 1,
          domains,
          answers: [],
          hintsUsed: 0,
        }
      }),
      tutorialDone: o.t === 1,
      visits,
      order: o.o ?? [],
      attempts: o.at ?? 0,
      sessionIds: o.si ?? [],
      sessionSeed: o.sd ?? 0,
    }
  } catch {
    return null
  }
}
