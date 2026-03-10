import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const next = searchParams.get("next") ?? "/";

    // Always redirect to the public site URL, never the internal container hostname.
    // NEXT_PUBLIC_SITE_URL is injected at runtime via docker-compose environment.
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:2323";

    if (code) {
        // Build the redirect response first so we can attach cookies before redirecting
        const response = NextResponse.redirect(`${siteUrl}${next}`);

        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return request.cookies.getAll();
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value, options }) => {
                            response.cookies.set(name, value, options);
                        });
                    },
                },
            }
        );

        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error) {
            // Check whether this user already has a profile row
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("id")
                    .eq("id", user.id)
                    .maybeSingle();

                if (!profile) {
                    // New user — send to onboarding to set username, age, and password
                    response.headers.set("Location", `${siteUrl}/auth/onboarding`);
                    return response;
                }
            }

            // Returning user — send to app root
            return response;
        }
    }

    return NextResponse.redirect(`${siteUrl}/auth?error=auth_callback_failed`);
}
