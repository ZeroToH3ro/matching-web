import { NextResponse } from 'next/server';
import { auth } from './auth';

const publicRoutes = ['/'];
const authRoutes = ['/login', '/register', '/register/success', '/verify-email', '/forgot-password', '/reset-password'];

export default auth((req) => {
    const { nextUrl } = req;
    const isLoggedIn = !!req.auth;
    const pathname = nextUrl.pathname;

    const isPublic = publicRoutes.includes(pathname);
    const isAuthRoute = authRoutes.includes(pathname);
    const isProfileComplete = req.auth?.user?.profileComplete;
    const isAdmin = req.auth?.user?.role === 'ADMIN';
    const isAdminRoute = pathname.startsWith('/admin');
    const isWellKnown = pathname.startsWith('/.well-known/');

    if (isPublic || isAdmin || isWellKnown) {
        return NextResponse.next();
    }

    if (isAdminRoute && !isAdmin) {
        return NextResponse.redirect(new URL('/', nextUrl));
    }

    if (isAuthRoute) {
        if (isLoggedIn) {
            return NextResponse.redirect(new URL('/members', nextUrl))
        }
        return NextResponse.next();
    }

    if (!isPublic && !isLoggedIn) {
        return NextResponse.redirect(new URL('/login', nextUrl))
    }

    // TODO: handlge wrong logic before
    // if (isLoggedIn && !isProfileComplete && pathname !== '/complete-profile') {
    //     return NextResponse.redirect(new URL('/complete-profile', nextUrl));
    // }

    return NextResponse.next();
})

/**
 * This is a regular expression that will match any URL path 
 * that does not start with /api, /_next/static, /_next/image, or favicon.ico.
 */
export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
}