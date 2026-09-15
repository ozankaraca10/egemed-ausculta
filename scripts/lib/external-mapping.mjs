/**
 * Dış veri setleri için etiket → akustik bulgu eşleme mantığı (saf fonksiyonlar).
 *
 * İlkeler (§6):
 *  - Yalnız kaynak etiketinde açıkça belirtilen bulgular doğrulanmış ('validated') sayılır.
 *  - Yaklaşık/örtüşen eşlemeler 'educational_mapping' olarak işaretlenir ve asla değerlendirmeye girmez.
 *  - Uymayan etiketler uydurulmaz; 'unsupported' olarak raporlanır.
 */

/** CirCor DigiScope: kayıt konumu kodları → simülasyon oskültasyon noktaları */
export const CIRCOR_LOCATIONS = {
  AV: 'cardiac_aortic',
  PV: 'cardiac_pulmonary',
  TV: 'cardiac_tricuspid',
  MV: 'cardiac_mitral',
}

/**
 * CirCor murmur etiketlerini akustik bulguya çevirir.
 * @param {string} murmur 'Absent' | 'Present' | 'Unknown'
 * @param {string} systolicTiming 'Early-systolic' | 'Mid-systolic' | 'Holosystolic' | 'Late-systolic' | 'nan'
 * @param {string} diastolicTiming
 */
export function mapCircorMurmur(murmur, systolicTiming, diastolicTiming) {
  const t = (v) => (v === undefined || v === null || v === '' || v === 'nan' ? null : String(v).trim())
  const m = t(murmur)
  const st = t(systolicTiming)
  const dt = t(diastolicTiming)

  if (m === 'Absent') {
    return { finding: 'normal', mappingStatus: 'validated', note: 'Murmur yok (CirCor "Absent") — normal kalp sesi sınıfı' }
  }
  if (m !== 'Present') {
    return { finding: null, mappingStatus: 'unsupported', note: `Murmur durumu belirsiz/eksik (${murmur})` }
  }
  if (dt) {
    // Diyastolik zamanlama veri setinde Early-diastolic; HLS-CMDS taksonomimizde geç diyastolik var.
    return { finding: null, mappingStatus: 'unsupported', note: `Diyastolik zamanlama (${dt}) mevcut taksonomiye birebir uymuyor` }
  }
  switch (st) {
    case 'Early-systolic':
      return { finding: 'early_systolic_murmur', mappingStatus: 'validated', note: 'Zamanlama birebir eşleşiyor (Early-systolic)' }
    case 'Mid-systolic':
      return { finding: 'mid_systolic_murmur', mappingStatus: 'validated', note: 'Zamanlama birebir eşleşiyor (Mid-systolic)' }
    case 'Late-systolic':
      return { finding: 'late_systolic_murmur', mappingStatus: 'validated', note: 'Zamanlama birebir eşleşiyor (Late-systolic)' }
    case 'Holosystolic':
      return {
        finding: 'mid_systolic_murmur',
        mappingStatus: 'educational_mapping',
        note: 'Pansistolik (holosistolik) üfürüm orta sistolik sınıfa yaklaşık eşlendi; değerlendirme dışı',
      }
    default:
      return { finding: null, mappingStatus: 'unsupported', note: 'Sistolik zamanlama etiketi yok (nan)' }
  }
}

/** CirCor kayıt konumu listesinden simülasyon noktalarını üretir */
export function mapCircorLocations(locationsField) {
  const codes = String(locationsField ?? '')
    .split('+')
    .map((c) => c.trim())
    .filter(Boolean)
  const out = []
  for (const c of codes) {
    const loc = CIRCOR_LOCATIONS[c]
    if (loc && !out.includes(loc)) out.push(loc)
  }
  return out
}

/** Kaynak tanım künyesi (dış kayıtlar için) */
export const EXTERNAL_DATASETS = {
  'physionet-circor': {
    id: 'physionet-circor',
    title: 'The CirCor DigiScope Phonocardiogram Dataset',
    version: '1.0.3',
    authors: ['Jorge Oliveira', 'Francesco Renna', 'Paulo Costa', 'Marcelo Nogueira', 'Ana Cristina Oliveira', 'Andoni Elola', 'Carlos Ferreira', 'Alipio Jorge', 'Ali Bahrami Rad', 'Matthew Reyna', 'Reza Sameni', 'Gari D. Clifford', 'Miguel T. Coimbra'],
    organization: 'PhysioNet (MIT-LCP) / CirCor',
    url: 'https://physionet.org/content/circor-heart-sound/1.0.3/',
    license: 'Open Data Commons Attribution License v1.0 (ODC-BY 1.0)',
    licenseUrl: 'https://physionet.org/content/circor-heart-sound/view-license/1.0.3/',
    attributionText:
      'Oliveira, J., Renna, F., Costa, P., Nogueira, M., Oliveira, A. C., Elola, A., Ferreira, C., Jorge, A., Bahrami Rad, A., Reyna, M., Sameni, R., Clifford, G., & Coimbra, M. (2022). The CirCor DigiScope Phonocardiogram Dataset (v1.0.3). PhysioNet. https://doi.org/10.13026/cy60-yn18 — ODC-BY 1.0',
  },
}
