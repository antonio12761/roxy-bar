import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';

// Define role permissions
const rolePermissions = {
  ADMIN: ['/', '/dashboard', '/cameriere', '/prepara', '/cucina', '/cassa', '/supervisore', '/banco'],
  MANAGER: ['/', '/dashboard', '/cameriere', '/prepara', '/cucina', '/cassa', '/supervisore', '/banco'],
  SUPERVISORE: ['/', '/supervisore', '/cameriere'],
  OPERATORE: ['/', '/banco'],
  CAMERIERE: ['/', '/cameriere'],
  PREPARA: ['/', '/prepara'],
  BANCO: ['/', '/banco'],
  CUCINA: ['/', '/cucina'],
  CASSA: ['/', '/cassa']
};

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  console.log(`[MIDDLEWARE] ${request.method} ${path}`);
  
  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/api/sse', '/api/login'];
  const isPublicRoute = publicRoutes.some(route => path.startsWith(route));
  
  // Protected routes that require authentication
  const protectedRoutes = ['/supervisore', '/cameriere', '/prepara', '/cucina', '/cassa', '/banco', '/dashboard'];
  const isProtectedRoute = protectedRoutes.some(route => path.startsWith(route));
  
  if (isPublicRoute) {
    return NextResponse.next();
  }
  
  // Only check authentication for protected routes
  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  // Check for session cookie
  const cookieName = process.env.SESSION_COOKIE_NAME || 'bar-roxy-session';
  const sessionCookie = request.cookies.get(cookieName);
  
  console.log(`[MIDDLEWARE] Session cookie trovato: ${sessionCookie ? 'SI' : 'NO'}`);
  
  if (!sessionCookie) {
    console.log(`[MIDDLEWARE] Redirect a login per ${path}`);
    // No session, redirect to login
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // For protected routes, we need to verify the user's role
  // This is a simplified check - in production you'd verify the JWT token
  // and get the user's role from the database
  
  // Dashboard routes require ADMIN or MANAGER role
  if (path.startsWith('/dashboard')) {
    // In a real implementation, you would:
    // 1. Decode the JWT token from the cookie
    // 2. Verify it's valid
    // 3. Get the user's role from the token or database
    // 4. Check if the role has permission
    
    // For now, we'll let the page component handle the role check
    // since we can't easily access the database from middleware
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/supervisore/:path*',
    '/cameriere/:path*',
    '/prepara/:path*',
    '/cucina/:path*',
    '/cassa/:path*',
    '/banco/:path*',
    '/dashboard/:path*',
    '/supervisore',
    '/cameriere',
    '/prepara',
    '/cucina',
    '/cassa',
    '/banco',
    '/dashboard'
  ],
};