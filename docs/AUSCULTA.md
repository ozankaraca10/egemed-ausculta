# EGEMED Ausculta — Mimari ve İçerik Rehberi

> Marka: **EGEMED Ausculta** (önceki ad: StetesAI). Marka varlıkları `public/brand/` altındadır:
> `ausculta-mark.svg` (amblem), `ausculta-horizontal.svg` (açık zemin), `ausculta-horizontal-white.svg`
> (koyu header), `ausculta-vertical.svg` (dikey), `favicon.svg`.

**Kardiyopulmoner Oskültasyon Simülatörü** · SCORM 2004 4th Edition (birincil) + SCORM 1.2 (yedek)

Bu belge; Ausculta modülünün mimarisini, vaka tanımını, ses içe aktarma hattını, atıf
ve klinik doğrulama katmanını, SCORM paketlemesini, bağımsız test modunu ve yeni
ses/vaka ekleme prosedürlerini açıklar.

---

## 1. Genel Mimari

```
LMS (Moodle vb.) ← SCORM 2004/1.2 paketi (tamamlama, puan, etkileşimler, suspend)
├── React arayüzü (ekranlar: Start → Tutorial → Modes → Learn/Simulation → Results)
├── store.tsx        : tek reducer + SCORM kablolama (suspend, skor, etkileşimler)
├── core/scorm.ts    : API_1484_11 / API keşfi + 2004↔1.2 anahtar eşleme + Mock adapter
├── core/suspend.ts  : kompakt suspend serileştirme (SCORM 1.2 4096 karakter limitine uygun)
├── core/scoring.ts  : deterministik alan bazlı skor (§24)
├── core/validation.ts : vaka şema doğrulaması (malformed vaka build'i keser)
├── core/resolver.ts : ses atamalarının kayıt çözümü (konum-duyarlı §2)
├── audio/engine.ts  : WebAudio — tek AudioContext, ~120 ms crossfade, tam segment döngü,
│                      Bell/Diyafram DSP fallback (audioConfig.ts merkezî)
├── data/            : sounds.json (üretim), cases.json, auscultation-points.json,
│                      library.json, sources.json, terminology.ts
├── public/assets/body: gerçekçi hasta ön/arka gövde fotoğrafları (CC0, kırpılmış)
└── ui/              : PatientStage (sürüklenebilir stetoskop), Toolbar, WaveformView,
                       Questions, torso SVG'leri, ikonlar
```

Prensipler:
- **Hiçbir render ağacı pointer hareketinde yeniden çizilmez** — stetoskop konumu DOM üzerinde ref ile güncellenir.
- **Ses lazy yüklenir** (kullanılan vakanın kayıtları), buffer cache + node temizliği yapılır.
- **Paket içinde her şey yereldir** — CDN/uzak font/görsel yok (§30).
- **Değerlendirmede yanıt ifşa eden görsel yok** — etiketler yalnız Öğrenme/Uygulamada (§21).

## 2. Üç Mod

| Mod | Amaç | İpucu | Skor | Geri bildirim |
|---|---|---|---|---|
| Öğrenme | Kütüphane + rehberli dinleme, dalga formu, klinik bilgi | — | yok | her yerde |
| Uygulama | Klinik vaka + sorular | var (−5 puan/adet) | gösterilir | soru başına |
| Değerlendirme | SCORM ölçümü | yok | SCORM'a yazılır | yalnız sonuçta |

## 3. Veri Şemaları

### 3.1 auscultation-points.json
Her nokta: `id`, `view (front|back)`, `group (cardiac|lung)`, `label`, `fullLabel`,
`detail`, `x/y` (normalize 0–1), `color`, `tagSide`. `views` bloğu her görünüm için
görsel yolunu ve piksel ölçülerini tutar; sahne görseli en-boy oranını koruyarak
letterbox'sız ölçeklenir (ResizeObserver), böylece hotspot hizası her ekranda tamdır.
Görsel değiştirilecekse: yeni fotoğrafı `public/assets/body/` altına koyun, `views`
ölçülerini güncelleyin ve noktaları `points` içinde yeniden kalibre edin (§12).

**Arka bölge (§14):** HLS-CMDS'te posterior kayıt yoktur. Öğrenme modunda posterior
noktalar görünür ve ses, aynı bulgunun anterior kaydından **açıkça belirtilerek**
çalınır (`resolveLibrarySoundEx` → `fallbackFrom`; arayüzde kaynak bölge notu gösterilir).
Vakalarda yanlış beyan olmaması için yalnız doğrulanmış bölge atamaları kullanılır.

