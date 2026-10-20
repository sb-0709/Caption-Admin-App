import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { displayName, fmtDate, fmtNum } from '@/lib/format'

export const dynamic = 'force-dynamic'

const PAGE = 24

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; deleted?: string }>
}) {
  const { supabase } = await requireAdmin()
  const { q = '', page: pageRaw = '1', deleted } = await searchParams
  const page = Math.max(1, Number(pageRaw) || 1)

  let query = supabase
    .from('captions')
    .select('id, text, image_url, created_by, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1)
  if (q.trim()) query = query.ilike('text', `%${q.trim()}%`)

  const { data: captions, count, error } = await query
  const rows = captions ?? []

  const ids = rows.map((c) => c.id)
  const authorIds = [...new Set(rows.map((c) => c.created_by).filter(Boolean))]
  const [{ data: votes }, { data: authors }] = await Promise.all([
    ids.length
      ? supabase.from('votes').select('caption_id, vote_type').in('caption_id', ids)
      : Promise.resolve({ data: [] }),
    authorIds.length
      ? supabase.from('profiles').select('id, first_name, last_name').in('id', authorIds)
      : Promise.resolve({ data: [] }),
  ])
  const authorName = new Map((authors ?? []).map((a) => [a.id, displayName(a)]))
  const tally = new Map<number, { up: number; down: number }>()
  for (const v of votes ?? []) {
    const t = tally.get(v.caption_id) ?? { up: 0, down: 0 }
    if (v.vote_type === 'up') t.up++
    else t.down++
    tally.set(v.caption_id, t)
  }

  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE))
  const href = (p: number) => `/media?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`

  return (
    <>
      <header className="page-head row">
        <div>
          <p className="eyebrow">Create · read · update · delete</p>
          <h1 className="page-title">
            AI media <span className="count">{fmtNum(count ?? 0)}</span>
          </h1>
        </div>
        <Link href="/media/new" className="btn btn-primary">
          + New caption
        </Link>
      </header>

      {deleted && <p className="notice">Caption deleted.</p>}
      {error && <p className="alert">{error.message}</p>}

      <form className="toolbar" action="/media">
        <input name="q" defaultValue={q} placeholder="Search caption text…" className="input" />
        <button className="btn" type="submit">
          Search
        </button>
        {q && (
          <a href="/media" className="link-btn">
            Clear
          </a>
        )}
      </form>

      {rows.length === 0 ? (
        <p className="empty panel">No captions{q ? ` matching “${q}”` : ''}.</p>
      ) : (
        <div className="media-grid">
          {rows.map((c) => {
            const t = tally.get(c.id) ?? { up: 0, down: 0 }
            const net = t.up - t.down
            return (
              <Link key={c.id} href={`/media/${c.id}`} className="media-card">
                <div className="media-img">
                  {c.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.image_url} alt="" loading="lazy" />
                  ) : (
                    <span className="preview-empty">No image</span>
                  )}
                  <span className={`media-score mono ${net > 0 ? 'up' : net < 0 ? 'down' : ''}`}>
                    {net > 0 ? '+' : ''}
                    {net}
                  </span>
                </div>
                <div className="media-body">
                  <p className="media-text">“{(c.text ?? '').replace(/^["“”]+|["“”]+$/g, '')}”</p>
                  <p className="media-meta">
                    #{c.id} · {c.created_by ? authorName.get(c.created_by) ?? 'Unknown' : 'Unknown'} ·{' '}
                    {fmtDate(c.created_at)}
                  </p>
                  <p className="media-meta mono">
                    <span className="up">{t.up}▲</span> <span className="down">{t.down}▼</span>
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {pages > 1 && (
        <nav className="pager">
          {page > 1 ? <Link href={href(page - 1)}>← Newer</Link> : <span />}
          <span className="mono muted">
            Page {page} of {pages}
          </span>
          {page < pages ? <Link href={href(page + 1)}>Older →</Link> : <span />}
        </nav>
      )}
    </>
  )
}
