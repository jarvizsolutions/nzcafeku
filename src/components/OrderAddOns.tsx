import { Minus, Plus } from "lucide-react";
import { formatINR } from "@/lib/format";

/**
 * Curated upsell add-ons offered just before checkout.
 * Kept as static menu so we don't depend on admin seeding extra rows.
 * Each selected add-on becomes a real order_items line, so the kitchen
 * and the bill see them naturally — no schema change needed.
 */
export const ADDONS: { id: string; name: string; emoji: string; price: number }[] = [
  { id: "addon-mayo",   name: "Mayonnaise", emoji: "🥚", price: 5 },
  { id: "addon-pepsi",  name: "Pepsi (400ml)", emoji: "🥤", price: 22 },
  { id: "addon-water",  name: "Water Bottle (750ml)", emoji: "💧", price: 12 },
];

export type AddOnQty = Record<string, number>;

export const OrderAddOns = ({
  value, onChange,
}: { value: AddOnQty; onChange: (next: AddOnQty) => void }) => {
  const set = (id: string, qty: number) => {
    const next = { ...value };
    if (qty <= 0) delete next[id];
    else next[id] = qty;
    onChange(next);
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-bold">Make it complete</h3>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Optional</span>
      </div>
      <div className="grid gap-2">
        {ADDONS.map((a) => {
          const qty = value[a.id] || 0;
          const active = qty > 0;
          return (
            <div
              key={a.id}
              className={`flex items-center gap-3 rounded-2xl border p-3 transition-smooth ${
                active ? "border-primary bg-primary/5" : "border-border bg-card"
              }`}
            >
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-lg">
                {a.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-semibold">{a.name}</p>
                <p className="text-xs text-muted-foreground">{formatINR(a.price)}</p>
              </div>
              {active ? (
                <div className="flex items-center gap-1.5 rounded-full bg-card p-1 shadow-soft">
                  <button
                    type="button"
                    onClick={() => set(a.id, qty - 1)}
                    aria-label={`Remove one ${a.name}`}
                    className="grid h-7 w-7 place-items-center rounded-full bg-secondary tap-scale"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="min-w-[18px] text-center text-sm font-bold">{qty}</span>
                  <button
                    type="button"
                    onClick={() => set(a.id, qty + 1)}
                    aria-label={`Add one more ${a.name}`}
                    className="grid h-7 w-7 place-items-center rounded-full bg-secondary tap-scale"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => set(a.id, 1)}
                  className="rounded-full bg-gradient-primary px-4 py-1.5 text-xs font-bold text-primary-foreground shadow-elegant tap-scale"
                >
                  + Add
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
