import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { LogOut, ShieldCheck, QrCode, UserSquare2, Trash2, Plus, Tags, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { BrandMark } from "@/components/BrandMark";
import { StaffGate } from "@/components/StaffGate";

// Protected route — only users with role "pro_admin" can access.
const ProAdmin = () => <StaffGate allow={["pro_admin"]}><Inner /></StaffGate>;

const Inner = () => (
  <main className="min-h-screen bg-gradient-warm pb-16">
    <header className="sticky top-0 z-30 glass border-b border-border/50">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <BrandMark />
          <span className="rounded-full bg-gradient-primary px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary-foreground">
            Pro Admin
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm"><Link to="/admin/dashboard">Admin</Link></Button>
          <Button asChild variant="ghost" size="sm"><Link to="/kitchen">Kitchen</Link></Button>
        </div>
      </div>
    </header>

    <section className="mx-auto max-w-4xl px-4 pt-6 space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold">Global Controls</h1>
        <p className="text-sm text-muted-foreground">System-wide switches. Changes take effect everywhere instantly.</p>
      </div>

      <ModePanel />
      <OtpPanel />
      <CategoriesPanel />
      <ResetDataPanel />
    </section>
  </main>
);

/* -------- Ordering Mode -------- */
const ModePanel = () => {
  const [mode, setMode] = useState<"qr" | "waiter" | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("app_settings").select("ordering_mode").eq("id", true).maybeSingle()
      .then(({ data }) => setMode((data?.ordering_mode as any) || "qr"));
  }, []);

  const set = async (next: "qr" | "waiter") => {
    if (next === mode) return;
    setBusy(true);
    const prev = mode;
    setMode(next);
    const { error } = await supabase.from("app_settings")
      .upsert({ id: true, ordering_mode: next, updated_at: new Date().toISOString() }, { onConflict: "id" });
    setBusy(false);
    if (error) { setMode(prev); toast.error(error.message); }
    else toast.success(`Switched to ${next === "qr" ? "QR Mode" : "Waiter Mode"}`);
  };

  return (
    <div className="rounded-2xl bg-card p-5 shadow-soft">
      <div className="mb-4 flex items-start gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-soft">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-display text-lg font-bold">Ordering Mode</h2>
          <p className="text-xs text-muted-foreground">Choose how customers place orders. Affects every table.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ModeCard
          active={mode === "qr"} disabled={busy}
          icon={QrCode} title="QR Mode"
          desc="Customers scan the table QR and order from their phone."
          onClick={() => set("qr")}
        />
        <ModeCard
          active={mode === "waiter"} disabled={busy}
          icon={UserSquare2} title="Waiter Mode"
          desc="Only staff can place orders — from the /waiter screen. Customer self-ordering is disabled."
          onClick={() => set("waiter")}
        />
      </div>
    </div>
  );
};

