#!/usr/bin/env node
/**
 * HLS-CMDS v3 importer.
 *
 * Source: HLS-CMDS: Heart and Lung Sounds Dataset Recorded from a Clinical Manikin
 * using Digital Stethoscope — DOI 10.17632/8972jxbpmp.3, CC BY 4.0.
 * Authors: Yasaman Torabi, Shahram Shirani, James P. Reilly.
 *
 * Usage:
 *   node scripts/import-hls-cmds.mjs /path/to/hls-cmds   (dir containing HS.csv,LS.csv,Mix.csv,HS.zip,LS.zip,Mix.zip)
 *
 * The importer:
 *  - parses HS.csv / LS.csv / Mix.csv metadata,
 *  - unzips WAV archives into public/assets/audio/runtime/{heart,lung,mixed}/,
 *  - verifies WAV headers + duration + clipping,
 *  - generates src/data/sounds.json with stable internal IDs.
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC_DIR = process.argv[2] || '/tmp/egemed-ausculta/hls-cmds'
const RUNTIME = path.join(ROOT, 'public', 'assets', 'audio', 'runtime')
const OUT_JSON = path.join(ROOT, 'src', 'data', 'sounds.json')
const DATASET_ID = 'hls-cmds-v3'

const HEART_TYPES = {
  Normal: 'normal',
  'Late Diastolic Murmur': 'late_diastolic_murmur',
  'Mid Systolic Murmur': 'mid_systolic_murmur',
  'Late Systolic Murmur': 'late_systolic_murmur',
  'Atrial Fibrillation': 'atrial_fibrillation',
  S4: 's4',
  'Early Systolic Murmur': 'early_systolic_murmur',
  S3: 's3',
  Tachycardia: 'tachycardia',
  'AV Block': 'av_block',
}
const LUNG_TYPES = {
  Normal: 'normal',
  Wheezing: 'wheezing',
  'Fine Crackles': 'fine_crackles',
  Rhonchi: 'rhonchi',
  'Pleural Rub': 'pleural_rub',
  'Coarse Crackles': 'coarse_crackles',
}

function parseCsv(file) {
  const text = fs.readFileSync(path.join(SRC_DIR, file), 'utf8')
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  const header = lines[0].split(',').map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const cols = line.split(',').map((c) => c.trim())
    const row = {}
    header.forEach((h, i) => (row[h] = cols[i]))
    return row
  })
}

function readWavInfo(buf) {
  if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE')
    return null
  let off = 12
  let fmt = null
  let dataOff = -1
  let dataLen = 0
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4)
    const size = buf.readUInt32LE(off + 4)
    if (id === 'fmt ') {
      fmt = {
        audioFormat: buf.readUInt16LE(off + 8),
        channels: buf.readUInt16LE(off + 10),
        sampleRate: buf.readUInt32LE(off + 12),
        bitsPerSample: buf.readUInt16LE(off + 22),
      }
    } else if (id === 'data') {
      dataOff = off + 8
      dataLen = size
    }
    off += 8 + size + (size % 2)
  }
  if (!fmt || dataOff < 0) return null
  const bytesPerSample = fmt.bitsPerSample / 8
  const frameCount = dataLen / (fmt.channels * bytesPerSample)
  const duration = frameCount / fmt.sampleRate
  let peak = 0
  let sumSq = 0
  for (let i = 0; i < frameCount; i++) {
    const s = buf.readInt16LE(dataOff + i * fmt.channels * bytesPerSample) / 32768
    const a = Math.abs(s)
    if (a > peak) peak = a
    sumSq += s * s
  }
  return {
    ...fmt,
    duration,
    frameCount,
    peak,
    rms: Math.sqrt(sumSq / Math.max(1, frameCount)),
    dataOff,
    dataLen,
  }
}

/** Kayıtları ortak hedef RMS'e yükseltir (ses düzeyi dengelemesi).
 *  Kazanç üst sınırı ve tepe (peak) tavanı ile kırpılma engellenir.
 *  Ustalar (master) arşivde değişmez; yalnız runtime kopyası normalize edilir. */
const TARGET_RMS = 0.1 // ≈ -20 dBFS
const MAX_GAIN = 30
const PEAK_CEIL = 0.97

