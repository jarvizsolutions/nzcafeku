import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatINR } from "@/lib/format";
import { taxOf, withTax, TAX_LABEL } from "@/lib/tax";
import { Trash2, Plus, Minus, ChefHat, Pencil, Check } from "lucide-react";

type Order = {
  id: string;
  table_number: number;
  customer_name: string | null;
  customer_phone: string | null;
  status: string;
  total: number;
  is_paid: boolean;
  payment_method: string | null;
  created_at: string;
  notes: string | null;
};

type Item = {
  id: string;
  name: string;
  variant_label: string | null;
  unit_price: number;
  quantity: number;
  added_by_kitchen?: boolean | null;
  is_prepared?: boolean | null;
  is_cancelled?: boolean | null;
  created_at: string;
};

/**
 * Realtime bill viewer used by Admin Bills + Recent Orders.
 * - View: shows full itemized bill (any age).
 * - Edit (admin only): change qty, delete line items, recompute total.
 * - Delete (admin only): wipes order + items.
 */
export const BillDialog = ({
  orderId,
  open,
  onOpenChange,
  allowEdit = true,
  allowDelete = true,
  onDeleted,
}: {
  orderId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  allowEdit?: boolean;
  allowDelete?: boolean;
  onDeleted?: () => void;
}) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!orderId) return;
    setLoading(true);
    const [{ data: o }, { data: its }] = await Promise.all([
      supabase.from("orders").select("*").eq("id", orderId).maybeSingle(),
      supabase.from("order_items").select("*").eq("order_id", orderId).order("created_at"),
    ]);
    setOrder(o as any);
    setItems((its as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!open || !orderId) return;
    load();
    const ch = supabase
      .channel(`bill-${orderId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `id=eq.${orderId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items", filter: `order_id=eq.${orderId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orderId]);

  const computed = useMemo(
    () => items.filter(it => !it.is_cancelled).reduce((s, it) => s + Number(it.unit_price) * Number(it.quantity), 0),
    [items]
  );

  const recomputeTotal = async () => {
    if (!order) return;
    await supabase.from("orders").update({ total: computed, updated_at: new Date().toISOString() }).eq("id", order.id);
  };

  const setQty = async (item: Item, qty: number) => {
    if (qty < 1) return;
    setBusy(true);
    const { error } = await supabase.from("order_items").update({ quantity: qty }).eq("id", item.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const newItems = items.map((i) => (i.id === item.id ? { ...i, quantity: qty } : i));
    const total = newItems.reduce((s, it) => s + Number(it.unit_price) * Number(it.quantity), 0);
    await supabase.from("orders").update({ total, updated_at: new Date().toISOString() }).eq("id", order!.id);
  };

  const removeItem = async (item: Item) => {
    if (!confirm(`Remove "${item.name}" from this bill?`)) return;
    setBusy(true);
    const { error } = await supabase.from("order_items").delete().eq("id", item.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const newItems = items.filter((i) => i.id !== item.id);
    const total = newItems.reduce((s, it) => s + Number(it.unit_price) * Number(it.quantity), 0);
    if (order) await supabase.from("orders").update({ total, updated_at: new Date().toISOString() }).eq("id", order.id);
    toast.success("Item removed");
  };

  const deleteBill = async () => {
    if (!order) return;
    if (!confirm(`Permanently DELETE bill #${order.id.slice(0, 8)} and all its items?`)) return;
    const typed = prompt('Type DELETE to confirm');
    if (typed !== "DELETE") { toast.error("Cancelled"); return; }
    setBusy(true);
    const { error: e1 } = await supabase.from("order_items").delete().eq("order_id", order.id);
    if (e1) { setBusy(false); toast.error(e1.message); return; }
    await supabase.from("feedback").delete().eq("order_id", order.id);
    const { error: e2 } = await supabase.from("orders").delete().eq("id", order.id);
    setBusy(false);
    if (e2) { toast.error(e2.message); return; }
    toast.success("Bill deleted");
    onDeleted?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/*
        max-h-[90vh]  — dialog never exceeds 90% of the viewport height
        flex flex-col — lets the inner scroll area expand to fill available space
      */}
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-base">
            {order ? <>Bill · Table {order.table_number} · #{order.id.slice(0, 8).toUpperCase()}</> : "Bill"}
          </DialogTitle>
        </DialogHeader>

        {loading && !order ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Loading bill…</div>
        ) : !order ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Bill not found.</div>
        ) : (
          /* This div scrolls independently — header and footer stay pinned */
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            {/* Order meta */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-xl bg-secondary/40 p-2.5 text-[11px]">
              <span><span className="text-muted-foreground">Customer:</span> <b>{order.customer_name || "Guest"}</b></span>
              {order.customer_phone && (
                <span><span className="text-muted-foreground">📞</span> <b>{order.customer_phone}</b></span>
              )}
              <span><span className="text-muted-foreground">Status:</span> <b className="capitalize">{order.status}</b></span>
              <span><span className="text-muted-foreground">Paid:</span> <b>{order.is_paid ? `Yes (${order.payment_method || "?"})` : "No"}</b></span>
              <span><span className="text-muted-foreground">Placed:</span> <b>{new Date(order.created_at).toLocaleString()}</b></span>
            </div>

            {/* Items list */}
            <ul className="divide-y divide-border/60 rounded-xl border border-border/60">
              {items.length === 0 && (
                <li className="p-4 text-center text-xs text-muted-foreground">No items.</li>
              )}
              {items.map((it) => (
                <li key={it.id} className={`flex items-center gap-2 p-2.5 text-xs ${it.is_cancelled ? "opacity-60" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate font-semibold ${it.is_cancelled ? "line-through" : ""}`}>
                      {it.name}
                      {it.variant_label ? <span className="text-muted-foreground"> ({it.variant_label})</span> : null}
                      {it.added_by_kitchen && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-gold/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold-foreground">
                          <ChefHat className="h-3 w-3" /> Kitchen
                        </span>
                      )}
                      {it.is_cancelled && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-destructive">
                          Cancelled
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{formatINR(Number(it.unit_price))} each</p>
                  </div>
                  {editing && allowEdit ? (
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" disabled={busy || it.quantity <= 1} onClick={() => setQty(it, it.quantity - 1)}>
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <span className="w-6 text-center font-mono">{it.quantity}</span>
                      <Button size="icon" variant="ghost" disabled={busy} onClick={() => setQty(it, it.quantity + 1)}>
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" disabled={busy} onClick={() => removeItem(it)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="w-10 text-right font-mono">×{it.quantity}</span>
                      <span className="w-18 text-right font-semibold">{formatINR(Number(it.unit_price) * Number(it.quantity))}</span>
                    </>
                  )}
                </li>
              ))}
            </ul>

            {/* Totals */}
            <div className="space-y-1.5 rounded-xl bg-primary/10 p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatINR(computed)}</span>
              </div>
              {taxOf(computed) > 0 && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Taxes & charges ({TAX_LABEL})</span>
                  <span>{formatINR(taxOf(computed))}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-border/40 pt-1.5">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">Total</span>
                <span className="font-display text-xl font-bold">{formatINR(withTax(computed))}</span>
              </div>
            </div>

            {order.notes && (
              <p className="rounded-lg bg-secondary/40 p-2 text-xs italic text-muted-foreground">"{order.notes}"</p>
            )}
          </div>
        )}

        <DialogFooter className="mt-3 shrink-0 flex-wrap gap-2">
          {allowEdit && order && (
            <Button variant={editing ? "hero" : "outline"} size="sm" onClick={() => setEditing((v) => !v)} disabled={busy}>
              {editing ? <><Check className="h-3.5 w-3.5" /> Done editing</> : <><Pencil className="h-3.5 w-3.5" /> Edit</>}
            </Button>
          )}
          {allowDelete && order && (
            <Button variant="destructive" size="sm" onClick={deleteBill} disabled={busy}>
              <Trash2 className="h-3.5 w-3.5" /> Delete bill
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};