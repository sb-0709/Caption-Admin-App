import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// The only routes reachable without being a superadmin.
const PUBLIC_ROUTES = ['/login', '/auth/callback', '/auth/signout', '/not-authorized']

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Redirect while keeping any refreshed session cookies.
  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone()
    url.pathname = path
    url.search = ''
    const res = NextResponse.redirect(url)
    response.cookies.getAll().forEach((c) => res.cookies.set(c))
    return res
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isPublic = PUBLIC_ROUTES.some((r) => path === r || path.startsWith(r + '/'))

  // Wall 1: must be logged in with Google.
  if (!user) return isPublic ? response : redirectTo('/login')

  if (isPublic && path !== '/login') return response

  // Wall 2: must have profiles.is_superadmin = true.
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_superadmin')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.is_superadmin === true

  if (path === '/login') return isAdmin ? redirectTo('/') : redirectTo('/not-authorized')
  if (!isAdmin) return redirectTo('/not-authorized')

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
