import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/format";

export type Variant = { label: string; price: number };

export const VariantPicker = ({
  open, onOpenChange, itemName, variants, onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  itemName: string;
  variants: Variant[];
  onConfirm: (v: Variant) => void;
}) => {
  const [selected, setSelected] = useState<string>(variants[0]?.label || "");

  const confirm = () => {
    const v = variants.find((x) => x.label === selected);
    if (v) {
      onConfirm(v);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Choose option</DialogTitle>
          <p className="text-xs text-muted-foreground">{itemName}</p>
        </DialogHeader>
        <div className="space-y-2 py-2">
          {variants.map((v) => {
            const active = selected === v.label;
            return (
              <button
                key={v.label}
                onClick={() => setSelected(v.label)}
                className={`flex w-full items-center justify-between rounded-2xl border-2 p-4 text-left transition-smooth ${
                  active
                    ? "border-primary bg-primary/5 shadow-soft"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`grid h-5 w-5 place-items-center rounded-full border-2 ${
                    active ? "border-primary" : "border-muted-foreground/40"
                  }`}>
                    {active && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
                  </span>
                  <span className="font-semibold">{v.label}</span>
                </div>
                <span className="font-display text-lg font-bold text-primary">{formatINR(Number(v.price))}</span>
              </button>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="hero" onClick={confirm} disabled={!selected}>Add to cart</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
