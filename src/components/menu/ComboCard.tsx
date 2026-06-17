import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Sparkles, Package } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatINR } from "@/lib/format";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";

export type Combo = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  original_price: number;
  offer_price: number;
  is_active: boolean;
  is_special: boolean;
  combo_items?: Array<{ menu_item_id: string; quantity: number; menu_items?: { name: string } | null }>;
};

const childrenList = (combo: Combo) =>
  (combo.combo_items || []).map((ci) => ({
    name: ci.menu_items?.name || "Item",
    quantity: ci.quantity,
  }));

export const ComboCard = ({ combo, onOpen }: { combo: Combo; onOpen: () => void }) => {
  const cart = useCart();
  const inCart = cart.items.find((i) => i.combo_id === combo.id);

  const add = () => {
    cart.add({
      menu_item_id: null,
      name: combo.name,
      price: Number(combo.offer_price),
      variant_label: "Combo",
      image_url: combo.image_url,
      combo_id: combo.id,
      combo_children: childrenList(combo),
    });
    toast.success(`${combo.name} added`, { duration: 1500 });
  };

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border-2 border-gold/40 bg-gradient-to-br from-card to-gold/5 shadow-elegant transition-smooth hover:shadow-float">
      {combo.is_special && (
        <span className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-full bg-gradient-gold px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gold-foreground shadow-gold">
          <Sparkles className="h-3 w-3" /> Special
        </span>
      )}
      <button type="button" onClick={onOpen} className="relative grid aspect-[4/3] w-full place-items-center overflow-hidden bg-secondary">
        {combo.image_url ? (
          <img src={combo.image_url} alt={combo.name} className="h-full w-full object-cover transition-smooth group-hover:scale-105" loading="lazy" />
        ) : (
          <Package className="h-10 w-10 text-primary/40" />
        )}
      </button>
      <div className="flex flex-1 flex-col p-3">
        <h3 className="font-display text-base font-bold">{combo.name}</h3>
        {combo.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{combo.description}</p>}
        <ul className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
          {(combo.combo_items || []).slice(0, 3).map((ci, i) => (
            <li key={i}>• {ci.quantity}× {ci.menu_items?.name || "Item"}</li>
          ))}
          {(combo.combo_items?.length || 0) > 3 && <li>+ {(combo.combo_items!.length - 3)} more…</li>}
        </ul>
        <div className="mt-auto flex items-center justify-between pt-3">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-xl font-bold text-primary">{formatINR(combo.offer_price)}</span>
            {combo.original_price > combo.offer_price && (
              <span className="text-xs text-muted-foreground line-through">{formatINR(combo.original_price)}</span>
            )}
          </div>
          <Button size="sm" variant="hero" onClick={add}>
            <Plus className="h-3.5 w-3.5" /> {inCart ? `Added (${inCart.quantity})` : "Add Combo"}
          </Button>
        </div>
      </div>
    </article>
  );
};

export const ComboModal = ({ combo, open, onOpenChange }: { combo: Combo | null; open: boolean; onOpenChange: (v: boolean) => void }) => {
  const cart = useCart();
  if (!combo) return null;
  const add = () => {
    cart.add({
      menu_item_id: null, name: combo.name, price: Number(combo.offer_price),
      variant_label: "Combo", image_url: combo.image_url,
      combo_id: combo.id, combo_children: childrenList(combo),
    });
    toast.success(`${combo.name} added`, { duration: 1500 });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto p-0">
        {combo.image_url && <img src={combo.image_url} alt={combo.name} className="h-48 w-full object-cover" />}
        <div className="space-y-3 p-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {combo.is_special && <Sparkles className="h-4 w-4 text-gold-foreground" />}
              {combo.name}
            </DialogTitle>
          </DialogHeader>
          {combo.description && <p className="text-sm text-muted-foreground">{combo.description}</p>}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Includes</p>
            <ul className="space-y-1 rounded-xl bg-secondary/40 p-3 text-sm">
              {(combo.combo_items || []).map((ci, i) => (
                <li key={i} className="flex items-center justify-between">
                  <span>{ci.menu_items?.name || "Item"}</span>
                  <span className="font-semibold">×{ci.quantity}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex items-end justify-between border-t border-border/60 pt-3">
            <div>
              <p className="text-xs text-muted-foreground line-through">{formatINR(combo.original_price)}</p>
              <p className="font-display text-3xl font-bold text-primary">{formatINR(combo.offer_price)}</p>
            </div>
            <Button variant="hero" size="lg" onClick={add}><Plus className="h-4 w-4" /> Add Combo</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