function normalizeToWav(buf, info) {
  let gain = Math.min(TARGET_RMS / Math.max(info.rms, 1e-6), MAX_GAIN)
  if (info.peak * gain > PEAK_CEIL) gain = PEAK_CEIL / Math.max(info.peak, 1e-6)
  const bytesPerSample = info.bitsPerSample / 8
  const frames = info.dataLen / (info.channels * bytesPerSample)
  const out = Buffer.alloc(44 + info.dataLen)
  out.write('RIFF', 0, 'ascii')
  out.writeUInt32LE(36 + info.dataLen, 4)
  out.write('WAVE', 8, 'ascii')
  out.write('fmt ', 12, 'ascii')
  out.writeUInt32LE(16, 16)
  out.writeUInt16LE(1, 20) // PCM
  out.writeUInt16LE(info.channels, 22)
  out.writeUInt32LE(info.sampleRate, 24)
  out.writeUInt32LE(info.sampleRate * info.channels * bytesPerSample, 28)
  out.writeUInt16LE(info.channels * bytesPerSample, 32)
  out.writeUInt16LE(info.bitsPerSample, 34)
  out.write('data', 36, 'ascii')
  out.writeUInt32LE(info.dataLen, 40)
  let peakAfter = 0
  let sumSq = 0
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < info.channels; c++) {
      const off = info.dataOff + (i * info.channels + c) * bytesPerSample
      let v = buf.readInt16LE(off) * gain
      if (v > 32767) v = 32767
      if (v < -32768) v = -32768
      out.writeInt16LE(Math.round(v), 44 + (i * info.channels + c) * bytesPerSample)
    }
    const a = Math.abs(buf.readInt16LE(info.dataOff + i * info.channels * bytesPerSample) * gain) / 32768
    if (a > peakAfter) peakAfter = a
    const sv = buf.readInt16LE(info.dataOff + i * info.channels * bytesPerSample) * gain / 32768
    sumSq += sv * sv
  }
  return { out, gain, peakAfter, rmsAfter: Math.sqrt(sumSq / Math.max(1, frames)) }
}

function unzip(zip, dest) {
  fs.rmSync(dest, { recursive: true, force: true })
  fs.mkdirSync(dest, { recursive: true })
  execFileSync('unzip', ['-o', '-q', zip, '-d', dest])
  // prune macOS junk and flatten the single top-level folder the archives contain
  const junk = path.join(dest, '__MACOSX')
  if (fs.existsSync(junk)) fs.rmSync(junk, { recursive: true, force: true })
  const entries = fs.readdirSync(dest).filter((e) => !e.startsWith('.'))
  if (entries.length === 1 && fs.statSync(path.join(dest, entries[0])).isDirectory()) {
    const inner = path.join(dest, entries[0])
    for (const f of fs.readdirSync(inner)) fs.renameSync(path.join(inner, f), path.join(dest, f))
    fs.rmSync(inner, { recursive: true, force: true })
  }
}

function writeRuntime(srcDir, category, filename, info, buf) {
  const dest = path.join(RUNTIME, category)
  fs.mkdirSync(dest, { recursive: true })
  const lower = `${slug(filename.replace(/\.wav$/i, ''))}.wav`
  const { out, gain, rmsAfter, peakAfter } = normalizeToWav(buf, info)
  fs.writeFileSync(path.join(dest, lower), out)
  return { gain, rmsAfter, peakAfter }
}



function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

const HEART_LOC_MAP = {
  RUSB: 'cardiac_aortic',
  LUSB: 'cardiac_pulmonary',
  LLSB: 'cardiac_tricuspid',
  Apex: 'cardiac_mitral',
  RC: null, // "right chest" — no exact educational landmark; not presented as a named focus
  LC: null, // "left chest" — ditto
}
const LUNG_LOC_MAP = {
  RUA: 'lung_right_upper_anterior',
  LUA: 'lung_left_upper_anterior',
  RMA: 'lung_right_middle_anterior',
  LMA: 'lung_left_middle_anterior',
  RLA: 'lung_right_lower_anterior',
  LLA: 'lung_left_lower_anterior',
}

// ---- unzip ----
const hsDir = path.join(SRC_DIR, '_unzip_hs')
const lsDir = path.join(SRC_DIR, '_unzip_ls')
const mixDir = path.join(SRC_DIR, '_unzip_mix')
unzip(path.join(SRC_DIR, 'HS.zip'), hsDir)
unzip(path.join(SRC_DIR, 'LS.zip'), lsDir)
unzip(path.join(SRC_DIR, 'Mix.zip'), mixDir)

