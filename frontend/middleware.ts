import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
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
        }
    );

    const { pathname } = request.nextUrl;

    // Allow auth pages, static files, and backend proxy through without any auth check
    if (
        pathname.startsWith("/auth") ||
        pathname.startsWith("/_next") ||
        pathname.startsWith("/favicon") ||
        pathname.startsWith("/api/proxy") ||
        pathname.includes(".")
    ) {
        return supabaseResponse;
    }

    // Use getSession() — reads from cookie, no network call.
    // getUser() makes a live Supabase network call on every navigation;
    // if Supabase is slow or temporarily unavailable it returns null and
    // causes an incorrect redirect loop. getSession() is local-cookie-only.
    let session = null;
    try {
        const sessionResult = await supabase.auth.getSession();
        session = sessionResult.data.session;
    } catch {
        // If the session check itself throws (network error, etc.), let the
        // request through. The page-level auth checks will handle identity.
        return supabaseResponse;
    }

    // Redirect unauthenticated users to /auth
    if (!session) {
        const url = request.nextUrl.clone();
        url.pathname = "/auth";
        return NextResponse.redirect(url);
    }

    return supabaseResponse;
}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
