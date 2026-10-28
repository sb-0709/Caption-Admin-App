'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { getResource, type Resource } from '@/lib/resources'

export type RowFormState = { error?: string } | undefined

// Build the row from the form using ONLY the fields allowed in the config,
// so a tampered form can't write to other columns.
function readPayload(r: Resource, fd: FormData) {
    const payload: Record<string, unknown> = {}
    for (const f of r.fields) {
        if (f.editable === false) continue
        const raw = fd.get(f.name)

        if (f.type === 'boolean') {
            payload[f.name] = raw === 'on'
            continue
        }
        let v = typeof raw === 'string' ? raw.trim() : ''
        if (f.lowercase) v = v.toLowerCase()

        if (!v) {
            if (f.required) return { error: `${f.label} is required.` }
            payload[f.name] = null
            continue
        }
        if (f.type === 'number' || f.type === 'ref') {
            const n = Number(v)
            if (Number.isNaN(n)) return { error: `${f.label} must be a number.` }
            payload[f.name] = f.type === 'ref' && f.ref?.table === 'profiles' ? v : n
        } else if (f.type === 'select' && f.options && !f.options.includes(v)) {
            return { error: `${f.label} has an invalid value.` }
        } else if ((f.type === 'url' || f.type === 'image') && !/^https?:\/\//i.test(v)) {
            return { error: `${f.label} must start with http(s)://` }
        } else {
            payload[f.name] = v
        }
    }
    // Images uploaded through the form also send their storage path.
    if (r.table === 'images') {
        const path = fd.get('storage_path')
        payload.storage_path = typeof path === 'string' && path ? path : null
    }
    if (r.table === 'prompt_chain_mix') payload.updated_at = new Date().toISOString()
    return { payload }
}

function friendly(msg: string) {
    if (/duplicate key/i.test(msg)) return 'That value already exists.'
    if (/violates foreign key/i.test(msg)) return 'Other rows still use this one. Remove or reassign them first.'
    if (/violates check constraint/i.test(msg)) return 'One of the values is not allowed (check the format).'
    return msg
}

export async function createRow(key: string, _prev: RowFormState, fd: FormData): Promise<RowFormState> {
    const { supabase } = await requireAdmin()
    const r = getResource(key)
    if (!r || !r.ops.create) return { error: 'Creating is not allowed here.' }
    const parsed = readPayload(r, fd)
    if ('error' in parsed) return { error: parsed.error }

    const { data, error } = await supabase.from(r.table).insert(parsed.payload).select('id').single()
    if (error) return { error: friendly(error.message) }
    revalidatePath(`/data/${key}`)
    redirect(`/data/${key}/${data.id}?saved=created`)
}

export async function updateRow(key: string, id: string, _prev: RowFormState, fd: FormData): Promise<RowFormState> {
    const { supabase } = await requireAdmin()
    const r = getResource(key)
    if (!r || !r.ops.update) return { error: 'Editing is not allowed here.' }
    const parsed = readPayload(r, fd)
    if ('error' in parsed) return { error: parsed.error }

    // For images, remember the old file so we can clean it up if it was replaced.
    let oldPath: string | null = null
    if (r.table === 'images') {
        const { data } = await supabase.from('images').select('storage_path').eq('id', id).single()
        oldPath = data?.storage_path ?? null
    }

    const { data, error } = await supabase.from(r.table).update(parsed.payload).eq('id', id).select('id')
    if (error) return { error: friendly(error.message) }
    if (!data?.length) return { error: 'Nothing was updated. Did you run 03_week7.sql?' }

    if (oldPath && oldPath !== parsed.payload.storage_path) {
        await supabase.storage.from('media').remove([oldPath])
    }
    revalidatePath(`/data/${key}`)
    redirect(`/data/${key}/${id}?saved=updated`)
}

export async function deleteRow(key: string, id: string): Promise<{ error?: string }> {
    const { supabase } = await requireAdmin()
    const r = getResource(key)
    if (!r || !r.ops.delete) return { error: 'Deleting is not allowed here.' }

    const { data, error } = await supabase.from(r.table).delete().eq('id', id).select('*')
    if (error) return { error: friendly(error.message) }
    if (!data?.length) return { error: 'Nothing was deleted.' }

    // Remove the uploaded file too, so Storage doesn't fill with orphans.
    const path = (data[0] as { storage_path?: string | null }).storage_path
    if (r.table === 'images' && path) await supabase.storage.from('media').remove([path])

    revalidatePath(`/data/${key}`)
    redirect(`/data/${key}?deleted=1`)
}