const records = []
const warnings = []
const counters = {}

function pushRecord(r) {
  const key = `${r.category}_${r.acousticFinding}_${slug(r.anatomicalLocation)}`
  counters[key] = (counters[key] || 0) + 1
  r.id = `${key}_${String(counters[key]).padStart(3, '0')}`
  records.push(r)
}

function buildBase({ category, sourceFile, wav }) {
  const fatal = []
  if (!wav) fatal.push(`unparseable WAV header: ${sourceFile}`)
  else {
    if (wav.duration <= 0) fatal.push(`duration <= 0: ${sourceFile}`)
    if (wav.peak > 0.9999) warnings.push(`possible clipping (peak=${wav.peak.toFixed(3)}): ${sourceFile}`)
  }
  return {
    id: '',
    category,
    acousticFinding: '',
    sourceDataset: DATASET_ID,
    sourceFile: `hls-cmds/${sourceFile}`,
    durationSec: wav ? Number(wav.duration.toFixed(2)) : 0,
    sampleRate: wav?.sampleRate ?? 0,
    channels: wav?.channels ?? 1,
    peak: wav ? Number(wav.peak.toFixed(4)) : 0,
    rms: wav ? Number(wav.rms.toFixed(5)) : 0,
    anatomicalLocation: '',
    recordedLocation: '',
    simulationLocation: null,
    nativeFilter: 'digital_filtered',
    gender: '',
    runtimeUrl: '',
    validationStatus: 'validated', // dataset class authenticity; disease mapping validation is separate
    gainApplied: 0,
    rmsNormalized: 0,
    peakNormalized: 0,
    issues: fatal,
  }
}

// ---- HS.csv (50 standalone heart recordings) ----
for (const row of parseCsv('HS.csv')) {
  const finding = HEART_TYPES[row['Heart Sound Type']]
  if (!finding) throw new Error(`Unknown heart sound type: ${row['Heart Sound Type']}`)
  const loc = row['Location']
  const file = `${row['Heart Sound ID']}.wav`
  const rawBuf = fs.readFileSync(path.join(hsDir, file))
  const wav = readWavInfo(rawBuf)
  const wavInfo = wav
  const r = buildBase({ category: 'heart', sourceFile: `HS/${file}`, wav })
  r.acousticFinding = finding
  r.recordedLocation = loc
  r.anatomicalLocation = loc
  r.simulationLocation = HEART_LOC_MAP[loc] ?? null
  r.gender = row.Gender
  r.runtimeUrl = `assets/audio/runtime/heart/${slug(file.replace(/\.wav$/i, ''))}.wav`
  const norm = writeRuntime(hsDir, 'heart', file, wavInfo, fs.readFileSync(path.join(hsDir, file)))
  r.gainApplied = Number(norm.gain.toFixed(3))
  r.rmsNormalized = Number(norm.rmsAfter.toFixed(4))
  r.peakNormalized = Number(norm.peakAfter.toFixed(4))
  pushRecord(r)
}

