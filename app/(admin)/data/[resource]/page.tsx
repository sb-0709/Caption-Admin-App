import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { getResource, opsLabel } from '@/lib/resources'
import { loadRefLabels } from '@/lib/refs'
import { fmtNum } from '@/lib/format'
import Cell from '@/components/Cell'
import RequestStats from '@/components/RequestStats'

export const dynamic = 'force-dynamic'

const PAGE = 25

export default async function ResourceListPage({
                                                   params,
                                                   searchParams,
                                               }: {
    params: Promise<{ resource: string }>
    searchParams: Promise<{ q?: string; page?: string; deleted?: string; status?: string }>
}) {
    const { supabase } = await requireAdmin()
    const { resource } = await params
    const r = getResource(resource)
    if (!r) notFound()

    const { q = '', page: pageRaw = '1', deleted, status = '' } = await searchParams
    const page = Math.max(1, Number(pageRaw) || 1)
    const listFields = r.fields.filter((f) => f.list)

    let query = supabase
        .from(r.table)
        .select('*', { count: 'exact' })
        .order(r.order.column, { ascending: r.order.ascending })
        .order('id', { ascending: true })
        .range((page - 1) * PAGE, page * PAGE - 1)

    const needle = q.trim().replace(/[,()%]/g, ' ')
    if (needle && r.search?.length) {
        query = query.or(r.search.map((c) => `${c}.ilike.%${needle}%`).join(','))
    }
    const hasStatus = r.fields.some((f) => f.name === 'status')
    if (hasStatus && ['pending', 'success', 'error'].includes(status)) query = query.eq('status', status)

    const { data, count, error } = await query
    const rows = (data ?? []) as Record<string, unknown>[]
    const refs = await loadRefLabels(supabase, listFields, rows)
    const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE))

    const href = (p: number, extra: Record<string, string> = {}) =>
        `/data/${r.key}?${new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}), page: String(p), ...extra })}`

    return (
        <>
            <header className="page-head row">
                <div>
                    <p className="eyebrow">
                        {r.group} · {opsLabel(r)}
                    </p>
                    <h1 className="page-title">
                        {r.title} <span className="count">{fmtNum(count ?? 0)}</span>
                    </h1>
                    <p className="lede small">{r.description}</p>
                </div>
                {r.ops.create && (
                    <Link href={`/data/${r.key}/new`} className="btn btn-primary">
                        + New {r.singular}
                    </Link>
                )}
            </header>

            {deleted && <p className="notice">Deleted.</p>}
            {error && (
                <p className="alert">
                    {error.message}. Did you run <code>03_week7.sql</code>?
                </p>
            )}

            {r.table === 'generation_requests' && <RequestStats />}

            {(r.search?.length || hasStatus) && (
                <form className="toolbar" action={`/data/${r.key}`}>
                    {r.search?.length ? (
                        <input name="q" defaultValue={q} placeholder={`Search ${r.title.toLowerCase()}…`} className="input" />
                    ) : null}
                    {hasStatus && (
                        <select name="status" defaultValue={status} className="input select">
                            <option value="">All statuses</option>
                            <option value="success">Success</option>
                            <option value="error">Error</option>
                            <option value="pending">Pending</option>
                        </select>
                    )}
                    <button className="btn" type="submit">
                        Filter
                    </button>
                    {(q || status) && (
                        <a href={`/data/${r.key}`} className="link-btn">
                            Clear
                        </a>
                    )}
                </form>
            )}

            <div className="table-wrap">
                <table className="table">
                    <thead>
                    <tr>
                        <th>ID</th>
                        {listFields.map((f) => (
                            <th key={f.name} className={f.type === 'number' ? 'num' : undefined}>
                                {f.label}
                            </th>
                        ))}
                        <th />
                    </tr>
                    </thead>
                    <tbody>
                    {rows.map((row) => (
                        <tr key={String(row.id)}>
                            <td className="mono muted">{String(row.id)}</td>
                            {listFields.map((f) => (
                                <td key={f.name} className={f.type === 'number' ? 'num' : undefined}>
                                    <Cell field={f} value={row[f.name]} refs={refs} />
                                </td>
                            ))}
                            <td className="num">
                                <Link href={`/data/${r.key}/${row.id}`} className="open-link">
                                    {r.ops.update ? 'Edit' : 'View'} →
                                </Link>
                            </td>
                        </tr>
                    ))}
                    {rows.length === 0 && (
                        <tr>
                            <td colSpan={listFields.length + 2} className="empty">
                                {q || status ? 'Nothing matches that filter.' : `No ${r.title.toLowerCase()} yet.`}
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>

            {pages > 1 && (
                <nav className="pager">
                    {page > 1 ? <Link href={href(page - 1)}>← Previous</Link> : <span />}
                    <span className="mono muted">
            Page {page} of {pages}
          </span>
                    {page < pages ? <Link href={href(page + 1)}>Next →</Link> : <span />}
                </nav>
            )}
        </>
    )
}