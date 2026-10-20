'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'

export type FormState = { error?: string } | undefined

function readFields(fd: FormData) {
  const text = String(fd.get('text') ?? '').trim()
  const image_url = String(fd.get('image_url') ?? '').trim() || null
  const prompt = String(fd.get('prompt') ?? '').trim() || null
  if (!text) return { error: 'Caption text is required.' } as const
  if (text.length > 500) return { error: 'Caption must be 500 characters or fewer.' } as const
  if (image_url && !/^https?:\/\//i.test(image_url)) return { error: 'Image URL must start with http(s)://' } as const
  return { values: { text, image_url, prompt } } as const
}

export async function createMedia(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, user } = await requireAdmin()
  const parsed = readFields(fd)
  if ('error' in parsed) return { error: parsed.error }

  const { data, error } = await supabase
    .from('captions')
    .insert({ ...parsed.values, created_by: user.id })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/media')
  revalidatePath('/')
  redirect(`/media/${data.id}?saved=created`)
}

export async function updateMedia(id: number, _prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin()
  const parsed = readFields(fd)
  if ('error' in parsed) return { error: parsed.error }

  const { data, error } = await supabase
    .from('captions')
    .update(parsed.values)
    .eq('id', id)
    .select('id')

  if (error) return { error: error.message }
  if (!data?.length) return { error: 'Nothing was updated — did you run supabase/setup.sql?' }
  revalidatePath('/media')
  revalidatePath(`/media/${id}`)
  revalidatePath('/')
  redirect(`/media/${id}?saved=updated`)
}

export async function deleteMedia(id: number) {
  const { supabase } = await requireAdmin()
  // votes on this caption are removed automatically (on delete cascade)
  const { data, error } = await supabase.from('captions').delete().eq('id', id).select('id')
  if (error) throw new Error(error.message)
  if (!data?.length) throw new Error('Nothing was deleted — did you run supabase/setup.sql?')
  revalidatePath('/media')
  revalidatePath('/')
  redirect('/media?deleted=1')
}
