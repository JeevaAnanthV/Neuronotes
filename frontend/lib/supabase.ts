// Supabase JS client for NeuroNotes frontend — uses @supabase/ssr
//
// USAGE (client components):
//   import { createClient } from "@/lib/supabase";
//   const supabase = createClient();
//
// Or use the pre-created singleton:
//   import { supabase } from "@/lib/supabase";
//
// All AI features (embeddings, RAG chat, etc.) still go through the
// FastAPI backend at NEXT_PUBLIC_API_URL via lib/api.ts.

import { createBrowserClient } from "@supabase/ssr";

export const createClient = () =>
    createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

// Backward-compatible lazy singleton — only created on first use (never at module eval time)
// This prevents SSR prerender crashes when env vars aren't available at build time.
let _supabase: ReturnType<typeof createBrowserClient> | null = null;
export const supabase = new Proxy({} as ReturnType<typeof createBrowserClient>, {
    get(_target, prop) {
        if (!_supabase) _supabase = createClient();
        return (_supabase as unknown as Record<string | symbol, unknown>)[prop];
    },
});

// ── Type helpers that mirror the backend schemas ──────────────────────────────

export interface SupabaseNote {
    id: string;
    title: string;
    content: string;
    created_at: string;
    updated_at: string;
    user_id?: string;
}

export interface SupabaseTag {
    id: string;
    name: string;
}

// ── Real-time helper ──────────────────────────────────────────────────────────

/** Subscribe to real-time note changes */
export function subscribeToNotes(onUpdate: (note: SupabaseNote) => void) {
    return supabase
        .channel("notes-changes")
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "notes" },
            (payload: { new: unknown }) => onUpdate(payload.new as SupabaseNote)
        )
        .subscribe();
}
