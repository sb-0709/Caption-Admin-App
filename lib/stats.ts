import type { SupabaseClient } from '@supabase/supabase-js'
import { displayName, fetchAll } from '@/lib/format'

export type Profile = {
  id: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  is_superadmin: boolean | null
}
export type Caption = {
  id: number
  text: string | null
  image_url: string | null
  created_by: string | null
  created_at: string
}
export type Vote = {
  caption_id: number
  user_id: string
  vote_type: 'up' | 'down'
  created_at: string
}

const TZ = 'America/New_York'

// "YYYY-MM-DD" for a timestamp, in Eastern time
function dayKey(d: Date) {
  return d.toLocaleDateString('en-CA', { timeZone: TZ })
}
function weekdayHour(d: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short',
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(d)
  const wd = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon'
  const hr = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  return { day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(wd), hour: hr % 24 }
}

export async function loadStats(supabase: SupabaseClient) {
  const [profiles, captions, votes] = await Promise.all([
    fetchAll<Profile>((a, b) =>
      supabase.from('profiles').select('id, first_name, last_name, avatar_url, is_superadmin').range(a, b)
    ),
    fetchAll<Caption>((a, b) =>
      supabase.from('captions').select('id, text, image_url, created_by, created_at').range(a, b)
    ),
    fetchAll<Vote>((a, b) =>
      supabase.from('votes').select('caption_id, user_id, vote_type, created_at').range(a, b)
    ),
  ])

  const profileById = new Map(profiles.map((p) => [p.id, p]))
  const nameOf = (id: string | null) => (id ? displayName(profileById.get(id)) : 'Unknown')

  // ---- headline numbers
  const ups = votes.filter((v) => v.vote_type === 'up').length
  const downs = votes.length - ups
  const named = profiles.filter((p) => p.first_name && p.last_name).length
  const withAvatar = profiles.filter((p) => p.avatar_url).length

  // ---- per-caption tallies
  const tally = new Map<number, { up: number; down: number }>()
  for (const v of votes) {
    const t = tally.get(v.caption_id) ?? { up: 0, down: 0 }
    if (v.vote_type === 'up') t.up++
    else t.down++
    tally.set(v.caption_id, t)
  }
  const scored = captions.map((c) => {
    const t = tally.get(c.id) ?? { up: 0, down: 0 }
    return { ...c, up: t.up, down: t.down, score: t.up - t.down, total: t.up + t.down, author: nameOf(c.created_by) }
  })

  const hallOfFame = [...scored]
    .filter((c) => c.total > 0)
    .sort((a, b) => b.score - a.score || b.total - a.total)
    .slice(0, 5)

  // Divisive = lots of votes on BOTH sides. 2*min(up,down) = how many votes "cancel out".
  const divisive = [...scored]
    .filter((c) => c.up > 0 && c.down > 0)
    .sort((a, b) => Math.min(b.up, b.down) - Math.min(a.up, a.down) || b.total - a.total)
    .slice(0, 3)

  const neverVoted = scored.filter((c) => c.total === 0).length

  // ---- 30-day activity (Eastern time)
  const days: { key: string; label: string; up: number; down: number; captions: number }[] = []
  const today = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86_400_000)
    days.push({
      key: dayKey(d),
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: TZ }),
      up: 0,
      down: 0,
      captions: 0,
    })
  }
  const dayIdx = new Map(days.map((d, i) => [d.key, i]))
  for (const v of votes) {
    const i = dayIdx.get(dayKey(new Date(v.created_at)))
    if (i === undefined) continue
    if (v.vote_type === 'up') days[i].up++
    else days[i].down++
  }
  for (const c of captions) {
    const i = dayIdx.get(dayKey(new Date(c.created_at)))
    if (i !== undefined) days[i].captions++
  }

  // Busiest day of all time
  const allDays = new Map<string, number>()
  for (const v of votes) {
    const k = dayKey(new Date(v.created_at))
    allDays.set(k, (allDays.get(k) ?? 0) + 1)
  }
  const busiest = [...allDays.entries()].sort((a, b) => b[1] - a[1])[0] ?? null

  // ---- weekday × hour heatmap (votes + captions = "activity")
  const heat: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
  for (const e of [...votes, ...captions]) {
    const { day, hour } = weekdayHour(new Date(e.created_at))
    if (day >= 0) heat[day][hour]++
  }
  let peak = { day: 0, hour: 0, n: 0 }
  heat.forEach((row, d) => row.forEach((n, h) => n > peak.n && (peak = { day: d, hour: h, n })))

  // ---- voter personalities
  const voters = new Map<string, { up: number; down: number }>()
  for (const v of votes) {
    const t = voters.get(v.user_id) ?? { up: 0, down: 0 }
    if (v.vote_type === 'up') t.up++
    else t.down++
    voters.set(v.user_id, t)
  }
  const voterList = [...voters.entries()].map(([id, t]) => ({
    id,
    name: nameOf(id),
    avatar: profileById.get(id)?.avatar_url ?? null,
    up: t.up,
    down: t.down,
    total: t.up + t.down,
    upRate: t.up / (t.up + t.down),
  }))
  const mostActive = [...voterList].sort((a, b) => b.total - a.total)[0] ?? null
  const minVotes = Math.min(3, Math.max(1, ...voterList.map((v) => v.total)))
  const eligible = voterList.filter((v) => v.total >= minVotes)
  const sweetheart = [...eligible].sort((a, b) => b.upRate - a.upRate || b.total - a.total)[0] ?? null
  const critic = [...eligible].sort((a, b) => b.down - a.down || a.upRate - b.upRate)[0] ?? null

  // ---- creators
  const creators = new Map<string, { count: number; score: number; up: number }>()
  for (const c of scored) {
    if (!c.created_by) continue
    const t = creators.get(c.created_by) ?? { count: 0, score: 0, up: 0 }
    t.count++
    t.score += c.score
    t.up += c.up
    creators.set(c.created_by, t)
  }
  const topCreators = [...creators.entries()]
    .map(([id, t]) => ({ id, name: nameOf(id), avatar: profileById.get(id)?.avatar_url ?? null, ...t }))
    .sort((a, b) => b.score - a.score || b.count - a.count)
    .slice(0, 5)

  // ---- does brevity win? average score by caption word count
  const buckets = [
    { label: '1–5 words', min: 1, max: 5 },
    { label: '6–10 words', min: 6, max: 10 },
    { label: '11–15 words', min: 11, max: 15 },
    { label: '16–20 words', min: 16, max: 20 },
    { label: '21+ words', min: 21, max: Infinity },
  ].map((b) => {
    const inB = scored.filter((c) => {
      const w = (c.text ?? '').trim().split(/\s+/).filter(Boolean).length
      return w >= b.min && w <= b.max
    })
    const avg = inB.length ? inB.reduce((s, c) => s + c.score, 0) / inB.length : 0
    return { label: b.label, count: inB.length, avg }
  })

  // ---- people who signed up but never did anything
  const active = new Set<string>([...voters.keys(), ...creators.keys()])
  const lurkers = profiles.filter((p) => !active.has(p.id)).length

  return {
    totals: {
      users: profiles.length,
      captions: captions.length,
      votes: votes.length,
      ups,
      downs,
      admins: profiles.filter((p) => p.is_superadmin).length,
    },
    completion: { named, withAvatar, total: profiles.length },
    hallOfFame,
    divisive,
    neverVoted,
    days,
    busiest,
    heat,
    peak,
    personalities: { mostActive, sweetheart, critic },
    topCreators,
    buckets,
    lurkers,
  }
}

export type Stats = Awaited<ReturnType<typeof loadStats>>