// ---- LS.csv (50 standalone lung recordings; CSV crackles codes C/G map to files FC/CC) ----
const LS_CODE_ALIAS = { C: 'FC', G: 'CC' }
for (const row of parseCsv('LS.csv')) {
  const finding = LUNG_TYPES[row['Lung Sound Type']]
  if (!finding) throw new Error(`Unknown lung sound type: ${row['Lung Sound Type']}`)
  const loc = row['Location']
  const rawId = row['Lung Sound ID'].trim()
  // CSV'de ince raller "C", kaba raller "G" kodlanmış; dosya adlarında FC/CC kullanılmış
  const aliasId = rawId.replace(/^(.)_(C|G)_/, (_m, g1, code) => `${g1}_${LS_CODE_ALIAS[code]}_`)
  const candidates = [`${rawId}.wav`, `${aliasId}.wav`]
  const existing = candidates.find((c) => fs.existsSync(path.join(lsDir, c)))
  if (!existing) {
    // Arşivde gerçekten olmayan kayıtlar raporlanır, sessizce düşürülmez.
    const r = buildBase({ category: 'lung', sourceFile: `LS/${rawId}.wav`, wav: null })
    r.acousticFinding = finding
    r.recordedLocation = loc
    r.anatomicalLocation = loc
    r.simulationLocation = LUNG_LOC_MAP[loc] ?? null
    r.gender = row.Gender
    r.runtimeUrl = `assets/audio/runtime/lung/${slug(rawId)}.wav`
    r.validationStatus = 'missing_asset'
    r.issues = ['WAV, LS.zip arşivinde bulunamadı (veri seti v3 eksikliği)']
    pushRecord(r)
    warnings.push(`missing lung wav: ${rawId}.wav`)
    continue
  }
  const file = existing
  const wav = readWavInfo(fs.readFileSync(path.join(lsDir, file)))
  const r = buildBase({ category: 'lung', sourceFile: `LS/${file}`, wav })
  r.acousticFinding = finding
  r.recordedLocation = loc
  r.anatomicalLocation = loc
  r.simulationLocation = LUNG_LOC_MAP[loc] ?? null
  r.gender = row.Gender
  r.runtimeUrl = `assets/audio/runtime/lung/${slug(file.replace(/\.wav$/i, ''))}.wav`
  const norm = writeRuntime(lsDir, 'lung', file, wav, fs.readFileSync(path.join(lsDir, file)))
  r.gainApplied = Number(norm.gain.toFixed(3))
  r.rmsNormalized = Number(norm.rmsAfter.toFixed(4))
  r.peakNormalized = Number(norm.peakAfter.toFixed(4))
  pushRecord(r)
}

// ---- Mix.csv (435 mixed cardiopulmonary recordings) ----
for (const row of parseCsv('Mix.csv')) {
  const hFinding = HEART_TYPES[row['Heart Sound Type']]
  const lFinding = LUNG_TYPES[row['Lung Sound Type']]
  if (!hFinding || !lFinding) throw new Error(`Unknown mixed sound types: ${JSON.stringify(row)}`)
  const loc = row['Location']
  const file = `${row['Mixed Sound ID']}.wav`
  const wav = readWavInfo(fs.readFileSync(path.join(mixDir, file)))
  const r = buildBase({ category: 'mixed', sourceFile: `Mix/${file}`, wav })
  r.acousticFinding = `${hFinding}+${lFinding}`
  r.heartFinding = hFinding
  r.lungFinding = lFinding
  r.recordedLocation = loc
  r.anatomicalLocation = loc
  r.simulationLocation = HEART_LOC_MAP[loc] ?? LUNG_LOC_MAP[loc] ?? null
  r.gender = row.Gender
  r.runtimeUrl = `assets/audio/runtime/mixed/${slug(file.replace(/\.wav$/i, ''))}.wav`
  const norm = writeRuntime(mixDir, 'mixed', file, wav, fs.readFileSync(path.join(mixDir, file)))
  r.gainApplied = Number(norm.gain.toFixed(3))
  r.rmsNormalized = Number(norm.rmsAfter.toFixed(4))
  r.peakNormalized = Number(norm.peakAfter.toFixed(4))
  pushRecord(r)
}

fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true })
const manifest = {
  generatedAt: new Date().toISOString(),
  dataset: {
    id: DATASET_ID,
    title:
      'HLS-CMDS: Heart and Lung Sounds Dataset Recorded from a Clinical Manikin using Digital Stethoscope',
    doi: '10.17632/8972jxbpmp.3',
    articleDoi: '10.1109/IEEEDATA.2025.3566012',
    license: 'CC BY 4.0',
    authors: ['Yasaman Torabi', 'Shahram Shirani', 'James P. Reilly'],
  },
  count: records.length,
  records,
}
fs.writeFileSync(OUT_JSON, JSON.stringify(manifest, null, 2))

// summary
const byCat = {}
for (const r of records) {
  const k = `${r.category}/${r.acousticFinding}`
  byCat[k] = (byCat[k] || 0) + 1
}
console.log(`Imported ${records.length} records:`)
for (const [k, v] of Object.entries(byCat).sort()) console.log(`  ${k}: ${v}`)
if (warnings.length) {
  console.log(`\nWarnings (${warnings.length}):`)
  for (const w of warnings.slice(0, 10)) console.log(`  - ${w}`)
}
console.log(`\nWrote ${OUT_JSON}`)
