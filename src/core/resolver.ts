import type { SoundAssignment, SoundRecord, SoundsManifest } from './types'
import soundsManifest from '../data/sounds.json'

/** Kayıt çözümleyici (§2 konum-duyarlı ses, §14). Ses atamalarını deterministik olarak
 *  sounds.json kayıtlarına eşler. Varsayılan sıralama: kaynak konum eşleşmesi > cinsiyet "any" > id. */

export const manifest = soundsManifest as unknown as SoundsManifest
export const RECORDS: SoundRecord[] = manifest.records

const byId = new Map(RECORDS.map((r) => [r.id, r]))

export function getSound(id: string): SoundRecord | undefined {
  return byId.get(id)
}

export function resolveAssignment(a: SoundAssignment): SoundRecord | null {
  if (a.soundId) return byId.get(a.soundId) ?? null
  const matches = RECORDS.filter(
    (r) =>
      r.category === a.category &&
      r.acousticFinding === a.acousticFinding &&
      r.validationStatus === 'validated' &&
      // dürüst eşleme (§13): RC/LC gibi net olmayan kayıt konumları adlandırılmış
      // odak noktasına sunulmaz — sim konumu uyuşmalı ya da kayıt eşlemesiz olmalı
      (!a.pointId || r.simulationLocation === a.pointId) &&
      (!a.recordedLocation || r.recordedLocation === a.recordedLocation) &&
      (!a.gender || a.gender === 'any' || r.gender === a.gender)
  )
  // deterministik: dosya adına göre sabit sıralama
  matches.sort((x, y) => x.sourceFile.localeCompare(y.sourceFile))
  return matches[0] ?? null
}

/** Bir vaka için pointId → kayıt haritasını çözer. Eksikler `{pointId: null}`. */
export function resolveCaseSounds(assignments: SoundAssignment[]): Record<string, SoundRecord | null> {
  const out: Record<string, SoundRecord | null> = {}
  for (const a of assignments) out[a.pointId] = resolveAssignment(a)
  return out
}

/** Öğrenme kütüphanesi sesi: kategori + akustik bulgu + tercihen odak noktası konumu. */
export function resolveLibrarySound(category: string, finding: string, simLocation?: string): SoundRecord | null {
  let pool = RECORDS.filter(
    (r) => r.category === category && r.acousticFinding === finding && r.validationStatus === 'validated'
  )
  if (simLocation) {
    const loc = pool.filter((r) => r.simulationLocation === simLocation)
    if (loc.length) {
      loc.sort((x, y) => x.sourceFile.localeCompare(y.sourceFile))
      return loc[0]
    }
  }
  pool.sort((x, y) => x.sourceFile.localeCompare(y.sourceFile))
  return pool[0] ?? null
}

const POSTERIOR_TO_ANTERIOR: Record<string, string> = {
  lung_right_upper_posterior: 'lung_right_upper_anterior',
  lung_left_upper_posterior: 'lung_left_upper_anterior',
  lung_right_middle_posterior: 'lung_right_middle_anterior',
  lung_left_middle_posterior: 'lung_left_middle_anterior',
  lung_right_lower_posterior: 'lung_right_lower_anterior',
  lung_left_lower_posterior: 'lung_left_lower_anterior',
}

export interface LibrarySoundResult {
  record: SoundRecord | null
  /** Kayıt, istenen bölgede değil başka bir bölgeden alınmışsa kaynak bölge id'si */
  fallbackFrom?: string
}

/** Kütüphane sesi + dürüstlük bilgisi (§14): posterior bölge için kayıt yoksa,
 *  aynı bulgunun anterior kaydı 'fallback' olarak sunulur ve kaynak bölge bildirilir. */
export function resolveLibrarySoundEx(category: string, finding: string, simLocation?: string): LibrarySoundResult {
  const direct = resolveLibrarySound(category, finding, simLocation)
  if (direct && (!simLocation || direct.simulationLocation === simLocation)) {
    return { record: direct }
  }
  if (simLocation && POSTERIOR_TO_ANTERIOR[simLocation]) {
    const source = POSTERIOR_TO_ANTERIOR[simLocation]
    const rec = resolveLibrarySound(category, finding, source)
    if (rec) return { record: rec, fallbackFrom: source }
  }
  return { record: direct ?? null }
}

/** Sınıf başına mevcut (doğrulanmış) kayıt sayısı — UI "yok" gösterimi için. */
export function availableCount(category: string, finding: string): number {
  return RECORDS.filter(
    (r) => r.category === category && r.acousticFinding === finding && r.validationStatus === 'validated'
  ).length
}

/** Değerlendirme havuzu: yalnızca validated eşlemeli ve 'assessment' modlu vakalar (§19). */
export function assessmentPool(cases: { modes: string[]; mappingValidation: string; clinicalDiagnosis: unknown }[]) {
  return cases.filter(
    (c) => c.modes.includes('assessment') && c.mappingValidation === 'validated'
  )
}
