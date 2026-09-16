/** Pediatrik hasta gövdesi — tıbbi diyagram illüstrasyonu (fotoğraf değil).
 *  Çocuk hastalarda fotoğraf KULLANILMAZ (etik): yüz/baş yok, boyundan bele kadar
 *  erkek çocuk gövdesi net anatomik hatlarla temsil edilir. Anatomi yerleşimi
 *  yetişkin nokta koordinatlarıyla (xp/yp) uyumludur. */

const SKIN_TOP = '#f9ddc2'
const SKIN_MID = '#f2c8a6'
const SKIN_BOT = '#e0ab84'
const LINE = '#b57a52'
const HI = '#ffeeda'

/** Ortak gövde hattı: boyun → omuz eğimi → kol çukuru → bel → kalça */
const BODY = `M458 30
  C 470 20 530 20 542 30
  L 546 112
  C 566 118 590 126 610 136
  C 668 162 700 196 700 230
  C 700 250 688 264 674 272
  C 660 280 646 278 636 270
  C 620 300 610 340 608 386
  C 606 442 606 500 610 556
  C 614 604 620 648 620 686
  C 620 726 616 762 606 790
  C 596 818 570 836 540 844
  C 526 848 512 850 500 850
  C 488 850 474 848 460 844
  C 430 836 404 818 394 790
  C 384 762 380 726 380 686
  C 380 648 386 604 390 556
  C 394 500 394 442 392 386
  C 390 340 380 300 364 270
  C 354 278 340 280 326 272
  C 312 264 300 250 300 230
  C 300 196 332 162 390 136
  C 410 126 434 118 454 112
  Z`

export function TorsoPediatricFront() {
  return (
    <svg className="torso" viewBox="0 0 1000 900" role="img" aria-label="Pediatrik hasta ön görünüm (erkek çocuk, tıbbi illüstrasyon)">
      <defs>
        <linearGradient id="s-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#eef4fb" />
          <stop offset="1" stopColor="#dfe8f4" />
        </linearGradient>
        <linearGradient id="s-skin" x1="0.15" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor={SKIN_TOP} />
          <stop offset="0.5" stopColor={SKIN_MID} />
          <stop offset="1" stopColor={SKIN_BOT} />
        </linearGradient>
        <linearGradient id="s-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e2eaf5" stopOpacity="0" />
          <stop offset="1" stopColor="#e2eaf5" stopOpacity="1" />
        </linearGradient>
        <filter id="s-b8" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="8" /></filter>
        <filter id="s-b20" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="20" /></filter>
        <clipPath id="s-clip"><path d={BODY} /></clipPath>
      </defs>

      <rect width="1000" height="900" fill="url(#s-bg)" />
      <g filter="url(#s-b20)" opacity="0.28"><ellipse cx="500" cy="826" rx="200" ry="22" fill="#b88e73" /></g>

      <path d={BODY} fill="url(#s-skin)" />

      <g clipPath="url(#s-clip)">
        {/* hacim: sağ gölge + sol vurgu */}
        <g filter="url(#s-b20)" opacity="0.26">
          <path d="M620 140 C 760 300 740 600 640 900 L 980 900 L 980 100 Z" fill="#c98f6a" />
        </g>
        <g filter="url(#s-b20)" opacity="0.3">
          <path d="M380 140 C 240 300 260 600 360 900 L 20 900 L 20 100 Z" fill={HI} />
        </g>
        {/* boyun altı gölgesi */}
        <g filter="url(#s-b8)" opacity="0.32"><ellipse cx="500" cy="136" rx="86" ry="22" fill="#cf9670" /></g>

        {/* köprücük kemikleri */}
        <g fill="none" strokeLinecap="round">
          <path d="M436 190 C 470 176 490 172 500 172" stroke={LINE} strokeOpacity="0.5" strokeWidth="6" />
          <path d="M564 190 C 530 176 510 172 500 172" stroke={LINE} strokeOpacity="0.5" strokeWidth="6" />
          <path d="M440 182 C 472 169 490 166 500 166" stroke={HI} strokeOpacity="0.7" strokeWidth="4" />
          <path d="M560 182 C 528 169 510 166 500 166" stroke={HI} strokeOpacity="0.7" strokeWidth="4" />
        </g>
        {/* sternal çentik */}
        <ellipse cx="500" cy="166" rx="11" ry="9" fill={LINE} opacity="0.35" />

        {/* pektoral çizgileri (çocuk: yumuşak yay) */}
        <g fill="none" stroke={LINE} strokeOpacity="0.4" strokeWidth="4" strokeLinecap="round">
          <path d="M370 356 C 410 388 446 396 472 388" />
          <path d="M630 356 C 590 388 554 396 528 388" />
          <path d="M438 250 C 420 268 408 296 404 320" strokeOpacity="0.28" />
          <path d="M562 250 C 580 268 592 296 596 320" strokeOpacity="0.28" />
        </g>
        {/* meme uçları */}
        <circle cx="424" cy="372" r="9" fill={LINE} opacity="0.55" />
        <circle cx="576" cy="372" r="9" fill={LINE} opacity="0.55" />

        {/* sternum */}
        <g fill="none" strokeLinecap="round">
          <path d="M500 214 V 424" stroke={LINE} strokeOpacity="0.3" strokeWidth="7" />
          <path d="M494 224 V 412" stroke={HI} strokeOpacity="0.35" strokeWidth="4" />
        </g>

        {/* kaburga yayları */}
        <g fill="none" stroke={LINE} strokeOpacity="0.22" strokeWidth="4" strokeLinecap="round">
          <path d="M434 262 C 460 252 478 250 494 250" />
          <path d="M566 262 C 540 252 522 250 506 250" />
          <path d="M424 316 C 456 304 478 302 494 302" />
          <path d="M576 316 C 544 304 522 302 506 302" />
          <path d="M426 372 C 458 360 478 358 494 358" />
          <path d="M574 372 C 542 360 522 358 506 358" />
          <path d="M434 428 C 462 418 480 416 494 416" />
          <path d="M566 428 C 538 418 520 416 506 416" />
        </g>
        {/* kostal yay */}
        <g fill="none" stroke={LINE} strokeOpacity="0.3" strokeWidth="5" strokeLinecap="round">
          <path d="M404 480 C 432 528 462 552 496 558" />
          <path d="M596 480 C 568 528 538 552 504 558" />
        </g>

        {/* karın ve göbek */}
        <g filter="url(#s-b20)" opacity="0.16" fill="#e3a87f"><ellipse cx="500" cy="614" rx="112" ry="58" /></g>
        <ellipse cx="500" cy="640" rx="15" ry="18" fill={LINE} opacity="0.5" />
        <ellipse cx="500" cy="637" rx="8" ry="10" fill="#a96b42" opacity="0.55" />
        <g fill="none" stroke={HI} strokeOpacity="0.5" strokeWidth="4" strokeLinecap="round">
          <path d="M474 654 C 486 664 514 664 526 654" />
        </g>

        {/* bel hattı */}
        <g filter="url(#s-b8)" opacity="0.14" fill="none" stroke={LINE} strokeWidth="12" strokeLinecap="round">
          <path d="M352 716 C 400 742 600 742 648 716" />
        </g>

        <rect x="290" y="770" width="420" height="70" fill="url(#s-fade)" />
      </g>

      <path d={BODY} fill="none" stroke="#c08a63" strokeOpacity="0.35" strokeWidth="2.5" />
    </svg>
  )
}

