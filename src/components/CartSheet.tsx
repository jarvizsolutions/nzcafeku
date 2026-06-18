import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2, ShoppingBag, X, ChevronLeft } from "lucide-react";
import { formatINR } from "@/lib/format";
import { taxOf, withTax, TAX_LABEL } from "@/lib/tax";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useTableSession } from "@/hooks/useTableSession";
import { ADDONS, AddOnQty, OrderAddOns } from "@/components/OrderAddOns";
import { recordMyOrder } from "@/lib/myOrders";

const PENDING_KEY = "fsc_pending_orders_v1";
const NAME_KEY = "fsc_customer_name_v1";
const PHONE_KEY = "fsc_customer_phone_v1";

// Parcel surcharge — flat rule so the diner sees it before placing the order.
// Small order (< ₹200) → ₹10. Larger order → ₹15. Edit here when real prices land.
const PARCEL_SMALL = 5;
const PARCEL_BIG = 5;
const PARCEL_THRESHOLD = 200;
const parcelCharge = (subtotal: number) => (subtotal < PARCEL_THRESHOLD ? PARCEL_SMALL : PARCEL_BIG);

type PendingOrder = {
  idempotency_key: string;
  table_number: number;
  session_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  notes: string | null;
  total: number;
  items: Array<{
    menu_item_id: string | null;
    name: string;
    variant_label: string | null;
    unit_price: number;
    quantity: number;
  }>;
};

const readPending = (): PendingOrder[] => {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) || "[]"); } catch { return []; }
};
const writePending = (list: PendingOrder[]) =>
  localStorage.setItem(PENDING_KEY, JSON.stringify(list));
const normalizeCustomerName = (value: string) => value.trim().replace(/\s+/g, " ");
const normalizePhone = (value: string) => value.replace(/[^\d+]/g, "");
const isValidPhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
};

const submitOrder = async (p: PendingOrder): Promise<string> => {
  const { data, error } = await supabase.rpc("append_order_items", {
    _table_number: p.table_number,
    _session_id: p.session_id,
    _customer_name: p.customer_name,
    _customer_phone: p.customer_phone,
    _notes: p.notes,
    _added_total: p.total,
    _items: p.items as any,
    _idempotency_key: p.idempotency_key,
  });
  if (error || !data) throw error || new Error("Order submission failed");
  return data as string;
};

