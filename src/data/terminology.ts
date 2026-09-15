/** Merkezî tıbbi terminoloji katmanı (§35). Bileşenlerde medikal string scatter edilmez. */
export const TERMINOLOGY = {
  heart: {
    normal: {
      title: 'Normal Kalp Sesleri',
      short: 'Normal S1–S2',
      librarySub: 'Sağlıklı kalp sesleri (S1, S2)',
      finding: 'Normal kalp sesleri (S1 ve S2)',
    },
    s3: {
      title: 'S3 (Üçüncü Kalp Sesi)',
      short: 'S3',
      librarySub: 'Üçüncü kalp sesi (protodiastolik gallop)',
      finding: 'Üçüncü kalp sesi (S3)',
    },
    s4: {
      title: 'S4 (Dördüncü Kalp Sesi)',
      short: 'S4',
      librarySub: 'Dördüncü kalp sesi (presistolik gallop)',
      finding: 'Dördüncü kalp sesi (S4)',
    },
    atrial_fibrillation: {
      title: 'Atriyal Fibrilasyon',
      short: 'Atriyal Fibrilasyon',
      librarySub: 'Düzensiz kalp ritmi',
      finding: 'Düzensiz ritim (atriyal fibrilasyon ile uyumlu)',
    },
    tachycardia: {
      title: 'Taşikardi',
      short: 'Taşikardi',
      librarySub: 'Hızlı kalp hızı',
      finding: 'Taşikardik hızlı ritim',
    },
    av_block: {
      title: 'Atriyoveventriküler Blok',
      short: 'AV Blok',
      librarySub: 'İletim bozukluğu bulguları',
      finding: 'İletim bozukluğu ile uyumlu kalp sesleri (AV blok)',
    },
    murmur: {
      early_systolic: {
        title: 'Sistolik Üfürüm (Erken Sistolik)',
        short: 'Erken sistolik üfürüm',
        librarySub: 'Sistol başında üfürüm',
        finding: 'Erken sistolik üfürüm',
      },
      mid_systolic: {
        title: 'Sistolik Üfürüm (Orta Sistolik)',
        short: 'Orta sistolik üfürüm',
        librarySub: 'Orta sistolik ejecte tipi üfürüm',
        finding: 'Orta sistolik üfürüm',
      },
      late_systolic: {
        title: 'Sistolik Üfürüm (Geç Sistolik)',
        short: 'Geç sistolik üfürüm',
        librarySub: 'Geç sistolikte üfürüm',
        finding: 'Geç sistolik üfürüm',
      },
      late_diastolic: {
        title: 'Diyastolik Üfürüm (Geç Diyastolik)',
        short: 'Geç diyastolik üfürüm',
        librarySub: 'Geç diyastolde presistolik üfürüm',
        finding: 'Geç diyastolik üfürüm',
      },
    },
  },
  lung: {
    normal: {
      title: 'Normal Solunum Sesleri',
      short: 'Normal Solunum',
      librarySub: 'Veziküler solunum sesleri',
      finding: 'Normal veziküler solunum sesleri',
    },
    wheezing: {
      title: 'Wheezing',
      short: 'Wheezing',
      librarySub: 'Ekspiryumda duyulan hışıltı sesi',
      finding: 'Wheezing (hışıltı)',
    },
    rhonchi: {
      title: 'Ronküs',
      short: 'Ronküs',
      librarySub: 'Düşük frekanslı kaba sesler',
      finding: 'Ronküs (rhonchi)',
    },
    fine_crackles: {
      title: 'İnce Raller (Fine Crackles)',
      short: 'İnce Raller',
      librarySub: 'İnce, kesintili patlama sesleri',
      finding: 'İnce raller (fine crackles)',
    },
    coarse_crackles: {
      title: 'Kaba Raller (Coarse Crackles)',
      short: 'Kaba Raller',
      librarySub: 'Daha kaba, nemli patlama sesleri',
      finding: 'Kaba raller (coarse crackles)',
    },
    pleural_rub: {
      title: 'Plevral Frotman',
      short: 'Plevral Frotman',
      librarySub: 'Plevral yüzeylerin sürtünme sesi',
      finding: 'Plevral frotman (pleural friction rub)',
    },
  },
  misc: {
    bell: 'Bell',
    diaphragm: 'Diyafram',
    front: 'Ön Görünüm',
    back: 'Arka Görünüm',
  },
} as const

export type HeartFindingKey =
  | 'normal'
  | 's3'
  | 's4'
  | 'atrial_fibrillation'
  | 'tachycardia'
  | 'av_block'
  | 'murmur.early_systolic'
  | 'murmur.mid_systolic'
  | 'murmur.late_systolic'
  | 'murmur.late_diastolic'

export type LungFindingKey =
  | 'normal'
  | 'wheezing'
  | 'rhonchi'
  | 'fine_crackles'
  | 'coarse_crackles'
  | 'pleural_rub'

/** kütüphana anahtarları 'heart.normal' gibi prefixli gelir; düz bulgu anahtarına indir */
function bare(key: string): string {
  return key.replace(/^(heart|lung)\./, '')
}

export function heartLabel(key: string): string {
  const k = bare(key)
  if (k.startsWith('murmur.')) {
    const sub = k.split('.')[1] as keyof typeof TERMINOLOGY.heart.murmur
    return TERMINOLOGY.heart.murmur[sub].title
  }
  const t = TERMINOLOGY.heart[k as Exclude<HeartFindingKey, `murmur.${string}`>]
  return t.title
}

export function heartLibrarySub(key: string): string {
  const k = bare(key)
  if (k.startsWith('murmur.')) {
    const sub = k.split('.')[1] as keyof typeof TERMINOLOGY.heart.murmur
    return TERMINOLOGY.heart.murmur[sub].librarySub
  }
  const t = TERMINOLOGY.heart[k as Exclude<HeartFindingKey, `murmur.${string}`>]
  return t.librarySub
}

export function heartFindingText(key: string): string {
  const k = bare(key)
  if (k.startsWith('murmur.')) {
    const sub = k.split('.')[1] as keyof typeof TERMINOLOGY.heart.murmur
    return TERMINOLOGY.heart.murmur[sub].finding
  }
  const t = TERMINOLOGY.heart[k as Exclude<HeartFindingKey, `murmur.${string}`>]
  return t.finding
}

export function lungLabel(key: string): string {
  return TERMINOLOGY.lung[bare(key) as LungFindingKey].title
}

export function lungLibrarySub(key: string): string {
  return TERMINOLOGY.lung[bare(key) as LungFindingKey].librarySub
}

export function lungFindingText(key: string): string {
  return TERMINOLOGY.lung[bare(key) as LungFindingKey].finding
}
