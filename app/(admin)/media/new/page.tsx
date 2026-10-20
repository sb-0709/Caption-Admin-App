import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import MediaForm from '@/components/MediaForm'
import { createMedia } from '../actions'

export default async function NewMediaPage() {
  await requireAdmin()
  return (
    <>
      <header className="page-head">
        <Link href="/media" className="back">
          ← All media
        </Link>
        <h1 className="page-title">
          New <em>caption</em>
        </h1>
      </header>
      <section className="panel">
        <MediaForm action={createMedia} submitLabel="Create caption" />
      </section>
    </>
  )
}
