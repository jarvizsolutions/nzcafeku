import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppSettings = {
  require_order_otp: boolean;
  ordering_mode: "qr" | "waiter";
};

const DEFAULTS: AppSettings = { require_order_otp: false, ordering_mode: "qr" };

/** Live-subscribed app settings. Returns null while loading. */
export const useAppSettings = (): AppSettings | null => {
  const [s, setS] = useState<AppSettings | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("require_order_otp, ordering_mode")
        .eq("id", true)
        .maybeSingle();
      if (!mounted) return;
      setS({
        require_order_otp: !!data?.require_order_otp,
        ordering_mode: (data?.ordering_mode as any) || DEFAULTS.ordering_mode,
      });
    };
    load();
    const ch = supabase
      .channel("app-settings-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, load)
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, []);

  return s;
};
