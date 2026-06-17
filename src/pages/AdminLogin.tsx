import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { BrandMark } from "@/components/BrandMark";

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const nav = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        const { data: roles } = await supabase
          .from("user_roles").select("role").eq("user_id", data.session.user.id);
        const list = (roles || []).map((r: any) => r.role);
        if (list.includes("pro_admin")) nav("/nzzht");
        else if (list.includes("admin")) nav("/admin/dashboard");
        else if (list.includes("kitchen")) nav("/kitchen");
      }
    });
  }, [nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/admin` },
        });
        if (error) throw error;
        toast.success("Account created!", { description: "Ask an existing admin to grant you a role." });
        setMode("signin");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Try to claim first-admin (no-op if any admin exists)
        await supabase.functions.invoke("bootstrap-admin").catch(() => {});
        const { data: roles } = await supabase
          .from("user_roles").select("role").eq("user_id", data.user.id);
        const list = (roles || []).map((r: any) => r.role);
        if (list.includes("pro_admin")) nav("/nzzht");
        else if (list.includes("admin")) nav("/admin/dashboard");
        else if (list.includes("kitchen")) nav("/kitchen");
        else {
          toast.message("Logged in", { description: "No staff role assigned yet. Ask an admin." });
        }
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-warm px-5">
      <div className="w-full max-w-sm animate-scale-in rounded-3xl bg-card p-7 shadow-elegant">
        <div className="flex flex-col items-center text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-elegant">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold">Staff Portal</h1>
          <BrandMark className="mt-1" />
        </div>

        <form onSubmit={submit} className="mt-6 space-y-3">
          <input
            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="h-12 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <input
            type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Password" minLength={6}
            className="h-12 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <Button type="submit" disabled={busy} variant="hero" size="lg" className="w-full">
            {busy ? "…" : mode === "signin" ? "Sign In" : "Create Account"}
          </Button>
        </form>

        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-4 block w-full text-center text-xs text-muted-foreground hover:text-primary transition-smooth"
        >
          {mode === "signin" ? "First time? Create staff account" : "Already have an account? Sign in"}
        </button>
      </div>
    </main>
  );
};

export default AdminLogin;
