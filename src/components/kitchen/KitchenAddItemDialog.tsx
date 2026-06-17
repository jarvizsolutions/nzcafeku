import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, ChefHat } from "lucide-react";
import { toast } from "sonner";

/**
 * Quick-pick presets so the kitchen rarely has to type.
 * `askPrice` items (ice-cream, parcel) need a price typed in.
 * The `name` strings stay identical across orders so today's item-wise
 * analytics aggregate kitchen-added items together with customer-ordered ones
 * (e.g. customer Water + kitchen Water → 2 Water Bottles sold today).
 */
const PRESETS: Array<{
  id: string;
  label: string;
  emoji: string;
  name?: string;
  price?: number;
  askPrice?: boolean;
}> = [
  { id: "water",   label: "Water 12",   emoji: "💧", name: "Water Bottle (750ml)", price: 12 },
  { id: "mayo",    label: "Mayo 5",     emoji: "🥚", name: "Mayonnaise",           price: 5  },
  { id: "pepsi",   label: "Pepsi 22",   emoji: "🥤", name: "Pepsi (400ml)",        price: 22 },
  { id: "ice",     label: "Ice cream",  emoji: "🍦", name: "Ice cream",            askPrice: true },
  { id: "parcel",  label: "Parcel",     emoji: "📦", name: "Parcel charges",       askPrice: true },
  { id: "custom",  label: "Other",      emoji: "✏️" },
];

/**
 * Kitchen-side: add an extra line item to an existing order.
 * Used for things like "Extra sauce", "Special packing", parcel conversion, etc.
 * The new item is flagged `added_by_kitchen=true` so all surfaces highlight it.
 */
export const KitchenAddItemDialog = ({ orderId, onAdded }: { orderId: string; onAdded?: () => void }) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"picker" | "form">("picker");
  const [preset, setPreset] = useState<typeof PRESETS[number] | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("1");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setMode("picker"); setPreset(null);
    setName(""); setPrice(""); setQty("1");
  };

  const choosePreset = (p: typeof PRESETS[number]) => {
    setPreset(p);
    setName(p.name || "");
    setPrice(p.price != null ? String(p.price) : "");
    setQty("1");
    setMode("form");
  };

  const submit = async () => {
    const n = name.trim();
    const p = Number(price);
    const q = Math.max(1, Math.floor(Number(qty) || 1));
    if (!n) { toast.error("Item name required"); return; }
    if (!Number.isFinite(p) || p < 0) { toast.error("Enter a valid price (0 or more)"); return; }
    setBusy(true);
    const { error } = await supabase.from("order_items").insert({
      order_id: orderId,
      name: n,
      unit_price: p,
      quantity: q,
      added_by_kitchen: true,
    });
    if (error) { setBusy(false); toast.error(error.message); return; }
    // Recompute order total
    const { data: items } = await supabase.from("order_items").select("unit_price,quantity,is_cancelled").eq("order_id", orderId);
    const total = (items || []).filter((it: any) => !it.is_cancelled).reduce((s: number, it: any) => s + Number(it.unit_price) * Number(it.quantity), 0);
    // If the order was already marked served, bump it back to preparing so it
    // reappears in the live feed for the new items.
    const { data: orderRow } = await supabase.from("orders").select("status").eq("id", orderId).maybeSingle();
    const patch: any = {
      total,
      last_appended_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (orderRow?.status === "served") patch.status = "preparing";
    await supabase.from("orders").update(patch).eq("id", orderId);
    setBusy(false);
    toast.success(`Added "${n}"`);
    reset();
    setOpen(false);
    onAdded?.();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="col-span-2">
          <ChefHat className="h-3.5 w-3.5" /> Add extra item
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {mode === "picker" ? "Add item to order" : `Add — ${preset?.label || "Custom"}`}
          </DialogTitle>
        </DialogHeader>

        {mode === "picker" ? (
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">Pick a common extra — or tap "Other" to type a custom item.</p>
            <div className="grid grid-cols-3 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => choosePreset(p)}
                  className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card p-3 text-center text-xs font-semibold transition-smooth hover:border-primary hover:bg-primary/5 tap-scale"
                >
                  <span className="text-2xl">{p.emoji}</span>
                  <span className="leading-tight">{p.label}</span>
                  {p.price != null && <span className="text-[10px] text-muted-foreground">₹{p.price}</span>}
                  {p.askPrice && <span className="text-[10px] text-muted-foreground">ask price</span>}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Item name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Extra sauce, Special packing"
                autoFocus={!preset || preset.id === "custom"}
                readOnly={!!preset && preset.id !== "custom"}
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Price (₹)</span>
                <input
                  type="number" inputMode="decimal" min={0}
                  value={price} onChange={(e) => setPrice(e.target.value)}
                  placeholder="0"
                  autoFocus={!!preset && (preset.askPrice || preset.id === "custom")}
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Quantity</span>
                <input
                  type="number" inputMode="numeric" min={1}
                  value={qty} onChange={(e) => setQty(e.target.value)}
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>
            </div>
            <p className="text-[11px] text-muted-foreground">
              This item will appear on the customer's bill, admin panel and the final receipt — flagged as added by kitchen.
            </p>
          </div>
        )}

        <DialogFooter>
          {mode === "form" && (
            <Button variant="ghost" size="sm" onClick={() => { setMode("picker"); setPreset(null); }} disabled={busy}>
              Back
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          {mode === "form" && (
            <Button variant="hero" size="sm" onClick={submit} disabled={busy}>
              <Plus className="h-3.5 w-3.5" /> {busy ? "Adding…" : "Add to order"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
