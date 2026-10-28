import type { SupabaseClient } from '@supabase/supabase-js'
import { RESOURCES, type Field } from '@/lib/resources'

export type RefMaps = Record<string, Map<string, string>>

function labelOf(row: Record<string, unknown>, cols: string[]) {
    const s = cols.map((c) => row[c]).filter((v) => v !== null && v !== undefined && v !== '').join(' ')
    return s || `#${row.id}`
}

/** For each foreign-key field, fetch the readable label of every referenced row. */
export async function loadRefLabels(
    supabase: SupabaseClient,
    fields: Field[],
    rows: Record<string, unknown>[]
): Promise<RefMaps> {
    const out: RefMaps = {}
    await Promise.all(
        fields
            .filter((f) => f.type === 'ref' && f.ref)
            .map(async (f) => {
                const ids = [...new Set(rows.map((r) => r[f.name]).filter((v) => v !== null && v !== undefined))]
                const map = new Map<string, string>()
                if (ids.length) {
                    const { data } = await supabase
                        .from(f.ref!.table)
                        .select([...new Set(['id', ...f.ref!.label])].join(', '))
                        .in('id', ids as string[])
                    for (const r of (data ?? []) as unknown as Record<string, unknown>[]) map.set(String(r.id), labelOf(r, f.ref!.label))
                }
                out[f.name] = map
            })
    )
    return out
}

/** All options for a foreign-key dropdown. */
export async function loadRefOptions(supabase: SupabaseClient, fields: Field[]) {
    const out: Record<string, { value: string; label: string }[]> = {}
    await Promise.all(
        fields
            .filter((f) => f.type === 'ref' && f.ref && f.editable !== false)
            .map(async (f) => {
                const { data } = await supabase
                    .from(f.ref!.table)
                    .select([...new Set(['id', ...f.ref!.label])].join(', '))
                    .order(f.ref!.label[0])
                    .limit(500)
                out[f.name] = ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
                    value: String(r.id),
                    label: labelOf(r, f.ref!.label),
                }))
            })
    )
    return out
}

/** Where a referenced row lives in the admin, so we can link to it. */
export function refHref(table: string, id: unknown) {
    if (table === 'profiles') return `/users?q=${id}`
    const r = RESOURCES.find((x) => x.table === table)
    return r ? `/data/${r.key}/${id}` : null
}