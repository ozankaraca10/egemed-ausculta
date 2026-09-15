#!/usr/bin/env node
/**
 * İsteğe bağlı Fraiwan akciğer ses veri seti importörü (§5).
 *
 * Veri seti: "A dataset of lung sounds recorded from the chest wall using an
 * electronic stethoscope" — DOI 10.17632/jwyy9np4gv.2, CC BY 4.0.
 * Authors: Mohammad Fraiwan, Luay Fraiwan, Basheer Khassawneh, Ali Ibnian.
 *
 * Kullanım:
 *   node scripts/import-lung-dataset.mjs /yol/veriseti.zip
 *
 * Beklenen içerik: chest_wav/*.wav (kayıt) + chest_res.csv (etiketler:
 * Diagnosis, Recording index, Chest location, Sound type, Mode, Patient ID).
 * Sound type değerleri: Normal | Crackle | Wheeze | Rhonchi | Stridor | Squawk | Pleural effusion.
 *
 * Not: Bu importör ikincil kaynaktır; birincil paket HLS-CMDS ile kurulur.
 * Kesin CSV kolon adları veri seti sürümüne göre küçük farklılık gösterebilir;
 * importör esnek eşleme yapar ve eşleşmeyen satırları uyarıyla atlar.
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = process.argv[2]
const RUNTIME = path.join(ROOT, 'public', 'assets', 'audio', 'runtime', 'lung')
const OUT_JSON = path.join(ROOT, 'src', 'data', 'sounds-fraiwan.json')

if (!SRC) {
  console.log('Kullanım: node scripts/import-lung-dataset.mjs /yol/framian-veriseti.zip')
  console.log('İndirme: https://data.mendeley.com/datasets/jwyy9np4gv/2 (CC BY 4.0)')
  console.log('Bu veri seti birincil paket için zorunlu değildir.')
  process.exit(0)
}

const TYPE_MAP = {
  Normal: 'normal',
  Crackle: 'crackles',
  Wheeze: 'wheezing',
  Rhonchi: 'rhonchi',
  Stridor: 'stridor',
  Squawk: 'squawk',
  'Pleural effusion': 'pleural_effusion',
}
const LOC_MAP = {
  'Right posterior upper': 'lung_right_upper_posterior',
  'Left posterior upper': 'lung_left_upper_posterior',
  'Right posterior lower': 'lung_right_lower_posterior',
  'Left posterior lower': 'lung_left_lower_posterior',
  'Right mid axillary': 'lung_right_middle_anterior',
  'Left mid axillary': 'lung_left_middle_anterior',
  'Right anterior upper': 'lung_right_upper_anterior',
  'Left anterior upper': 'lung_left_upper_anterior',
  'Right anterior lower': 'lung_right_lower_anterior',
  'Left anterior lower': 'lung_left_lower_anterior',
}

const tmp = fs.mkdtempSync('/tmp/fraiwan-')
execFileSync('unzip', ['-o', '-q', SRC, '-d', tmp])
const csvPath = findCsv(tmp, 'chest_res')
const wavDir = path.join(tmp, 'chest_wav')
if (!fs.existsSync(csvPath) || !fs.existsSync(wavDir)) {
  console.error('chest_res.csv / chest_wav/ bulunamadı — arşiv yapısını kontrol edin.')
  process.exit(1)
}
const lines = fs.readFileSync(csvPath, 'utf8').split(/\r?\n/).filter((l) => l.trim())
const header = lines[0].split(',').map((h) => h.trim())
const idx = (name) => header.findIndex((h) => /diagnosis/i.test(h) ? name === 'diagnosis' : h.toLowerCase().includes(name.toLowerCase()))
const col = {
  wavName: header.findIndex((h) => /wav/i.test(h)),
  diagnosis: header.findIndex((h) => /diagnosis/i.test(h)),
  loc: header.findIndex((h) => /location/i.test(h)),
  sound: header.findIndex((h) => /sound type/i.test(h)),
  mode: header.findIndex((h) => /mode/i.test(h)),
  patient: header.findIndex((h) => /patient/i.test(h)),
}

const records = []
for (const line of lines.slice(1)) {
  const cols = line.split(',').map((c) => c.trim())
  const wavName = cols[col.wavName]
  if (!wavName) continue
  const wavFile = `${wavName}.wav`
  const wavPath = path.join(wavDir, wavFile)
  if (!fs.existsSync(wavPath)) { console.warn(`uyarı: ${wavFile} yok, atlandı`); continue }
  const finding = TYPE_MAP[cols[col.sound]]
  if (!finding) { console.warn(`bilinmeyen ses tipi: ${cols[col.sound]}, atlandı`); continue }
  const simLoc = LOC_MAP[cols[col.loc]] ?? null
  const id = `fraiwan_${finding}_${simLoc ?? 'unmapped'}_${String(records.length + 1).padStart(3, '0')}`
  fs.copyFileSync(wavPath, path.join(RUNTIME, wavFile))
  records.push({
    id,
    category: 'lung',
    acousticFinding: finding,
    sourceDataset: 'fraiwan-lung-2019',
    sourceFile: `chest_wav/${wavFile}`,
    durationSec: 15,
    recordedLocation: cols[col.loc],
    anatomicalLocation: cols[col.loc],
    simulationLocation: simLoc,
    nativeFilter: cols[col.mode]?.toLowerCase() ?? 'unspecified',
    diagnosis: cols[col.diagnosis],
    patientInternal: cols[col.patient],
    gender: '',
    runtimeUrl: `assets/audio/runtime/lung/${wavFile}`,
    validationStatus: 'validated',
    issues: [],
  })
}

fs.writeFileSync(OUT_JSON, JSON.stringify({
  generatedAt: new Date().toISOString(),
  dataset: {
    id: 'fraiwan-lung-2019',
    title: 'A dataset of lung sounds recorded from the chest wall using an electronic stethoscope',
    doi: '10.17632/jwyy9np4gv.2',
    license: 'CC BY 4.0',
    authors: ['Mohammad Fraiwan', 'Luay Fraiwan', 'Basheer Khassawneh', 'Ali Ibnian'],
  },
  count: records.length,
  records,
}, null, 2))
console.log(`${records.length} kayıt içeri aktarıldı → ${OUT_JSON}`)
console.log('Not: kayıtları ana kataloğa birleştirmek için src/core/resolver.ts içinde ek kayıt kaynağı tanımlayın.')

function findCsv(dir, stem) {
  const stack = [dir]
  while (stack.length) {
    const d = stack.pop()
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) stack.push(path.join(d, e.name))
      else if (e.name.toLowerCase().startsWith(stem)) return path.join(d, e.name)
    }
  }
  return null
}
