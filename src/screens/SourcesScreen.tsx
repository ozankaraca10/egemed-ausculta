import { useStore } from '../core/store'
import { Footer, EcgDeco } from '../ui/chrome'
import sourcesData from '../data/sources.json'
import { IconInfo } from '../ui/icons'

/** Kaynaklar ve Veri Setleri (§33). Attribution sources.json'dan UI'a ve makine okunur şekilde. */

export interface InventoryEntry {
  id: string
  title: string
  type: string
  population: string
  recordings: number
  sampleRateHz: number | null
  license: string
  licenseVerified: boolean
  status: string
  accessUrl: string
  notes: string
  importScript: string | null
  attributionText: string
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    bundled: 'pakete dahil',
    samples_included: 'örnekler aktarıldı',
    importer_ready: 'içe aktarılabilir',
    inventory_only: 'envanter (eşleme uygun değil)',
    license_review: 'lisans incelemesi gerekli',
  }
  return map[s] ?? s
}
function typeLabel(t: string): string {
  return t === 'heart' ? 'kalp sesleri' : t === 'lung' ? 'akciğer sesleri' : 'kalp + akciğer'
}

export function SourcesScreen() {
  const brandBlock = (
    <div className="brand-card">
      <img src="brand/logo-horizontal-web.png" alt="EGEMED Ausculta" />
      <p>
        EGEMED Ausculta, tıp fakültesi öğrencileri için geliştirilmiş kardiyopulmoner oskültasyon
        eğitimidir. Ses içerikleri lisanslı açık veri setlerinden oskültasyon taksonomisine doğrulanmış
        eşlemeyle aktarılmıştır (ayrıntı aşağıda).
      </p>
    </div>
  )
  const { dispatch } = useStore()
  return (
    <>
      <EcgDeco />
      <div className="screen" style={{ position: 'relative', zIndex: 1 }}>
        <div className="src-wrap screen-body">
          <h1 className="src-title">Kaynaklar ve Veri Setleri</h1>
          <p className="src-sub">Bu modülde kullanılan klinik ses kayıtları, atıf bilgileri ve araştırılan veri seti envanteri.</p>
          {brandBlock}

          <h2 className="inv-title">Veri Seti Envanteri</h2>
          <p className="src-sub">
            Platformun taksonomisiyle karşılaştırılan açık erişimli veri setleri. Yalnız lisansı doğrulanmış ve
            etiketleri birebir eşlenebilen veri setleri içeriğe alınır; uymayan etiketler uydurulmaz.
          </p>
          <div className="inv-rows">
            {(sourcesData.inventory as InventoryEntry[]).map((it) => (
              <div className={`inv-row ${it.status}`} key={it.id}>
                <div className="inv-head">
                  <b>{it.title}</b>
                  <span className={`inv-chip ${it.status}`}>{statusLabel(it.status)}</span>
                  {it.licenseVerified
                    ? <span className="inv-chip lic-ok">lisans doğrulandı</span>
                    : <span className="inv-chip lic-review">lisans incelemesi</span>}
                </div>
                <div className="inv-meta">
                  <span>{typeLabel(it.type)}</span>
                  <span>{it.population}</span>
                  <span>{it.recordings != null ? `${it.recordings.toLocaleString('tr-TR')} kayıt` : 'kayıt sayısı doğrulanmadı'}</span>
                  {it.sampleRateHz ? <span>{it.sampleRateHz} Hz</span> : null}
                  <span>{it.license}</span>
                </div>
                <div className="inv-notes">{it.notes}</div>
                <div className="inv-foot">
                  <span className="muted small">{it.attributionText}</span>
                  <a className="small" href={it.accessUrl} target="_blank" rel="noreferrer">kaynağa git ↗</a>
                </div>
                {it.importScript && <div className="inv-cmd"><code>{it.importScript}</code></div>}
              </div>
            ))}
          </div>

          {sourcesData.datasets.map((d) => (
            <div className="card src-card" key={d.id}>
              <h3>{d.title}</h3>
              <div className="auth">{d.authors.join(', ')}</div>
              <div className="src-kv">
                <span className="k">Veri seti DOI</span>
                <span className="v">{d.datasetDoi}</span>
                {d.articleDoi && (
                  <>
                    <span className="k">Makale DOI</span>
                    <span className="v">{d.articleDoi}</span>
                  </>
                )}
                <span className="k">Lisans</span>
                <span className="v">
                  <span className="license-chip">CC BY 4.0</span> — Creative Commons Attribution 4.0 International
                </span>
                <span className="k">Kullanım</span>
                <span className="v">{d.usage ?? d.status ?? 'Kaynak kayıtlar eğitim amaçlı kullanılmıştır.'}</span>
              </div>
              <p className="muted small mt-12">{d.attributionText}</p>
            </div>
          ))}

          {sourcesData.assets?.map((a: { id: string; title: string; authors: string[]; source: string; license: string; usage: string; attributionText: string }) => (
            <div className="card src-card" key={a.id}>
              <h3>{a.title}</h3>
              <div className="auth">{a.authors.join(', ')} — {a.source}</div>
              <div className="src-kv">
                <span className="k">Lisans</span>
                <span className="v"><span className="license-chip">CC0 1.0</span> — {a.license}</span>
                <span className="k">Kullanım</span>
                <span className="v">{a.usage}</span>
              </div>
              <p className="muted small mt-12">{a.attributionText}</p>
            </div>
          ))}

          <div className="card">
            <div className="note-strip" style={{ marginTop: 0 }}>
              <IconInfo />
              <span>{sourcesData.disclaimer}</span>
            </div>
            <p className="muted small mt-12">
              Atıf verileri makine okunur olarak <code>src/data/sources.json</code> dosyasında da saklanır.
              Bu modül; tıp fakültesi öğrencilerine yönelik eğitim amaçlı geliştirilmiştir (EGEMED).
            </p>
          </div>

          <div className="results-actions" style={{ justifyContent: 'flex-start' }}>
            <button className="btn outline" onClick={() => dispatch({ type: 'goto', screen: 'start' })}>
              ← Geri
            </button>
          </div>
        </div>
      </div>
      <Footer />
    </>
  )
}
