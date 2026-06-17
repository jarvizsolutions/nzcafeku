import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Bell, Check } from "lucide-react";
import { toast } from "sonner";

type Call = {
  id: string;
  table_number: number;
  created_at: string;
  status: "pending" | "resolved";
  note: string | null;
};

const playDing = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = "triangle"; o.frequency.value = 1100; g.gain.value = 0.1;
    o.start(); o.stop(ctx.currentTime + 0.25);
  } catch {}
};

export const WaiterCallsPanel = ({ audioReady }: { audioReady: boolean }) => {
  const [calls, setCalls] = useState<Call[]>([]);
  const known = useRef<Set<string>>(new Set());
  const seeded = useRef(false);
  const audioRef = useRef(audioReady);
  useEffect(() => { audioRef.current = audioReady; }, [audioReady]);

  const load = async () => {
    const { data } = await supabase
      .from("waiter_calls")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    const list = (data as Call[]) || [];
    if (!seeded.current) {
      list.forEach((c) => known.current.add(c.id));
      seeded.current = true;
    }
    setCalls(list);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("waiter-calls-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "waiter_calls" }, (p) => {
        const row = p.new as Call;
        if (!known.current.has(row.id)) {
          known.current.add(row.id);
          toast.warning(`🔔 Table ${row.table_number} is calling!`, { duration: 6000 });
          if (audioRef.current) playDing();
        }
        load();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "waiter_calls" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const resolve = async (id: string) => {
    const { error } = await supabase
      .from("waiter_calls")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error(error.message);
  };

  if (calls.length === 0) return null;

  return (
    <div className="mb-5 rounded-2xl border-2 border-gold/60 bg-gold/10 p-4 shadow-soft animate-pulse-glow">
      <div className="mb-3 flex items-center gap-2">
        <Bell className="h-4 w-4 text-gold-foreground" />
        <h2 className="font-display text-lg font-bold">Waiter Calls</h2>
        <span className="ml-auto rounded-full bg-gold px-2.5 py-0.5 text-xs font-bold text-gold-foreground">
          {calls.length}
        </span>
      </div>
      <ul className="space-y-2">
        {calls.map((c) => {
          const mins = Math.max(0, Math.floor((Date.now() - new Date(c.created_at).getTime()) / 60000));
          return (
            <li key={c.id} className="flex items-center gap-3 rounded-xl bg-card p-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-gold text-sm font-extrabold text-gold-foreground shadow-gold">
                T{c.table_number}
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold">Table {c.table_number} needs help</p>
                <p className="text-[11px] text-muted-foreground">{mins}m ago</p>
              </div>
              <Button size="sm" variant="gold" onClick={() => resolve(c.id)}>
                <Check className="h-3.5 w-3.5" /> Resolved
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
