import { useState } from "react";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const CallWaiterButton = ({
  tableNumber,
  sessionId,
}: {
  tableNumber: number;
  sessionId: string | null;
}) => {
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(false);

  const call = async () => {
    if (busy || cooldown) return;
    setBusy(true);
    const { error } = await supabase
      .from("waiter_calls")
      .insert({ table_number: tableNumber, session_id: sessionId });
    setBusy(false);
    if (error) {
      toast.error("Could not call waiter", { description: error.message });
      return;
    }
    toast.success("Waiter has been notified 🔔", { description: "Someone will be with you shortly." });
    setCooldown(true);
    setTimeout(() => setCooldown(false), 60_000); // 60s cooldown to prevent spam
  };

  return (
    <button
      onClick={call}
      disabled={busy || cooldown}
      className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gold/60 bg-gold/10 px-4 py-3 text-sm font-bold text-gold-foreground transition-smooth hover-lift disabled:opacity-50"
    >
      <Bell className={`h-4 w-4 ${busy ? "animate-pulse" : ""}`} />
      {cooldown ? "Waiter notified ✓" : busy ? "Calling…" : "Call Waiter"}
    </button>
  );
};
