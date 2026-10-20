import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Second layer of the login wall (the first is proxy.ts).
 * Every admin page AND every server action calls this, so even a request
 * that somehow skipped the proxy can't read or change anything.
 */
export async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, avatar_url, is_superadmin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_superadmin) redirect('/not-authorized')

  return { supabase, user, profile }
}
