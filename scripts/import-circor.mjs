#!/usr/bin/env node
/**
 * CirCor DigiScope (PhysioNet v1.0.3) içe aktarıcı — ODC-BY 1.0.
 *
 * Kullanım:
 *   node scripts/import-circor.mjs /yol/circor-heart-sound-1.0.3
 *   (dizin: training_data.csv + training_data/*.wav içermelidir)
 *
 * Çıktı:
 *   public/assets/audio/runtime/external/circor/*.wav  (RMS'e normalize edilir)
 *   src/data/sounds-external.json                       (kaynak etiketli kayıtlar)
 *   reports/external-import-report.txt                  (eşleme/dışlama raporu)
 *
 * Notlar:
 *  - Yalnız 'validated' veya 'educational_mapping' eşlemeleri kaydedilir;
 *    uymayan etiketler uydurulmaz, raporda listelenir (§6).
 *  - Kayıtlar birincil pakete OTOMATİK girmez; ana katalog HLS-CMDS'tir.
 *    Bu çıktı, ileride taksonomiyi genişletmek için hazır bir envanterdir.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mapCircorMurmur, mapCircorLocations, EXTERNAL_DATASETS } from './lib/external-mapping.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = process.argv[2]
if (!SRC) {
  console.log('Kullanım: node scripts/import-circor.mjs /yol/circor-heart-sound-1.0.3')
  console.log('İndirme: https://physionet.org/content/circor-heart-sound/1.0.3/ (449 MB, ODC-BY 1.0)')
  process.exit(0)
}
const csvPath = path.join(SRC, 'training_data.csv')
const wavDir = path.join(SRC, 'training_data')
if (!fs.existsSync(csvPath) || !fs.existsSync(wavDir)) {
  console.error('training_data.csv ve training_data/ bulunamadı.')
  process.exit(1)
}

const RUNTIME = path.join(ROOT, 'public', 'assets', 'audio', 'runtime', 'external', 'circor')
const OUT_JSON = path.join(ROOT, 'src', 'data', 'sounds-external.json')
fs.mkdirSync(RUNTIME, { recursive: true })

const TARGET_RMS = 0.1
const MAX_GAIN = 30
const PEAK_CEIL = 0.97

function readWav(buf) {
  if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') return null
  let off = 12
  let fmt = null
  let dataOff = -1
  let dataLen = 0
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4)
    const size = buf.readUInt32LE(off + 4)
    if (id === 'fmt ') {
      fmt = { channels: buf.readUInt16LE(off + 10), sampleRate: buf.readUInt32LE(off + 12), bitsPerSample: buf.readUInt16LE(off + 22) }
    } else if (id === 'data') {
      dataOff = off + 8
      dataLen = size
      break
    }
    off += 8 + size + (size % 2)
  }
  if (!fmt || dataOff < 0) return null
  const bytesPerSample = fmt.bitsPerSample / 8
  const frames = dataLen / (fmt.channels * bytesPerSample)
  let peak = 0
  let sumSq = 0
  for (let i = 0; i < frames * fmt.channels; i++) {
    const v = buf.readInt16LE(dataOff + i * bytesPerSample) / 32768
    const a = Math.abs(v)
    if (a > peak) peak = a
    sumSq += v * v
  }
  return { ...fmt, dataOff, dataLen, frames, peak, rms: Math.sqrt(sumSq / Math.max(1, frames * fmt.channels)), duration: frames / fmt.sampleRate }
}

function normalizeToWav(buf, info) {
  let gain = Math.min(TARGET_RMS / Math.max(info.rms, 1e-6), MAX_GAIN)
  if (info.peak * gain > PEAK_CEIL) gain = PEAK_CEIL / Math.max(info.peak, 1e-6)
  const bps = info.bitsPerSample / 8
  const out = Buffer.alloc(44 + info.dataLen)
  out.write('RIFF', 0, 'ascii')
  out.writeUInt32LE(36 + info.dataLen, 4)
  out.write('WAVE', 8, 'ascii')
  out.write('fmt ', 12, 'ascii')
  out.writeUInt32LE(16, 16)
  out.writeUInt16LE(1, 20)
  out.writeUInt16LE(info.channels, 22)
  out.writeUInt32LE(info.sampleRate, 24)
  out.writeUInt32LE(info.sampleRate * info.channels * bps, 28)
  out.writeUInt16LE(info.channels * bps, 32)
  out.writeUInt16LE(info.bitsPerSample, 34)
  out.write('data', 36, 'ascii')
  out.writeUInt32LE(info.dataLen, 40)
  for (let i = 0; i < info.frames * info.channels; i++) {
    let v = buf.readInt16LE(info.dataOff + i * bps) * gain
    if (v > 32767) v = 32767
    if (v < -32768) v = -32768
    out.writeInt16LE(Math.round(v), 44 + i * bps)
  }
  return { out, gain }
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  const header = lines[0].split(',').map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const cols = line.split(',')
    const row = {}
    header.forEach((h, i) => (row[h] = (cols[i] ?? '').trim()))
    return row
  })
}

const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'))
const records = []
const skipped = []
const counters = {}

for (const row of rows) {
  const patientId = row['Patient ID']
  const locations = mapCircorLocations(row['Recording locations:'])
  if (!locations.length) continue
  const mapping = mapCircorMurmur(row['Murmur'], row['Systolic murmur timing'], row['Diastolic murmur timing'])
  for (const loc of locations) {
    const code = Object.entries({ AV: 'cardiac_aortic', PV: 'cardiac_pulmonary', TV: 'cardiac_tricuspid', MV: 'cardiac_mitral' }).find(([, v]) => v === loc)?.[0]
    const file = `${patientId}_${code}.wav`
    const srcFile = path.join(wavDir, file)
    if (!fs.existsSync(srcFile)) continue
    if (!mapping.finding) {
      skipped.push(`${file}: ${mapping.note}`)
      continue
    }
    const raw = fs.readFileSync(srcFile)
    const info = readWav(raw)
    if (!info) {
      skipped.push(`${file}: WAV çözülemedi`)
      continue
    }
    const key = `circor_${mapping.finding}_${loc}`
    counters[key] = (counters[key] ?? 0) + 1
    const id = `${key}_${String(counters[key]).padStart(3, '0')}`
    const outName = `${id}.wav`
    const { out, gain } = normalizeToWav(raw, info)
    fs.writeFileSync(path.join(RUNTIME, outName), out)
    records.push({
      id,
      category: 'heart',
      acousticFinding: mapping.finding,
      mappingStatus: mapping.mappingStatus,
      mappingNote: mapping.note,
      sourceDataset: 'physionet-circor',
      sourceFile: `training_data/${file}`,
      /** dahili kaynak kimliği — öğrenen arayüzünde GÖSTERİLMEZ (§48) */
      internalSourceId: `circor-patient-${patientId}`,
      durationSec: Number(info.duration.toFixed(2)),
      sampleRate: info.sampleRate,
      channels: info.channels,
      gainApplied: Number(gain.toFixed(3)),
      recordedLocation: code,
      simulationLocation: loc,
      nativeFilter: 'unspecified',
      runtimeUrl: `assets/audio/runtime/external/circor/${outName}`,
      validationStatus: 'validated',
      issues: [],
    })
  }
}

