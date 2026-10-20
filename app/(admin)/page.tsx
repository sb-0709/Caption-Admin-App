import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { loadStats } from '@/lib/stats'
import { fmtNum, truncate } from '@/lib/format'
import { ActivityChart, Heatmap, LengthChart, RatioBar } from '@/components/charts'

export const dynamic = 'force-dynamic'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const hourLabel = (h: number) => (h === 0 ? '12 AM' : h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`)

export default async function OverviewPage() {
  const { supabase } = await requireAdmin()
  const s = await loadStats(supabase)
  const { mostActive, sweetheart, critic } = s.personalities

  const dateline = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York',
  })
  const last30 = s.days.reduce((n, d) => n + d.up + d.down, 0)
  const votesPerCaption = s.totals.captions ? s.totals.votes / s.totals.captions : 0

  return (
    <>
      <header className="page-head">
        <p className="eyebrow">{dateline} · Morning edition</p>
        <h1 className="page-title">
          What the crowd <em>thinks</em>.
        </h1>
        <p className="lede">
          {fmtNum(s.totals.users)} people have cast {fmtNum(s.totals.votes)} votes on{' '}
          {fmtNum(s.totals.captions)} AI-generated captions — {fmtNum(last30)} of them in the last 30 days.
        </p>
      </header>

      <section className="kpis">
        <div className="kpi">
          <span className="kpi-label">Users</span>
          <span className="kpi-num">{fmtNum(s.totals.users)}</span>
          <span className="kpi-note">{s.totals.admins} superadmin{s.totals.admins === 1 ? '' : 's'}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">AI media</span>
          <span className="kpi-num">{fmtNum(s.totals.captions)}</span>
          <span className="kpi-note">{s.neverVoted} never voted on</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Votes cast</span>
          <span className="kpi-num">{fmtNum(s.totals.votes)}</span>
          <span className="kpi-note">{votesPerCaption.toFixed(1)} per caption</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Mood</span>
          <span className="kpi-num">
            {s.totals.votes ? Math.round((s.totals.ups / s.totals.votes) * 100) : 0}
            <small>%</small>
          </span>
          <span className="kpi-note">of votes are upvotes</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Lurkers</span>
          <span className="kpi-num">{fmtNum(s.lurkers)}</span>
          <span className="kpi-note">signed up, never voted or posted</span>
        </div>
      </section>

      <section className="grid-2-1">
        <article className="panel">
          <div className="panel-head">
            <h2>The last 30 days</h2>
            <p>
              Upvotes rise, downvotes sink. <span className="dot-key" /> marks a day new captions were made.
            </p>
          </div>
          <ActivityChart days={s.days} />
          {s.busiest && (
            <p className="footnote">
              Busiest day on record: <strong>{s.busiest[0]}</strong> with {s.busiest[1]} votes.
            </p>
          )}
        </article>
        <article className="panel">
          <div className="panel-head">
            <h2>Thumbs up or down?</h2>
            <p>Every vote ever cast.</p>
          </div>
          <RatioBar up={s.totals.ups} down={s.totals.downs} />
          <div className="completion">
            <h3>Profile completeness</h3>
            <Meter label="Added a name" n={s.completion.named} of={s.completion.total} />
            <Meter label="Uploaded a photo" n={s.completion.withAvatar} of={s.completion.total} />
          </div>
        </article>
      </section>

      <section className="grid-2">
        <article className="panel">
          <div className="panel-head">
            <h2>Hall of fame</h2>
            <p>Highest net score (up − down).</p>
          </div>
          {s.hallOfFame.length === 0 ? (
            <p className="empty">No votes yet.</p>
          ) : (
            <ol className="rank">
              {s.hallOfFame.map((c, i) => (
                <li key={c.id}>
                  <span className="rank-n">{i + 1}</span>
                  {c.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.image_url} alt="" className="thumb" />
                  ) : (
                    <span className="thumb thumb-blank" />
                  )}
                  <Link href={`/media/${c.id}`} className="rank-text">
                    “{truncate(c.text, 70)}”<small>by {c.author}</small>
                  </Link>
                  <span className="score up mono">+{c.score}</span>
                </li>
              ))}
            </ol>
          )}
        </article>
        <article className="panel">
          <div className="panel-head">
            <h2>Most divisive</h2>
            <p>Captions that split the room down the middle.</p>
          </div>
          {s.divisive.length === 0 ? (
            <p className="empty">Nothing controversial yet — everyone agrees.</p>
          ) : (
            <ul className="divisive">
              {s.divisive.map((c) => (
                <li key={c.id}>
                  <Link href={`/media/${c.id}`}>“{truncate(c.text, 90)}”</Link>
                  <div className="tug">
                    <span className="tug-up" style={{ flex: c.up }}>
                      {c.up}▲
                    </span>
                    <span className="tug-down" style={{ flex: c.down }}>
                      ▼{c.down}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>When is everyone here?</h2>
          <p>
            Votes and new captions by weekday and hour (Eastern).{' '}
            {s.peak.n > 0 && (
              <>
                Peak: <strong>{DAYS[s.peak.day]}s around {hourLabel(s.peak.hour)}</strong>.
              </>
            )}
          </p>
        </div>
        <div className="scroll-x">
          <Heatmap heat={s.heat} />
        </div>
      </section>

      <section className="grid-2">
        <article className="panel">
          <div className="panel-head">
            <h2>Voter personalities</h2>
            <p>Who&apos;s generous, who&apos;s tough.</p>
          </div>
          <div className="persona-grid">
            <Persona title="Most active" who={mostActive} stat={mostActive && `${mostActive.total} votes`} />
            <Persona
              title="The sweetheart"
              who={sweetheart}
              stat={sweetheart && `${Math.round(sweetheart.upRate * 100)}% upvotes`}
            />
            <Persona title="Harshest critic" who={critic} stat={critic && `${critic.down} downvotes`} />
          </div>
        </article>
        <article className="panel">
          <div className="panel-head">
            <h2>Top creators</h2>
            <p>Total score across everything they generated.</p>
          </div>
          {s.topCreators.length === 0 ? (
            <p className="empty">No captions with an author yet.</p>
          ) : (
            <ol className="rank">
              {s.topCreators.map((c, i) => (
                <li key={c.id}>
                  <span className="rank-n">{i + 1}</span>
                  {c.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.avatar} alt="" className="avatar sm" />
                  ) : (
                    <span className="avatar sm avatar-blank">{c.name.slice(0, 1)}</span>
                  )}
                  <span className="rank-text">
                    {c.name}
                    <small>
                      {c.count} caption{c.count === 1 ? '' : 's'} · {c.up} upvotes received
                    </small>
                  </span>
                  <span className={`score mono ${c.score >= 0 ? 'up' : 'down'}`}>
                    {c.score > 0 ? '+' : ''}
                    {c.score}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </article>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Does brevity win?</h2>
          <p>Average net score by caption length. Highlighted: the length that performs best.</p>
        </div>
        <LengthChart buckets={s.buckets} />
      </section>
    </>
  )
}

function Meter({ label, n, of }: { label: string; n: number; of: number }) {
  const pct = of ? Math.round((n / of) * 100) : 0
  return (
    <div className="meter">
      <div className="meter-top">
        <span>{label}</span>
        <span className="mono">
          {n}/{of} · {pct}%
        </span>
      </div>
      <div className="meter-track">
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Persona({
  title,
  who,
  stat,
}: {
  title: string
  who: { name: string; avatar: string | null } | null
  stat: string | null
}) {
  return (
    <div className="persona">
      <span className="persona-title">{title}</span>
      {who ? (
        <>
          {who.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={who.avatar} alt="" className="avatar lg" />
          ) : (
            <span className="avatar lg avatar-blank">{who.name.slice(0, 1)}</span>
          )}
          <span className="persona-name">{who.name}</span>
          <span className="persona-stat mono">{stat}</span>
        </>
      ) : (
        <span className="empty">—</span>
      )}
    </div>
  )
}
