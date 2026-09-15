#!/usr/bin/env node
/**
 * Ses/varlık doğrulama scripti (§39).
 * Kontrol eder:
 *  - sounds.json kayıtları → runtime dosyası mevcut ve WAV başlığı çözülebilir, süre > 0
 *  - kaynak atıf mevcut (sources.json)
 *  - kategori + anatomik konum geçerli
 *  - değerlendirme vakaları yalnız doğrulanmış eşlemeler kullanır; atıfta bulunan tüm sesler çözülebilir
 * Fatal hatalarda çıkış kodu 1 (build'i keser).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = path.join(ROOT, 'src', 'data', 'sounds.json')
const casesFile = path.join(ROOT, 'src', 'data', 'cases.json')
const pointsFile = path.join(ROOT, 'src', 'data', 'auscultation-points.json')
const sourcesFile = path.join(ROOT, 'src', 'data', 'sources.json')
const report = []

const fatal = []
const warn = []
let ok = 0
let missing = 0

if (!fs.existsSync(manifestPath)) {
  console.error('sounds.json yok — önce `npm run import:hls-cmds` çalıştırın.')
  process.exit(1)
}
const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const sources = JSON.parse(fs.readFileSync(sourcesFile, 'utf8'))
const points = JSON.parse(fs.readFileSync(pointsFile, 'utf8'))
const cases = JSON.parse(fs.readFileSync(casesFile, 'utf8'))

const VALID_CATEGORY = new Set(['heart', 'lung', 'mixed'])
const VALID_HEART = new Set(['normal', 'late_diastolic_murmur', 'mid_systolic_murmur', 'late_systolic_murmur', 'atrial_fibrillation', 's4', 'early_systolic_murmur', 's3', 'tachycardia', 'av_block'])
const VALID_LUNG = new Set(['normal', 'wheezing', 'fine_crackles', 'rhonchi', 'pleural_rub', 'coarse_crackles'])
const HEART_SIM = new Set(['cardiac_aortic', 'cardiac_pulmonary', 'cardiac_tricuspid', 'cardiac_mitral'])
const LUNG_SIM = new Set(points.points.filter((p) => p.id.startsWith('lung_')).map((p) => p.id))

function checkWav(buf) {
  if (buf.length < 44) return null
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') return null
  let off = 12
  let dataOff = -1
  let dataLen = 0
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4)
    const size = buf.readUInt32LE(off + 4)
    if (id === 'data') { dataOff = off + 8; dataLen = size; break }
    off += 8 + size + (size % 2)
  }
  if (dataOff < 0) return null
  const channels = buf.readUInt16LE(22)
  const rate = buf.readUInt32LE(24)
  const bits = buf.readUInt16LE(34)
  return { duration: dataLen / (channels * bits / 8) / rate, rate, bits, channels }
}

for (const r of m.records) {
  if (!VALID_CATEGORY.has(r.category)) { fatal.push(`${r.id}: geçersiz kategori ${r.category}`); continue }
  const validSet = r.category === 'heart' ? VALID_HEART : VALID_LUNG
  if (!validSet.has(r.acousticFinding) && !r.acousticFinding.includes('+')) {
    fatal.push(`${r.id}: geçersiz akustik bulgu ${r.acousticFinding}`)
    continue
  }
  if (!sources.datasets.some((d) => d.id === r.sourceDataset)) fatal.push(`${r.id}: kaynak atfı eksik (${r.sourceDataset})`)
  if (r.validationStatus === 'missing_asset') { missing++; continue }
  const f = path.join(ROOT, 'public', r.runtimeUrl)
  if (!fs.existsSync(f)) { fatal.push(`${r.id}: dosya yok ${r.runtimeUrl}`); continue }
  const wav = checkWav(fs.readFileSync(f))
  if (!wav) { fatal.push(`${r.id}: WAV başlığı çözülemiyor`); continue }
  if (wav.duration <= 0) fatal.push(`${r.id}: süre 0`)
  if (r.simulationLocation && r.category === 'heart' && !HEART_SIM.has(r.simulationLocation)) {
    fatal.push(`${r.id}: geçersiz simülasyon konumu ${r.simulationLocation}`)
  }
  if (r.simulationLocation && r.category === 'lung' && !LUNG_SIM.has(r.simulationLocation)) {
    fatal.push(`${r.id}: geçersiz simülasyon konumu ${r.simulationLocation}`)
  }
  ok++
}

// ---- vaka ↔ ses eşleşmesi (§19: değerlendirme havuzu doğrulama katmanı) ----
const soundIds = new Set(m.records.map((r) => r.id))
const pointIds = new Set(points.points.map((p) => p.id))
const severityPool = []
for (const c of cases.cases) {
  for (const a of c.soundAssignments) {
    if (a.soundId && !soundIds.has(a.soundId)) severityPool.push([`${c.id}: atıf sesId yok: ${a.soundId}`])
  }
  for (const p of c.technique?.requiredPoints ?? []) {
    if (!pointIds.has(p)) severityPool.push([`${c.id}: bilinmeyen nokta ${p}`])
  }
  const hasDiagnosisQ = (c.questions ?? []).some((q) => q.domain === 'diagnosis')
  if (hasDiagnosisQ && (c.mappingValidation !== 'validated' || !c.clinicalDiagnosis)) {
    severityPool.push([`${c.id}: tanı sorusu var ama doğrulanmış eşleme yok`])
  }
  if (c.mappingValidation === 'experimental' && c.modes.includes('assessment')) {
    severityPool.push([`${c.id}: deneysel vaka değerlendirmeye giremez`])
  }
}
for (const [msg] of severityPool) fatal.push(msg)

// ---- görsel varlıklar ----
for (const asset of [
  'public/assets/body/front.jpg',
  'public/assets/body/back.jpg',
  'public/brand/ausculta-mark.svg',
  'public/brand/ausculta-horizontal.svg',
  'public/brand/ausculta-horizontal-white.svg',
]) {
  if (!fs.existsSync(path.join(ROOT, asset))) fatal.push(`eksik varlık: ${asset}`)
}

console.log('=== Ausculta Ses Doğrulama Raporu ===')
console.log(`Doğrulanmış kayıt: ${ok}`)
console.log(`Eksik dosya (bilinçli): ${missing}`)
console.log(`Ölümcül hata: ${fatal.length}`)
console.log(`Uyarı: ${warn.length}`)
if (fatal.length) {
  console.log('--- HATALAR ---')
  for (const f of fatal.slice(0, 40)) console.log('  ✗', f)
  fs.mkdirSync(path.join(ROOT, 'reports'), { recursive: true })
  fs.writeFileSync(path.join(ROOT, 'reports', 'validation-report.txt'), ['FATAL', ...fatal].join('\n'))
  process.exit(1)
}
fs.mkdirSync(path.join(ROOT, 'reports'), { recursive: true })
fs.writeFileSync(
  path.join(ROOT, 'reports', 'validation-report.txt'),
  [`OK — validated:${ok} missing:${missing} warnings:${warn.length}`, ...warn].join('\n')
)
console.log('Doğrulama geçti.')
