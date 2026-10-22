'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth'

export async function setSuperadmin(userId: string, makeAdmin: boolean): Promise<{ error?: string }> {
    const { supabase } = await requireAdmin()

    // The database function re-checks that the caller is a superadmin.
    const { error } = await supabase.rpc('admin_set_superadmin', {
        target: userId,
        make_admin: makeAdmin,
    })
    if (error) return { error: error.message }

    revalidatePath('/users')
    revalidatePath('/')
    return {}
}