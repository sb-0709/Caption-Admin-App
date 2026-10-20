import type { Stats } from '@/lib/stats'

/** Diverging bars: upvotes rise above the line, downvotes hang below it. */
export function ActivityChart({ days }: { days: Stats['days'] }) {
  const W = 720
  const H = 240
  const padL = 34
  const padR = 8
  const mid = 120
  const maxUp = Math.max(1, ...days.map((d) => d.up))
  const maxDown = Math.max(1, ...days.map((d) => d.down))
  const max = Math.max(maxUp, maxDown)
  const half = 92
  const step = (W - padL - padR) / days.length
  const bw = Math.max(4, step - 6)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Votes per day, last 30 days">
      <line x1={padL} x2={W - padR} y1={mid} y2={mid} className="axis" />
      <text x={padL - 6} y={mid - half + 4} className="tick" textAnchor="end">
        {max}
      </text>
      <text x={padL - 6} y={mid + 4} className="tick" textAnchor="end">
        0
      </text>
      <text x={padL - 6} y={mid + half + 4} className="tick" textAnchor="end">
        {max}
      </text>
      {days.map((d, i) => {
        const x = padL + i * step + (step - bw) / 2
        const hu = (d.up / max) * half
        const hd = (d.down / max) * half
        return (
          <g key={d.key}>
            <title>{`${d.label}: ${d.up} up · ${d.down} down · ${d.captions} new captions`}</title>
            {d.up > 0 && <rect x={x} y={mid - hu} width={bw} height={hu} rx={1.5} className="bar-up" />}
            {d.down > 0 && <rect x={x} y={mid + 1} width={bw} height={hd} rx={1.5} className="bar-down" />}
            {d.captions > 0 && <circle cx={x + bw / 2} cy={mid - hu - 7} r={2.6} className="dot" />}
              {(days.length - 1 - i) % 7 === 0 ? (
              <text x={x + bw / 2} y={H - 4} className="tick" textAnchor="middle">
                {d.label}
              </text>
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function Heatmap({ heat }: { heat: number[][] }) {
  const max = Math.max(1, ...heat.flat())
  const cell = 26
  const gap = 3
  const padL = 36
  const padT = 4
  const W = padL + 24 * (cell + gap)
  const H = padT + 7 * (cell + gap) + 20

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Activity by weekday and hour">
      {heat.map((row, d) => (
        <g key={d}>
          <text x={padL - 8} y={padT + d * (cell + gap) + cell / 2 + 4} className="tick" textAnchor="end">
            {DAYS[d]}
          </text>
          {row.map((n, h) => (
            <rect
              key={h}
              x={padL + h * (cell + gap)}
              y={padT + d * (cell + gap)}
              width={cell}
              height={cell}
              rx={3}
              className={n === 0 ? 'heat-empty' : 'heat'}
              style={n === 0 ? undefined : { opacity: 0.18 + 0.82 * (n / max) }}
            >
              <title>{`${DAYS[d]} ${h}:00 — ${n} actions`}</title>
            </rect>
          ))}
        </g>
      ))}
      {[0, 6, 12, 18, 23].map((h) => (
        <text key={h} x={padL + h * (cell + gap) + cell / 2} y={H - 4} className="tick" textAnchor="middle">
          {h === 0 ? '12a' : h === 12 ? '12p' : h < 12 ? `${h}a` : `${h - 12}p`}
        </text>
      ))}
    </svg>
  )
}

export function LengthChart({ buckets }: { buckets: Stats['buckets'] }) {
  const maxAbs = Math.max(0.5, ...buckets.map((b) => Math.abs(b.avg)))
  const best = buckets.reduce((a, b) => (b.count && b.avg > a.avg ? b : a), buckets[0])
  return (
    <div className="hbars">
      {buckets.map((b) => {
        const pct = (Math.abs(b.avg) / maxAbs) * 50
        return (
          <div className="hbar-row" key={b.label}>
            <span className="hbar-label">{b.label}</span>
            <div className="hbar-track">
              <span className="hbar-zero" />
              {b.count > 0 && (
                <span
                  className={b.avg >= 0 ? 'hbar-fill up' : 'hbar-fill down'}
                  style={b.avg >= 0 ? { left: '50%', width: `${pct}%` } : { right: '50%', width: `${pct}%` }}
                />
              )}
            </div>
            <span className={`hbar-val mono ${b === best && b.count ? 'win' : ''}`}>
              {b.count ? (b.avg > 0 ? '+' : '') + b.avg.toFixed(1) : '—'}
              <small> n={b.count}</small>
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function RatioBar({ up, down }: { up: number; down: number }) {
  const total = up + down || 1
  const pUp = (up / total) * 100
  return (
    <div>
      <div className="ratio">
        <span className="ratio-up" style={{ width: `${pUp}%` }} />
        <span className="ratio-down" style={{ width: `${100 - pUp}%` }} />
      </div>
      <div className="ratio-legend">
        <span>
          <i className="sw up" /> {Math.round(pUp)}% up · {up}
        </span>
        <span>
          {down} · {Math.round(100 - pUp)}% down <i className="sw down" />
        </span>
      </div>
    </div>
  )
}
