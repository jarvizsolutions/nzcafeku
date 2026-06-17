import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";

export type ComboChild = { name: string; quantity: number };

export type CartItem = {
  /** Unique cart-line key */
  key: string;
  /** menu_items.id for normal dishes; null for combos / add-ons */
  menu_item_id: string | null;
  name: string;
  price: number;
  variant_label?: string | null;
  image_url?: string | null;
  quantity: number;
  /** When set, this line is a combo; children are forwarded to kitchen via order notes */
  combo_id?: string | null;
  combo_children?: ComboChild[];
};

type CartCtx = {
  items: CartItem[];
  add: (item: Omit<CartItem, "quantity" | "key"> & { key?: string }) => void;
  remove: (key: string) => void;
  setQuantity: (key: string, qty: number) => void;
  clear: () => void;
  count: number;
  total: number;
};

const Ctx = createContext<CartCtx | null>(null);
const KEY = "fsc_cart_v2";

const makeKey = (menuItemId: string | null, variantLabel?: string | null, comboId?: string | null) => {
  if (comboId) return `combo::${comboId}`;
  return variantLabel ? `${menuItemId}::${variantLabel}` : String(menuItemId);
};

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
      // Ensure shape (migrate from old v1 if present)
      return Array.isArray(raw) ? raw.filter((i) => i && i.key && (i.menu_item_id || i.combo_id)) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(items));
  }, [items]);

  const value = useMemo<CartCtx>(() => ({
    items,
    add: (item) => {
      const key = item.key || makeKey(item.menu_item_id, item.variant_label, item.combo_id);
      setItems((curr) => {
        const found = curr.find((i) => i.key === key);
        if (found) return curr.map((i) => (i.key === key ? { ...i, quantity: i.quantity + 1 } : i));
        return [...curr, { ...item, key, quantity: 1 }];
      });
    },
    remove: (key) => setItems((curr) => curr.filter((i) => i.key !== key)),
    setQuantity: (key, qty) =>
      setItems((curr) =>
        qty <= 0 ? curr.filter((i) => i.key !== key) : curr.map((i) => (i.key === key ? { ...i, quantity: qty } : i))
      ),
    clear: () => setItems([]),
    count: items.reduce((s, i) => s + i.quantity, 0),
    total: items.reduce((s, i) => s + i.quantity * i.price, 0),
  }), [items]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useCart = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};
