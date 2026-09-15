/** Merkezî ses/DSP konfigürasyonu (§8, §9, §10). DSP, fiziksel stetoskoptan birebir
 *  devşirme değildir; klinik olarak makul frekans vurgulaması uygular. */

export interface HeadDsp {
  /** Uygulanacak biquad zinciri; native kayıt eşleşiyorsa bypass edilir. */
  highshelfDb: number
  lowshelfDb: number
}

export const AUDIO_CONFIG = {
  /** Çapraz geçiş süresi ms (§9: 80–200 ms) */
  crossfadeMs: 120,
  /** Stetoskop yerleştikten sonra ses başlamadan önceki bekleme ms */
  dwellToPlayMs: 260,
  /** Kayıt biterse döngü (tam fizyolojik segment) */
  loopWholeSegment: true,
  /** Master ses düzeyi varsayılanı */
  defaultVolume: 0.85,
  /** Güvenlik limiter'ı (kırpılma koruması) */
  limiter: { thresholdDb: -1.5, kneeDb: 0, ratio: 20, attackSec: 0.003, releaseSec: 0.25 },
  dsp: {
    /** Bell: düşük frekans vurgusu */
    bell: { lowshelfDb: 6.5, lowshelfHz: 220, highshelfDb: -5, highshelfHz: 1200, peakingDb: 4, peakingHz: 90, peakingQ: 1.2 } as HeadDspConfig,
    /** Diyafram: orta/yüksek frekans vurgusu */
    diaphragm: { lowshelfDb: -3.5, lowshelfHz: 160, highshelfDb: 4.5, highshelfHz: 900, peakingDb: 0, peakingHz: 500, peakingQ: 0.8 } as HeadDspConfig,
  },
  /** 4 kHz mono WAV kayıtlar için klinik frekans bandı koruması */
  masterLowpassHz: 3800,
  /** Kayıtlar içe aktarımda ortak RMS'e normalize edilir (scripts/import-hls-cmds.mjs);
   *  bu katsayı yalnız ek güvenlik payıdır. */
  clipGuardGain: 1.0,
}

export interface HeadDspConfig {
  lowshelfDb: number
  lowshelfHz: number
  highshelfDb: number
  highshelfHz: number
  peakingDb: number
  peakingHz: number
  peakingQ: number
}

export type StethHead = 'bell' | 'diaphragm'
