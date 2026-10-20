import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { displayName, fmtDate, fmtNum, truncate } from '@/lib/format'

export const dynamic = 'force-dynamic'

const PAGE = 50

export default async function VotesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; page?: string }>
}) {
  const { supabase } = await requireAdmin()
  const { type = 'all', page: pageRaw = '1' } = await searchParams
  const page = Math.max(1, Number(pageRaw) || 1)

  let query = supabase
    .from('votes')
    .select('id, user_id, caption_id, vote_type, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1)
  if (type === 'up' || type === 'down') query = query.eq('vote_type', type)

  const [{ data: votes, count, error }, { count: upCount }, { count: downCount }] = await Promise.all([
    query,
    supabase.from('votes').select('id', { count: 'exact', head: true }).eq('vote_type', 'up'),
    supabase.from('votes').select('id', { count: 'exact', head: true }).eq('vote_type', 'down'),
  ])
  const rows = votes ?? []

  const userIds = [...new Set(rows.map((v) => v.user_id))]
  const captionIds = [...new Set(rows.map((v) => v.caption_id))]
  const [{ data: users }, { data: captions }] = await Promise.all([
    userIds.length
      ? supabase.from('profiles').select('id, first_name, last_name, avatar_url').in('id', userIds)
      : Promise.resolve({ data: [] }),
    captionIds.length
      ? supabase.from('captions').select('id, text, image_url').in('id', captionIds)
      : Promise.resolve({ data: [] }),
  ])
  const userById = new Map((users ?? []).map((u) => [u.id, u]))
  const captionById = new Map((captions ?? []).map((c) => [c.id, c]))

  const total = (upCount ?? 0) + (downCount ?? 0)
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE))
  const href = (t: string, p = 1) => `/votes?${new URLSearchParams({ type: t, page: String(p) })}`

  return (
    <>
      <header className="page-head">
        <p className="eyebrow">Read only</p>
        <h1 className="page-title">
          Votes <span className="count">{fmtNum(total)}</span>
        </h1>
      </header>

      <div className="tabs">
        <Link href={href('all')} className={type === 'all' ? 'tab active' : 'tab'}>
          All <span className="mono">{fmtNum(total)}</span>
        </Link>
        <Link href={href('up')} className={type === 'up' ? 'tab active' : 'tab'}>
          ▲ Upvotes <span className="mono">{fmtNum(upCount ?? 0)}</span>
        </Link>
        <Link href={href('down')} className={type === 'down' ? 'tab active' : 'tab'}>
          ▼ Downvotes <span className="mono">{fmtNum(downCount ?? 0)}</span>
        </Link>
      </div>

      {error && <p className="alert">{error.message}</p>}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Vote</th>
              <th>Voter</th>
              <th>Caption</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => {
              const u = userById.get(v.user_id)
              const c = captionById.get(v.caption_id)
              return (
                <tr key={v.id}>
                  <td>
                    <span className={v.vote_type === 'up' ? 'pill up' : 'pill down'}>
                      {v.vote_type === 'up' ? '▲ up' : '▼ down'}
                    </span>
                  </td>
                  <td>
                    <div className="cell-user">
                      {u?.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={u.avatar_url} alt="" className="avatar sm" />
                      ) : (
                        <span className="avatar sm avatar-blank">{displayName(u).slice(0, 1)}</span>
                      )}
                      {displayName(u)}
                    </div>
                  </td>
                  <td>
                    <Link href={`/media/${v.caption_id}`} className="cell-caption">
                      {c?.image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.image_url} alt="" className="thumb sm" />
                      )}
                      <span>{c ? `“${truncate(c.text, 60)}”` : `#${v.caption_id}`}</span>
                    </Link>
                  </td>
                  <td className="muted">{fmtDate(v.created_at)}</td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="empty">
                  No votes here yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav className="pager">
          {page > 1 ? <Link href={href(type, page - 1)}>← Newer</Link> : <span />}
          <span className="mono muted">
            Page {page} of {pages}
          </span>
          {page < pages ? <Link href={href(type, page + 1)}>Older →</Link> : <span />}
        </nav>
      )}
    </>
  )
}