const ModeCard = ({ active, disabled, icon: Icon, title, desc, onClick }: any) => (
  <button
    type="button" disabled={disabled} onClick={onClick}
    className={`text-left rounded-xl border p-4 transition-smooth tap-scale ${
      active ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-border bg-background hover:border-primary/50"
    }`}
  >
    <div className="flex items-center gap-2">
      <Icon className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
      <span className="font-display text-base font-bold">{title}</span>
      {active && <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">Active</span>}
    </div>
    <p className="mt-2 text-xs text-muted-foreground">{desc}</p>
  </button>
);

/* -------- OTP toggle -------- */
const OtpPanel = () => {
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("app_settings").select("require_order_otp").eq("id", true).maybeSingle()
      .then(({ data }) => setOn(!!data?.require_order_otp));
  }, []);

  const toggle = async (v: boolean) => {
    setBusy(true);
    const prev = on;
    setOn(v);
    const { error } = await supabase.from("app_settings")
      .upsert({ id: true, require_order_otp: v, updated_at: new Date().toISOString() }, { onConflict: "id" });
    setBusy(false);
    if (error) { setOn(prev); toast.error(error.message); }
    else toast.success(v ? "OTP enabled" : "OTP disabled");
  };

  return (
    <div className="rounded-2xl bg-card p-5 shadow-soft">
      <div className="flex items-start gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-soft">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold">OTP Verification</h2>
              <p className="text-xs text-muted-foreground">When ON, every QR order shows a 4-digit code. Staff must enter it on Kitchen to release the order.</p>
            </div>
            <Switch checked={!!on} onCheckedChange={toggle} disabled={on === null || busy} />
          </div>
          <p className="mt-3 rounded-xl bg-secondary/50 p-3 text-xs">
            <span className="font-semibold">Status: </span>
            <span className={on ? "text-primary font-semibold" : "text-muted-foreground"}>
              {on === null ? "Loading…" : on ? "ON — staff verifies every order" : "OFF — orders go straight to kitchen"}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

/* -------- Categories CRUD -------- */
const CategoriesPanel = () => {
  const [list, setList] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("categories").select("*").order("sort_order").order("name");
    setList(data || []);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("categories").insert({ name: name.trim(), sort_order: list.length });
    setBusy(false);
    if (error) toast.error(error.message);
    else { setName(""); toast.success("Category added"); load(); }
  };

  const rename = async (id: string, current: string) => {
    const next = prompt("Rename category", current);
    if (!next || next.trim() === current) return;
    const { error } = await supabase.from("categories").update({ name: next.trim() }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Renamed"); load(); }
  };

  const remove = async (id: string, n: string) => {
    if (!confirm(`Delete category "${n}"? Items will become uncategorised.`)) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); load(); }
  };

  return (
    <div className="rounded-2xl bg-card p-5 shadow-soft">
      <div className="mb-4 flex items-start gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-soft">
          <Tags className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-display text-lg font-bold">Menu Categories</h2>
          <p className="text-xs text-muted-foreground">Used in the admin's "Add dish" dropdown and on the customer menu.</p>
        </div>
      </div>

      <div className="mb-3 flex gap-2">
        <input
          value={name} onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Starters, Beverages…"
          className="h-10 flex-1 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <Button variant="hero" onClick={add} disabled={busy || !name.trim()}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      {list.length === 0 ? (
        <p className="rounded-xl bg-secondary/40 p-3 text-sm text-muted-foreground">No categories yet.</p>
      ) : (
        <ul className="divide-y divide-border/60 rounded-xl bg-secondary/30">
          {list.map((c) => (
            <li key={c.id} className="flex items-center justify-between p-3">
              <span className="font-semibold">{c.name}</span>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => rename(c.id, c.name)}>Rename</Button>
                <Button size="icon" variant="ghost" onClick={() => remove(c.id, c.name)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ProAdmin;

/* -------- Reset Data (danger zone) -------- */
const ResetDataPanel = () => {
  const [busy, setBusy] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const reset = async () => {
    if (confirmText !== "RESET") { toast.error('Type RESET to confirm'); return; }
    setBusy(true);
    const { error } = await (supabase as any).rpc("reset_app_data");
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("All orders, sessions, feedback and reports cleared");
    setConfirmText("");
  };

  return (
    <div className="rounded-2xl border-2 border-destructive/40 bg-destructive/5 p-5 shadow-soft">
      <div className="mb-3 flex items-start gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-destructive text-white shadow-soft">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-display text-lg font-bold text-destructive">Reset Data — Danger Zone</h2>
          <p className="text-xs text-muted-foreground">
            Permanently deletes <b>all orders, order items, table sessions, waiter calls, feedback and saved monthly reports</b>.
            Menu items, combos, categories, tables, announcements, user accounts and settings are kept.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder='Type "RESET" to confirm'
          className="h-10 flex-1 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-destructive focus:ring-2 focus:ring-destructive/20"
        />
        <Button
          variant="destructive"
          disabled={busy || confirmText !== "RESET"}
          onClick={() => { if (confirm("This will permanently delete all orders & analytics. Continue?")) reset(); }}
        >
          <Trash2 className="h-4 w-4" /> {busy ? "Resetting…" : "Reset all data"}
        </Button>
      </div>
    </div>
  );
};