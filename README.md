# EGEMED Ausculta

**Kardiyopulmoner Oskültasyon Simülatörü** — SCORM uyumlu, çevrimdışı çalışan tıp fakültesi eğitim modülü.

- Gerçek klinik sesler: HLS-CMDS v3 (klinik manikin, dijital stetoskop) — DOI `10.17632/8972jxbpmp.3`, CC BY 4.0
- Gerçekçi hasta gövdesi: CC0 anterior/posterior fotoğraf (yalnız gövde bölgesi kırpılmış)
- Üç mod: Öğrenme · Uygulama · Değerlendirme (SCORM 2004 4th Ed. birincil, SCORM 1.2 yedek)
- Sürüklenebilir sanal stetoskop, Bell/Diyafram seçimi, ön/arka görünüm (etiketli posterior noktalar), konum-duyarlı ses
- 13 vaka, 16 oskültasyon noktası, alan bazlı deterministik skor (hakimiyet eşiği 80/100)
- 16:9 uyumlu kaydırmasız yerleşim, tam ekran düğmesi, mobil/tablet responsive
- Kayıtlar ortak RMS düzeyine normalize edilir (medyan ≈ 20× daha yüksek çıkış) + güvenlik limiter'ı

## Hızlı başlangıç

```bash
npm install
npm run import:hls-cmds   # birincil ses veri setini içe aktarır (yol: /tmp/egemed-ausculta/hls-cmds veya SOUNDS_DIR)
npm run validate          # ses + vaka doğrulaması (fatal hata → build durur)
npm run dev               # http://localhost:5173 (SCORM yoksa bağımsız/mock mod)
npm test                  # vitest — SCORM, suspend, skor, şema, eşleme testleri
npm run build:scorm2004   # dist/EGEMED-Ausculta-SCORM2004.zip
npm run build:scorm12     # dist/EGEMED-Ausculta-SCORM12.zip
```

Veri seti arşivleri yoksa: `./scripts/download-hls-cmds.sh` ile indirin (public kaynak).
Ayrıntılı mimari ve içerik rehberi: [`docs/AUSCULTA.md`](docs/AUSCULTA.md)
