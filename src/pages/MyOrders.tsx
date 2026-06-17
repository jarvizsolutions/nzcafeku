import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ChefHat, Clock, CheckCircle2, Utensils } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { myOrdersForTable, readMyOrders } from "@/lib/myOrders";
import { formatINR } from "@/lib/format";
import { withTax } from "@/lib/tax";

// "ready" status removed from the new flow but kept here for legacy rows
// (mapped to the "preparing" badge so old orders still display sanely).
const STATUS_META: Record<string, { label: string; icon: any; cls: string }> = {
  pending:    { label: "Received",  icon: Clock,         cls: "bg-secondary text-foreground" },
  preparing:  { label: "Preparing", icon: ChefHat,       cls: "bg-gold/25 text-gold-foreground" },
  ready:      { label: "Preparing", icon: ChefHat,       cls: "bg-gold/25 text-gold-foreground" },
  served:     { label: "Served",    icon: CheckCircle2,  cls: "bg-secondary text-muted-foreground" },
  cancelled:  { label: "Cancelled", icon: Clock,         cls: "bg-destructive text-destructive-foreground" },
};

const MyOrders = () => {
  const [params] = useSearchParams();
  const tableParam = Number(params.get("table"));
  const table = Number.isFinite(tableParam) && tableParam > 0 ? tableParam : null;

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const stored = table ? myOrdersForTable(table) : readMyOrders();
    const ids = stored.map((s) => s.id);
    if (ids.length === 0) { setOrders([]); setLoading(false); return; }
    const { data } = await supabase
      .from("orders").select("*").in("id", ids)
      .order("created_at", { ascending: false });
    setOrders(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel(`my-orders-${Math.random().toString(36).slice(2,8)}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = orders.filter((o) => ["pending","preparing","ready"].includes(o.status));
  const past = orders.filter((o) => !["pending","preparing","ready"].includes(o.status));

  return (
    <main className="min-h-screen bg-gradient-warm pb-12">
      <header className="glass border-b border-border/50">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <Link to={table ? `/menu?table=${table}` : "/"} className="grid h-10 w-10 place-items-center rounded-full bg-secondary tap-scale">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <BrandMark />
          <div className="w-10" />
        </div>
      </header>

      <section className="mx-auto max-w-md px-5 pt-6 animate-fade-in-up">
        <h1 className="font-display text-3xl font-bold">My Orders</h1>
        <p className="text-sm text-muted-foreground">{table ? `Table ${table}` : "All your orders"}</p>

        {loading ? (
          <p className="mt-10 text-center text-muted-foreground">Loading…</p>
        ) : orders.length === 0 ? (
          <p className="mt-10 text-center text-muted-foreground">No orders yet from this device.</p>
        ) : (
          <>
            {active.length > 0 && (
              <div className="mt-6 space-y-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Active</h2>
                {active.map((o) => <OrderRow key={o.id} o={o} />)}
              </div>
            )}
            {past.length > 0 && (
              <div className="mt-6 space-y-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Past</h2>
                {past.map((o) => <OrderRow key={o.id} o={o} />)}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
};

const OrderRow = ({ o }: { o: any }) => {
  const meta = STATUS_META[o.status] || STATUS_META.pending;
  const Icon = meta.icon;
  return (
    <Link
      to={`/track/${o.id}`}
      className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-soft transition-smooth hover:shadow-elegant"
    >
      <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-primary text-primary-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold">Table {o.table_number} • #{o.id.slice(0, 8)}</p>
        <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</p>
      </div>
      <div className="text-right">
        <p className="font-display text-lg font-bold text-primary">{formatINR(withTax(Number(o.total)))}</p>
        <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${meta.cls}`}>
          {meta.label}
        </span>
      </div>
    </Link>
  );
};

export default MyOrders;
