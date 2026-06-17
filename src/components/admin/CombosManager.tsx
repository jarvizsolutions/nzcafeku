import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Edit, Sparkles, Package, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImageUploadField } from "./ImageUploadField";
import { formatINR } from "@/lib/format";

type MenuItem = { id: string; name: string; price: number };
type ComboItemRow = { id?: string; menu_item_id: string; quantity: number };
type Combo = {
  id: string; name: string; description: string | null; image_url: string | null;
  original_price: number; offer_price: number; is_active: boolean;
  is_special: boolean; sort_order: number;
};

export const CombosManager = () => {
  const [combos, setCombos] = useState<Combo[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Combo | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: cs }, { data: mi }] = await Promise.all([
      supabase.from("combos").select("*").order("sort_order").order("created_at"),
      supabase.from("menu_items").select("id,name,price").order("name"),
    ]);
    setCombos((cs as Combo[]) || []);
    setItems((mi as MenuItem[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const toggle = async (c: Combo, field: "is_active" | "is_special") => {
    const patch: any = { [field]: !c[field] };
    const { error } = await supabase.from("combos").update(patch).eq("id", c.id);
    if (error) toast.error(error.message); else load();
  };

  const remove = async (c: Combo) => {
    if (!confirm(`Delete combo "${c.name}"?`)) return;
    const { error } = await supabase.from("combos").delete().eq("id", c.id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); load(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold">Combo Offers</h2>
          <p className="text-xs text-muted-foreground">Bundle existing menu items into a single combo with a special price.</p>
        </div>
        <Button variant="hero" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> New Combo
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : combos.length === 0 ? (
        <p className="rounded-2xl bg-card p-10 text-center text-sm text-muted-foreground shadow-soft">
          No combos yet. Click "New Combo" to create one.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {combos.map((c) => (
            <article key={c.id} className={`rounded-2xl bg-card p-3 shadow-soft transition-smooth ${!c.is_active ? "opacity-60" : ""}`}>
              <div className="flex gap-3">
                <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-secondary">
                  {c.image_url ? <img src={c.image_url} alt={c.name} className="h-full w-full object-cover" /> : <Package className="h-6 w-6 text-muted-foreground" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-1">
                    <p className="truncate font-semibold">{c.name}</p>
                    {c.is_special && <span className="rounded-full bg-gold/20 px-1.5 py-0.5 text-[9px] font-bold text-gold-foreground">★ SPECIAL</span>}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{c.description || "—"}</p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="font-display text-base font-bold text-primary">{formatINR(c.offer_price)}</span>
                    {c.original_price > c.offer_price && (
                      <span className="text-xs text-muted-foreground line-through">{formatINR(c.original_price)}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-2">
                <label className="flex items-center gap-2 text-xs">
                  <Switch checked={c.is_active} onCheckedChange={() => toggle(c, "is_active")} />
                  Active
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <Switch checked={c.is_special} onCheckedChange={() => toggle(c, "is_special")} />
                  <Sparkles className="h-3 w-3" /> Special
                </label>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => setEditing(c)}><Edit className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(c)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <ComboEditor
        open={creating || !!editing}
        combo={editing}
        items={items}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSaved={() => { setCreating(false); setEditing(null); load(); }}
      />
    </div>
  );
};

const ComboEditor = ({ open, combo, items, onClose, onSaved }: {
  open: boolean; combo: Combo | null; items: MenuItem[]; onClose: () => void; onSaved: () => void;
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [original, setOriginal] = useState("");
  const [offer, setOffer] = useState("");
  const [isSpecial, setIsSpecial] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [rows, setRows] = useState<ComboItemRow[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (combo) {
      setName(combo.name); setDescription(combo.description || "");
      setImageUrl(combo.image_url || ""); setOriginal(String(combo.original_price));
      setOffer(String(combo.offer_price)); setIsSpecial(combo.is_special); setIsActive(combo.is_active);
      supabase.from("combo_items").select("*").eq("combo_id", combo.id).then(({ data }) =>
        setRows((data || []).map((r: any) => ({ id: r.id, menu_item_id: r.menu_item_id, quantity: r.quantity })))
      );
    } else {
      setName(""); setDescription(""); setImageUrl("");
      setOriginal(""); setOffer(""); setIsSpecial(false); setIsActive(true); setRows([]);
    }
  }, [open, combo]);

  const computedOriginal = useMemo(() => {
    return rows.reduce((s, r) => {
      const it = items.find((i) => i.id === r.menu_item_id);
      return s + (it ? Number(it.price) * r.quantity : 0);
    }, 0);
  }, [rows, items]);

  const addRow = () => setRows((r) => [...r, { menu_item_id: items[0]?.id || "", quantity: 1 }]);
  const updateRow = (idx: number, patch: Partial<ComboItemRow>) =>
    setRows((r) => r.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  const removeRow = (idx: number) => setRows((r) => r.filter((_, i) => i !== idx));

  const save = async () => {
    if (!name.trim()) { toast.error("Combo name required"); return; }
    if (rows.length === 0) { toast.error("Add at least one item"); return; }
    if (rows.some((r) => !r.menu_item_id || r.quantity < 1)) { toast.error("Fix item rows"); return; }
    const offerNum = Number(offer);
    if (!offerNum || offerNum <= 0) { toast.error("Enter a valid offer price"); return; }
    const originalNum = Number(original) || computedOriginal;

    setBusy(true);
    try {
      const payload = {
        name: name.trim(), description: description.trim() || null, image_url: imageUrl || null,
        original_price: originalNum, offer_price: offerNum,
        is_special: isSpecial, is_active: isActive,
      };
      let comboId = combo?.id;
      if (combo) {
        const { error } = await supabase.from("combos").update(payload).eq("id", combo.id);
        if (error) throw error;
        await supabase.from("combo_items").delete().eq("combo_id", combo.id);
      } else {
        const { data, error } = await supabase.from("combos").insert(payload).select("id").single();
        if (error) throw error;
        comboId = data.id;
      }
      const { error: ciErr } = await supabase.from("combo_items").insert(
        rows.map((r) => ({ combo_id: comboId!, menu_item_id: r.menu_item_id, quantity: r.quantity }))
      );
      if (ciErr) throw ciErr;
      toast.success(combo ? "Combo updated" : "Combo created");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{combo ? "Edit Combo" : "New Combo"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <ImageUploadField value={imageUrl} onChange={setImageUrl} folder="combos" />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
            </label>
            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Short description</span>
              <input value={description} onChange={(e) => setDescription(e.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
            </label>
            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Original price (₹)</span>
              <input type="number" value={original} onChange={(e) => setOriginal(e.target.value)}
                placeholder={`Auto: ${computedOriginal}`}
                className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
            </label>
            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Offer price (₹)</span>
              <input type="number" value={offer} onChange={(e) => setOffer(e.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
            </label>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Included items</span>
              <Button type="button" size="sm" variant="outline" onClick={addRow} disabled={items.length === 0}>
                <Plus className="h-3.5 w-3.5" /> Add item
              </Button>
            </div>
            {items.length === 0 && <p className="text-xs text-muted-foreground">Add menu items first.</p>}
            <div className="space-y-2">
              {rows.map((r, idx) => (
                <div key={idx} className="flex items-center gap-2 rounded-xl bg-secondary/40 p-2">
                  <select value={r.menu_item_id} onChange={(e) => updateRow(idx, { menu_item_id: e.target.value })}
                    className="h-9 flex-1 rounded-lg border border-border bg-background px-2 text-sm">
                    {items.map((it) => <option key={it.id} value={it.id}>{it.name} — ₹{it.price}</option>)}
                  </select>
                  <input type="number" min={1} value={r.quantity}
                    onChange={(e) => updateRow(idx, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                    className="h-9 w-16 rounded-lg border border-border bg-background px-2 text-sm" />
                  <Button size="icon" variant="ghost" onClick={() => removeRow(idx)}><X className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
            {rows.length > 0 && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Sum of items: <strong>{formatINR(computedOriginal)}</strong>
              </p>
            )}
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm"><Switch checked={isActive} onCheckedChange={setIsActive} /> Active</label>
            <label className="flex items-center gap-2 text-sm"><Switch checked={isSpecial} onCheckedChange={setIsSpecial} /> Mark as Special</label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="hero" onClick={save} disabled={busy}>{busy ? "Saving…" : combo ? "Save Changes" : "Create Combo"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