### 3.2 cases.json (§17)
Zorunlu alanlar: `id, title, modes, patient, chiefComplaint, history, vitalSigns,
objectives, tasks, views, allowedHeads, soundAssignments, primaryAcousticFinding,
clinicalDiagnosis, mappingValidation, technique, questions, feedback, references`.
`scoringWeights` isteğe bağlı (toplam 100 olmalı; otomatik dengeleme var).

Soru (§23): `type ∈ {single_choice, multi_choice, sound_identify, localization,
bell_diaphragm, interpretation, diagnosis, sequence}`, `domain ∈ {recognition,
localization, interpretation, diagnosis}`, `options/correct/feedback*/hint`.

### 3.3 sounds.json (import üretimi)
Bkz. §4. Kayıt alanları: `id, category, acousticFinding, sourceDataset, sourceFile,
durationSec, sampleRate, peak, rms, recordedLocation, simulationLocation, nativeFilter,
gender, runtimeUrl, validationStatus, issues`.

**Dürüst eşleme kuralları (§13, §14):**
- `recordedLocation` veri setindeki gerçek kayıt konumudur (RUSB, LUSB, Apex, LLSB, LUA…).
- `simulationLocation` yalnız birebir karşılığı olan eğitim işaretine eşlenir
  (RC/LC gibi belirsiz konumlar `null` kalır ve adlandırılmış odağa sunulmaz).
- Arşivde olmayan kayıtlar `missing_asset` olarak listelenir; sessizce düşürülmez.
- Posterior akciğer kayıtları HLS-CMDS'te yoktur; posterior noktalar yalnız
  Fraiwan importu ile ses alır (importör hazır).

## 4. Ses İçe Aktarma

**Düzey normalizasyonu:** Kayıtlar çok düşük seviyededir (medyan RMS ≈ 0.004).
İçe aktarma sırasında her runtime kopyası ortak hedef RMS'e (−20 dBFS) yükseltilir;
kazanç üst sınırı 30× ve tepe tavanı 0.97 ile kırpılma engellenir. Ustalar değişmez.
Oynatma zincirinde ayrıca güvenlik limiter'ı (DynamicsCompressor) vardır.

```bash
# 1) Birincil veri seti (HLS-CMDS v3, DOI 10.17632/8972jxbpmp.3)
./scripts/download-hls-cmds.sh /tmp/egemed-ausculta/hls-cmds
npm run import:hls-cmds        # → public/assets/audio/runtime/... + src/data/sounds.json

# 2) Doğrulama (build'i kesen fatal rapor)
npm run validate

# 3) İsteğe bağlı Fraiwan akciğer veri seti (DOI 10.17632/jwyy9np4gv.2)
node scripts/import-lung-dataset.mjs /yol/chest-dataset.zip
```

Importör; HS/LS/Mix CSV'lerini ayrıştırır, WAV başlıklarını okur (süre, peak, RMS,
clipping uyarısı), dosyaları `public/assets/audio/runtime/{heart,lung,mixed}/`
altına **küçük harf adlarla** kopyalar (vaka-duyarlı LMS sunucularıyla uyum) ve
sabit iç ID'ler üretir: `heart_normal_rusb_001` biçiminde.

## 4.1 Veri Seti ↔ Kütüphane ↔ Vaka Senkronizasyonu (§36)

Platform üç katmanda **aynı veri seti etiket kümesiyle** hizalıdır ve bu durum otomatik denetlenir:

| Katman | Kapsam |
|---|---|
| Veri seti (HLS-CMDS v3) | 10 kalp sınıfı + 6 akciğer sınıfı + 60 kombine (mixed) kombinasyon |
| Öğrenme kütüphanesi | 10 kalp + 6 akciğer + 4 kombine kalemi (20 kalem, her birinde **ses metaforu**) |
| Uygulama modu | 20 vaka (tüm sınıflar + 4 kombine vaka) |
| Değerlendirme modu | 16 vaka / 50 soru (tüm doğrulanmış sınıflar) |

Kurallar `scripts/validate-audio.mjs` (fatal) ve `tests/core.test.ts` (vitest) ile zorlanır:
her veri seti sınıfı için kütüphane kalemi + en az bir uygulama vakası + en az bir değerlendirme
vakası bulunmalıdır; kombine kayıtlar kütüphane ve uygulamada temsil edilmelidir (değerlendirme
dışıdır — `educational_mapping`); her kütüphane kalemi için çalınabilir kayıt olmalıdır.

