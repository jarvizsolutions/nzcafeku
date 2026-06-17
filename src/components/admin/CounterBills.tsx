import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Eye, Wallet, CheckCircle2, Smartphone, Banknote, Split } from "lucide-react";
import { toast } from "sonner";
import { formatINR } from "@/lib/format";
import { withTax } from "@/lib/tax";
import { BillDialog } from "@/components/admin/BillDialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const MiniStat = ({ label, value, accent }: { label: string; value: any; accent?: boolean }) => (
  <div className={`rounded-2xl p-4 shadow-soft ${accent ? "bg-gradient-primary text-primary-foreground" : "bg-card"}`}>
    <p className={`text-[11px] uppercase tracking-wider ${accent ? "opacity-80" : "text-muted-foreground"}`}>{label}</p>
    <p className="mt-1 font-display text-2xl font-bold">{value}</p>
  </div>
);

/**
 * Counter Bills — shared by Admin + Kitchen.
 * Realtime: unpaid bills, today's collected cash & UPI totals.
 * Bill clear flow: quick Cash / UPI buttons OR "Bill cleared" → choose method dialog.
 */
export const CounterBills = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [todayPaid, setTodayPaid] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [billId, setBillId] = useState<string | null>(null);
  const [methodFor, setMethodFor] = useState<any | null>(null);
  const [mixFor, setMixFor] = useState<any | null>(null);
  const [mixCash, setMixCash] = useState<string>("");

  const load = async () => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const [{ data: unpaid }, { data: paid }] = await Promise.all([
      supabase.from("orders").select("*")
        .eq("is_paid", false)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false }),
      supabase.from("orders")
        .select("id,total,payment_method,cash_amount,upi_amount,is_paid,created_at")
        .eq("is_paid", true)
        .neq("status", "cancelled")
        .gte("created_at", startOfDay.toISOString()),
    ]);
    setOrders(unpaid || []);
    setTodayPaid(paid || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`bills-shared-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const clearBill = async (o: any, method: "cash" | "upi") => {
    setBusyId(o.id);
    const grand = withTax(Number(o.total));
    const { error } = await supabase
      .from("orders")
      .update({
        is_paid: true,
        payment_method: method,
        cash_amount: method === "cash" ? grand : 0,
        upi_amount:  method === "upi"  ? grand : 0,
      })
      .eq("id", o.id);
    setBusyId(null);
    setMethodFor(null);
    if (error) toast.error(error.message);
    else toast.success(`Bill #${o.id.slice(0, 8)} cleared (${method.toUpperCase()})`);
  };

  const clearMixed = async (o: any, cash: number) => {
    const grand = withTax(Number(o.total));
    if (!Number.isFinite(cash) || cash < 0 || cash > grand) {
      toast.error(`Cash must be between ₹0 and ${formatINR(grand)}`);
      return;
    }
    const upi = Math.round((grand - cash) * 100) / 100;
    setBusyId(o.id);
    const { error } = await supabase
      .from("orders")
      .update({
        is_paid: true,
        payment_method: "mixed",
        cash_amount: cash,
        upi_amount: upi,
      })
      .eq("id", o.id);
    setBusyId(null);
    if (error) { toast.error(error.message); return; }
    setMixFor(null);
    setMixCash("");
    setMethodFor(null);
    toast.success(`Bill #${o.id.slice(0, 8)} cleared (Cash ${formatINR(cash)} + UPI ${formatINR(upi)})`);
  };

  const byTable = useMemo(() => {
    const map = new Map<number, any[]>();
    orders.forEach((o) => {
      const list = map.get(o.table_number) || [];
      list.push(o);
      map.set(o.table_number, list);
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [orders]);

  const totalDue = orders.reduce((s, o) => s + withTax(Number(o.total)), 0);
  // Split-aware totals: use cash_amount/upi_amount when present, else fall back to method.
  const cashOf = (o: any) => {
    if (o.cash_amount != null) return Number(o.cash_amount);
    return o.payment_method === "cash" ? withTax(Number(o.total)) : 0;
  };
  const upiOf = (o: any) => {
    if (o.upi_amount != null) return Number(o.upi_amount);
    return o.payment_method === "upi" ? withTax(Number(o.total)) : 0;
  };
  const todayCash = todayPaid.reduce((s, o) => s + cashOf(o), 0);
  const todayUpi  = todayPaid.reduce((s, o) => s + upiOf(o), 0);
  const todayTotal = todayCash + todayUpi;

  if (loading) {
    return <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />)}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Today's totals — realtime */}
      <div className="rounded-2xl bg-gradient-primary p-4 text-primary-foreground shadow-soft">
        <p className="text-xs uppercase tracking-wider opacity-80">Today collected (realtime)</p>
        <p className="mt-1 font-display text-3xl font-bold">{formatINR(todayTotal)}</p>
        <div className="mt-2 flex flex-wrap gap-4 text-sm">
          <span className="inline-flex items-center gap-1.5"><Banknote className="h-4 w-4" /> Cash <b>{formatINR(todayCash)}</b></span>
          <span className="inline-flex items-center gap-1.5"><Smartphone className="h-4 w-4" /> UPI <b>{formatINR(todayUpi)}</b></span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MiniStat label="Unpaid orders" value={orders.length} />
        <MiniStat label="Total due" value={formatINR(totalDue)} />
      </div>

      {orders.length === 0 ? (
        <div className="rounded-2xl bg-card p-10 text-center shadow-soft">
          <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
          <p className="mt-2 font-display text-lg font-bold">All bills cleared 🎉</p>
          <p className="text-sm text-muted-foreground">No outstanding payments right now.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {byTable.map(([tableNum, list]) => {
            const tableTotal = list.reduce((s, o) => s + withTax(Number(o.total)), 0);
            return (
              <article key={tableNum} className="rounded-2xl bg-card p-4 shadow-soft">
                <header className="mb-3 flex items-center justify-between">
                  <span className="font-display text-xl font-bold">Table {tableNum}</span>
                  <span className="font-display text-lg font-bold text-primary">{formatINR(tableTotal)}</span>
                </header>
                <div className="space-y-2">
                  {list.map((o) => (
                    <div key={o.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-secondary/40 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-xs text-muted-foreground">#{o.id.slice(0, 8).toUpperCase()}</p>
                        <p className="text-sm font-semibold">
                          {o.customer_name || "Guest"} • {formatINR(withTax(Number(o.total)))}
                        </p>
                        {o.customer_phone && (
                          <p className="text-[11px] text-muted-foreground">📞 {o.customer_phone}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(o.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setBillId(o.id)} title="View bill">
                          <Eye className="h-3.5 w-3.5" /> <span className="hidden sm:inline">View</span>
                        </Button>
                        {/* Quick Cash / UPI — only on tablet+ to keep mobile rows compact */}
                        <Button
                          variant="outline" size="sm"
                          disabled={busyId === o.id}
                          onClick={() => clearBill(o, "cash")}
                          title="Cleared by cash"
                          className="hidden sm:inline-flex"
                        >
                          <Banknote className="h-4 w-4" /> Cash
                        </Button>
                        <Button
                          variant="outline" size="sm"
                          disabled={busyId === o.id}
                          onClick={() => clearBill(o, "upi")}
                          title="Cleared by UPI"
                          className="hidden sm:inline-flex"
                        >
                          <Smartphone className="h-4 w-4" /> UPI
                        </Button>
                        <Button
                          variant="destructive" size="sm"
                          disabled={busyId === o.id}
                          onClick={() => setMethodFor(o)}
                        >
                          <Wallet className="h-4 w-4" />
                          <span className="hidden sm:inline">{busyId === o.id ? "Clearing…" : "Bill cleared"}</span>
                          <span className="sm:hidden">{busyId === o.id ? "…" : "Bill"}</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Choose payment method dialog */}
      <Dialog open={!!methodFor} onOpenChange={(v) => !v && setMethodFor(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>How was this bill paid?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            {methodFor && `Table ${methodFor.table_number} • ${formatINR(withTax(Number(methodFor.total)))}`}
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Button variant="hero" disabled={!!busyId} onClick={() => methodFor && clearBill(methodFor, "cash")}>
              <Banknote className="h-4 w-4" /> Cash
            </Button>
            <Button variant="hero" disabled={!!busyId} onClick={() => methodFor && clearBill(methodFor, "upi")}>
              <Smartphone className="h-4 w-4" /> UPI
            </Button>
            <Button
              variant="hero" disabled={!!busyId}
              onClick={() => { setMixFor(methodFor); setMixCash(""); }}
            >
              <Split className="h-4 w-4" /> Mix
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mixed payment dialog */}
      <Dialog open={!!mixFor} onOpenChange={(v) => { if (!v) { setMixFor(null); setMixCash(""); } }}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Split payment</DialogTitle></DialogHeader>
          {mixFor && (() => {
            const grand = withTax(Number(mixFor.total));
            const cashN = Number(mixCash);
            const validCash = Number.isFinite(cashN) && cashN >= 0 && cashN <= grand;
            const upi = validCash ? Math.round((grand - cashN) * 100) / 100 : 0;
            return (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Table {mixFor.table_number} • Total <b>{formatINR(grand)}</b>
                </p>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Cash received</label>
                  <Input
                    type="number" inputMode="decimal" min={0} max={grand}
                    placeholder="0" value={mixCash}
                    onChange={(e) => setMixCash(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="rounded-xl bg-secondary/50 p-3 text-sm">
                  <div className="flex justify-between"><span>Cash</span><b>{validCash ? formatINR(cashN) : "—"}</b></div>
                  <div className="flex justify-between"><span>UPI (auto)</span><b>{validCash ? formatINR(upi) : "—"}</b></div>
                </div>
                <Button
                  variant="hero" className="w-full"
                  disabled={!validCash || !!busyId}
                  onClick={() => clearMixed(mixFor, cashN)}
                >
                  {busyId ? "Clearing…" : "Clear bill"}
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <BillDialog
        orderId={billId}
        open={!!billId}
        onOpenChange={(v) => !v && setBillId(null)}
        allowEdit={false}
        allowDelete={false}
      />
    </div>
  );
};
