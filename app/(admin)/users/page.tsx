import { requireAdmin } from '@/lib/auth'
import AdminToggle from '@/components/AdminToggle'
import { displayName, fetchAll, fmtDate, fmtNum } from '@/lib/format'
import type { Caption, Vote } from '@/lib/stats'

export const dynamic = 'force-dynamic'

type AdminUser = {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  is_superadmin: boolean | null
  created_at: string | null
  last_sign_in_at: string | null
}

export default async function UsersPage({
                                          searchParams,
                                        }: {
  searchParams: Promise<{ q?: string; sort?: string }>
}) {
  const { supabase, user: me } = await requireAdmin()
  const { q = '', sort = 'votes' } = await searchParams

  const [usersRes, captions, votes] = await Promise.all([
    supabase.rpc('admin_list_users'),
    fetchAll<Pick<Caption, 'id' | 'created_by'>>((a, b) =>
        supabase.from('captions').select('id, created_by').range(a, b)
    ),
    fetchAll<Pick<Vote, 'caption_id' | 'user_id' | 'vote_type'>>((a, b) =>
        supabase.from('votes').select('caption_id, user_id, vote_type').range(a, b)
    ),
  ])
  const users = (usersRes.data ?? []) as AdminUser[]

  const authorOf = new Map(captions.map((c) => [c.id, c.created_by]))
  const stats = new Map<string, { made: number; up: number; down: number; received: number }>()
  const get = (id: string) => {
    let s = stats.get(id)
    if (!s) stats.set(id, (s = { made: 0, up: 0, down: 0, received: 0 }))
    return s
  }
  for (const c of captions) if (c.created_by) get(c.created_by).made++
  for (const v of votes) {
    const s = get(v.user_id)
    if (v.vote_type === 'up') s.up++
    else s.down++
    const author = authorOf.get(v.caption_id)
    if (author) get(author).received += v.vote_type === 'up' ? 1 : -1
  }

  const needle = q.trim().toLowerCase()
  const rows = users
      .map((p) => ({ ...p, name: displayName(p), ...(stats.get(p.id) ?? { made: 0, up: 0, down: 0, received: 0 }) }))
      .filter(
          (p) =>
              !needle ||
              p.name.toLowerCase().includes(needle) ||
              (p.email ?? '').toLowerCase().includes(needle) ||
              p.id.startsWith(needle)
      )
      .sort((a, b) => {
        if (sort === 'name') return a.name.localeCompare(b.name)
        if (sort === 'email') return (a.email ?? '').localeCompare(b.email ?? '')
        if (sort === 'captions') return b.made - a.made
        if (sort === 'score') return b.received - a.received
        if (sort === 'joined') return (b.created_at ?? '').localeCompare(a.created_at ?? '')
        if (sort === 'admin') return Number(!!b.is_superadmin) - Number(!!a.is_superadmin)
        return b.up + b.down - (a.up + a.down)
      })

  const adminCount = users.filter((u) => u.is_superadmin).length

  const sortLink = (key: string, label: string) => (
      <a href={`/users?${new URLSearchParams({ q, sort: key })}`} className={sort === key ? 'th-sort active' : 'th-sort'}>
        {label}
      </a>
  )

  return (
      <>
        <header className="page-head">
          <p className="eyebrow">Read · manage admin access</p>
          <h1 className="page-title">
            Users <span className="count">{fmtNum(users.length)}</span>
          </h1>
          <p className="lede small">
            {adminCount} superadmin{adminCount === 1 ? '' : 's'}. Superadmins can open this panel and edit or delete
            any caption.
          </p>
        </header>

        {usersRes.error && (
            <p className="alert">
              Couldn&apos;t load users: {usersRes.error.message}. Did you run the new SQL in Supabase?
            </p>
        )}

        <form className="toolbar" action="/users">
          <input name="q" defaultValue={q} placeholder="Search by name, email or ID…" className="input" />
          <input type="hidden" name="sort" value={sort} />
          <button className="btn" type="submit">
            Search
          </button>
          {q && (
              <a href="/users" className="link-btn">
                Clear
              </a>
          )}
        </form>

        <div className="table-wrap">
          <table className="table">
            <thead>
            <tr>
              <th>{sortLink('name', 'User')}</th>
              <th>{sortLink('email', 'Email')}</th>
              <th className="num">{sortLink('captions', 'Captions')}</th>
              <th className="num">{sortLink('votes', 'Votes given')}</th>
              <th className="num">{sortLink('score', 'Score')}</th>
              <th>{sortLink('joined', 'Joined')}</th>
              <th>{sortLink('admin', 'Admin')}</th>
            </tr>
            </thead>
            <tbody>
            {rows.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="cell-user">
                      {p.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.avatar_url} alt="" className="avatar sm" />
                      ) : (
                          <span className="avatar sm avatar-blank">{p.name.slice(0, 1)}</span>
                      )}
                      <span>
                      {p.name}
                        {p.is_superadmin && <span className="badge">superadmin</span>}
                        {!p.first_name && <span className="badge badge-muted">no name</span>}
                    </span>
                    </div>
                  </td>
                  <td>
                    {p.email ? (
                        <a href={`mailto:${p.email}`} className="email">
                          {p.email}
                        </a>
                    ) : (
                        <span className="muted">—</span>
                    )}
                  </td>
                  <td className="num mono">{p.made}</td>
                  <td className="num mono">
                    <span className="up">{p.up}▲</span> <span className="down">{p.down}▼</span>
                  </td>
                  <td className={`num mono ${p.received > 0 ? 'up' : p.received < 0 ? 'down' : ''}`}>
                    {p.received > 0 ? '+' : ''}
                    {p.received}
                  </td>
                  <td className="muted nowrap" title={`Last sign-in: ${fmtDate(p.last_sign_in_at)}`}>
                    {fmtDate(p.created_at)}
                  </td>
                  <td>
                    <AdminToggle userId={p.id} name={p.name} isAdmin={!!p.is_superadmin} isSelf={p.id === me.id} />
                  </td>
                </tr>
            ))}
            {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty">
                    No users match “{q}”.
                  </td>
                </tr>
            )}
            </tbody>
          </table>
        </div>
      </>
  )
}