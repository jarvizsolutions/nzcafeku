import { ShoppingBag } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { formatINR } from "@/lib/format";
import { useState } from "react";
import { CartSheet } from "@/components/CartSheet";

/**
 * A globally-reusable floating cart button.
 * Always visible so the user can open the cart anytime.
 * - Shows full bar with item count + total when cart has items.
 * - Shows a compact circular icon when cart is empty.
 */
export const FloatingCartBar = ({ tableNumber }: { tableNumber: number }) => {
  const cart = useCart();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="fixed inset-x-0 bottom-4 z-40 mx-auto max-w-md px-4 animate-slide-up pointer-events-none">
        {cart.count > 0 ? (
          <button
            onClick={() => setOpen(true)}
            className="pointer-events-auto flex w-full items-center justify-between rounded-full bg-gradient-primary px-5 py-4 text-primary-foreground shadow-elegant transition-bounce active:scale-95"
          >
            <span className="flex items-center gap-3 text-sm font-semibold">
              <span className="relative grid h-9 w-9 place-items-center rounded-full bg-primary-foreground/15 animate-bounce-soft">
                <ShoppingBag className="h-4 w-4" />
                <span className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-gold px-1 text-[10px] font-bold text-gold-foreground">
                  {cart.count}
                </span>
              </span>
              {cart.count} {cart.count === 1 ? "item" : "items"} • {formatINR(cart.total)}
            </span>
            <span className="rounded-full bg-gold px-4 py-1.5 text-xs font-bold text-gold-foreground">
              View Cart →
            </span>
          </button>
        ) : (
          <div className="flex justify-end">
            <button
              onClick={() => setOpen(true)}
              aria-label="View cart"
              className="pointer-events-auto grid h-14 w-14 place-items-center rounded-full bg-gradient-primary text-primary-foreground shadow-elegant transition-bounce active:scale-95"
            >
              <ShoppingBag className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
      <CartSheet open={open} onOpenChange={setOpen} tableNumber={tableNumber} />
    </>
  );
};
