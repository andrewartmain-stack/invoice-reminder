import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => req.cookies.get(name)?.value } },
  );
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const isAuth = !!session;
  const isLoginPage = req.nextUrl.pathname.startsWith('/login');
  if (!isAuth && !isLoginPage)
    return NextResponse.redirect(new URL('/login', req.url));
  if (isAuth && isLoginPage)
    return NextResponse.redirect(new URL('/', req.url));
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
