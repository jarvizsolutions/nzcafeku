import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ChefHat, Clock, Utensils, ArrowLeft } from "lucide-react";
import { formatINR } from "@/lib/format";
import { withTax } from "@/lib/tax";
import { BrandMark } from "@/components/BrandMark";
import { FloatingCartBar } from "@/components/FloatingCartBar";
import { CallWaiterButton } from "@/components/CallWaiterButton";
import { useTableSession } from "@/hooks/useTableSession";

type Order = {
  id: string; table_number: number; status: string; total: number;
  customer_name: string | null; notes: string | null; created_at: string; is_paid: boolean;
};
type OrderItem = { id: string; name: string; quantity: number; unit_price: number; created_at: string; is_prepared?: boolean; prepared_quantity?: number; is_cancelled?: boolean };

// "ready" removed from the customer-facing flow.
const STEPS = [
  { key: "pending", label: "Received", icon: Clock },
  { key: "preparing", label: "Preparing", icon: ChefHat },
  { key: "served", label: "Served", icon: CheckCircle2 },
];

const Track = () => {
  const { id } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const [{ data: o }, { data: it }] = await Promise.all([
        supabase.from("orders").select("*").eq("id", id).maybeSingle(),
        supabase.from("order_items").select("*").eq("order_id", id).order("created_at", { ascending: true }),
      ]);
      setOrder(o as Order | null);
      setItems((it as OrderItem[]) || []);
    };
    load();

    const ch = supabase
      .channel(`order-${id}-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${id}` }, (p) => {
        setOrder(p.new as Order);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_items", filter: `order_id=eq.${id}` }, (p) => {
        setItems((prev) => [...prev, p.new as OrderItem]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "order_items", filter: `order_id=eq.${id}` }, (p) => {
        const n = p.new as OrderItem;
        setItems((prev) => prev.map((it) => (it.id === n.id ? { ...it, ...n } : it)));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  if (!order) {
    return (
      <main className="grid min-h-screen place-items-center bg-gradient-warm">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
      </main>
    );
  }

  // Map legacy "ready" rows to "preparing" so the progress bar still makes sense.
  const effectiveStatus = order.status === "ready" ? "preparing" : order.status;
  const stepIdx = effectiveStatus === "cancelled" ? -1 : STEPS.findIndex((s) => s.key === effectiveStatus);

  return (
    <main className="min-h-screen bg-gradient-warm pb-10">
      <header className="glass border-b border-border/50">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <Link to={`/menu?table=${order.table_number}`} className="grid h-10 w-10 place-items-center rounded-full bg-secondary tap-scale">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <BrandMark />
          <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-gold text-xs font-bold text-gold-foreground shadow-gold">
            T{order.table_number}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-md px-5 pt-6 animate-fade-in-up">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Order #{order.id.slice(0, 8)}</p>
        <h1 className="font-display text-3xl font-bold text-balance">
          {effectiveStatus === "served" ? "Enjoy your meal! 🎉" :
           effectiveStatus === "preparing" ? "Sizzling in the kitchen…" :
           effectiveStatus === "cancelled" ? "Order cancelled" :
           "Order received!"}
        </h1>

        {/* Progress */}
        <div className="mt-6 rounded-3xl bg-card p-5 shadow-soft">
          <div className="flex items-start justify-between">
            {STEPS.map((s, idx) => {
              const Icon = s.icon;
              const done = idx <= stepIdx;
              const current = idx === stepIdx;
              return (
                <div key={s.key} className="flex flex-1 flex-col items-center gap-2">
                  <div
                    className={`grid h-12 w-12 place-items-center rounded-full transition-bounce ${
                      done ? "bg-gradient-primary text-primary-foreground shadow-elegant" : "bg-secondary text-muted-foreground"
                    } ${current ? "animate-pulse-glow" : ""}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={`text-[11px] font-semibold ${done ? "text-foreground" : "text-muted-foreground"}`}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Items — grouped into sub-batches when more items are added to the same order */}
        <div className="mt-6 rounded-3xl bg-card p-5 shadow-soft">
          <h2 className="font-display text-lg font-bold">Your items</h2>
          {(() => {
            // Group items into batches by created_at minute — each batch = one "sub-order".
            const batches = new Map<string, OrderItem[]>();
            items.forEach((i) => {
              const key = i.created_at ? new Date(i.created_at).toISOString().slice(0, 16) : "init";
              const arr = batches.get(key) || [];
              arr.push(i);
              batches.set(key, arr);
            });
            const batchList = Array.from(batches.entries());
            return (
              <div className="mt-3 space-y-4">
                {batchList.map(([key, batchItems], idx) => (
                  <div key={key}>
                    {batchList.length > 1 && (
                      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Batch {idx + 1} {idx === batchList.length - 1 && idx > 0 ? "• just added" : ""}
                      </p>
                    )}
                    <ul className="space-y-2">
                      {batchItems.map((i) => {
                        const qty = Number(i.quantity) || 1;
                        const done = Number(i.prepared_quantity) || (i.is_prepared ? qty : 0);
                        const fully = done >= qty;
                        const cancelled = !!i.is_cancelled;
                        if (cancelled) {
                          return (
                            <li key={i.id} className="flex items-center justify-between text-sm">
                              <span className="flex items-center gap-1.5">
                                <span className="rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-destructive">
                                  Cancelled by kitchen
                                </span>
                                <span className="line-through opacity-60">
                                  <span className="font-semibold">{qty}×</span> {i.name}
                                </span>
                              </span>
                              <span className="text-muted-foreground line-through opacity-60">{formatINR(i.unit_price * qty)}</span>
                            </li>
                          );
                        }
                        return (
                          <li key={i.id} className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-1.5">
                              {fully ? (
                                <CheckCircle2 className="h-4 w-4 text-primary" aria-label="Served" />
                              ) : done > 0 ? (
                                <span className="grid h-4 min-w-4 place-items-center rounded bg-primary/15 px-1 text-[10px] font-bold text-primary">
                                  {done}/{qty}
                                </span>
                              ) : null}
                              <span className={fully ? "line-through opacity-70" : ""}>
                                <span className="font-semibold text-primary">{qty}×</span> {i.name}
                              </span>
                            </span>
                            <span className="text-muted-foreground">{formatINR(i.unit_price * qty)}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            );
          })()}
          <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
            <span className="font-semibold">Total</span>
            <span className="font-display text-xl font-bold text-primary">{formatINR(withTax(Number(order.total)))}</span>
          </div>
          {order.notes && <p className="mt-3 rounded-xl bg-secondary/60 p-3 text-xs text-muted-foreground">Note: {order.notes}</p>}
        </div>

        {/* Pay + feedback */}
        <div className="mt-6 grid gap-3">
          <Button asChild variant="gold" size="lg">
            <Link to={`/pay/${order.id}`}>{order.is_paid ? "Payment received ✓" : "Pay Now"}</Link>
          </Button>
          {order.status === "served" && (
            <Button asChild variant="outline" size="lg">
              <Link to={`/feedback/${order.id}`}>Leave Feedback</Link>
            </Button>
          )}

          <Button asChild variant="outline" size="lg">
            <Link to={`/my-orders?table=${order.table_number}`}>Track all my orders</Link>
          </Button>
          <Button asChild variant="ghost" size="lg">
            <Link to={`/menu?table=${order.table_number}`}>Order more</Link>
          </Button>
          <TrackWaiterCall tableNumber={order.table_number} />
        </div>
      </section>
      <FloatingCartBar tableNumber={order.table_number} />
    </main>
  );
};

const TrackWaiterCall = ({ tableNumber }: { tableNumber: number }) => {
  const { sessionId } = useTableSession(tableNumber);
  return <CallWaiterButton tableNumber={tableNumber} sessionId={sessionId} />;
};

export default Track;
