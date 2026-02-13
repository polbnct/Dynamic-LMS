import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/signup', '/']
  const isPublicRoute = publicRoutes.includes(pathname) || pathname.startsWith('/api/')

  // If accessing a protected route and not authenticated, redirect to login
  if (!isPublicRoute && !user) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // If authenticated and trying to access login/signup, redirect to appropriate dashboard
  if (user && (pathname === '/login' || pathname === '/signup')) {
    // Check user role
    const { data: profData } = await supabase
      .from('professors')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profData) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/prof'
      return NextResponse.redirect(redirectUrl)
    }

    const { data: studentData } = await supabase
      .from('students')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (studentData) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/student/dashboard'
      return NextResponse.redirect(redirectUrl)
    }

    // Fallback to users table
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (userData?.role) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = userData.role === 'professor' ? '/prof' : '/student/dashboard'
      return NextResponse.redirect(redirectUrl)
    }
  }

  // Role-based route protection
  if (user) {
    // Check if accessing professor routes
    if (pathname.startsWith('/prof')) {
      const { data: profData } = await supabase
        .from('professors')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!profData) {
        // Check users table as fallback
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()

        if (userData?.role !== 'professor') {
          // Not a professor, redirect to student dashboard
          const redirectUrl = request.nextUrl.clone()
          redirectUrl.pathname = '/student/dashboard'
          return NextResponse.redirect(redirectUrl)
        }
      }
    }

    // Check if accessing student routes
    if (pathname.startsWith('/student')) {
      const { data: studentData } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!studentData) {
        // Check users table as fallback
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()

        if (userData?.role !== 'student') {
          // Not a student, redirect to professor dashboard
          const redirectUrl = request.nextUrl.clone()
          redirectUrl.pathname = '/prof'
          return NextResponse.redirect(redirectUrl)
        }
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

