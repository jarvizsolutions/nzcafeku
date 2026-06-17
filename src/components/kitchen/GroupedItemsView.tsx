import { useMemo } from "react";
import { Flame } from "lucide-react";

type Item = { id: string; name: string; quantity: number; order_id: string };

/**
 * Groups identical line items across all active orders.
 * Useful for kitchen pull-list view: "Chicken Popcorn (Large) × 6 (3 tables)"
 */
export const GroupedItemsView = ({
  items,
  ordersByItemOrderId,
}: {
  items: Item[];
  ordersByItemOrderId: Record<string, { table_number: number; is_rush: boolean }>;
}) => {
  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; tables: Set<number>; rush: boolean }>();
    items.forEach((it) => {
      const o = ordersByItemOrderId[it.order_id];
      if (!o) return;
      const entry = map.get(it.name) || { name: it.name, qty: 0, tables: new Set<number>(), rush: false };
      entry.qty += it.quantity;
      entry.tables.add(o.table_number);
      if (o.is_rush) entry.rush = true;
      map.set(it.name, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty);
  }, [items, ordersByItemOrderId]);

  if (grouped.length === 0) {
    return <p className="py-12 text-center text-muted-foreground">Nothing to prepare. 🍗</p>;
  }

  return (
    <ul className="space-y-2">
      {grouped.map((g) => (
        <li
          key={g.name}
          className={`flex items-center gap-3 rounded-2xl bg-card p-4 shadow-soft transition-smooth ${
            g.rush ? "ring-2 ring-destructive" : ""
          }`}
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary text-xl font-extrabold text-primary-foreground shadow-soft">
            {g.qty}
          </span>
          <div className="flex-1">
            <p className="font-semibold leading-tight">{g.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {g.tables.size} {g.tables.size === 1 ? "table" : "tables"}: {Array.from(g.tables).sort((a, b) => a - b).map((t) => `T${t}`).join(", ")}
            </p>
          </div>
          {g.rush && (
            <span className="flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold uppercase text-destructive-foreground">
              <Flame className="h-3 w-3" /> Rush
            </span>
          )}
        </li>
      ))}
    </ul>
  );
};
