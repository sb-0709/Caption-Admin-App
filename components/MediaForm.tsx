'use client'

import { useActionState, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { FormState } from '@/app/(admin)/media/actions'

type Initial = { text?: string | null; image_url?: string | null; prompt?: string | null }

export default function MediaForm({
  action,
  initial = {},
  submitLabel,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>
  initial?: Initial
  submitLabel: string
}) {
  const [state, formAction, pending] = useActionState(action, undefined)
  const [imageUrl, setImageUrl] = useState(initial.image_url ?? '')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [text, setText] = useState(initial.text ?? '')

  // Upload straight from the browser to Supabase Storage. Only the public
  // URL goes into the database — never the image bytes.
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError('')
    if (!file.type.startsWith('image/')) return setUploadError('Please choose an image file.')
    if (file.size > 5 * 1024 * 1024) return setUploadError('Max 5 MB.')
    setUploading(true)
    const supabase = createClient()
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `admin/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from('media').upload(path, file, { contentType: file.type })
    if (error) {
      setUploadError(error.message)
    } else {
      setImageUrl(supabase.storage.from('media').getPublicUrl(path).data.publicUrl)
    }
    setUploading(false)
  }

  return (
    <form action={formAction} className="media-form">
      <div className="media-form-preview">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="Preview" />
        ) : (
          <span className="preview-empty">No image</span>
        )}
        {text && <p className="preview-caption">“{text}”</p>}
      </div>

      <div className="media-form-fields">
        <label className="field">
          <span>Caption text *</span>
          <textarea
            name="text"
            rows={3}
            required
            maxLength={500}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="input"
          />
          <small className="muted">{text.length}/500</small>
        </label>

        <label className="field">
          <span>Image URL</span>
          <input
            name="image_url"
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://…"
            className="input"
          />
        </label>

        <label className="field">
          <span>…or upload an image</span>
          <input type="file" accept="image/*" onChange={onFile} disabled={uploading} className="file" />
          {uploading && <small className="muted">Uploading…</small>}
          {uploadError && <small className="error-text">{uploadError}</small>}
        </label>

        <label className="field">
          <span>Prompt / style used to generate it</span>
          <textarea name="prompt" rows={2} defaultValue={initial.prompt ?? ''} className="input" />
        </label>

        {state?.error && <p className="alert">{state.error}</p>}

        <button className="btn btn-primary" type="submit" disabled={pending || uploading}>
          {pending ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
