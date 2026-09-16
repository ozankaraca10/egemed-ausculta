# EGEMED Ausculta — Denetim Bilgilendirmesi

Bu dosya, projeyi denetleyecek yapay zekâ/insan denetçi için hazırlanmıştır.
Denetime başlamadan önce **README.md** ve **docs/AUSCULTA.md** okunmalıdır.

## Proje nedir?
Tıp fakültesi öğrencileri için Türkçe, tarayıcı tabanlı **kardiyopulmoner oskültasyon
simülatörü**. Statik site olarak (LMS'siz) veya SCORM 1.2 paketi olarak çalışır.

- Teknoloji: Vite + React 19 + TypeScript, ses için Web Audio API, testler vitest,
  lint oxlint, e2e için playwright-core (yalnız scriptlerde).
- Dağıtım çıktıları: `npm run build:html` (bağımsız HTML) ve `npm run build:scorm` (SCORM 1.2).
- SCORM 2004 **kapsam dışıdır** ve paketlenmez.

## Dizin haritası
| Yol | İçerik |
|---|---|
| `src/screens/` | Ekranlar: Start, Tutorial, ModeSelect, Learn, Simulation, Results, Sources, DevPanel |
| `src/ui/` | Bileşenler: PatientStage (stetoskop/hotspot), Questions, Toolbar, HelpModal, torso-pediatric, icons |
| `src/core/` | store (durum+SCORM runtime), resolver (ses çözümleme), scoring, session (rastgele örnekleme), suspend, scorm, types, validation |
| `src/data/` | Vaka havuzu (`cases.json` + `cases-auto.json`), kütüphane (`library.json`), ses envanteri (`sounds.json`, `sounds-external.json`), kaynaklar (`sources.json`), metrikler, pediatrik referans |
| `scripts/` | `generate-cases.mjs` (veri setinden vaka üretimi), `validate-audio.mjs` (zorunlu bütünlük denetimi), `build-html.mjs`, `build-scorm.mjs`, `e2e-screens.mjs`, `e2e-session.mjs`, importörler |
| `tests/core.test.ts` | 67 test: senkronizasyon, skorlama, SCORM, tıbbi tutarlılık, suspend, örnekleme |
| `docs/` | Mimari/ilke dokümanı ve hekim gözden geçirme listesi (CSV) |

## Komutlar
```bash
npm install
npm test              # vitest (67 test)
npm run validate      # ses/kaynak bütünlüğü — ölümcül hatalarda çıkar
npm run lint
npx tsc -b
npm run dev           # geliştirme sunucusu (http://localhost:5173)
npm run e2e           # ekranların görsel/konsol denetimi
npm run e2e:session   # 10 vakalık değerlendirmeyi uçtan uca koşar
npm run build:html    # release/EGEMED-Ausculta-HTML(.zip)
npm run build:scorm   # dist/EGEMED-Ausculta-SCORM12.zip
```

## Denetim kapsamı (istenen)
UI, UX, güvenlik, SCORM 1.2 uyumu, mantık (logic) ve **tıbbi tutarlılık**.
Her bulgu için: önem derecesi (kritik/orta/düşük), kanıt (`dosya:satır`), önerilen düzeltme.

## Bilinçli tasarım kararları (bulgu değildir)
- **Çocuk fotoğrafı kullanılmaz**; pediatrik gövde şematik/anatomik illüstrasyondur (etik).
- **Cinsiyet seçici yoktur**; gövde erkek, pediatrik vakalarda çocuk gövdesidir.
- Değerlendirmede **tek dinleme** kuralı, işaret/ipucu yokluğu bilinçlidir.
- Klinik tanı iddiası yalnız doğrulanmış eşlemelerde (AF, taşikardi, AV blok) yapılır;
  üfürüm–kapak lezyonu eşlemesi **yapılmaz** (kanıt yetersizliği).
- ICBHI 2017 gibi yeniden dağıtıma kapalı veri setleri pakete **alınmaz**.
- Ses verileri depoda tutulmaz (lisans/boyut); `scripts/import-*` ile üretilir. Bu nedenle
  ses dosyaları olmadan `npm run dev` sessiz çalışır, arayüz ve mantık testleri etkilenmez.

## Hazır denetim istemi (kopyala-yapıştır)
> Bu depoyu UI, UX, güvenlik, SCORM 1.2, mantık ve tıbbi tutarlılık açılarından denetle.
> Önce README.md ve docs/AUSCULTA.md'yi oku; oradaki ilkeleri ölçüt kabul et.
> `npm test`, `npm run validate`, `npm run lint`, `npx tsc -b` komutlarını çalıştır ve
> sonuçları raporla. Ardından kod ve veri üzerinde şunları ara:
> (1) erişilebilirlik ve klavye kullanımı, (2) taşma/kırpılma/okunabilirlik sorunları,
> (3) XSS/enjeksiyon/ağ sızıntısı riskleri, (4) SCORM 1.2 alan eşlemeleri ve suspend_data
> boyut güvenliği, (5) durum yönetimi/kenar durum hataları, (6) soru kök ve seçeneklerinde
> Türkçe anlam bozuklukları ile tıbbi tutarsızlıklar (örn. yaşa uygun vital aralıkları,
> tanı iddiası sınırları). Her bulgu için önem derecesi, `dosya:satır` kanıtı ve somut
> düzeltme önerisi ver; sonunda önceliklendirilmiş bir eylem listesi üret.
