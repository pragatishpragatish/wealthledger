import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge middleware must not await Supabase Auth over the network.
 * Intermittent Auth latency was causing Vercel MIDDLEWARE_INVOCATION_TIMEOUT (504).
 *
 * Routing here is cookie-based only. Real session validation happens in
 * Server Components / requireUser() (Node runtime, not subject to the Edge MW limit).
 */

function isAuthRoute(pathname: string) {
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/callback")
  );
}

function isPublicPath(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/api/") ||
    pathname.includes(".")
  );
}

/** Supabase SSR auth cookie (chunked names: sb-<ref>-auth-token, .0, .1, …). */
function hasSupabaseSessionCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some(
      (c) =>
        (c.name.includes("-auth-token") || c.name.startsWith("sb-")) &&
        c.value.length > 0
    );
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (isPublicPath(pathname)) {
    return NextResponse.next({ request });
  }

  const hasSession = hasSupabaseSessionCookie(request);
  const onAuth = isAuthRoute(pathname);

  if (!hasSession && !onAuth) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    if (pathname !== "/") {
      redirectUrl.searchParams.set("redirect", pathname);
    }
    return NextResponse.redirect(redirectUrl);
  }

  // Logged-in users hitting auth screens → home (callback must stay reachable).
  if (hasSession && onAuth && !pathname.startsWith("/callback")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next({ request });
}
