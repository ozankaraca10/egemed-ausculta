import { useStore } from '../core/store'
import { Footer, EcgDeco } from '../ui/chrome'
import sourcesData from '../data/sources.json'
import { IconInfo } from '../ui/icons'

/** Kaynaklar ve Veri Setleri (§33). Attribution sources.json'dan UI'a ve makine okunur şekilde. */

export function SourcesScreen() {
  const { dispatch } = useStore()
  return (
    <>
      <EcgDeco />
      <div className="screen" style={{ position: 'relative', zIndex: 1 }}>
        <div className="src-wrap screen-body">
          <h1 className="src-title">Kaynaklar ve Veri Setleri</h1>
          <p className="src-sub">Bu modülde kullanılan klinik ses kayıtları ve atıf bilgileri.</p>

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
