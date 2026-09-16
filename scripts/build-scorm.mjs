#!/usr/bin/env node
/**
 * SCORM paketleyici (§50).
 *   node scripts/build-scorm.mjs 12     → SCORM 1.2 (varsayılan; tek hedef)
 *   node scripts/build-scorm.mjs 12     → SCORM 1.2 yedek paketi
 * dist/ içeriğini paketleyip imsmanifest.xml'i köke yerleştirir.
 * Çıktı: dist/EGEMED-Ausculta-SCORM12.zip
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import JSZip from 'jszip'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')
const version = '12' // SCORM 2004 kullanımdan kaldırıldı (kullanıcı kararı); yalnız 1.2 paketlenir
const STAGE = path.join(ROOT, 'build', `scorm${version}`)
const outZip = path.join(DIST, 'EGEMED-Ausculta-SCORM12.zip')

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
async function pack() {
  // dist'i staging'e kopyala (vite build dist'i temizlediği için zip'ler orada yaşayamaz)
  fs.rmSync(STAGE, { recursive: true, force: true })
  fs.mkdirSync(STAGE, { recursive: true })
  for (const f of listFiles(DIST).filter((f) => !f.endsWith('.zip'))) {
    const dest = path.join(STAGE, f)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.copyFileSync(path.join(DIST, f), dest)
  }
  // CSP meta başlığı: derleme ürününe derinlemesine savunma (dev'de HMR bozulmaması için yalnız pakette)
  const indexPath = path.join(STAGE, 'index.html')
  if (fs.existsSync(indexPath)) {
    let html = fs.readFileSync(indexPath, 'utf8')
    const csp = "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'self'; img-src 'self' data:; media-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'\">"
    if (!/Content-Security-Policy/.test(html)) {
      html = html.replace(/<head([^>]*)>/i, `<head$1>\n    ${csp}`)
      fs.writeFileSync(indexPath, html)
      console.log('CSP meta enjekte edildi')
    }
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