export function TorsoPediatricBack() {
  return (
    <svg className="torso" viewBox="0 0 1000 900" role="img" aria-label="Pediatrik hasta arka görünüm (erkek çocuk, tıbbi illüstrasyon)">
      <defs>
        <linearGradient id="t-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#eef4fb" />
          <stop offset="1" stopColor="#dfe8f4" />
        </linearGradient>
        <linearGradient id="t-skin" x1="0.15" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor={SKIN_TOP} />
          <stop offset="0.5" stopColor={SKIN_MID} />
          <stop offset="1" stopColor={SKIN_BOT} />
        </linearGradient>
        <linearGradient id="t-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e2eaf5" stopOpacity="0" />
          <stop offset="1" stopColor="#e2eaf5" stopOpacity="1" />
        </linearGradient>
        <filter id="t-b8" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="8" /></filter>
        <filter id="t-b20" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="20" /></filter>
        <clipPath id="t-clip"><path d={BODY} /></clipPath>
      </defs>

      <rect width="1000" height="900" fill="url(#t-bg)" />
      <g filter="url(#t-b20)" opacity="0.28"><ellipse cx="500" cy="826" rx="200" ry="22" fill="#b88e73" /></g>

      <path d={BODY} fill="url(#t-skin)" />

      <g clipPath="url(#t-clip)">
        <g filter="url(#t-b20)" opacity="0.26">
          <path d="M620 140 C 760 300 740 600 640 900 L 980 900 L 980 100 Z" fill="#c98f6a" />
        </g>
        <g filter="url(#t-b20)" opacity="0.3">
          <path d="M380 140 C 240 300 260 600 360 900 L 20 900 L 20 100 Z" fill={HI} />
        </g>
        <g filter="url(#t-b8)" opacity="0.32"><ellipse cx="500" cy="136" rx="86" ry="22" fill="#cf9670" /></g>

        {/* omurga oluğu + diken çıkıntıları */}
        <g fill="none" strokeLinecap="round">
          <path d="M500 178 V 750" stroke={LINE} strokeOpacity="0.35" strokeWidth="16" />
          <path d="M492 190 V 738" stroke={HI} strokeOpacity="0.45" strokeWidth="5" />
        </g>
        <g opacity="0.35" stroke={LINE} strokeWidth="3.5" fill="none" strokeLinecap="round">
          {[232, 280, 328, 376, 424, 472, 520, 568, 616, 664].map((y) => (
            <path key={y} d={`M489 ${y} H 511`} />
          ))}
        </g>

        {/* trapez ve skapula */}
        <g fill="none" stroke={LINE} strokeOpacity="0.3" strokeWidth="4" strokeLinecap="round">
          <path d="M500 180 C 452 200 418 224 400 248" />
          <path d="M500 180 C 548 200 582 224 600 248" />
          <path d="M420 256 C 396 292 394 336 410 368" />
          <path d="M580 256 C 604 292 606 336 590 368" />
        </g>
        <g fill="none" stroke={HI} strokeOpacity="0.4" strokeWidth="3.5" strokeLinecap="round">
          <path d="M432 260 C 412 292 410 330 422 358" />
          <path d="M568 260 C 588 292 590 330 578 358" />
        </g>

        {/* bel çukuru */}
        <g filter="url(#t-b8)" opacity="0.16" fill="none" stroke={LINE} strokeWidth="11" strokeLinecap="round">
          <path d="M430 660 C 468 680 532 680 570 660" />
        </g>

        <rect x="290" y="770" width="420" height="70" fill="url(#t-fade)" />
      </g>

      <path d={BODY} fill="none" stroke="#c08a63" strokeOpacity="0.35" strokeWidth="2.5" />
    </svg>
  )
}
