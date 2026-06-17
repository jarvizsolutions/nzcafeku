import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const keyFor = (table: number) => `fsc_session_t${table}`;

/**
 * Returns the active session id for a given table number.
 * - Reuses an existing active session (joins what other diners at the table started)
 * - Creates one if none exists
 * - Caches the id in localStorage per-table so refreshes are instant
 */
export const useTableSession = (tableNumber: number) => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      const cached = localStorage.getItem(keyFor(tableNumber));
      if (cached) {
        // Verify the cached session is still active.
        const { data } = await supabase
          .from("table_sessions")
          .select("id,status")
          .eq("id", cached)
          .maybeSingle();
        if (!cancelled && data?.status === "active") {
          setSessionId(data.id);
          setLoading(false);
          return;
        }
        localStorage.removeItem(keyFor(tableNumber));
      }

      // Look for any active session on this table (started by another diner).
      const { data: existing } = await supabase
        .from("table_sessions")
        .select("id")
        .eq("table_number", tableNumber)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing?.id) {
        if (!cancelled) {
          localStorage.setItem(keyFor(tableNumber), existing.id);
          setSessionId(existing.id);
          setLoading(false);
        }
        return;
      }

      // None active — create one.
      const { data: created, error } = await supabase
        .from("table_sessions")
        .insert({ table_number: tableNumber })
        .select("id")
        .single();
      if (!cancelled && created && !error) {
        localStorage.setItem(keyFor(tableNumber), created.id);
        setSessionId(created.id);
      }
      if (!cancelled) setLoading(false);
    };
    run();
    return () => { cancelled = true; };
  }, [tableNumber]);

  // Watch for closure (e.g. after final payment) and clear cache.
  useEffect(() => {
    if (!sessionId) return;
    // Unique channel name per mount avoids "callbacks added after subscribe" in StrictMode.
    const ch = supabase.channel(`session-${sessionId}-${Math.random().toString(36).slice(2, 8)}`);
    ch.on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "table_sessions", filter: `id=eq.${sessionId}` },
      (p) => {
        if ((p.new as any)?.status === "closed") {
          localStorage.removeItem(keyFor(tableNumber));
          setSessionId(null);
        }
      }
    ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId, tableNumber]);

  return { sessionId, loading };
};
