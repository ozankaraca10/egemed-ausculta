/** Sürüklenebilir stetoskop göğüs parçası (§11). Üretici logosu yok. */
export function Chestpiece({ onBody }: { onBody?: boolean }) {
  return (
    <svg viewBox="0 0 100 100">
      {/* zil/diyafram kasası */}
      <circle cx="50" cy="50" r="44" fill="#c9d4de" />
      <circle cx="50" cy="50" r="44" fill="none" stroke="#98a6b3" strokeWidth="2" />
      <circle cx="50" cy="50" r="36" fill="#eef1f4" />
      <circle cx="50" cy="50" r="36" fill="none" stroke="#aab6c2" strokeWidth="2.5" />
      <circle cx="50" cy="50" r="26" fill="#5b6b7a" />
      <circle cx="50" cy="50" r="26" fill="none" stroke="#414e5b" strokeWidth="3" />
      {/* taktik çizgiler */}
      <g stroke="#8b98a5" strokeWidth="1.6" opacity="0.8">
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((a) => {
          const r1 = 37, r2 = 43
          const rad = (a * Math.PI) / 180
          return (
            <line
              key={a}
              x1={50 + r1 * Math.cos(rad)}
              y1={50 + r1 * Math.sin(rad)}
              x2={50 + r2 * Math.cos(rad)}
              y2={50 + r2 * Math.sin(rad)}
            />
          )
        })}
      </g>
      <circle cx="50" cy="50" r="10" fill="#3d4854" />
      {/* tüp */}
      <path
        d="M50 94c0-14 20-18 20-36"
        fill="none"
        stroke="#1f2b38"
        strokeWidth="7"
        strokeLinecap="round"
        opacity={onBody ? 0.95 : 0}
        transform="translate(0 2)"
      />
      <circle cx="50" cy="94" r="6" fill="#1f2b38" opacity={onBody ? 0.95 : 0} />
    </svg>
  )
}
