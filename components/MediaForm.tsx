'use client'

import { useActionState, useRef, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { generateCaption, type FormState } from '@/app/(admin)/media/actions'

type Initial = { text?: string | null; image_url?: string | null; prompt?: string | null }

const DEFAULT_PROMPT = 'Write a short, funny caption for this image.'

export default function MediaForm({
                                    action,
                                    initial = {},
                                    submitLabel,
                                  }: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>
  initial?: Initial
  submitLabel: string
}) {
  const [state, formAction, saving] = useActionState(action, undefined)
  const fileInput = useRef<HTMLInputElement>(null)

  const [imageUrl, setImageUrl] = useState(initial.image_url ?? '')
  const [fileName, setFileName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [imageError, setImageError] = useState('')

  const [prompt, setPrompt] = useState(initial.prompt || DEFAULT_PROMPT)
  const [usedPrompt, setUsedPrompt] = useState(initial.prompt ?? '') // what gets saved
  const [generating, startGenerate] = useTransition()
  const [genError, setGenError] = useState('')

  const [text, setText] = useState(initial.text ?? '')

  // Upload straight to Supabase Storage; only the public URL goes into the DB.
  async function upload(file: File) {
    setImageError('')
    if (!file.type.startsWith('image/')) return setImageError('Please choose an image file.')
    if (file.size > 5 * 1024 * 1024) return setImageError('Max 5 MB.')
    setUploading(true)
    const supabase = createClient()
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `admin/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from('media').upload(path, file, { contentType: file.type })
    if (error) {
      setImageError(error.message)
    } else {
      setImageUrl(supabase.storage.from('media').getPublicUrl(path).data.publicUrl)
      setFileName(file.name)
    }
    setUploading(false)
  }

  function onGenerate() {
    setGenError('')
    startGenerate(async () => {
      const res = await generateCaption(imageUrl, prompt)
      if (res.error) return setGenError(res.error)
      setText(res.caption ?? '')
      setUsedPrompt(prompt)
    })
  }

  const busy = uploading || generating || saving

  return (
      <form action={formAction} className="media-form">
        <div className="media-form-preview">
          {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="Preview" />
          ) : (
              <span className="preview-empty">No image yet</span>
          )}
          {text && <p className="preview-caption">“{text}”</p>}
        </div>

        <div className="media-form-fields">
          {/* ---- Step 1: image ---- */}
          <fieldset className="step">
            <legend>
              <span className="step-n">1</span> Image
            </legend>

            <div
                className={`dropzone ${dragging ? 'dragging' : ''} ${imageUrl ? 'has-image' : ''}`}
                onClick={() => !uploading && fileInput.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragging(false)
                  const f = e.dataTransfer.files?.[0]
                  if (f) upload(f)
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInput.current?.click()}
            >
              <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) upload(f)
                    e.target.value = ''
                  }}
              />
              <span className="dropzone-icon" aria-hidden>
              {uploading ? '…' : imageUrl ? '✓' : '↑'}
            </span>
              <span className="dropzone-text">
              {uploading ? (
                  'Uploading…'
              ) : fileName ? (
                  <>
                    <strong>{fileName}</strong> uploaded · <u>replace</u>
                  </>
              ) : imageUrl ? (
                  <>
                    Image set · <u>upload a different one</u>
                  </>
              ) : (
                  <>
                    <strong>Drop an image here</strong> or <u>browse</u>
                  </>
              )}
            </span>
              <span className="dropzone-hint">PNG, JPG, GIF or WebP · up to 5 MB</span>
            </div>

            <div className="or-row">
              <span>or paste a link</span>
            </div>
            <input
                name="image_url"
                type="url"
                value={imageUrl}
                onChange={(e) => {
                  setImageUrl(e.target.value)
                  setFileName('')
                }}
                placeholder="https://…"
                className="input"
            />
            {imageError && <small className="error-text">{imageError}</small>}
          </fieldset>

          {/* ---- Step 2: AI ---- */}
          <fieldset className="step">
            <legend>
              <span className="step-n">2</span> Generate with AI <span className="muted">(optional)</span>
            </legend>
            <textarea
                rows={2}
                maxLength={500}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="input"
                placeholder="e.g. Write a sarcastic caption from the cat's point of view"
            />
            <div className="gen-row">
              <button
                  type="button"
                  className="btn btn-ai"
                  onClick={onGenerate}
                  disabled={busy || !imageUrl}
                  title={!imageUrl ? 'Add an image first' : undefined}
              >
                {generating ? 'Generating…' : text && usedPrompt ? '↻ Regenerate' : '✦ Generate caption'}
              </button>
              {!imageUrl && <small className="muted">Add an image first</small>}
            </div>
            {genError && <small className="error-text">{genError}</small>}
            <input type="hidden" name="prompt" value={usedPrompt} />
          </fieldset>

          {/* ---- Step 3: caption ---- */}
          <fieldset className="step">
            <legend>
              <span className="step-n">3</span> Caption *
            </legend>
            {usedPrompt && (
                <small className="ai-note">✦ Written by AI · edit it if you like</small>
            )}
            <textarea
                name="text"
                rows={3}
                required
                maxLength={500}
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="input"
                placeholder="Generate one above, or write your own"
            />
            <small className="muted">{text.length}/500</small>
          </fieldset>

          {state?.error && <p className="alert">{state.error}</p>}

          <button className="btn btn-primary" type="submit" disabled={busy}>
            {saving ? 'Saving…' : submitLabel}
          </button>
        </div>
      </form>
  )
}