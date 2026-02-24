// middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  const { data: { session } } = await supabase.auth.getSession();

  const protectedRoutes = [
    '/knowledge', 
    '/behavior', 
    '/model',
    '/appearance', 
    '/install', 
    '/faqs', 
    '/triggers',
    '/context-routing', 
    '/inbox', 
    '/integrations', 
    '/analytics', 
    '/team'
  ];

  const isProtectedRoute = protectedRoutes.some(route => req.nextUrl.pathname.startsWith(route));

  // Protect dashboard routes
  if (!session && isProtectedRoute) {
    return NextResponse.redirect(new URL('/', req.url));
  }
  
  return res;
}

export const config = {
  matcher: [
    '/knowledge/:path*', 
    '/behavior/:path*', 
    '/model/:path*',
    '/appearance/:path*', 
    '/install/:path*', 
    '/faqs/:path*', 
    '/triggers/:path*',
    '/context-routing/:path*', 
    '/inbox/:path*', 
    '/integrations/:path*', 
    '/analytics/:path*', 
    '/team/:path*'
  ],
};