**Ses metaforları (izleme modu):** her kütüphane kalemi, klinik eğitimde kullanılan işitsel
benzetmeleri içerir (ör. ince raller → *"karda yürüme sesi / saç oğuşturma"*, kaba raller →
*"kaynama fokurtusu"*, wheezing → *"çaydanlık düdüğü"*, ronküs → *"uykuda horlama"*,
plevral frotman → *"kar gıcırtısı"*, S3 → *"ken-ta-ta dörtnal ritmi"*). Metaforlar öğrenme
modunda ayrı bir kartta gösterilir ve yeni vakaların ipuçlarında da kullanılır.

## 4.2 Veri Seti Envanteri (§5, §34)

Araştırılan açık erişimli veri setleri `src/data/sources.json` → `inventory` altında tutulur
(makine okunur; "Kaynaklar" ekranında durum çipleriyle gösterilir). Durum kodları:

| Durum | Anlam |
|---|---|
| `bundled` | Pakete dahil (lisans doğrulanmış) |
| `samples_included` | Örnek kayıtlar envantere aktarıldı (paket dışı manifest) |
| `importer_ready` | Import scripti hazır, kullanıcı veriyi indirip çalıştırır |
| `inventory_only` | Etiketler taksonomiye birebir uymuyor — içeriğe alınmaz |
| `license_review` | Lisans/yeniden dağıtım koşulları doğrulanmadı — pakete alınmaz |

Envanterdeki veri setleri (özet): HLS-CMDS v3 (paket, CC BY 4.0) · Fraiwan akciğer (CC BY 4.0,
posterior adayı) · **CirCor DigiScope** (ODC-BY 1.0, pediatrik üfürüm, 4 örnek aktarıldı) ·
PhysioNet/CinC 2016 (ODC-BY 1.0, yalnız normal/anormal → envanter) · SPRSound (CC BY 4.0,
ince/kaba ral ayrımı yok → envanter) · EPHNOGRAM (EKG korelasyonu adayı) · ICBHI 2017
(lisans incelemesi; §34 gereği pakete alınmaz) · HF_Lung_V1 ve KAUH (erişim/lisans doğrulaması).

**Posterior kuralları:** veri setinde posterior kayıt yoksa aynı bulgunun anterior kaydı
"fallback" olarak, kaynak bölge açıkça bildirilerek çalınır (§14).

**CirCor içe aktarma:**
```bash
# 1) Veriyi indir (449 MB, ODC-BY 1.0): https://physionet.org/content/circor-heart-sound/1.0.3/
node scripts/import-circor.mjs /yol/circor-heart-sound-1.0.3
# → public/assets/audio/runtime/external/circor/*.wav + src/data/sounds-external.json + rapor
```
Eşleme kuralları `scripts/lib/external-mapping.mjs` içinde saf fonksiyonlardır ve test edilir:
Erken/Orta/Geç sistolik zamanlamalar doğrulanmış; holosistolik `educational_mapping`
(değerlendirmeye girmez); uymayan etiketler uydurulmaz, rapora yazılır.

## 5. Klinik Doğrulama Katmanı (§6, §19)

- `acousticFinding` (akustik bulgu) ile `clinicalDiagnosis` (tanı) ayrıdır.
- Bir tanı sorusu ancak `clinicalDiagnosis` dolu **ve** `mappingValidation === 'validated'`
  iken vaka içinde yer alabilir. Şu an doğrulanmış tanı eşlemeleri yalnız:
  Atriyal Fibrilasyon, Taşikardi, AV Blok (manikin sınıfı = ritim tanısı).
  Üfürüm → kapak lezyonu gibi eşlemeler bilinçli olarak yapılmaz.
- `validate-audio.mjs` + `core/validation.ts` ihlalleri **build hatası** yapar;
  `filterAssessmentPool` hatalı vakaları değerlendirme havuzundan dışlar.

## 6. Skor (§24)

Varsayılan ağırlıklar: teknik 20 · lokalizasyon 20 · tanıma 25 · yorum 20 · tanı 10 · sistematik 5.
Tanı sorusu olmayan vakalarda ağırlık tanıma/yorum'a dağıtılır (toplam daima 100).
Hakimiyet eşiği **80**. Uygulama modunda her ipucu −5. Tek hata çifte ceza vermez
(sistematik yarım puan; teknik ayrı ölçülür).

## 7. SCORM (§25–§27, §50)

```bash
npm run build:scorm2004   # dist/EGEMED-Ausculta-SCORM2004.zip (birincil)
npm run build:scorm12     # dist/EGEMED-Ausculta-SCORM12.zip (yedek)
```
- `imsmanifest.xml` paket kökünde; ek sarıcı klasör yok.
- Çalışma zamanı: `Initialize/GetValue/SetValue/Commit/Terminate`; 2004 ve 1.2 otomatik algılanır.
  API yoksa **Mock adapter** ile bağımsız çalışma (başlıkta DEV rozeti, yalnız dev build).