export const CartSheet = ({
  open, onOpenChange, tableNumber,
}: { open: boolean; onOpenChange: (v: boolean) => void; tableNumber: number }) => {
  const cart = useCart();
  const [name, setName] = useState(() => {
    try { return localStorage.getItem(NAME_KEY) || ""; } catch { return ""; }
  });
  const [phone, setPhone] = useState(() => {
    try { return localStorage.getItem(PHONE_KEY) || ""; } catch { return ""; }
  });
  const [notes, setNotes] = useState("");
  const [addons, setAddons] = useState<AddOnQty>({});
  const [parcel, setParcel] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { sessionId } = useTableSession(tableNumber);
  const retryTimer = useRef<number | null>(null);

  const addonsTotal = useMemo(
    () => ADDONS.reduce((s, a) => s + (addons[a.id] || 0) * a.price, 0),
    [addons]
  );
  const parcelFee = parcel ? parcelCharge(cart.total + addonsTotal) : 0;
  const itemsTotal = cart.total + addonsTotal + parcelFee;
  const taxAmt = taxOf(itemsTotal);
  const grandTotal = withTax(itemsTotal);

  useEffect(() => {
    const flush = async () => {
      const list = readPending();
      if (list.length === 0) return;
      const remaining: PendingOrder[] = [];
      for (const p of list) {
        try {
          const id = await submitOrder(p);
          toast.success("Pending order synced", { description: `Order #${id.slice(0, 8)}` });
        } catch {
          remaining.push(p);
        }
      }
      writePending(remaining);
    };
    flush();
    retryTimer.current = window.setInterval(flush, 15_000);
    return () => { if (retryTimer.current) window.clearInterval(retryTimer.current); };
  }, []);

  const placeOrder = async () => {
    if (cart.items.length === 0 || placing) return;
    const trimmed = normalizeCustomerName(name);
    const phoneTrimmed = normalizePhone(phone);
    if (!trimmed) {
      setNameError("Please enter your name to place the order");
      toast.error("Name is required");
      return;
    }
    if (!phoneTrimmed || !isValidPhone(phoneTrimmed)) {
      setPhoneError("Please enter a valid phone number (10+ digits)");
      toast.error("Valid phone is required");
      return;
    }
    setNameError(null);
    setPhoneError(null);
    setPlacing(true);

    const addonItems = ADDONS
      .filter((a) => (addons[a.id] || 0) > 0)
      .map((a) => ({
        menu_item_id: null as string | null,
        name: a.name,
        variant_label: "Add-on",
        unit_price: a.price,
        quantity: addons[a.id],
      }));

    const parcelItems = parcel
      ? [{
          menu_item_id: null as string | null,
          name: "📦 Parcel charges",
          variant_label: "Parcel",
          unit_price: parcelFee,
          quantity: 1,
        }]
      : [];

    const comboLines = cart.items
      .filter((i) => i.combo_id && i.combo_children?.length)
      .map((i) => {
        const childStr = (i.combo_children || []).map((c) => `${c.quantity}× ${c.name}`).join(", ");
        return `🎁 ${i.name} ×${i.quantity} → ${childStr}`;
      });
    const fullNotes = [notes, ...comboLines].filter(Boolean).join("\n");

    const pending: PendingOrder = {
      idempotency_key: crypto.randomUUID(),
      table_number: tableNumber,
      session_id: sessionId,
      customer_name: trimmed,
      customer_phone: phoneTrimmed,
      notes: fullNotes || null,
      total: grandTotal,
      items: [
        ...cart.items.map((i) => ({
          menu_item_id: i.menu_item_id,
          name: i.combo_id
            ? `🎁 ${i.name} (Combo)`
            : i.variant_label ? `${i.name} (${i.variant_label})` : i.name,
          variant_label: i.variant_label || null,
          unit_price: i.price,
          quantity: i.quantity,
        })),
        ...addonItems,
        ...parcelItems,
      ],
    };

    writePending([...readPending(), pending]);

    try {
      const orderId = await submitOrder(pending);
      writePending(readPending().filter((p) => p.idempotency_key !== pending.idempotency_key));
      try {
        localStorage.setItem(NAME_KEY, trimmed);
        localStorage.setItem(PHONE_KEY, phoneTrimmed);
      } catch {}
      cart.clear();
      onOpenChange(false);
      recordMyOrder(orderId, tableNumber);
      navigate(`/confirm/${orderId}`);
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.includes("name_required")) {
        writePending(readPending().filter((p) => p.idempotency_key !== pending.idempotency_key));
        setNameError("Please enter your name to place the order");
        toast.error("Name is required");
      } else {
        toast.error("Saved offline — will retry", {
          description: "Your order is queued and will sync automatically.",
        });
      }
    } finally {
      setPlacing(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-3xl border-t-0 p-0">

        {/* ── Sticky header with close/back button ── */}
        <SheetHeader className="sticky top-0 z-10 border-b bg-card/90 backdrop-blur-md px-5 py-4 text-left">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="font-display text-2xl">Your Order</SheetTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Table {tableNumber} • {cart.count} {cart.count === 1 ? "item" : "items"}</p>
            </div>
            {/* Close / Back to menu button */}
            <button
              onClick={() => onOpenChange(false)}
              className="flex items-center gap-1.5 rounded-full bg-secondary border border-border/60 px-3 py-2 text-xs font-semibold text-secondary-foreground transition-smooth hover:bg-secondary/70 active:scale-95 tap-scale"
              aria-label="Back to menu"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Menu</span>
            </button>
          </div>
        </SheetHeader>

        {cart.items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-secondary text-muted-foreground">
              <ShoppingBag className="h-7 w-7" />
            </div>
            <p className="text-muted-foreground">Your cart is empty.</p>
            <button
              onClick={() => onOpenChange(false)}
              className="mt-2 flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft tap-scale"
            >
              <ChevronLeft className="h-4 w-4" />
              Browse Menu
            </button>
          </div>
        ) : (
          <>
            {/* ── 1. NAME + SPECIAL REQUEST — always visible at top ── */}
            <div className="space-y-3 px-5 py-4 border-b border-border/60">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your Details</p>
              <div>
                <input
                  value={name}
                  onChange={(e) => { setName(e.target.value); if (nameError) setNameError(null); }}
                  placeholder="Your name (required)"
                  required
                  aria-invalid={!!nameError}
                  className={`h-11 w-full rounded-xl border bg-background px-4 text-sm outline-none focus:ring-2 ${
                    nameError ? "border-destructive focus:ring-destructive/20" : "border-border focus:border-primary focus:ring-primary/20"
                  }`}
                />
                {nameError && <p className="mt-1 text-xs font-semibold text-destructive">{nameError}</p>}
              </div>
              <div>
                <input
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); if (phoneError) setPhoneError(null); }}
                  placeholder="Phone number (required)"
                  type="tel"
                  inputMode="tel"
                  required
                  aria-invalid={!!phoneError}
                  className={`h-11 w-full rounded-xl border bg-background px-4 text-sm outline-none focus:ring-2 ${
                    phoneError ? "border-destructive focus:ring-destructive/20" : "border-border focus:border-primary focus:ring-primary/20"
                  }`}
                />
                {phoneError && <p className="mt-1 text-xs font-semibold text-destructive">{phoneError}</p>}
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Special requests? (e.g. less spice)"
                rows={2}
                className="w-full resize-none rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* ── 2. ADD-ONS ── */}
            <div className="space-y-3 px-5 py-4 border-b border-border/60">
              <OrderAddOns value={addons} onChange={setAddons} />
              {/* Parcel toggle — adds a flat surcharge line item that flows to kitchen, bill & admin */}
              <button
                type="button"
                onClick={() => setParcel((v) => !v)}
                aria-pressed={parcel}
                className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-smooth ${
                  parcel ? "border-primary bg-primary/5" : "border-border bg-card"
                }`}
              >
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-lg">📦</div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-semibold">Make it a parcel</p>
                  <p className="text-xs text-muted-foreground">
                    +{formatINR(parcelCharge(cart.total + addonsTotal))} packaging charge
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${parcel ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                  {parcel ? "Added" : "+ Add"}
                </span>
              </button>
            </div>

            {/* ── 3. SELECTED ITEMS ── */}
            <div className="space-y-2 px-5 py-4 border-b border-border/60">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your Items</p>
              {cart.items.map((i) => (
                <div key={i.key} className="flex items-center gap-3 rounded-2xl bg-secondary/50 p-3">
                  <div className="flex-1">
                    <p className="text-sm font-semibold">
                      {i.combo_id && <span className="mr-1">🎁</span>}
                      {i.name}
                      {i.variant_label && (
                        <span className="ml-1.5 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                          {i.variant_label}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatINR(i.price)} each</p>
                    {i.combo_children && i.combo_children.length > 0 && (
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {i.combo_children.map((c) => `${c.quantity}× ${c.name}`).join(" • ")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full bg-card p-1 shadow-soft">
                    <button onClick={() => cart.setQuantity(i.key, i.quantity - 1)} className="grid h-7 w-7 place-items-center rounded-full bg-secondary tap-scale">
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="min-w-[18px] text-center text-sm font-bold">{i.quantity}</span>
                    <button onClick={() => cart.setQuantity(i.key, i.quantity + 1)} className="grid h-7 w-7 place-items-center rounded-full bg-secondary tap-scale">
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <span className="w-16 text-right font-semibold">{formatINR(i.price * i.quantity)}</span>
                  <button onClick={() => cart.remove(i.key)} className="text-muted-foreground hover:text-destructive transition-smooth">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>


            {/* ── Sticky bottom: totals + place order ── */}
            <div className="sticky bottom-0 space-y-3 border-t bg-card/95 px-5 py-4 backdrop-blur pb-safe">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Items subtotal</span>
                <span>{formatINR(cart.total)}</span>
              </div>
              {addonsTotal > 0 && (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Add-ons</span>
                  <span>{formatINR(addonsTotal)}</span>
                </div>
              )}
              {parcelFee > 0 && (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Parcel charges</span>
                  <span>{formatINR(parcelFee)}</span>
                </div>
              )}
              {taxAmt > 0 && (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Taxes & charges ({TAX_LABEL})</span>
                  <span>{formatINR(taxAmt)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="font-display text-lg font-bold">Total</span>
                <span className="font-display text-2xl font-bold text-primary">{formatINR(grandTotal)}</span>
              </div>
              <Button onClick={placeOrder} disabled={placing} variant="hero" size="lg" className="w-full">
                {placing ? "Placing…" : "Place Order"}
              </Button>
              <p className="text-center text-[11px] text-muted-foreground">Pay at counter or via UPI after meal</p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};
