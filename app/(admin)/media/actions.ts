'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { captionImage } from '@/lib/gemini'

export type FormState = { error?: string } | undefined

export async function generateCaption(
    imageUrl: string,
    prompt: string
): Promise<{ caption?: string; error?: string }> {
  const { supabase, user } = await requireAdmin()
  if (!/^https?:\/\//i.test(imageUrl)) return { error: 'Add an image first.' }
  if (!prompt.trim()) return { error: 'Write a prompt so the AI knows what to aim for.' }
  if (prompt.length > 500) return { error: 'Prompt must be 500 characters or fewer.' }

  // Observability: log the request before calling the model...
  const started = Date.now()
  const { data: req } = await supabase
      .from('generation_requests')
      .insert({ user_id: user.id, source: 'admin', image_url: imageUrl, prompt: prompt.trim(), status: 'pending' })
      .select('id')
      .single()

  try {
    const result = await captionImage(imageUrl, prompt.trim())

    // ...then record the outcome and the raw model response.
    if (req) {
      const { data: model } = await supabase.from('llm_models').select('id').eq('model_id', result.model).maybeSingle()
      await Promise.all([
        supabase
            .from('generation_requests')
            .update({ status: 'success', latency_ms: Date.now() - started, model_id: model?.id ?? null })
            .eq('id', req.id),
        supabase.from('llm_responses').insert({
          request_id: req.id,
          model_id: model?.id ?? null,
          response_text: result.text,
          input_tokens: result.inputTokens,
          output_tokens: result.outputTokens,
          finish_reason: result.finishReason,
        }),
      ])
    }
    return { caption: result.text }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Caption generation failed.'
    if (req) {
      await supabase
          .from('generation_requests')
          .update({ status: 'error', error_message: message, latency_ms: Date.now() - started })
          .eq('id', req.id)
    }
    return { error: message }
  }
}

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
