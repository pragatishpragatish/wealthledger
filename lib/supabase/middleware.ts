import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Keep well under Vercel's middleware limit so a slow Auth call cannot 504 the site. */
const AUTH_FETCH_TIMEOUT_MS = 4_000;

function getSupabaseKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}

function isAuthRoute(pathname: string) {
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/callback")
  );
}

/** True when a Supabase SSR session cookie is present (even if Auth API is slow). */
function hasSupabaseSessionCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some(
      (c) =>
        c.name.includes("-auth-token") ||
        (c.name.startsWith("sb-") && c.value.length > 0)
    );
}

function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const timeoutSignal = AbortSignal.timeout(AUTH_FETCH_TIMEOUT_MS);
  const parent = init?.signal;
  const signal =
    parent != null ? AbortSignal.any([parent, timeoutSignal]) : timeoutSignal;
  return fetch(input, { ...init, signal });
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Cron / background routes authenticate themselves — never block on Auth.
  if (pathname.startsWith("/api/cron")) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = getSupabaseKey();

  if (!supabaseUrl || !key) {
    if (!isAuthRoute(pathname)) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      return NextResponse.redirect(redirectUrl);
    }
    return NextResponse.next({ request });
  }

  const supabase = createServerClient(supabaseUrl, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
    global: {
      fetch: fetchWithTimeout,
    },
  });

  let user: { id: string } | null = null;
  let authUnreachable = false;

  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      const msg = `${error.name} ${error.message}`.toLowerCase();
      authUnreachable =
        msg.includes("abort") ||
        msg.includes("timeout") ||
        msg.includes("fetch") ||
        msg.includes("network") ||
        msg.includes("failed to fetch");
      if (!authUnreachable) {
        user = null;
      }
    } else {
      user = data.user;
    }
  } catch {
    authUnreachable = true;
  }

  // Auth hung or timed out but session cookies exist → fail open (avoid 504 / false logout).
  // RSC / requireUser() will re-validate on the actual page request.
  if (authUnreachable && hasSupabaseSessionCookie(request)) {
    return supabaseResponse;
  }

  const isPublicAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".");

  if (!user && !isAuthRoute(pathname) && !isPublicAsset) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isAuthRoute(pathname) && !pathname.startsWith("/callback")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
