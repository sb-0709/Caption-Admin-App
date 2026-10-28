import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { getResource } from '@/lib/resources'
import { loadRefLabels, loadRefOptions } from '@/lib/refs'
import Cell from '@/components/Cell'
import RowForm from '@/components/RowForm'
import DeleteButton from '@/components/DeleteButton'
import { createRow, deleteRow, updateRow } from '../../actions'

export const dynamic = 'force-dynamic'

export default async function ResourceDetailPage({
                                                     params,
                                                     searchParams,
                                                 }: {
    params: Promise<{ resource: string; id: string }>
    searchParams: Promise<{ saved?: string }>
}) {
    const { supabase } = await requireAdmin()
    const { resource, id } = await params
    const { saved } = await searchParams
    const r = getResource(resource)
    if (!r) notFound()

    const isNew = id === 'new'
    if (isNew && !r.ops.create) notFound()

    const editableFields = r.fields.filter((f) => f.editable !== false)
    const refOptions = r.ops.create || r.ops.update ? await loadRefOptions(supabase, r.fields) : {}

    // ---------- Create ----------
    if (isNew) {
        return (
            <>
                <Head backHref={`/data/${r.key}`} backLabel={r.title} title={`New ${r.singular}`} />
                <section className="panel">
                    <RowForm
                        fields={editableFields}
                        refOptions={refOptions}
                        action={createRow.bind(null, r.key)}
                        submitLabel={`Create ${r.singular}`}
                    />
                </section>
            </>
        )
    }

    // ---------- Read / Update ----------
    const { data: row } = await supabase.from(r.table).select('*').eq('id', id).maybeSingle()
    if (!row) notFound()
    const refs = await loadRefLabels(supabase, r.fields, [row])

    const children = await Promise.all(
        (r.children ?? []).map(async (c) => {
            const cr = getResource(c.resource)!
            const { data, count } = await supabase
                .from(cr.table)
                .select('*', { count: 'exact' })
                .eq(c.fk, id)
                .order(cr.order.column, { ascending: cr.order.ascending })
                .limit(10)
            const rows = (data ?? []) as Record<string, unknown>[]
            const fields = cr.fields.filter((f) => f.list && f.name !== c.fk)
            return { ...c, cr, rows, count: count ?? 0, fields, refs: await loadRefLabels(supabase, fields, rows) }
        })
    )

    const readOnlyFields = r.ops.update ? r.fields.filter((f) => f.editable === false) : r.fields

    return (
        <>
            <Head
                backHref={`/data/${r.key}`}
                backLabel={r.title}
                title={
                    <>
                        {r.singular[0].toUpperCase() + r.singular.slice(1)} <span className="count">#{String(row.id)}</span>
                    </>
                }
            />

            {saved && <p className="notice">Saved, {r.singular} {saved}.</p>}

            {readOnlyFields.length > 0 && (
                <section className="panel">
                    <dl className="details">
                        {readOnlyFields.map((f) => (
                            <div key={f.name} className={f.type === 'textarea' || f.type === 'image' ? 'wide' : undefined}>
                                <dt>{f.label}</dt>
                                <dd>
                                    <Cell field={f} value={row[f.name]} refs={refs} full />
                                </dd>
                            </div>
                        ))}
                    </dl>
                </section>
            )}

            {r.ops.update && (
                <section className="panel">
                    <div className="panel-head">
                        <h2>Edit</h2>
                    </div>
                    <RowForm
                        fields={editableFields}
                        initial={row}
                        refOptions={refOptions}
                        action={updateRow.bind(null, r.key, id)}
                        submitLabel="Save changes"
                    />
                </section>
            )}

            {children.map((c) => (
                <section className="panel" key={c.resource + c.fk}>
                    <div className="panel-head row-between">
                        <h2>
                            {c.title} <span className="count">{c.count}</span>
                        </h2>
                        {c.count > c.rows.length && (
                            <Link href={`/data/${c.cr.key}`} className="open-link">
                                All {c.cr.title.toLowerCase()} →
                            </Link>
                        )}
                    </div>
                    {c.rows.length === 0 ? (
                        <p className="empty">None yet.</p>
                    ) : (
                        <div className="table-wrap flat">
                            <table className="table">
                                <thead>
                                <tr>
                                    <th>ID</th>
                                    {c.fields.map((f) => (
                                        <th key={f.name}>{f.label}</th>
                                    ))}
                                    <th />
                                </tr>
                                </thead>
                                <tbody>
                                {c.rows.map((cr) => (
                                    <tr key={String(cr.id)}>
                                        <td className="mono muted">{String(cr.id)}</td>
                                        {c.fields.map((f) => (
                                            <td key={f.name}>
                                                <Cell field={f} value={cr[f.name]} refs={c.refs} />
                                            </td>
                                        ))}
                                        <td className="num">
                                            <Link href={`/data/${c.cr.key}/${cr.id}`} className="open-link">
                                                Open →
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            ))}

            {r.ops.delete && (
                <section className="panel danger-zone">
                    <div className="panel-head">
                        <h2>Danger zone</h2>
                        <p>This permanently deletes the {r.singular}.</p>
                    </div>
                    <DeleteButton
                        action={deleteRow.bind(null, r.key, id)}
                        label={`Delete ${r.singular}`}
                        message={`Delete this ${r.singular}? This cannot be undone.`}
                    />
                </section>
            )}
        </>
    )
}

function Head({ backHref, backLabel, title }: { backHref: string; backLabel: string; title: React.ReactNode }) {
    return (
        <header className="page-head">
            <Link href={backHref} className="back">
                ← {backLabel}
            </Link>
            <h1 className="page-title">{title}</h1>
        </header>
    )
}