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

// Backward-compatible singleton export
export const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
            (payload) => onUpdate(payload.new as SupabaseNote)
        )
        .subscribe();
}
