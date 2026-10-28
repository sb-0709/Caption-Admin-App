import { requireAdmin } from '@/lib/auth'
import NavLinks from '@/components/NavLinks'
import { displayName } from '@/lib/format'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile, user } = await requireAdmin()
  const name = displayName(profile) === 'Anonymous' ? user.email ?? 'Admin' : displayName(profile)

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="masthead">
          <span className="masthead-kicker">Vol. 7 · Admin</span>
          <span className="masthead-title">
            The Caption <em>Ledger</em>
          </span>
        </div>
        <NavLinks />
        <div className="whoami">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt="" className="avatar" />
          ) : (
            <span className="avatar avatar-blank">{name.slice(0, 1)}</span>
          )}
          <div className="whoami-text">
            <span className="whoami-name">{name}</span>
            <span className="badge">superadmin</span>
          </div>
          <form action="/auth/signout" method="post">
            <button className="link-btn" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  )
}