const manifest = {
  generatedAt: new Date().toISOString(),
  dataset: EXTERNAL_DATASETS['physionet-circor'],
  count: records.length,
  records,
}
fs.writeFileSync(OUT_JSON, JSON.stringify(manifest, null, 2))
fs.mkdirSync(path.join(ROOT, 'reports'), { recursive: true })
fs.writeFileSync(
  path.join(ROOT, 'reports', 'external-import-report.txt'),
  [
    `CirCor DigiScope içe aktarma — ${new Date().toISOString()}`,
    `Kaynak dizin: ${SRC}`,
    `Aktarılan kayıt: ${records.length}`,
    `Eşleme dağılımı:`,
    ...Object.entries(counters).map(([k, v]) => `  ${k}: ${v}`),
    `Dışlanan (uydurulmadı): ${skipped.length}`,
    ...skipped.slice(0, 50).map((s) => `  - ${s}`),
  ].join('\n')
)

console.log(`CirCor: ${records.length} kayıt aktarıldı → ${OUT_JSON}`)
console.log('Eşleme dağılımı:', counters)
console.log(`Dışlanan (uyumsuz etiket): ${skipped.length} (rapor: reports/external-import-report.txt)`)
console.log('Not: bu kayıtlar birincil pakete girmez; envanter olarak hazırdır.')
