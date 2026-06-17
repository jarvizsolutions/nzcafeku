import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Smartphone, Wallet } from "lucide-react";
import { formatINR } from "@/lib/format";
import { TAX_LABEL, taxOf, withTax } from "@/lib/tax";
import { BrandMark } from "@/components/BrandMark";

type OrderItem = {
  id: string; name: string; quantity: number; unit_price: number; variant_label: string | null;
};

const Pay = () => {
  const { id } = useParams();
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<OrderItem[]>([]);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const [{ data: o }, { data: its }] = await Promise.all([
        supabase.from("orders").select("*").eq("id", id).maybeSingle(),
        supabase.from("order_items").select("*").eq("order_id", id).order("created_at"),
      ]);
      setOrder(o);
      setItems((its as OrderItem[]) || []);
    };
    load();
    const ch = supabase
      .channel(`pay-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `id=eq.${id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items", filter: `order_id=eq.${id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  if (!order) return null;

  const subtotal = items.reduce((s, i) => s + Number(i.unit_price) * i.quantity, 0);
  const taxes = taxOf(subtotal);
  const grandTotal = withTax(subtotal);

  return (
    <main className="min-h-screen bg-gradient-warm pb-10">
      <header className="glass border-b border-border/50">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <Link to={`/track/${id}`} className="grid h-10 w-10 place-items-center rounded-full bg-secondary tap-scale">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <BrandMark />
          <span className="w-10" />
        </div>
      </header>

      <section className="mx-auto max-w-md px-5 pt-6 animate-fade-in-up">
        <h1 className="font-display text-3xl font-bold">Your Bill</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Order #{order.id.slice(0, 8)} • Table {order.table_number}
          {order.customer_name && ` • ${order.customer_name}`}
        </p>

        {/* Itemised bill */}
        <div className="mt-5 rounded-3xl bg-card p-5 shadow-soft">
          <h2 className="font-display text-lg font-bold">Items</h2>
          <ul className="mt-3 divide-y divide-border/60">
            {items.map((i) => (
              <li key={i.id} className="flex items-center justify-between py-2.5 text-sm">
                <div className="flex-1 pr-3">
                  <p className="font-semibold">
                    {i.name}
                    {i.variant_label && (
                      <span className="ml-1.5 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                        {i.variant_label}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {i.quantity} × {formatINR(Number(i.unit_price))}
                  </p>
                </div>
                <span className="font-semibold">{formatINR(Number(i.unit_price) * i.quantity)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-3 space-y-1.5 border-t border-border/60 pt-3 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span><span>{formatINR(subtotal)}</span>
            </div>
            {taxes > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Taxes & charges ({TAX_LABEL})</span><span>{formatINR(taxes)}</span>
              </div>
            )}
            <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2">
              <span className="font-display text-lg font-bold">Total</span>
              <span className="font-display text-2xl font-bold text-primary">{formatINR(grandTotal)}</span>
            </div>
          </div>
        </div>

        {order.is_paid ? (
          <p className="mt-6 rounded-2xl bg-secondary p-4 text-center text-sm font-semibold text-foreground">
            ✓ Payment already recorded ({order.payment_method})
          </p>
        ) : (
          <>
            <h2 className="mt-7 font-display text-lg font-bold">Pay Now</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose any one option below — staff will confirm your payment.
            </p>
            <div className="mt-3 space-y-3">
              <PayInfo
                icon={Smartphone}
                label="UPI / GPay / PhonePe"
                sub="Scan the payment QR on your table and pay"
              />
              <PayInfo
                icon={Wallet}
                label="Cash"
                sub="Please pay at the counter"
              />
            </div>
          </>
        )}
      </section>
    </main>
  );
};

const PayInfo = ({ icon: Icon, label, sub }: any) => (
  <div className="flex w-full items-center gap-4 rounded-2xl bg-card p-4 text-left shadow-soft">
    <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-gold text-gold-foreground shadow-gold">
      <Icon className="h-5 w-5" />
    </div>
    <div className="flex-1">
      <p className="font-semibold">{label}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  </div>
);

export default Pay;