- Takip: completion/success, score.raw/min/max(/scaled), progress_measure, session_time,
  location, suspend_data, etkileşimler (soru bazlı id/type/response/result).
- Suspend: mod, vaka, adım, yanıtlar, ziyaret noktaları, ipucu sayısı, vaka sonuçları.
  SCORM 1.2 limitine uymak için kompakt serileştirme + test.

## 8. Bağımsız / Geliştirme Modunda Test

```bash
npm run dev        # http://localhost:5173
```
- SCORM API olmadan mock adapter devrede; durum kaybı olmadan çalışır.
- Geliştirici teşhisi (§38): dev build + `http://localhost:5173/?dev=1` → sol alt panelde
  vaka, nokta, çözülen kayıt, kaynak dosya, doğal lokasyon, süre, SCORM durumu.
- Otomatik görsel akış testi: `node scripts/e2e-screens.mjs` (dev server açıkken;
  ekran görüntülerini /tmp/egemed-ausculta-shots'a yazar, console hatalarını raporlar).
- SCORM LMS testi: paketi Moodle'a yükleyin; "Suspend/Resume" davranışı dersin
  yeniden açılışında vaka/adım/yanıtların korunmasıyla doğrulanır.

## 9. Yeni Ses Ekleme

1. Kaynak dosyayı ve CSV'yi `scripts/download-hls-cmds.sh` akışına veya
   `import-lung-dataset.mjs` haritasına uygun dizine koyun.
2. `import-*` script'ini çalıştırın → `sounds.json` güncellenir.
3. `npm run validate` → raporda `validated/missing` sayılarını kontrol edin.
4. Vakada kullanmak için `soundAssignments`'a `category + acousticFinding (+recordedLocation)` yazın.

## 10. Yeni Vaka Ekleme (§36)

1. `src/data/cases.json` içine yeni kayıt ekleyin (şema §3.2).
2. Ses atamalarının çözülebilir olduğundan emin olun (`npm run validate`).
3. Tanı sorusu ekliyorsanız: `clinicalDiagnosis` doldurun ve eşlemeyi belgeleyin;
   doğrulanmamış eşleme build'i keser.
4. Uygulama/Değerlendirme havuzlarına otomatik girer (mod listesine göre).
   Test: `npx vitest run` (şema + havuz filtresi testleri).

## 11. Atıf ve Lisans

- Sesler: **HLS-CMDS v3** — Torabi, Shirani, Reilly — DOI 10.17632/8972jxbpmp.3 — CC BY 4.0.
  Makale DOI 10.1109/IEEEDATA.2025.3566012.
- Gövde görselleri: **Mikael Häggström** — anterior/posterior insan gövdesi — Wikimedia Commons, **CC0 1.0**
  (yalnız gövde bölgesi kırpılmış, gereksiz anatomi gösterilmemiştir).
- Makine okunur atıf: `src/data/sources.json`; kullanıcıya "Kaynaklar" ekranında gösterilir.
- Hasta tanımlayıcı veri öğrenen arayüzüne sızmaz (§48).

## 13. Arayüz ve Yerleşim

- **16:9 uyumu:** Simülasyon ve öğrenme ekranları `100dvh` içinde kaydırmasız çalışır;
  sahne görseli kapsayıcıya sığdırılır, sağ panel kendi içinde kaydırılır (1366×768 ve 1920×1080 doğrulandı).
- **Tam ekran:** Header'daki "Tam Ekran" düğmesi `requestFullscreen` kullanır.
- **Responsive:** ≤1080px tek sütun (hasta önce, panel sonra); kütüphane yatay kaydırılabilir
  şeride dönüşür, araç çubuğu altta yapışkan kalır; ≤720px header gerekirse ikinci satıra sarar,
  dokunma hedefleri büyütülür. Yatay taşma yok — doğrulandı: 390×844 (telefon), 820×1180
  (tablet dikey), 1024×768 (tablet yatay), 1366×768 ve 1920×1080 (masaüstü, kaydırmasız).
- **Marka:** Header/landing/footer'da `public/brand` SVG kilidi kullanılır; slogan yok.

## 12. Bilinen Sınırlar (V1)

- Posterior akciğer noktaları yalnız Fraiwan importu ile ses alır (HLS-CMDS'te posterior kayıt yok).
- Erb noktası için veri setinde ayrı kayıt yoktur; nokta eğitim amaçlı işaretlenir, ses yok.
- Dalga formu oynatıcıda 10 s geri/ileri atlama stub (transport butonları devre dışı).
- SCORM 1.2 paketinde etkileşim sayısı ve suspend boyutu 1.2 limitlerine tabidir.
