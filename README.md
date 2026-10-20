# The Caption Ledger — Admin Panel

Admin area for the caption rating app. Same Supabase database, separate Next.js app and Vercel project.

## What's inside

| Route | What it does |
|---|---|
| `/` | Stats dashboard: 30-day diverging vote chart, up/down mood, profile completeness, hall of fame, most divisive captions, weekday × hour heatmap, voter personalities, top creators, "does brevity win?" |
| `/users` | **Read** all profiles — search, sort, captions made, votes given, score received |
| `/media` | **Read** AI-generated captions — search + pagination |
| `/media/new` | **Create** a caption (image URL or upload to Storage) |
| `/media/[id]` | **Update** / **Delete** a caption, plus every vote on it |
| `/votes` | **Read** all votes — filter up / down, pagination |

## Security (two walls)

1. **`proxy.ts`** runs on every request. Not logged in → `/login` (Google only). Logged in but `profiles.is_superadmin` isn't `true` → `/not-authorized`.
2. **`requireAdmin()`** (`lib/auth.ts`) runs again inside every admin page and every server action.
3. **Database (RLS)**: only superadmins can update/delete other people's captions, and a trigger stops anyone flipping their own `is_superadmin` through the API.

## Setup

1. **SQL** — Supabase → SQL Editor → run `supabase/setup.sql`.
2. **Make yourself superadmin** (the "won't I be locked out?" answer): log in once with Google, then in the SQL Editor run:
   ```sql
   update public.profiles set is_superadmin = true
   where id = (select id from auth.users where email = 'YOUR_EMAIL@gmail.com');
   ```
   The SQL Editor runs as the database owner, so it isn't blocked by the app's login wall or RLS.
3. **Env** — copy `.env.local.example` to `.env.local` with the same Supabase URL + anon key as the caption app.
4. **Run** — `npm install` then `npm run dev` → http://localhost:3000
5. **Supabase redirect URLs** — Authentication → URL Configuration → add
   `http://localhost:3000/**` and `https://*-<your-vercel-account-slug>.vercel.app/**`
   (the wildcard covers the production URL *and* every commit-specific URL). If a URL isn't
   listed, Supabase silently sends you to the **Site URL** — i.e. your caption app — after login.
6. **Deploy** — push to a new GitHub repo, import it as a new Vercel project, add both env vars, turn off Deployment Protection.
