import Link from 'next/link'
import type { Field } from '@/lib/resources'
import { refHref, type RefMaps } from '@/lib/refs'
import { fmtDate, truncate } from '@/lib/format'

/** Renders one value according to its field type. `full` = detail page (no truncation). */
export default function Cell({
                                 field,
                                 value,
                                 refs,
                                 full = false,
                             }: {
    field: Field
    value: unknown
    refs: RefMaps
    full?: boolean
}) {
    if (value === null || value === undefined || value === '') return <span className="muted">—</span>

    switch (field.type) {
        case 'boolean':
            return <span className={value ? 'pill up' : 'pill'}>{value ? 'Yes' : 'No'}</span>
        case 'datetime':
            return <span className="muted nowrap">{fmtDate(String(value))}</span>
        case 'image':
            return full ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={String(value)} alt="" className="detail-img" />
            ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={String(value)} alt="" className="thumb" loading="lazy" />
            )
        case 'ref': {
            const label = refs[field.name]?.get(String(value)) ?? `#${String(value).slice(0, 8)}`
            const href = refHref(field.ref!.table, value)
            return href ? (
                <Link href={href} className="ref-link">
                    {label}
                </Link>
            ) : (
                <span>{label}</span>
            )
        }
        case 'select':
            return <span className={`pill status-${String(value)}`}>{String(value)}</span>
        case 'number':
            return <span className="mono">{String(value)}</span>
        case 'url':
        case 'email':
            return <span className="mono small-text">{String(value)}</span>
        case 'textarea':
            return full ? <p className="pre">{String(value)}</p> : <span>{truncate(String(value), 90)}</span>
        default:
            return <span>{full ? String(value) : truncate(String(value), 60)}</span>
    }
}