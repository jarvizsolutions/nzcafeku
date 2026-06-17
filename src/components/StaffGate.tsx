import { useEffect, useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type Role = "admin" | "kitchen" | "pro_admin";

export const useStaffGuard = (required: Role[]) => {
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState<Role | null>(null);
  const nav = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const check = async (uid?: string) => {
      if (!uid) { nav("/admin"); return; }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      const roles = (data || []).map((r: any) => r.role as Role);
      const have = required.find((r) => roles.includes(r));
      if (cancelled) return;
      if (!have) { nav("/admin"); return; }
      setRole(have);
      setReady(true);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      check(session?.user.id);
    });
    supabase.auth.getSession().then(({ data }) => check(data.session?.user.id));
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ready, role };
};

export const StaffGate = ({ allow, children }: { allow: Role[]; children: ReactNode }) => {
  const { ready } = useStaffGuard(allow);
  if (!ready) {
    return (
      <main className="grid min-h-screen place-items-center bg-gradient-warm">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
      </main>
    );
  }
  return <>{children}</>;
};
