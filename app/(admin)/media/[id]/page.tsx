import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import MediaForm from '@/components/MediaForm'
import DeleteButton from '@/components/DeleteButton'
import { displayName, fmtDate } from '@/lib/format'
import { deleteMedia, updateMedia } from '../actions'

export const dynamic = 'force-dynamic'

export default async function EditMediaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ saved?: string }>
}) {
  const { supabase } = await requireAdmin()
  const { id: raw } = await params
  const { saved } = await searchParams
  const id = Number(raw)
  if (!Number.isInteger(id)) notFound()

  const { data: caption } = await supabase
    .from('captions')
    .select('id, text, image_url, prompt, created_by, created_at')
    .eq('id', id)
    .single()
  if (!caption) notFound()

  const [{ data: author }, { data: votes }] = await Promise.all([
    caption.created_by
      ? supabase.from('profiles').select('first_name, last_name').eq('id', caption.created_by).single()
      : Promise.resolve({ data: null }),
    supabase
      .from('votes')
      .select('user_id, vote_type, created_at')
      .eq('caption_id', id)
      .order('created_at', { ascending: false }),
  ])

  const voterIds = [...new Set((votes ?? []).map((v) => v.user_id as string))]
  const { data: voters } = voterIds.length
    ? await supabase.from('profiles').select('id, first_name, last_name').in('id', voterIds)
    : { data: [] }
  const voterName = new Map((voters ?? []).map((p) => [p.id, displayName(p)]))

  const up = (votes ?? []).filter((v) => v.vote_type === 'up').length
  const down = (votes ?? []).length - up

  return (
    <>
      <header className="page-head">
        <Link href="/media" className="back">
          ← All media
        </Link>
        <h1 className="page-title">
          Caption <span className="count">#{caption.id}</span>
        </h1>
        <p className="lede small">
          By {author ? displayName(author) : 'unknown'} · created {fmtDate(caption.created_at)} ·{' '}
          <span className="up">{up}▲</span> <span className="down">{down}▼</span> · net{' '}
          <strong>{up - down > 0 ? '+' : ''}{up - down}</strong>
        </p>
      </header>

      {saved && <p className="notice">Saved — caption {saved}.</p>}

      <section className="panel">
        <MediaForm action={updateMedia.bind(null, id)} initial={caption} submitLabel="Save changes" />
      </section>

      <section className="grid-2">
        <article className="panel">
          <div className="panel-head">
            <h2>Votes on this caption</h2>
            <p>{(votes ?? []).length} total</p>
          </div>
          {(votes ?? []).length === 0 ? (
            <p className="empty">No votes yet.</p>
          ) : (
            <ul className="vote-list">
              {(votes ?? []).map((v) => (
                <li key={v.user_id as string}>
                  <span className={v.vote_type === 'up' ? 'pill up' : 'pill down'}>
                    {v.vote_type === 'up' ? '▲ up' : '▼ down'}
                  </span>
                  <span>{voterName.get(v.user_id as string) ?? 'Unknown'}</span>
                  <span className="muted">{fmtDate(v.created_at as string)}</span>
                </li>
              ))}
            </ul>
          )}
        </article>
        <article className="panel danger-zone">
          <div className="panel-head">
            <h2>Danger zone</h2>
            <p>Deleting removes the caption and every vote on it.</p>
          </div>
          <DeleteButton action={deleteMedia.bind(null, id)} label="Delete caption" />
        </article>
      </section>
    </>
  )
}
