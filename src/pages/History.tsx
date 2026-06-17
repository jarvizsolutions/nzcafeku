import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Receipt, CheckCircle2, Clock } from "lucide-react";
import { formatINR } from "@/lib/format";
import { withTax } from "@/lib/tax";
import { BrandMark } from "@/components/BrandMark";
import { useTableSession } from "@/hooks/useTableSession";
import { Button } from "@/components/ui/button";

type Order = {
  id: string;
  table_number: number;
  status: string;
  total: number;
  is_paid: boolean;
  payment_method: string | null;
  created_at: string;
  customer_name: string | null;
};
type OrderItem = {
  id: string; order_id: string; name: string; quantity: number; unit_price: number; variant_label: string | null;
};

const paymentLabel = (o: Order) => {
  if (o.is_paid) {
    const m = o.payment_method ?? "paid";
    return { text: `Paid • ${m.toUpperCase()}`, tone: "success" as const };
  }
  if (o.payment_method === "cash_pending") {
    return { text: "Cash awaited at counter", tone: "warn" as const };
  }
  return { text: "Unpaid", tone: "muted" as const };
};

const History = () => {
  const [params] = useSearchParams();
  const tableNumber = Number(params.get("table") || 0);
  const { sessionId, loading: sessionLoading } = useTableSession(tableNumber || 1);
  const [orders, setOrders] = useState<Order[]>([]);
  const [itemsByOrder, setItemsByOrder] = useState<Record<string, OrderItem[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tableNumber) { setLoading(false); return; }
    if (sessionLoading) return;

    const load = async () => {
      setLoading(true);

      // Pull orders for this session OR (fallback) latest orders for this table in last 12h
      let query = supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (sessionId) {
        query = query.eq("session_id", sessionId);
      } else {
        const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
        query = query.eq("table_number", tableNumber).gte("created_at", since);
      }

      const { data: os } = await query;
      const list = (os as Order[]) || [];
      setOrders(list);

      if (list.length) {
        const ids = list.map((o) => o.id);
        const { data: its } = await supabase
          .from("order_items")
          .select("*")
          .in("order_id", ids);
        const grouped: Record<string, OrderItem[]> = {};
        ((its as OrderItem[]) || []).forEach((it) => {
          (grouped[it.order_id] ||= []).push(it);
        });
        setItemsByOrder(grouped);
      } else {
        setItemsByOrder({});
      }
      setLoading(false);
    };
    load();

    // Realtime: refresh when any order on this session updates
    if (!sessionId) return;
    const ch = supabase
      .channel(`history-${sessionId}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `session_id=eq.${sessionId}` },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tableNumber, sessionId, sessionLoading]);

  const totalSpent = orders.filter((o) => o.is_paid).reduce((s, o) => s + withTax(Number(o.total)), 0);
  const outstanding = orders.filter((o) => !o.is_paid).reduce((s, o) => s + withTax(Number(o.total)), 0);

  return (
    <main className="min-h-screen bg-gradient-warm pb-10">
      <header className="glass border-b border-border/50">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <Link to={`/menu?table=${tableNumber || ""}`} className="grid h-10 w-10 place-items-center rounded-full bg-secondary tap-scale">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <BrandMark />
          <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-gold text-xs font-bold text-gold-foreground shadow-gold">
            T{tableNumber || "?"}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-md px-5 pt-6 animate-fade-in-up">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Your session</p>
        <h1 className="font-display text-3xl font-bold">Order & Payment History</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All orders placed at this table during your visit.
        </p>

        {/* Summary */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-card p-4 shadow-soft">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Paid</p>
            <p className="mt-1 font-display text-xl font-bold text-primary">{formatINR(totalSpent)}</p>
          </div>
          <div className="rounded-2xl bg-card p-4 shadow-soft">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Outstanding</p>
            <p className={`mt-1 font-display text-xl font-bold ${outstanding > 0 ? "text-destructive" : "text-muted-foreground"}`}>
              {formatINR(outstanding)}
            </p>
          </div>
        </div>

        {/* Orders */}
        <div className="mt-6 space-y-4">
          {loading ? (
            <div className="grid place-items-center py-12">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
            </div>
          ) : !tableNumber ? (
            <p className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground shadow-soft">
              Open this page from your table's menu to see history.
            </p>
          ) : orders.length === 0 ? (
            <div className="rounded-2xl bg-card p-8 text-center shadow-soft">
              <Receipt className="mx-auto h-10 w-10 text-muted-foreground/60" />
              <p className="mt-3 font-semibold">No orders yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Your placed orders will appear here.</p>
              <Button asChild variant="gold" className="mt-4">
                <Link to={`/menu?table=${tableNumber}`}>Browse menu</Link>
              </Button>
            </div>
          ) : (
            orders.map((o) => {
              const tag = paymentLabel(o);
              const its = itemsByOrder[o.id] || [];
              return (
                <article key={o.id} className="rounded-3xl bg-card p-5 shadow-soft">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Order #{o.id.slice(0, 8)}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {new Date(o.created_at).toLocaleString("en-IN", {
                          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                        })}
                        {o.customer_name && ` • ${o.customer_name}`}
                      </p>
                    </div>
                    <span
                      className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                        tag.tone === "success" ? "bg-primary/15 text-primary" :
                        tag.tone === "warn" ? "bg-destructive/15 text-destructive" :
                        "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {tag.tone === "success" ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                      {tag.text}
                    </span>
                  </div>

                  <ul className="mt-3 divide-y divide-border/60">
                    {its.map((i) => (
                      <li key={i.id} className="flex items-center justify-between py-2 text-sm">
                        <span className="pr-3">
                          <span className="font-semibold text-primary">{i.quantity}×</span> {i.name}
                          {i.variant_label && (
                            <span className="ml-1.5 rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
                              {i.variant_label}
                            </span>
                          )}
                        </span>
                        <span className="text-muted-foreground">
                          {formatINR(Number(i.unit_price) * i.quantity)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">Total</span>
                    <span className="font-display text-lg font-bold text-primary">{formatINR(withTax(Number(o.total)))}</span>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <Button asChild variant="outline" size="sm" className="flex-1">
                      <Link to={`/track/${o.id}`}>Track</Link>
                    </Button>
                    {!o.is_paid && (
                      <Button asChild variant="gold" size="sm" className="flex-1">
                        <Link to={`/pay/${o.id}`}>Pay</Link>
                      </Button>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
};

export default History;
