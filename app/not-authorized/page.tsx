export default function NotAuthorizedPage() {
  return (
    <main className="gate">
      <div className="gate-card">
        <p className="eyebrow eyebrow-alert">403 · Access denied</p>
        <h1 className="gate-title">
          Not on the <em>list</em>.
        </h1>
        <p className="gate-copy">
          You&apos;re signed in, but your account isn&apos;t a superadmin. Ask the project owner
          to grant access, or sign out and try a different account.
        </p>
        <form action="/auth/signout" method="post">
          <button className="btn btn-wide" type="submit">
            Sign out
          </button>
        </form>
      </div>
    </main>
  )
}
