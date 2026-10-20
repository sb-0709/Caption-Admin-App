-- =====================================================================
-- Admin panel setup — run once in Supabase → SQL Editor.
-- Safe to re-run.
-- =====================================================================

-- 1. The superadmin flag. Defaults to FALSE for everyone.
alter table public.profiles
  add column if not exists is_superadmin boolean not null default false;

-- 2. Helper used by RLS policies: "is the logged-in user a superadmin?"
--    security definer so it can read profiles regardless of RLS.
create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_superadmin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- 3. IMPORTANT: stop users promoting themselves.
--    Your existing policy lets users UPDATE their own profile row, which
--    would otherwise include this column. Any request coming through the
--    API (auth.uid() is set) can't change the flag. The Supabase dashboard
--    SQL Editor runs with no auth.uid(), so you can still change it there.
create or replace function public.protect_superadmin_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    if tg_op = 'INSERT' then
      new.is_superadmin := false;
    elsif new.is_superadmin is distinct from old.is_superadmin then
      raise exception 'is_superadmin can only be changed from the Supabase dashboard';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_superadmin_flag on public.profiles;
create trigger protect_superadmin_flag
  before insert or update on public.profiles
  for each row execute function public.protect_superadmin_flag();

-- 4. Let superadmins create / edit / delete ANY caption (AI-generated media).
--    Regular users keep their existing rules from the main app.
drop policy if exists "Superadmins can insert captions" on public.captions;
create policy "Superadmins can insert captions"
  on public.captions for insert to authenticated
  with check (public.is_superadmin());

drop policy if exists "Superadmins can update any caption" on public.captions;
create policy "Superadmins can update any caption"
  on public.captions for update to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

drop policy if exists "Superadmins can delete any caption" on public.captions;
create policy "Superadmins can delete any caption"
  on public.captions for delete to authenticated
  using (public.is_superadmin());

-- 5. Storage bucket for images uploaded from the admin panel.
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "Superadmins can upload media" on storage.objects;
create policy "Superadmins can upload media"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.is_superadmin());

drop policy if exists "Superadmins can delete media" on storage.objects;
create policy "Superadmins can delete media"
  on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.is_superadmin());

-- =====================================================================
-- 6. Make YOURSELF a superadmin (solves the "locked out" problem).
--    Log in to either app with Google once first so your profile exists,
--    then replace the email below and run this line.
-- =====================================================================
-- update public.profiles
--   set is_superadmin = true
--   where id = (select id from auth.users where email = 'YOUR_EMAIL@gmail.com');

-- Check it worked:
-- select p.id, u.email, p.is_superadmin
--   from public.profiles p join auth.users u on u.id = p.id
--   where p.is_superadmin;
