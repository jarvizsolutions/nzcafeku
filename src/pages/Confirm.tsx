import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { formatINR } from "@/lib/format";
import { withTax } from "@/lib/tax";
import { BrandMark } from "@/components/BrandMark";

const Confirm = () => {
  const { id } = useParams();
  const [order, setOrder] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    const load = () =>
      supabase.from("orders").select("*").eq("id", id).maybeSingle()
        .then(({ data }) => setOrder(data));
    load();
    const ch = supabase.channel(`confirm-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${id}` }, load)
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

  const awaitingStaff = order.staff_otp && !order.otp_verified;

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-warm px-5 py-8">
      <section className="w-full max-w-md animate-scale-in text-center">
        <div className="mb-6 flex justify-center"><BrandMark /></div>

        <div className="rounded-3xl bg-card p-8 shadow-float">
          <div className={`mx-auto grid h-20 w-20 place-items-center rounded-full text-primary-foreground shadow-elegant ${
            awaitingStaff ? "bg-gold animate-pulse-glow" : "bg-gradient-primary animate-pulse-glow"
          }`}>
            {awaitingStaff
              ? <ShieldCheck className="h-10 w-10" strokeWidth={2.5} />
              : <CheckCircle2 className="h-10 w-10" strokeWidth={2.5} />}
          </div>

          <h1 className="mt-5 font-display text-3xl font-bold">
            {awaitingStaff ? "Almost there!" : "Order Confirmed!"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {awaitingStaff
              ? "Please share this code with our staff to confirm your order."
              : "Our kitchen has received your order 🔥"}
          </p>

          {awaitingStaff && (
            <div className="mt-5 rounded-2xl border-2 border-dashed border-gold bg-gold/10 p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Your confirmation code
              </p>
              <p className="mt-2 select-all font-display text-5xl font-extrabold tracking-[0.4em] text-primary">
                {order.staff_otp}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                Tell this 4-digit code to your waiter or the counter.<br />
                Once verified, the kitchen will start preparing your order.
              </p>
            </div>
          )}

          <dl className="mt-6 space-y-3 rounded-2xl bg-secondary/50 p-4 text-left text-sm">
            <Row label="Order ID" value={`#${order.id.slice(0, 8).toUpperCase()}`} />
            <Row label="Table" value={`T${order.table_number}`} />
            {order.customer_name && <Row label="Name" value={order.customer_name} />}
            <div className="flex items-center justify-between border-t border-border/60 pt-3">
              <dt className="font-display text-base font-bold">Total</dt>
              <dd className="font-display text-2xl font-bold text-primary">
                {formatINR(withTax(Number(order.total)))}
              </dd>
            </div>
          </dl>

          <div className="mt-6 space-y-2">
            {awaitingStaff ? (
              <Button variant="hero" size="lg" className="w-full" disabled>
                Waiting for staff verification…
              </Button>
            ) : (
              <Button asChild variant="hero" size="lg" className="w-full">
                <Link to={`/track/${order.id}`}>Track Order</Link>
              </Button>
            )}
            <Button asChild variant="outline" size="lg" className="w-full">
              <Link to={`/menu?table=${order.table_number}`}>Add more items</Link>
            </Button>

            {/* WhatsApp Group Join CTA */}
            <a
              href="https://chat.whatsapp.com/BmOKgjjPHe5Ij8jAjHwpjg"
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-[#25D366] bg-[#25D366]/10 px-6 py-3 text-sm font-semibold text-[#128C7E] transition-all hover:bg-[#25D366] hover:text-white active:scale-95"
            >
              {/* WhatsApp SVG icon */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 32 32"
                className="h-5 w-5 flex-shrink-0 fill-current"
                aria-hidden="true"
              >
                <path d="M16 0C7.163 0 0 7.163 0 16c0 2.824.737 5.469 2.027 7.77L0 32l8.469-2.001A15.934 15.934 0 0016 32c8.837 0 16-7.163 16-16S24.837 0 16 0zm0 29.333a13.27 13.27 0 01-6.771-1.854l-.485-.288-5.025 1.187 1.21-4.893-.317-.502A13.267 13.267 0 012.667 16C2.667 8.636 8.636 2.667 16 2.667c7.364 0 13.333 5.969 13.333 13.333 0 7.364-5.969 13.333-13.333 13.333zm7.307-9.987c-.4-.2-2.368-1.168-2.735-1.301-.368-.133-.636-.2-.904.2-.267.4-1.034 1.301-1.268 1.568-.234.267-.467.3-.867.1-.4-.2-1.689-.623-3.218-1.984-1.189-1.059-1.992-2.368-2.226-2.768-.234-.4-.025-.616.176-.815.18-.178.4-.467.6-.7.2-.234.267-.4.4-.667.133-.267.067-.5-.033-.7-.1-.2-.904-2.178-1.238-2.98-.325-.783-.656-.676-.904-.688l-.77-.013c-.267 0-.7.1-1.068.5-.367.4-1.4 1.368-1.4 3.335 0 1.967 1.433 3.867 1.633 4.134.2.267 2.82 4.307 6.833 6.036.955.412 1.7.658 2.281.843.958.305 1.831.262 2.52.159.769-.115 2.368-.969 2.702-1.904.334-.934.334-1.735.234-1.904-.1-.167-.367-.267-.767-.467z" />
              </svg>
              Join our WhatsApp for offers &amp; more
            </a>
          </div>
        </div>

        <p className="mt-4 text-[11px] text-muted-foreground">
          Tip: stay on this device — we'll keep updating your order live.
        </p>
      </section>
    </main>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="font-semibold">{value}</dd>
  </div>
);

export default Confirm;
