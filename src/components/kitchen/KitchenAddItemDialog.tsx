import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, ChefHat, Search, Minus } from "lucide-react";
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

/** A single addable row built from menu_items (one per variant, if any). */
type MenuRow = {
  key: string;
  menu_item_id: string;
  name: string;
  variant_label: string | null;
  unit_price: number;
};

/**
 * Kitchen-side: add an extra line item to an existing order.
 * Used for things like "Extra sauce", "Special packing", parcel conversion, etc.
 * The new item is flagged `added_by_kitchen=true` so all surfaces highlight it.
 */
export const KitchenAddItemDialog = ({ orderId, onAdded }: { orderId: string; onAdded?: () => void }) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"picker" | "form" | "menu">("picker");
  const [preset, setPreset] = useState<typeof PRESETS[number] | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("1");
  const [busy, setBusy] = useState(false);

  // Menu-picker state
  const [menuRows, setMenuRows] = useState<MenuRow[]>([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Record<string, number>>({}); // key -> qty

  useEffect(() => {
    if (mode !== "menu" || menuRows.length > 0) return;
    let cancelled = false;
    (async () => {
      setMenuLoading(true);
      const { data, error } = await supabase
        .from("menu_items")
        .select("id,name,price,variants,is_available")
        .eq("is_available", true)
        .order("name", { ascending: true });
      if (cancelled) return;
      if (error) { toast.error(error.message); setMenuLoading(false); return; }
      const rows: MenuRow[] = [];
      for (const m of (data || []) as any[]) {
        const variants = Array.isArray(m.variants) ? m.variants : [];
        if (variants.length > 0) {
          for (const v of variants) {
            const label = String(v?.label ?? "").trim();
            const vp = Number(v?.price);
            if (!label || !Number.isFinite(vp)) continue;
            rows.push({
              key: `${m.id}::${label}`,
              menu_item_id: m.id,
              name: m.name,
              variant_label: label,
              unit_price: vp,
            });
          }
        } else {
          rows.push({
            key: m.id,
            menu_item_id: m.id,
            name: m.name,
            variant_label: null,
            unit_price: Number(m.price) || 0,
          });
        }
      }
      setMenuRows(rows);
      setMenuLoading(false);
    })();
    return () => { cancelled = true; };
  }, [mode, menuRows.length]);

  const filteredMenu = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return menuRows;
    return menuRows.filter((r) =>
      r.name.toLowerCase().includes(q) ||
      (r.variant_label || "").toLowerCase().includes(q)
    );
  }, [menuRows, search]);

  const pickedTotal = useMemo(() => {
    return menuRows.reduce((s, r) => s + (picked[r.key] || 0) * r.unit_price, 0);
  }, [menuRows, picked]);

  const pickedCount = useMemo(() => {
    return Object.values(picked).reduce((s, n) => s + (n || 0), 0);
  }, [picked]);

  const bump = (key: string, delta: number) => {
    setPicked((prev) => {
      const next = { ...prev };
      const n = Math.max(0, (next[key] || 0) + delta);
      if (n === 0) delete next[key]; else next[key] = n;
      return next;
    });
  };

  const reset = () => {
    setMode("picker"); setPreset(null);
    setName(""); setPrice(""); setQty("1");
    setSearch(""); setPicked({});
  };

  const choosePreset = (p: typeof PRESETS[number]) => {
    if (p.id === "custom") {
      // "Other" opens the same searchable menu picker as "Browse full menu" —
      // kitchen picks a real item + quantity instead of typing a name/price.
      setMode("menu");
      return;
    }
    setPreset(p);
    setName(p.name || "");
    setPrice(p.price != null ? String(p.price) : "");
    setQty("1");
    setMode("form");
  };

  /** Recompute order total + bump back to "preparing" if it was served. */
  const refreshOrderTotal = async () => {
    const { data: items } = await supabase
      .from("order_items")
      .select("unit_price,quantity,is_cancelled")
      .eq("order_id", orderId);
    const total = (items || [])
      .filter((it: any) => !it.is_cancelled)
      .reduce((s: number, it: any) => s + Number(it.unit_price) * Number(it.quantity), 0);
    const { data: orderRow } = await supabase
      .from("orders").select("status").eq("id", orderId).maybeSingle();
    const patch: any = {
      total,
      last_appended_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (orderRow?.status === "served") patch.status = "preparing";
    await supabase.from("orders").update(patch).eq("id", orderId);
  };

  const submitMenuSelection = async () => {
    const rows = menuRows
      .filter((r) => (picked[r.key] || 0) > 0)
      .map((r) => ({
        order_id: orderId,
        menu_item_id: r.menu_item_id,
        name: r.name,
        variant_label: r.variant_label,
        unit_price: r.unit_price,
        quantity: picked[r.key],
        added_by_kitchen: true,
      }));
    if (rows.length === 0) { toast.error("Pick at least one item"); return; }
    setBusy(true);
    const { error } = await supabase.from("order_items").insert(rows);
    if (error) { setBusy(false); toast.error(error.message); return; }
    await refreshOrderTotal();
    setBusy(false);
    toast.success(`Added ${rows.reduce((s, r) => s + r.quantity, 0)} item(s)`);
    reset();
    setOpen(false);
    onAdded?.();
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
    await refreshOrderTotal();
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
            {mode === "picker"
              ? "Add item to order"
              : mode === "menu"
                ? "Add from menu"
                : `Add — ${preset?.label || "Custom"}`}
          </DialogTitle>
        </DialogHeader>

        {mode === "picker" ? (
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">Pick a common extra, or tap "Other" to search the menu and pick an item.</p>
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
        ) : mode === "menu" ? (
          <div className="space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search menu…"
                autoFocus
                className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="max-h-[55vh] overflow-y-auto rounded-xl border border-border">
              {menuLoading ? (
                <div className="p-6 text-center text-xs text-muted-foreground">Loading menu…</div>
              ) : filteredMenu.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">No items match.</div>
              ) : (
                <ul className="divide-y divide-border">
                  {filteredMenu.map((r) => {
                    const n = picked[r.key] || 0;
                    return (
                      <li key={r.key} className="flex items-center gap-2 p-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">
                            {r.name}
                            {r.variant_label && (
                              <span className="ml-1 text-[11px] font-normal text-muted-foreground">({r.variant_label})</span>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground">₹{r.unit_price}</div>
                        </div>
                        {n === 0 ? (
                          <Button size="sm" variant="outline" onClick={() => bump(r.key, 1)}>
                            <Plus className="h-3.5 w-3.5" /> Add
                          </Button>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => bump(r.key, -1)}>
                              <Minus className="h-3.5 w-3.5" />
                            </Button>
                            <span className="w-6 text-center text-sm font-bold tabular-nums">{n}</span>
                            <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => bump(r.key, 1)}>
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            {pickedCount > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-primary/5 px-3 py-2 text-xs">
                <span className="font-semibold">{pickedCount} item(s) selected</span>
                <span className="font-bold">₹{pickedTotal.toFixed(2)}</span>
              </div>
            )}
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
          {(mode === "form" || mode === "menu") && (
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
          {mode === "menu" && (
            <Button variant="hero" size="sm" onClick={submitMenuSelection} disabled={busy || pickedCount === 0}>
              <Plus className="h-3.5 w-3.5" /> {busy ? "Adding…" : `Add ${pickedCount || ""}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
