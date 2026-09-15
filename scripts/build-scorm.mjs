#!/usr/bin/env node
/**
 * SCORM paketleyici (§50).
 *   node scripts/build-scorm.mjs 2004   → SCORM 2004 4th Edition (varsayılan)
 *   node scripts/build-scorm.mjs 12     → SCORM 1.2 yedek paketi
 * dist/ içeriğini paketleyip imsmanifest.xml'i köke yerleştirir.
 * Çıktı: dist/EGEMED-Ausculta-SCORM2004.zip | dist/EGEMED-Ausculta-SCORM12.zip
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import JSZip from 'jszip'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')
const version = process.argv[2] === '12' ? '12' : '2004'
const STAGE = path.join(ROOT, 'build', `scorm${version}`)
const outZip = path.join(DIST, version === '12' ? 'EGEMED-Ausculta-SCORM12.zip' : 'EGEMED-Ausculta-SCORM2004.zip')

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('dist/ boş — önce `npm run build` çalıştırın.')
  process.exit(1)
}

function listFiles(dir, base = '') {
  const out = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.join(base, e.name)
    if (e.isDirectory()) out.push(...listFiles(path.join(dir, e.name), rel))
    else out.push(rel)
  }
  return out
}

const files = listFiles(DIST).filter((f) => !f.endsWith('.zip'))

let manifest
if (version === '2004') {
  manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
          xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
          xmlns:adlseq="http://www.adlnet.org/xsd/adlseq_v1p3"
          xmlns:adlnav="http://www.adlnet.org/xsd/adlnav_v1p3"
          xmlns:imsss="http://www.imsglobal.org/xsd/imsss"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          identifier="EGEMED_AUSCULTA_MANIFEST"
          version="1.0"
          xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 http://www.imsglobal.org/xsd/imscp_v1p1.xsd http://www.adlnet.org/xsd/adlcp_v1p3 http://www.adlnet.org/xsd/adlcp_v1p3.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>2004 4th Edition</schemaversion>
  </metadata>
  <organizations default="EGEMED-AUSCULTA-ORG">
    <organization identifier="EGEMED-AUSCULTA-ORG">
      <title>EGEMED Ausculta — Kardiyopulmoner Oskültasyon Simülatörü</title>
      <item identifier="ITEM-AUSCULTA" identifierref="RES-AUSCULTA">
        <title>Ausculta</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES-AUSCULTA" type="webcontent" adlcp:scormType="sco" href="index.html">
      <file href="index.html"/>
${files.filter((f) => f !== 'index.html').map((f) => `      <file href="${f.replace(/\\/g, '/')}"/>`).join('\n')}
    </resource>
  </resources>
</manifest>
`
} else {
  manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
          xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          identifier="EGEMED_AUSCULTA_MANIFEST"
          version="1.2"
          xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 http://www.imsglobal.org/xsd/imscp_v1p1.xsd http://www.adlnet.org/xsd/adlcp_rootv1p2 http://www.adlnet.org/xsd/adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="EGEMED-AUSCULTA-ORG">
    <organization identifier="EGEMED-AUSCULTA-ORG">
      <title>EGEMED Ausculta — Kardiyopulmoner Oskültasyon Simülatörü</title>
      <item identifier="ITEM-AUSCULTA" identifierref="RES-AUSCULTA">
        <title>Ausculta</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES-AUSCULTA" type="webcontent" adlcp:scormtype="sco" href="index.html">
      <file href="index.html"/>
${files.filter((f) => f !== 'index.html').map((f) => `      <file href="${f.replace(/\\/g, '/')}"/>`).join('\n')}
    </resource>
  </resources>
</manifest>
`
}

async function pack() {
  // dist'i staging'e kopyala (vite build dist'i temizlediği için zip'ler orada yaşayamaz)
  fs.rmSync(STAGE, { recursive: true, force: true })
  fs.mkdirSync(STAGE, { recursive: true })
  for (const f of listFiles(DIST).filter((f) => !f.endsWith('.zip'))) {
    const dest = path.join(STAGE, f)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.copyFileSync(path.join(DIST, f), dest)
  }
  fs.writeFileSync(path.join(STAGE, 'imsmanifest.xml'), manifest)
  const allFiles = listFiles(STAGE)
  const zip = new JSZip()
  for (const f of allFiles) {
    zip.file(f.replace(/\\/g, '/'), fs.readFileSync(path.join(STAGE, f)))
  }
  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } })
  fs.writeFileSync(outZip, buf)
  const mb = (buf.length / 1024 / 1024).toFixed(1)
  console.log(`Paket: ${outZip} (${mb} MB, ${allFiles.length} dosya, manifest kökte)`)
}

pack().catch((e) => {
  console.error(e)
  process.exit(1)
})
