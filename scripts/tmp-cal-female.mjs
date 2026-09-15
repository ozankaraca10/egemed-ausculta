import fs from 'node:fs'
import { chromium } from 'playwright-core'

const CHROME = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
const PROJ = '/Users/ozankaraca/Documents/Default Project/egemed-ausculta'

// Kadın görünümü için aday koordinatlar (kalibrasyon)
const FRONT = [
  ['aort', 0.44, 0.26], ['pulmoner', 0.54, 0.26], ['erb', 0.545, 0.315], ['triküspit', 0.53, 0.44], ['mitral', 0.62, 0.47],
  ['sag ust', 0.38, 0.24], ['sol ust', 0.60, 0.24], ['sag orta', 0.33, 0.40], ['sol orta', 0.64, 0.40], ['sag alt', 0.35, 0.53], ['sol alt', 0.63, 0.53],
]
const BACK = [
  ['sag ust p', 0.61, 0.27], ['sol ust p', 0.39, 0.27], ['sag orta p', 0.62, 0.42], ['sol orta p', 0.38, 0.42], ['sag alt p', 0.60, 0.56], ['sol alt p', 0.40, 0.56],
]

function page(view) {
  const pts = view === 'front' ? FRONT : BACK
  const img = view === 'front' ? 'public/assets/body/front-female.jpg' : 'public/assets/body/back-female.jpg'
  return `<!doctype html><html><body style="margin:0;background:#eef4fc;font-family:sans-serif">
  <div style="position:relative;width:900px;margin:0 auto">
    <img src="file://${PROJ}/${img}" style="width:100%;display:block" />
    ${pts.map(([l, x, y]) => `
      <div style="position:absolute;left:${x * 100}%;top:${y * 100}%;transform:translate(-50%,-50%)">
        <div style="padding:2px 6px;border-radius:99px;border:2px solid #e11d48;background:rgba(255,255,255,.9);font-size:10px;font-weight:700;color:#0b2559;white-space:nowrap">${l}</div>
      </div>`).join('')}
    ${[0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9].map((f) => `
      <div style="position:absolute;left:0;right:0;top:${f * 100}%;border-top:1px dashed rgba(22,115,230,.4)"><span style="font-size:10px;color:#1673e6;background:#fff">${f}</span></div>
      <div style="position:absolute;top:0;bottom:0;left:${f * 100}%;border-left:1px dashed rgba(22,115,230,.4)"><span style="font-size:10px;color:#1673e6;background:#fff">${f}</span></div>`).join('')}
  </div></body></html>`
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const p = await browser.newPage({ viewport: { width: 980, height: 1000 } })
for (const view of ['front', 'back']) {
  const f = `/tmp/body-f/calib-${view}.html`
  fs.writeFileSync(f, page(view))
  await p.goto('file://' + f, { waitUntil: 'load' })
  await p.waitForTimeout(350)
  await p.screenshot({ path: `/tmp/body-f/calib-${view}.png`, fullPage: true })
}
await browser.close()
console.log('kalibrasyon görüntüleri hazır')
