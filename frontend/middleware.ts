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

    // Refresh session — getUser() triggers token refresh internally.
    // If the refresh token is invalid (400), user is null and we clear cookies.
    const { data: { user } } = await supabase.auth.getUser();

    const { pathname } = request.nextUrl;

    // Allow auth pages, static files, and backend proxy through
    if (
        pathname.startsWith("/auth") ||
        pathname.startsWith("/_next") ||
        pathname.startsWith("/favicon") ||
        pathname.startsWith("/api/proxy") ||
        pathname.includes(".")
    ) {
        return supabaseResponse;
    }

    // Redirect unauthenticated users to /auth
    if (!user) {
        const url = request.nextUrl.clone();
        url.pathname = "/auth";
        const redirect = NextResponse.redirect(url);
        // Clear all Supabase auth cookies so stale tokens don't cause repeated 400s
        request.cookies.getAll().forEach(({ name }) => {
            if (name.startsWith("sb-")) {
                redirect.cookies.delete(name);
            }
        });
        return redirect;
    }

    return supabaseResponse;
}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
