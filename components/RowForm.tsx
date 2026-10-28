'use client'

import { useActionState, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Field } from '@/lib/resources'
import type { RowFormState } from '@/app/(admin)/data/actions'

type Values = Record<string, unknown>
type Options = Record<string, { value: string; label: string }[]>

export default function RowForm({
                                    fields,
                                    initial = {},
                                    refOptions,
                                    action,
                                    submitLabel,
                                }: {
    fields: Field[]
    initial?: Values
    refOptions: Options
    action: (prev: RowFormState, fd: FormData) => Promise<RowFormState>
    submitLabel: string
}) {
    const [state, formAction, saving] = useActionState(action, undefined)
    const [uploading, setUploading] = useState(false)

    return (
        <form action={formAction} className="row-form">
            {fields.map((f) => (
                <FieldInput
                    key={f.name}
                    field={f}
                    initial={initial[f.name]}
                    storagePath={(initial.storage_path as string) ?? ''}
                    options={refOptions[f.name] ?? []}
                    onUploading={setUploading}
                />
            ))}
            {state?.error && <p className="alert">{state.error}</p>}
            <div>
                <button className="btn btn-primary" type="submit" disabled={saving || uploading}>
                    {saving ? 'Saving…' : submitLabel}
                </button>
            </div>
        </form>
    )
}

function FieldInput({
                        field: f,
                        initial,
                        storagePath,
                        options,
                        onUploading,
                    }: {
    field: Field
    initial: unknown
    storagePath: string
    options: { value: string; label: string }[]
    onUploading: (b: boolean) => void
}) {
    const str = initial === null || initial === undefined ? '' : String(initial)
    const label = (
        <span>
      {f.label}
            {f.required && ' *'}
    </span>
    )
    const help = f.help ? <small className="muted">{f.help}</small> : null

    switch (f.type) {
        case 'boolean':
            return (
                <label className="check">
                    <input type="checkbox" name={f.name} defaultChecked={initial === undefined ? true : !!initial} />
                    <span>{f.label}</span>
                </label>
            )
        case 'textarea':
            return (
                <label className="field">
                    {label}
                    <textarea name={f.name} defaultValue={str} rows={4} required={f.required} className="input" />
                    {help}
                </label>
            )
        case 'ref':
            return (
                <label className="field">
                    {label}
                    <select name={f.name} defaultValue={str} required={f.required} className="input select">
                        <option value="">— none —</option>
                        {options.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                    {help}
                </label>
            )
        case 'select':
            return (
                <label className="field">
                    {label}
                    <select name={f.name} defaultValue={str} required={f.required} className="input select">
                        {(f.options ?? []).map((o) => (
                            <option key={o}>{o}</option>
                        ))}
                    </select>
                </label>
            )
        case 'image':
            return <ImageField field={f} initialUrl={str} initialPath={storagePath} onUploading={onUploading} />
        default:
            return (
                <label className="field">
                    {label}
                    <input
                        name={f.name}
                        type={f.type === 'number' ? 'number' : f.type === 'email' ? 'email' : f.type === 'url' ? 'url' : 'text'}
                        step={f.type === 'number' ? f.step ?? 'any' : undefined}
                        defaultValue={str}
                        required={f.required}
                        className="input"
                    />
                    {help}
                </label>
            )
    }
}

/** Upload to Supabase Storage (bucket "media") or paste a URL. Only the URL is saved in the DB. */
function ImageField({
                        field: f,
                        initialUrl,
                        initialPath,
                        onUploading,
                    }: {
    field: Field
    initialUrl: string
    initialPath: string
    onUploading: (b: boolean) => void
}) {
    const input = useRef<HTMLInputElement>(null)
    const [url, setUrl] = useState(initialUrl)
    const [path, setPath] = useState(initialPath)
    const [fileName, setFileName] = useState('')
    const [busy, setBusy] = useState(false)
    const [dragging, setDragging] = useState(false)
    const [error, setError] = useState('')

    async function upload(file: File) {
        setError('')
        if (!file.type.startsWith('image/')) return setError('Please choose an image file.')
        if (file.size > 5 * 1024 * 1024) return setError('Max 5 MB.')
        setBusy(true)
        onUploading(true)
        const supabase = createClient()
        const ext = file.name.split('.').pop() || 'jpg'
        const p = `images/${crypto.randomUUID()}.${ext}`
        const { error } = await supabase.storage.from('media').upload(p, file, { contentType: file.type })
        if (error) setError(error.message)
        else {
            setUrl(supabase.storage.from('media').getPublicUrl(p).data.publicUrl)
            setPath(p)
            setFileName(file.name)
        }
        setBusy(false)
        onUploading(false)
    }

    return (
        <div className="field">
      <span>
        {f.label}
          {f.required && ' *'}
      </span>
            <div className="image-field">
                <div className="image-field-preview">
                    {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt="" />
                    ) : (
                        <span className="preview-empty">No image</span>
                    )}
                </div>
                <div className="image-field-inputs">
                    <div
                        className={`dropzone ${dragging ? 'dragging' : ''} ${url ? 'has-image' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => !busy && input.current?.click()}
                        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
                        onDragOver={(e) => {
                            e.preventDefault()
                            setDragging(true)
                        }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={(e) => {
                            e.preventDefault()
                            setDragging(false)
                            const file = e.dataTransfer.files?.[0]
                            if (file) upload(file)
                        }}
                    >
                        <input
                            ref={input}
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) upload(file)
                                e.target.value = ''
                            }}
                        />
                        <span className="dropzone-icon" aria-hidden>
              {busy ? '…' : url ? '✓' : '↑'}
            </span>
                        <span className="dropzone-text">
              {busy ? (
                  'Uploading…'
              ) : fileName ? (
                  <>
                      <strong>{fileName}</strong> uploaded · <u>replace</u>
                  </>
              ) : url ? (
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
                        name={f.name}
                        type="url"
                        value={url}
                        required={f.required}
                        onChange={(e) => {
                            setUrl(e.target.value)
                            setPath('') // a pasted link isn't in our Storage
                            setFileName('')
                        }}
                        placeholder="https://…"
                        className="input"
                    />
                    <input type="hidden" name="storage_path" value={path} />
                    {error && <small className="error-text">{error}</small>}
                </div>
            </div>
        </div>
    )
}