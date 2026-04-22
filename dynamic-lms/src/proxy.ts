import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Fast-path public/static routes to avoid unnecessary auth/database work.
  const publicRoutes = ['/login', '/signup', '/']
  const isApiRoute = pathname.startsWith('/api/')
  const isStaticAsset =
    /\.(png|jpe?g|gif|webp|svg|ico|css|js|map|json|txt|pdf)$/i.test(pathname)
  const isPublicRoute = publicRoutes.includes(pathname) || isApiRoute || isStaticAsset

  if (isPublicRoute && pathname !== '/login' && pathname !== '/signup') {
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    })
  }

  const requestCookies = request.cookies.getAll()
  const hasSupabaseAuthCookie = requestCookies.some(({ name }) =>
    /^sb-.*-auth-token(?:\.\d+)?$/.test(name)
  )

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Read all cookies from the incoming request.
        getAll() {
          return request.cookies.getAll()
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value) 
            response.cookies.set(name, value, options) 
          })
        },
      },
    }
  )

  // Avoid refresh-token calls when no Supabase auth cookie is present.
  // This prevents noisy `refresh_token_not_found` errors on public auth pages.
  const {
    data: { user },
  } = hasSupabaseAuthCookie
    ? await supabase.auth.getUser()
    : { data: { user: null } }

  // If accessing a protected route and not authenticated, redirect to login
  if (!isPublicRoute && !user) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  const getRole = async () => {
    const [{ data: profData }, { data: studentData }, { data: userData }] = await Promise.all([
      supabase.from('professors').select('id').eq('user_id', user!.id).maybeSingle(),
      supabase.from('students').select('id').eq('user_id', user!.id).maybeSingle(),
      supabase.from('users').select('role').eq('id', user!.id).maybeSingle(),
    ])

    return {
      isProfessor: Boolean(profData) || userData?.role === 'professor',
      isStudent: Boolean(studentData) || userData?.role === 'student',
      role: userData?.role ?? null,
    }
  }

  // If authenticated and trying to access login/signup, redirect to appropriate dashboard
  if (user && (pathname === '/login' || pathname === '/signup')) {
    const roleInfo = await getRole()
    if (roleInfo.isProfessor) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/prof'
      return NextResponse.redirect(redirectUrl)
    }

    if (roleInfo.isStudent) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/student/dashboard'
      return NextResponse.redirect(redirectUrl)
    }

    if (roleInfo.role) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = roleInfo.role === 'professor' ? '/prof' : '/student/dashboard'
      return NextResponse.redirect(redirectUrl)
    }
  }

  // Role-based route protection
  if (user) {
    const roleInfo =
      pathname.startsWith('/prof') || pathname.startsWith('/student')
        ? await getRole()
        : null

    // Check if accessing professor routes
    if (pathname.startsWith('/prof')) {
      if (!roleInfo?.isProfessor) {
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = '/student/dashboard'
        return NextResponse.redirect(redirectUrl)
      }
    }

    // Check if accessing student routes
    if (pathname.startsWith('/student')) {
      if (!roleInfo?.isStudent) {
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = '/prof'
        return NextResponse.redirect(redirectUrl)
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}

