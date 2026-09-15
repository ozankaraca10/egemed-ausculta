/** Pediatrik hasta gövdesi — şematik (fotoğraf DEĞİL).
 *  Çocuk hastalarda gerçek fotoğraf kullanılmaz; bu şematik temsil klinik eğitim
 *  amaçlıdır ve hotspot mantığı yetişkin görselleriyle birebir aynıdır.
 *  Çocuk anatomisi: görece büyük baş, kısa gövde, geniş interkostal aralıklar. */

const SKIN_A = '#f7d6bd'
const SKIN_B = '#f0c3a4'
const EDGE = '#dba57f'

function defs(id: string) {
  return (
    <defs>
      <linearGradient id={`pskin-${id}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={SKIN_A} />
        <stop offset="1" stopColor={SKIN_B} />
      </linearGradient>
      <radialGradient id={`pbg-${id}`} cx="0.5" cy="0.25" r="1">
        <stop offset="0" stopColor="#e3effc" />
        <stop offset="1" stopColor="#f6faff" />
      </radialGradient>
      <linearGradient id={`plung-${id}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#a9c9ef" stopOpacity="0.5" />
        <stop offset="1" stopColor="#c4d9f2" stopOpacity="0.35" />
      </linearGradient>
      <linearGradient id={`pheart-${id}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#f4b0b0" stopOpacity="0.85" />
        <stop offset="1" stopColor="#e58b91" stopOpacity="0.7" />
      </linearGradient>
    </defs>
  )
}

/** 1000 x 900 — görece kısa gövde, yuvarlak omuzlar */
function childBody(fill: string) {
  return (
    <path
      d="M436 128
         C 386 136 340 152 312 178
         C 282 206 268 250 264 300
         C 260 352 264 402 274 442
         C 280 468 298 478 316 470
         C 330 464 338 448 342 426
         L 350 500
         C 356 560 360 616 358 668
         L 352 780
         C 350 812 370 830 402 830
         L 598 830
         C 630 830 650 812 648 780
         L 642 668
         C 640 616 644 560 650 500
         L 658 426
         C 662 448 670 464 684 470
         C 702 478 720 468 726 442
         C 736 402 740 352 736 300
         C 732 250 718 206 688 178
         C 660 152 614 136 564 128
         C 550 148 528 158 500 158
         C 472 158 450 148 436 128 Z"
      fill={fill}
    />
  )
}

export function TorsoPediatricFront() {
  return (
    <svg className="torso" viewBox="0 0 1000 900" role="img" aria-label="Pediatrik hasta ön görünüm (şematik)">
      {defs('f')}
      <rect width="1000" height="900" fill="url(#pbg-f)" />
      {/* boyun + baş alt kenarı */}
      <path d="M452 30h96v70c0 26-20 42-48 42s-48-16-48-42z" fill="url(#pskin-f)" />
      <ellipse cx="500" cy="26" rx="86" ry="46" fill="url(#pskin-f)" />
      {childBody('url(#pskin-f)')}
      {/* klavikula + hafif göğüs */}
      <path d="M438 196c48-14 106-16 152 0" stroke={EDGE} strokeWidth="7" fill="none" opacity="0.32" strokeLinecap="round" />
      <path d="M474 230c11 20 11 34 0 52" stroke={EDGE} strokeWidth="5" opacity="0.22" fill="none" strokeLinecap="round" />
      <path d="M526 230c-11 20-11 34 0 52" stroke={EDGE} strokeWidth="5" opacity="0.22" fill="none" strokeLinecap="round" />
      {/* karın yuvarlaklığı — çocuk oranı */}
      <path d="M432 560c40 22 96 22 136 0" stroke={EDGE} strokeWidth="5" opacity="0.16" fill="none" strokeLinecap="round" />
      {/* kaburgalar (çocukta daha belirgin aralık) */}
      <g stroke={EDGE} strokeWidth="3.4" opacity="0.2" fill="none" strokeLinecap="round">
        <path d="M436 250c50-14 102-14 152 0" />
        <path d="M428 298c56-16 114-16 170 0" />
        <path d="M424 348c58-16 122-16 180 0" />
        <path d="M428 398c54-15 118-15 172 0" />
        <path d="M436 446c50-13 104-13 152 0" />
      </g>
      {/* akciğerler */}
      <path d="M478 240c-48 6-78 42-84 100-6 62 6 120 28 156 13 20 32 28 51 24l5-280z" fill="url(#plung-f)" stroke="#9fbde4" strokeOpacity="0.3" />
      <path d="M522 240c48 6 78 42 84 100 6 62-6 120-28 156-13 20-32 28-51 24l-5-280z" fill="url(#plung-f)" stroke="#9fbde4" strokeOpacity="0.3" />
      {/* kalp — hastanın solunda */}
      <path d="M514 284c20-16 50-13 63 7 17 24 15 58 2 92-13 37-32 66-48 85-20-9-39-26-52-53-17-35-24-72-15-96 9-22 31-26 50-35z" fill="url(#pheart-f)" stroke="#dc9aa0" strokeOpacity="0.5" />
      <ellipse cx="450" cy="352" rx="12" ry="8" fill={EDGE} opacity="0.4" />
      <ellipse cx="550" cy="352" rx="12" ry="8" fill={EDGE} opacity="0.4" />
      <ellipse cx="500" cy="640" rx="14" ry="18" fill={EDGE} opacity="0.4" />
      <rect y="810" width="1000" height="90" fill="url(#pbg-f)" opacity="0.5" />
    </svg>
  )
}

export function TorsoPediatricBack() {
  return (
    <svg className="torso" viewBox="0 0 1000 900" role="img" aria-label="Pediatrik hasta arka görünüm (şematik)">
      {defs('b')}
      <rect width="1000" height="900" fill="url(#pbg-b)" />
      <path d="M452 30h96v70c0 26-20 42-48 42s-48-16-48-42z" fill="url(#pskin-b)" />
      <ellipse cx="500" cy="26" rx="86" ry="46" fill="url(#pskin-b)" />
      {childBody('url(#pskin-b)')}
      {/* omuz kemikleri */}
      <path d="M436 214c-40 6-62 26-68 64-6 42 0 88 16 116 12 20 34 18 42-6 8-26 14-84 10-174z" fill={EDGE} opacity="0.13" />
      <path d="M564 214c40 6 62 26 68 64 6 42 0 88-16 116-12 20-34 18-42-6-8-26-14-84-10-174z" fill={EDGE} opacity="0.13" />
      {/* omurga */}
      <g stroke={EDGE} strokeWidth="6" opacity="0.3" strokeLinecap="round">
        <path d="M500 196v520" />
        {[250, 300, 350, 400, 450, 500, 550, 600, 650].map((y) => (
          <path key={y} d={`M482 ${y}h36`} strokeWidth="4" opacity="0.5" />
        ))}
      </g>
      {/* akciğerler (arkadan) */}
      <path d="M476 244c-52 6-84 44-90 106-6 68 8 128 30 164 13 20 32 28 53 24l7-294z" fill="url(#plung-b)" stroke="#9fbde4" strokeOpacity="0.3" />
      <path d="M524 244c52 6 84 44 90 106 6 68-8 128-30 164-13 20-32 28-53 24l-7-294z" fill="url(#plung-b)" stroke="#9fbde4" strokeOpacity="0.3" />
      <path d="M430 520c44 16 104 16 148 0" stroke={EDGE} strokeWidth="4" opacity="0.2" fill="none" />
      <rect y="810" width="1000" height="90" fill="url(#pbg-b)" opacity="0.5" />
    </svg>
  )
}
