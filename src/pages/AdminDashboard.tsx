import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, LogOut, Trash2, QrCode as QrIcon, Download, Wallet, CheckCircle2, ShieldCheck, Image as ImageIcon, Tags, FileSpreadsheet, BarChart3, Archive, RefreshCw, ChevronDown, Pencil } from "lucide-react";
import * as XLSX from "xlsx";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { formatINR } from "@/lib/format";
import { withTax } from "@/lib/tax";
import { StaffGate } from "@/components/StaffGate";
import { BrandMark } from "@/components/BrandMark";
import { QRCodeSVG } from "qrcode.react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { BillDialog } from "@/components/admin/BillDialog";
import { Eye, Sparkles, EyeOff } from "lucide-react";
import { CombosManager } from "@/components/admin/CombosManager";
import { AnnouncementsManager } from "@/components/admin/AnnouncementsManager";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import { CounterBills } from "@/components/admin/CounterBills";
import { Input } from "@/components/ui/input";

const AdminDashboard = () => (
  <StaffGate allow={["admin", "pro_admin"]}>
    <Inner />
  </StaffGate>
);

/* ── The 8 tabs split into primary (always visible) and secondary (behind "More") ── */
const PRIMARY_TABS = ["bills", "orders", "announcements"] as const;
const SECONDARY_TABS = ["menu", "analytics", "combos", "tables", "feedback", "settings"] as const;
const ALL_TABS = [...PRIMARY_TABS, ...SECONDARY_TABS];

const TAB_LABELS: Record<string, string> = {
  bills: "Bills",
  orders: "Orders",
  announcements: "News",
  menu: "Menu",
  analytics: "Analytics",
  combos: "Combos",
  tables: "Tables",
  feedback: "Feedback",
  settings: "Settings",
};

const Inner = () => {
  const [tab, setTab] = useState("bills");
  const [moreOpen, setMoreOpen] = useState(false);

  /* active style — teal/green instead of red */
  const triggerBase =
    "rounded-full data-[state=active]:bg-destructive data-[state=active]:text-white";

  const isSecondaryActive = (SECONDARY_TABS as readonly string[]).includes(tab);

  return (
    <main className="min-h-screen bg-gradient-warm pb-16">
      <header className="sticky top-0 z-30 glass border-b border-border/50">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <BrandMark />
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm"><Link to="/kitchen">Kitchen</Link></Button>
            <Button
              variant="outline" size="sm"
              onClick={async () => { await supabase.auth.signOut(); window.location.href = "/admin"; }}
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 pt-6">
        <h1 className="font-display text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground">Manage menu, tables, and watch orders flow.</p>

        <Tabs value={tab} onValueChange={(v) => { setTab(v); setMoreOpen(false); }} className="mt-6">

          {/* ── Desktop TabsList (all 8 tabs, unchanged layout) ── */}
          <TabsList className="hidden sm:grid h-auto sm:grid-cols-9 gap-1 rounded-2xl bg-secondary p-1">
            {ALL_TABS.map((t) => (
              <TabsTrigger key={t} value={t} className={triggerBase}>
                {TAB_LABELS[t]}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ── Mobile TabsList (3 primary + More button) ── */}
          <div className="sm:hidden">
            <div className="flex gap-1 rounded-2xl bg-secondary p-1">
              {PRIMARY_TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setMoreOpen(false); }}
                  className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition-colors
                    ${tab === t
                      ? "bg-destructive text-white"
                      : "text-foreground hover:bg-secondary/80"
                    }`}
                >
                  {TAB_LABELS[t]}
                </button>
              ))}
              {/* More button */}
              <button
                onClick={() => setMoreOpen((v) => !v)}
                className={`flex items-center gap-1 rounded-full px-3 py-2 text-sm font-medium transition-colors
                  ${isSecondaryActive
                    ? "bg-destructive text-white"
                    : "text-foreground hover:bg-secondary/80"
                  }`}
              >
                {isSecondaryActive ? TAB_LABELS[tab] : "More"}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${moreOpen ? "rotate-180" : ""}`} />
              </button>
            </div>

            {/* Dropdown panel for secondary tabs */}
            {moreOpen && (
              <div className="mt-1 rounded-2xl bg-card shadow-soft border border-border/50 p-2 flex flex-col gap-1 z-20 relative">
                {SECONDARY_TABS.map((t) => (
                  <button
                    key={t}
                    onClick={() => { setTab(t); setMoreOpen(false); }}
                    className={`w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors
                      ${tab === t
                        ? "bg-destructive text-white"
                        : "hover:bg-secondary text-foreground"
                      }`}
                  >
                    {TAB_LABELS[t]}
                  </button>
                ))}
              </div>
            )}
          </div>

          <TabsContent value="bills"         className="mt-6"><CounterBills /></TabsContent>
          <TabsContent value="menu"          className="mt-6"><MenuManager /></TabsContent>
          <TabsContent value="analytics"     className="mt-6"><ItemAnalytics /></TabsContent>
          <TabsContent value="combos"        className="mt-6"><CombosManager /></TabsContent>
          <TabsContent value="announcements" className="mt-6"><AnnouncementsManager /></TabsContent>
          <TabsContent value="tables"        className="mt-6"><TablesManager /></TabsContent>
          <TabsContent value="orders"        className="mt-6"><OrdersOverview /></TabsContent>
          <TabsContent value="feedback"      className="mt-6"><FeedbackPanel /></TabsContent>
          <TabsContent value="settings"      className="mt-6"><SettingsPanel /></TabsContent>
        </Tabs>
      </section>
    </main>
  );
};

/* -------- FEEDBACK PANEL -------- */
type FeedbackRow = {
  id: string;
  rating: number;
  comment: string | null;
  customer_name: string | null;
  table_number: number | null;
  order_id: string | null;
  created_at: string;
};

const FeedbackPanel = () => {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase.from("feedback") as any)
      .select("id, rating, comment, customer_name, table_number, order_id, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setRows((data || []) as FeedbackRow[]);
  };

  useEffect(() => { load(); }, []);

  const avg = useMemo(() => {
    if (!rows.length) return 0;
    return rows.reduce((s, r) => s + (r.rating || 0), 0) / rows.length;
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Customer Feedback</p>
          <p className="font-display text-2xl font-bold">
            {rows.length} {rows.length === 1 ? "review" : "reviews"} · ⭐ {avg.toFixed(1)}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No feedback yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold truncate">
                    {r.customer_name || "Anonymous"}
                    {r.table_number ? <span className="ml-2 text-xs text-muted-foreground">Table {r.table_number}</span> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
                </div>
                <span className="shrink-0 rounded-full bg-gold/15 px-2.5 py-1 text-xs font-bold text-gold-foreground">
                  {"★".repeat(r.rating)}{"☆".repeat(Math.max(0, 5 - r.rating))}
                </span>
              </div>
              {r.comment ? <p className="mt-2 text-sm text-foreground/90">{r.comment}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/* -------- MENU MANAGER -------- */
const MenuManager = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, { regular: string; large: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("menu_items").select("*").order("sort_order").order("name");
    const list = data || [];
    setItems(list);
    const next: Record<string, { regular: string; large: string }> = {};
    list.forEach((it: any) => {
      const v = Array.isArray(it.variants) ? it.variants : [];
      const reg = v.find((x: any) => String(x.label).toLowerCase() === "regular");
      const lg = v.find((x: any) => String(x.label).toLowerCase() === "large");
      next[it.id] = {
        regular: String(reg?.price ?? it.price ?? ""),
        large: lg?.price != null ? String(lg.price) : "",
      };
    });
    setDrafts(next);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const setDraft = (id: string, key: "regular" | "large", val: string) =>
    setDrafts((d) => ({ ...d, [id]: { ...d[id], [key]: val } }));

  const savePrices = async (it: any) => {
    const d = drafts[it.id];
    const reg = Number(d.regular);
    const hasLarge = d.large.trim() !== "";
    const lg = Number(d.large);
    if (!reg || reg <= 0) { toast.error("Enter a valid Regular price"); return; }
    if (hasLarge && (!lg || lg <= 0)) { toast.error("Large price must be greater than 0 (or leave it blank)"); return; }
    const variants = hasLarge
      ? [{ label: "Regular", price: reg }, { label: "Large", price: lg }]
      : [];
    setSavingId(it.id);
    const { error } = await supabase
      .from("menu_items")
      .update({ price: reg, variants: variants as any })
      .eq("id", it.id);
    setSavingId(null);
    if (error) toast.error(error.message);
    else { toast.success(`${it.name} prices updated`); load(); }
  };

  const toggleAvail = async (id: string, val: boolean) => {
    const { error } = await supabase.from("menu_items").update({ is_available: val }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(val ? "Marked available" : "Marked sold out"); load(); }
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    const { error } = await supabase.from("menu_items").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); load(); }
  };

  const veg = items.filter((i) => i.is_veg);
  const nonveg = items.filter((i) => !i.is_veg);

  return (
    <div className="space-y-6">
      <AddDishCard onAdded={load} />
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-2xl bg-card p-8 text-center text-sm text-muted-foreground shadow-soft">
          No dishes yet. Add your first dish above.
        </p>
      ) : (
        <>
          <PriceSection title="🟢 Veg" items={veg} drafts={drafts} setDraft={setDraft}
            savePrices={savePrices} toggleAvail={toggleAvail} remove={remove} savingId={savingId} reload={load} />
          <PriceSection title="🔴 Non-Veg" items={nonveg} drafts={drafts} setDraft={setDraft}
            savePrices={savePrices} toggleAvail={toggleAvail} remove={remove} savingId={savingId} reload={load} />
        </>
      )}
    </div>
  );
};

const normalizeImageUrl = (raw: string): string => {
  const url = raw.trim();
  if (!url) return url;
  const driveFile = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (driveFile) return `https://drive.google.com/uc?export=view&id=${driveFile[1]}`;
  const driveOpen = url.match(/drive\.google\.com\/open\?id=([^&]+)/);
  if (driveOpen) return `https://drive.google.com/uc?export=view&id=${driveOpen[1]}`;
  return url;
};

const isValidHttpUrl = (s: string): boolean => {
  try { const u = new URL(s); return u.protocol === "http:" || u.protocol === "https:"; }
  catch { return false; }
};

const ItemImageCell = ({ item, onUpdated }: { item: any; onUpdated: () => void }) => {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(item.image_url || "");

  const save = async (newUrl: string) => {
    const { error } = await supabase.from("menu_items").update({ image_url: newUrl || null }).eq("id", item.id);
    if (error) toast.error(error.message);
    else { toast.success("Photo updated"); setOpen(false); onUpdated(); }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => { setUrl(item.image_url || ""); setOpen(true); }}
        className="relative grid h-14 w-14 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-xl border border-border bg-secondary tap-scale"
      >
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <ImageIcon className="h-5 w-5 text-muted-foreground" />
        )}
        <span className="absolute inset-x-0 bottom-0 bg-foreground/70 py-0.5 text-center text-[9px] font-bold uppercase tracking-wider text-background">
          {item.image_url ? "Edit" : "Add"}
        </span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{item.name} — image</DialogTitle></DialogHeader>
          <ImageUploadField value={url} onChange={(u) => { setUrl(u); save(u); }} folder="menu" />
        </DialogContent>
      </Dialog>
    </>
  );
};

const PriceSection = ({ title, items, drafts, setDraft, savePrices, toggleAvail, remove, savingId, reload }: any) => {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="mb-2 font-display text-lg font-bold">{title} <span className="text-sm font-normal text-muted-foreground">({items.length})</span></h3>
      <div className="space-y-2">
        {items.map((it: any) => {
          const d = drafts[it.id] || { regular: "", large: "" };
          const original = Array.isArray(it.variants) ? it.variants : [];
          const origReg = original.find((x: any) => String(x.label).toLowerCase() === "regular")?.price ?? it.price;
          const origLg = original.find((x: any) => String(x.label).toLowerCase() === "large")?.price;
          const draftLgNum = d.large.trim() === "" ? null : Number(d.large);
          const origLgNum = origLg != null ? Number(origLg) : null;
          const dirty = Number(d.regular) !== Number(origReg) || draftLgNum !== origLgNum;
          return (
            <article key={it.id} className="rounded-2xl bg-card p-3 shadow-soft sm:p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <ItemImageCell item={it} onUpdated={reload} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold">{it.name}</p>
                    <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground" title="Priority (1 = top)">
                      #{it.sort_order ?? 0}
                    </span>
                    <EditItemDialog item={it} onSaved={reload} />
                  </div>
                  {!it.image_url && (
                    <span className="mt-0.5 inline-block rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold-foreground">
                      No photo
                    </span>
                  )}
                  {!it.is_available && (
                    <span className="ml-1 mt-0.5 inline-block rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-destructive">
                      Sold out
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <PriceInput label="Regular" value={d.regular} onChange={(v) => setDraft(it.id, "regular", v)} />
                  <PriceInput label="Large (optional)" value={d.large} onChange={(v) => setDraft(it.id, "large", v)} placeholder="—" />
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant={dirty ? "hero" : "outline"}
                    disabled={!dirty || savingId === it.id}
                    onClick={() => savePrices(it)}
                  >
                    {savingId === it.id ? "Saving…" : dirty ? "Save" : "Saved"}
                  </Button>
                  <Button
                    size="sm"
                    variant={it.is_special ? "gold" : "ghost"}
                    onClick={async () => {
                      const { error } = await supabase.from("menu_items").update({ is_special: !it.is_special } as any).eq("id", it.id);
                      if (error) toast.error(error.message); else { toast.success(it.is_special ? "Removed from Specials" : "Marked as Special"); reload(); }
                    }}
                    title={it.is_special ? "Remove from Specials" : "Mark as Special"}
                  >
                    <Sparkles className="h-3.5 w-3.5" /> {it.is_special ? "★" : ""}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleAvail(it.id, !it.is_available)}
                    title={it.is_available ? "Mark sold out" : "Mark available"}
                  >
                    {it.is_available ? "Hide" : "Show"}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(it.id, it.name)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};

const PriceInput = ({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) => (
  <label className="flex flex-col">
    <span className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
    <div className="relative">
      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-24 rounded-xl border border-border bg-background pl-5 pr-2 text-sm font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    </div>
  </label>
);

const EditItemDialog = ({ item, onSaved }: { item: any; onSaved: () => void }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState<string>(item.name || "");
  const [priority, setPriority] = useState<string>(String(item.sort_order ?? 0));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const n = name.trim();
    if (!n) { toast.error("Name is required"); return; }
    const p = Number(priority);
    if (Number.isNaN(p)) { toast.error("Priority must be a number"); return; }
    setBusy(true);
    const { error } = await supabase.from("menu_items")
      .update({ name: n, sort_order: p })
      .eq("id", item.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Updated");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) { setName(item.name || ""); setPriority(String(item.sort_order ?? 0)); } }}>
      <DialogTrigger asChild>
        <button type="button" className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Edit name & priority">
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Edit dish</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Name</span>
            <input
              value={name} onChange={(e) => setName(e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Priority (1 = top of menu)</span>
            <input
              type="number" inputMode="numeric"
              value={priority} onChange={(e) => setPriority(e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <span className="mt-1 block text-[11px] text-muted-foreground">Lower number shows first. Leave existing value to keep current order.</span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button variant="hero" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const AddDishCard = ({ onAdded }: { onAdded: () => void }) => {
  const [name, setName] = useState("");
  const [isVeg, setIsVeg] = useState(false);
  const [regular, setRegular] = useState("");
  const [large, setLarge] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [priority, setPriority] = useState<string>("");
  const [categories, setCategories] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("categories").select("*").order("sort_order").order("name")
      .then(({ data }) => setCategories(data || []));
  }, []);

  const submit = async () => {
    const reg = Number(regular);
    const hasLarge = large.trim() !== "";
    const lg = Number(large);
    if (!name.trim()) { toast.error("Dish name is required"); return; }
    const normalized = imageUrl ? normalizeImageUrl(imageUrl) : "";
    if (normalized && !isValidHttpUrl(normalized)) { toast.error("Image URL is invalid"); return; }
    if (!reg || reg <= 0) { toast.error("Enter a Regular price"); return; }
    if (hasLarge && (!lg || lg <= 0)) { toast.error("Large price must be > 0 (or leave blank)"); return; }
    setBusy(true);
    try {
      const variants = hasLarge
        ? [{ label: "Regular", price: reg }, { label: "Large", price: lg }]
        : [];
      let nextSort: number;
      if (priority.trim() !== "" && !Number.isNaN(Number(priority))) {
        nextSort = Number(priority);
      } else {
        const { data: maxRow } = await supabase
          .from("menu_items").select("sort_order")
          .order("sort_order", { ascending: false }).limit(1).maybeSingle();
        nextSort = ((maxRow as any)?.sort_order ?? 0) + 1;
      }
      const { error } = await supabase.from("menu_items").insert({
        name: name.trim(),
        price: reg,
        is_veg: isVeg,
        is_available: true,
        image_url: normalized || null,
        category_id: categoryId || null,
        variants: variants as any,
        sort_order: nextSort,
      });
      if (error) throw error;
      toast.success("Dish added");
      setName(""); setRegular(""); setLarge(""); setIsVeg(false);
      setImageUrl(""); setCategoryId(""); setPriority("");
      onAdded();
    } catch (err: any) {
      toast.error(err?.message || "Failed to add dish");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl bg-card p-4 shadow-soft">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Add a new dish</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <ImageUploadField value={imageUrl} onChange={setImageUrl} folder="menu" label="Image" />
        <div className="space-y-3">
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Name</span>
            <input
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Chicken Popcorn"
              className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Category</span>
            <select
              value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="">— None —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <PriceInput label="Regular" value={regular} onChange={setRegular} />
            <PriceInput label="Large (optional)" value={large} onChange={setLarge} placeholder="—" />
            <PriceInput label="Priority (optional)" value={priority} onChange={setPriority} placeholder="auto" />
            <label className="flex items-center gap-2 px-1 pb-2 text-sm">
              <input type="checkbox" checked={isVeg} onChange={(e) => setIsVeg(e.target.checked)} className="h-4 w-4 accent-primary" />
              Veg
            </label>
          </div>
          <Button variant="hero" onClick={submit} disabled={busy} className="w-full sm:w-auto">
            <Plus className="h-4 w-4" /> {busy ? "Adding…" : "Add dish"}
          </Button>
        </div>
      </div>
    </div>
  );
};

const inputCls = "h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
    {children}
  </label>
);

/* -------- TABLES & QR -------- */
const TablesManager = () => {
  const [tables, setTables] = useState<any[]>([]);
  const [num, setNum] = useState("");
  const [label, setLabel] = useState("");
  const [qrFor, setQrFor] = useState<any | null>(null);

  const load = async () => {
    const { data } = await supabase.from("restaurant_tables").select("*").order("table_number");
    setTables(data || []);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!num) return;
    const { error } = await supabase.from("restaurant_tables").insert({
      table_number: Number(num), label: label || null,
    });
    if (error) toast.error(error.message); else { setNum(""); setLabel(""); load(); }
  };

  const remove = async (id: string) => {
    if (!confirm("Remove table?")) return;
    const { error } = await supabase.from("restaurant_tables").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-2 rounded-2xl bg-card p-4 shadow-soft">
        <Field label="Number"><input type="number" className={inputCls + " w-28"} value={num} onChange={(e) => setNum(e.target.value)} /></Field>
        <Field label="Label (optional)"><input className={inputCls + " w-48"} value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
        <Button variant="hero" onClick={add}><Plus /> Add Table</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tables.map((t) => (
          <article key={t.id} className="rounded-2xl bg-card p-4 shadow-soft hover-lift">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-display text-2xl font-bold">Table {t.table_number}</p>
                {t.label && <p className="text-xs text-muted-foreground">{t.label}</p>}
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(t.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
            <Button variant="gold" size="sm" className="mt-3 w-full" onClick={() => setQrFor(t)}>
              <QrIcon className="h-4 w-4" /> Show QR
            </Button>
          </article>
        ))}
      </div>

      <Dialog open={!!qrFor} onOpenChange={(v) => !v && setQrFor(null)}>
        {qrFor && <QrDialog table={qrFor} />}
      </Dialog>
    </div>
  );
};

const QrDialog = ({ table }: { table: any }) => {
  const url = `${window.location.origin}/menu?table=${table.table_number}`;
  const downloadPng = () => {
    const svg = document.getElementById("qr-svg") as unknown as SVGSVGElement;
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: "image/svg+xml" });
    const blobUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 800; canvas.height = 800;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 800, 800);
      ctx.drawImage(img, 50, 50, 700, 700);
      canvas.toBlob((b) => {
        if (!b) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(b);
        a.download = `table-${table.table_number}-qr.png`;
        a.click();
      });
      URL.revokeObjectURL(blobUrl);
    };
    img.src = blobUrl;
  };

  return (
    <DialogContent className="max-w-sm">
      <DialogHeader><DialogTitle>Table {table.table_number} QR</DialogTitle></DialogHeader>
      <div className="flex flex-col items-center gap-4">
        <div className="rounded-2xl bg-card p-5 shadow-elegant">
          <QRCodeSVG id="qr-svg" value={url} size={220} fgColor="#a31c1c" level="H" includeMargin />
        </div>
        <p className="break-all rounded-lg bg-secondary p-2 text-center text-xs text-muted-foreground">{url}</p>
        <Button variant="hero" onClick={downloadPng}><Download /> Download PNG</Button>
      </div>
    </DialogContent>
  );
};

/* -------- ORDERS OVERVIEW -------- */
const OrdersOverview = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [monthOrders, setMonthOrders] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [openReport, setOpenReport] = useState<any | null>(null);
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAllOrders, setShowAllOrders] = useState(false);
  const [billId, setBillId] = useState<string | null>(null);
  const [editPay, setEditPay] = useState<any | null>(null);
  const [editMethod, setEditMethod] = useState<"cash" | "upi" | "mixed">("cash");
  const [editCash, setEditCash] = useState<string>("");
  const [editBusy, setEditBusy] = useState(false);

  const openEditPay = (o: any) => {
    const grand = withTax(Number(o.total || 0));
    const m = (o.payment_method as "cash" | "upi" | "mixed") || "cash";
    setEditPay(o);
    setEditMethod(m);
    setEditCash(
      m === "mixed"
        ? String(Number(o.cash_amount ?? 0))
        : m === "cash"
        ? String(grand)
        : "0"
    );
  };

  const saveEditPay = async () => {
    if (!editPay) return;
    const grand = withTax(Number(editPay.total || 0));
    let patch: any = { updated_at: new Date().toISOString() };
    if (editMethod === "cash") {
      patch = { ...patch, payment_method: "cash", cash_amount: grand, upi_amount: 0 };
    } else if (editMethod === "upi") {
      patch = { ...patch, payment_method: "upi", cash_amount: 0, upi_amount: grand };
    } else {
      const cash = Math.max(0, Math.min(grand, Number(editCash || 0)));
      const upi = +(grand - cash).toFixed(2);
      if (!(cash > 0 && upi > 0)) {
        toast.error("Mixed needs both cash and UPI > 0");
        return;
      }
      patch = { ...patch, payment_method: "mixed", cash_amount: cash, upi_amount: upi };
    }
    setEditBusy(true);
    const { error } = await supabase.from("orders").update(patch).eq("id", editPay.id);
    setEditBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Payment updated");
    setEditPay(null);
    load();
  };

  const load = async () => {
    setLoading(true);
    try {
      const { data: recent, error: rErr } = await supabase
        .from("orders").select("*")
        .order("created_at", { ascending: false }).limit(500);
      if (rErr) throw rErr;
      setOrders(recent || []);

      const start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const { data: month, error: mErr } = await supabase
        .from("orders")
        .select("id,total,is_paid,status,created_at")
        .gte("created_at", start.toISOString())
        .neq("status", "cancelled");
      if (mErr) throw mErr;
      setMonthOrders(month || []);

      const { data: rpts } = await supabase
        .from("monthly_reports").select("*").order("period_start", { ascending: false });
      setReports(rpts || []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("admin-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const earnings = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(startOfDay);
    const day = (startOfDay.getDay() + 6) % 7;
    startOfWeek.setDate(startOfDay.getDate() - day);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const sum = (list: any[]) => list.reduce((s, o) => s + withTax(Number(o.total || 0)), 0);
    const inRange = (from: Date) => monthOrders.filter((o) => o.is_paid && new Date(o.created_at) >= from);
    return {
      today: { count: inRange(startOfDay).length, revenue: sum(inRange(startOfDay)) },
      week:  { count: inRange(startOfWeek).length, revenue: sum(inRange(startOfWeek)) },
      month: { count: inRange(startOfMonth).length, revenue: sum(inRange(startOfMonth)) },
      activeNow: orders.filter((o) => ["pending", "preparing"].includes(o.status)).length,
    };
  }, [monthOrders, orders]);

  const exportLastMonth = async () => {
    setExporting(true);
    try {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 1);
      const label = start.toLocaleString("en-IN", { month: "long", year: "numeric" });

      const { data: ordersRange, error: oErr } = await supabase
        .from("orders").select("*")
        .gte("created_at", start.toISOString())
        .lt("created_at", end.toISOString())
        .neq("status", "cancelled")
        .order("created_at", { ascending: true });
      if (oErr) throw oErr;

      const ids = (ordersRange || []).map((o) => o.id);
      let items: any[] = [];
      if (ids.length) {
        const { data: it, error: iErr } = await supabase
          .from("order_items").select("*").in("order_id", ids);
        if (iErr) throw iErr;
        items = it || [];
      }

      const validOrders = ordersRange || [];
      const totalRevenue = validOrders.reduce((s, o) => s + withTax(Number(o.total || 0)), 0);
      const totalOrders = validOrders.length;
      const paidCount = validOrders.filter((o) => o.is_paid).length;
      const totalItems = items.reduce((s, i) => s + Number(i.quantity || 0), 0);
      const aov = totalOrders ? totalRevenue / totalOrders : 0;

      const itemMap = new Map<string, { name: string; qty: number; revenue: number; orders: Set<string> }>();
      items.forEach((i) => {
        const key = `${i.name}${i.variant_label ? ` (${i.variant_label})` : ""}`;
        const cur = itemMap.get(key) || { name: key, qty: 0, revenue: 0, orders: new Set() };
        cur.qty += Number(i.quantity || 0);
        cur.revenue += Number(i.unit_price || 0) * Number(i.quantity || 0);
        cur.orders.add(i.order_id);
        itemMap.set(key, cur);
      });
      const itemBreakdown = Array.from(itemMap.values())
        .map((v) => ({ item: v.name, quantity: v.qty, revenue: v.revenue, orders: v.orders.size }))
        .sort((a, b) => b.revenue - a.revenue);

      const overall = {
        revenue: totalRevenue,
        orders: totalOrders,
        paid_orders: paidCount,
        unpaid_orders: totalOrders - paidCount,
        items_sold: totalItems,
        avg_order_value: aov,
      };

      const periodStart = start.toISOString().slice(0, 10);
      const periodEnd = new Date(end.getTime() - 1).toISOString().slice(0, 10);
      const { data: auth } = await supabase.auth.getUser();
      await supabase.from("monthly_reports").upsert({
        period_start: periodStart, period_end: periodEnd, label,
        total_revenue: totalRevenue, total_orders: totalOrders, total_items: totalItems,
        avg_order_value: aov, overall, item_breakdown: itemBreakdown,
        created_by: auth?.user?.id ?? null,
      }, { onConflict: "period_start,period_end" });

      const wb = XLSX.utils.book_new();
      const summary = [
        ["Period", label],
        ["From", periodStart],
        ["To", periodEnd],
        [],
        ["Total revenue", totalRevenue],
        ["Total orders", totalOrders],
        ["Paid orders", paidCount],
        ["Unpaid orders", totalOrders - paidCount],
        ["Items sold", totalItems],
        ["Avg order value", Number(aov.toFixed(2))],
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Summary");

      const ordersSheet = (ordersRange || []).map((o) => ({
        OrderId: o.id, Table: o.table_number, Customer: o.customer_name || "",
        Status: o.status, Paid: o.is_paid ? "Yes" : "No",
        Payment: o.payment_method || "", Total: withTax(Number(o.total || 0)),
        CreatedAt: new Date(o.created_at).toLocaleString(),
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ordersSheet), "Orders");

      const itemsSheet = items.map((i) => ({
        OrderId: i.order_id, Item: i.name, Variant: i.variant_label || "",
        UnitPrice: Number(i.unit_price), Qty: i.quantity,
        Subtotal: Number(i.unit_price) * Number(i.quantity),
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itemsSheet), "Items");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itemBreakdown), "Item Analysis");

      XLSX.writeFile(wb, `report-${periodStart}_to_${periodEnd}.xlsx`);
      toast.success(`Exported & saved: ${label}`);
      load();
    } catch (e: any) {
      toast.error(e.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const exportAllTime = async () => {
    setExporting(true);
    try {
      const { data: ordersRange, error: oErr } = await supabase
        .from("orders").select("*")
        .neq("status", "cancelled")
        .order("created_at", { ascending: true });
      if (oErr) throw oErr;

      const ids = (ordersRange || []).map((o) => o.id);
      let items: any[] = [];
      if (ids.length) {
        const chunks: string[][] = [];
        for (let i = 0; i < ids.length; i += 200) chunks.push(ids.slice(i, i + 200));
        for (const c of chunks) {
          const { data: it, error: iErr } = await supabase
            .from("order_items").select("*").in("order_id", c);
          if (iErr) throw iErr;
          items = items.concat(it || []);
        }
      }

      const validOrders = ordersRange || [];
      const totalRevenue = validOrders.reduce((s, o) => s + withTax(Number(o.total || 0)), 0);
      const totalOrders = validOrders.length;
      const paidCount = validOrders.filter((o) => o.is_paid).length;
      const totalItems = items.reduce((s, i) => s + Number(i.quantity || 0), 0);
      const aov = totalOrders ? totalRevenue / totalOrders : 0;

      const itemMap = new Map<string, { name: string; qty: number; revenue: number; orders: Set<string> }>();
      items.forEach((i) => {
        const key = `${i.name}${i.variant_label ? ` (${i.variant_label})` : ""}`;
        const cur = itemMap.get(key) || { name: key, qty: 0, revenue: 0, orders: new Set() };
        cur.qty += Number(i.quantity || 0);
        cur.revenue += Number(i.unit_price || 0) * Number(i.quantity || 0);
        cur.orders.add(i.order_id);
        itemMap.set(key, cur);
      });
      const itemBreakdown = Array.from(itemMap.values())
        .map((v) => ({ item: v.name, quantity: v.qty, revenue: v.revenue, orders: v.orders.size }))
        .sort((a, b) => b.revenue - a.revenue);

      const today = new Date().toISOString().slice(0, 10);
      const wb = XLSX.utils.book_new();
      const summary = [
        ["Report", "All-time"],
        ["Generated", today],
        [],
        ["Total revenue", totalRevenue],
        ["Total orders", totalOrders],
        ["Paid orders", paidCount],
        ["Unpaid orders", totalOrders - paidCount],
        ["Items sold", totalItems],
        ["Avg order value", Number(aov.toFixed(2))],
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Summary");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(validOrders.map((o) => ({
        OrderId: o.id, Table: o.table_number, Customer: o.customer_name || "",
        Status: o.status, Paid: o.is_paid ? "Yes" : "No",
        Payment: o.payment_method || "", Total: withTax(Number(o.total || 0)),
        CreatedAt: new Date(o.created_at).toLocaleString(),
      }))), "Orders");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(items.map((i) => ({
        OrderId: i.order_id, Item: i.name, Variant: i.variant_label || "",
        UnitPrice: Number(i.unit_price), Qty: i.quantity,
        Subtotal: Number(i.unit_price) * Number(i.quantity),
      }))), "Items");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itemBreakdown), "Item Analysis");
      XLSX.writeFile(wb, `report-all-time-${today}.xlsx`);
      toast.success(`Exported all-time report (${totalOrders} orders)`);
    } catch (e: any) {
      toast.error(e.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  // Custom date-range export. Default: last 7 days.
  const [rangeOpen, setRangeOpen] = useState(false);
  const todayKey = new Date().toISOString().slice(0, 10);
  const weekAgoKey = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const [rangeFrom, setRangeFrom] = useState(weekAgoKey);
  const [rangeTo, setRangeTo] = useState(todayKey);

  const exportRange = async () => {
    if (!rangeFrom || !rangeTo) { toast.error("Pick both dates"); return; }
    if (rangeFrom > rangeTo) { toast.error("'From' date must be before 'To'"); return; }
    setExporting(true);
    try {
      const startISO = new Date(`${rangeFrom}T00:00:00`).toISOString();
      const endDate = new Date(`${rangeTo}T00:00:00`);
      endDate.setDate(endDate.getDate() + 1);
      const endISO = endDate.toISOString();

      const { data: ordersRange, error: oErr } = await supabase
        .from("orders").select("*")
        .neq("status", "cancelled")
        .gte("created_at", startISO)
        .lt("created_at", endISO)
        .order("created_at", { ascending: true });
      if (oErr) throw oErr;

      const ids = (ordersRange || []).map((o) => o.id);
      let items: any[] = [];
      if (ids.length) {
        const chunks: string[][] = [];
        for (let i = 0; i < ids.length; i += 200) chunks.push(ids.slice(i, i + 200));
        for (const c of chunks) {
          const { data: it, error: iErr } = await supabase
            .from("order_items").select("*").in("order_id", c);
          if (iErr) throw iErr;
          items = items.concat(it || []);
        }
      }

      const validOrders = ordersRange || [];
      const totalRevenue = validOrders.reduce((s, o) => s + withTax(Number(o.total || 0)), 0);
      const totalOrders = validOrders.length;
      const paidCount = validOrders.filter((o) => o.is_paid).length;
      const totalItems = items.reduce((s, i) => s + Number(i.quantity || 0), 0);
      const aov = totalOrders ? totalRevenue / totalOrders : 0;

      const cashOf = (o: any) => {
        if (!o.is_paid) return 0;
        if (o.cash_amount != null) return Number(o.cash_amount);
        return o.payment_method === "cash" ? withTax(Number(o.total || 0)) : 0;
      };
      const upiOf = (o: any) => {
        if (!o.is_paid) return 0;
        if (o.upi_amount != null) return Number(o.upi_amount);
        return o.payment_method === "upi" ? withTax(Number(o.total || 0)) : 0;
      };
      const totalCash = validOrders.reduce((s, o) => s + cashOf(o), 0);
      const totalUpi  = validOrders.reduce((s, o) => s + upiOf(o), 0);

      const itemMap = new Map<string, { name: string; qty: number; revenue: number; orders: Set<string> }>();
      items.forEach((i) => {
        if (i.is_cancelled) return;
        const key = `${i.name}${i.variant_label ? ` (${i.variant_label})` : ""}`;
        const cur = itemMap.get(key) || { name: key, qty: 0, revenue: 0, orders: new Set() };
        cur.qty += Number(i.quantity || 0);
        cur.revenue += Number(i.unit_price || 0) * Number(i.quantity || 0);
        cur.orders.add(i.order_id);
        itemMap.set(key, cur);
      });
      const itemBreakdown = Array.from(itemMap.values())
        .map((v) => ({ item: v.name, quantity: v.qty, revenue: v.revenue, orders: v.orders.size }))
        .sort((a, b) => b.revenue - a.revenue);

      const wb = XLSX.utils.book_new();
      const summary = [
        ["Report", "Custom range"],
        ["From", rangeFrom],
        ["To", rangeTo],
        ["Generated", new Date().toLocaleString()],
        [],
        ["Total revenue", totalRevenue],
        ["Cash collected", totalCash],
        ["UPI collected", totalUpi],
        ["Total orders", totalOrders],
        ["Paid orders", paidCount],
        ["Unpaid orders", totalOrders - paidCount],
        ["Items sold", totalItems],
        ["Avg order value", Number(aov.toFixed(2))],
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Summary");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(validOrders.map((o) => ({
        OrderId: o.id, Table: o.table_number, Customer: o.customer_name || "",
        Phone: o.customer_phone || "",
        Status: o.status, Paid: o.is_paid ? "Yes" : "No",
        Payment: o.payment_method || "",
        Cash: o.cash_amount ?? "",
        UPI: o.upi_amount ?? "",
        Total: withTax(Number(o.total || 0)),
        CreatedAt: new Date(o.created_at).toLocaleString(),
      }))), "Orders");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(items.map((i) => ({
        OrderId: i.order_id, Item: i.name, Variant: i.variant_label || "",
        UnitPrice: Number(i.unit_price), Qty: i.quantity,
        Cancelled: i.is_cancelled ? "Yes" : "No",
        Subtotal: Number(i.unit_price) * Number(i.quantity),
      }))), "Items");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itemBreakdown), "Item Analysis");
      XLSX.writeFile(wb, `report-${rangeFrom}_to_${rangeTo}.xlsx`);
      toast.success(`Exported ${totalOrders} orders (${rangeFrom} → ${rangeTo})`);
      setRangeOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const deleteReport = async (id: string) => {
    if (!confirm("Delete this saved report?")) return;
    const { error } = await supabase.from("monthly_reports").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); load(); }
  };

  const [wiping, setWiping] = useState(false);
  const wipeAllOrderData = async () => {
    if (!confirm("This will permanently DELETE all orders, order items, feedback, waiter calls and table sessions.\n\nMenu items, categories, tables, users and app settings will be kept.\n\nContinue?")) return;
    const typed = prompt('Type DELETE to confirm');
    if (typed !== "DELETE") { toast.error("Cancelled"); return; }
    setWiping(true);
    try {
      const run = async (name: string, p: Promise<{ error: any }>) => {
        const { error } = await p;
        if (error) throw new Error(`${name}: ${error.message}`);
      };
      await run("order_items", supabase.from("order_items").delete().not("id", "is", null) as any);
      await run("feedback", supabase.from("feedback").delete().not("id", "is", null) as any);
      await run("waiter_calls", supabase.from("waiter_calls").delete().not("id", "is", null) as any);
      await run("orders", supabase.from("orders").delete().not("id", "is", null) as any);
      await run("table_sessions", supabase.from("table_sessions").delete().not("id", "is", null) as any);
      toast.success("All order history wiped");
      load();
    } catch (e: any) {
      toast.error(e.message || "Wipe failed");
    } finally {
      setWiping(false);
    }
  };

  return (
    <div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <EarningCard label="Today" revenue={earnings.today.revenue} count={earnings.today.count} accent />
        <EarningCard label="This week" revenue={earnings.week.revenue} count={earnings.week.count} />
        <EarningCard label="This month" revenue={earnings.month.revenue} count={earnings.month.count} />
        <Stat label="Active now" value={earnings.activeNow} />
      </div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          Earnings include all non-cancelled orders
        </p>
        <Button variant="outline" size="sm" disabled={loading} onClick={load} title="Refresh analytics">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      <div className="mb-4 rounded-2xl bg-card p-4 shadow-soft">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary text-primary-foreground">
              <BarChart3 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold">Orders analysis</h3>
              <p className="text-[11px] text-muted-foreground">Export Analysis to Excel and keep a saved snapshot.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={exporting} onClick={() => setRangeOpen(true)}>
              <Download className="h-4 w-4" />
              Export range
            </Button>
            <Button variant="outline" size="sm" disabled={exporting} onClick={exportAllTime}>
              <Download className="h-4 w-4" />
              {exporting ? "Exporting…" : "Export all-time"}
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={rangeOpen} onOpenChange={(v) => !exporting && setRangeOpen(v)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Export by date range</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">From</span>
                <Input
                  type="date"
                  value={rangeFrom}
                  max={rangeTo || todayKey}
                  onChange={(e) => setRangeFrom(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">To</span>
                <Input
                  type="date"
                  value={rangeTo}
                  min={rangeFrom}
                  max={todayKey}
                  onChange={(e) => setRangeTo(e.target.value)}
                />
              </label>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Excel includes summary (with From/To), all orders, line items and item analysis for the selected window.
            </p>
            <Button variant="hero" className="w-full" disabled={exporting} onClick={exportRange}>
              <Download className="h-4 w-4" />
              {exporting ? "Exporting…" : "Download Excel"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="overflow-hidden rounded-2xl bg-card shadow-soft">
        <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-secondary/40 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {showAllOrders
              ? `All orders (${orders.length})`
              : `Recent orders (showing ${Math.min(10, orders.length)} of ${orders.length})`}
          </p>
          {orders.length > 10 && (
            <Button size="sm" variant="ghost" onClick={() => setShowAllOrders((v) => !v)}>
              {showAllOrders ? "Show recent 10" : "View all"}
            </Button>
          )}
        </div>

      {(() => {
        const displayedOrders = showAllOrders ? orders : orders.slice(0, 10);

        // Group by local date string e.g. "19/6/2026"
        const groups: { dateKey: string; label: string; items: typeof orders }[] = [];
        const seen = new Map<string, number>();
        displayedOrders.forEach((o) => {
          const d = new Date(o.created_at);
          const dateKey = toLocalDateKey(d);
          const today = toLocalDateKey(new Date());
          const yesterday = toLocalDateKey(new Date(Date.now() - 86400000));
          const label =
            dateKey === today
              ? `Today — ${d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`
              : dateKey === yesterday
              ? `Yesterday — ${d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`
              : d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
          if (seen.has(dateKey)) {
            groups[seen.get(dateKey)!].items.push(o);
          } else {
            seen.set(dateKey, groups.length);
            groups.push({ dateKey, label, items: [o] });
          }
        });

        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 rounded-2xl bg-card px-4 py-2 shadow-soft">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {showAllOrders
                  ? `All orders (${orders.length})`
                  : `Recent orders (showing ${Math.min(10, orders.length)} of ${orders.length})`}
              </p>
              {orders.length > 10 && (
                <Button size="sm" variant="ghost" onClick={() => setShowAllOrders((v) => !v)}>
                  {showAllOrders ? "Show recent 10" : "View all"}
                </Button>
              )}
            </div>

            {groups.map((g) => (
              <div key={g.dateKey} className="overflow-hidden rounded-2xl bg-card shadow-soft">
                {/* Date separator heading */}
                <div className="flex items-center gap-3 border-b border-border/60 bg-secondary/60 px-4 py-2.5">
                  <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                  <p className="text-xs font-bold uppercase tracking-wider text-foreground">
                    {g.label}
                  </p>
                  <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                    {g.items.length} {g.items.length === 1 ? "order" : "orders"}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="bg-secondary/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="p-3">Customer</th>
                        <th className="p-3">Phone</th>
                        <th className="p-3">Table</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Total</th>
                        <th className="p-3">Paid</th>
                        <th className="p-3">Pay</th>
                        <th className="p-3">Time</th>
                        <th className="p-3">Bill</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.items.map((o) => (
                        <tr key={o.id} className="border-t border-border/60">
                          <td className="p-3 font-mono text-xs">{o.customer_name}</td>
                          <td className="p-3 text-xs">{o.customer_phone || "—"}</td>
                          <td className="p-3 font-semibold">T{o.table_number}</td>
                          <td className="p-3"><StatusPill s={o.status} /></td>
                          <td className="p-3 font-semibold">{formatINR(withTax(Number(o.total)))}</td>
                          <td className="p-3">{o.is_paid ? "✓" : "—"}</td>
                          <td className="p-3 text-lg" title={o.payment_method || ""}>
                            {o.is_paid ? (
                              <button
                                type="button"
                                onClick={() => openEditPay(o)}
                                className="rounded-md px-1.5 py-0.5 hover:bg-secondary"
                                title={`Edit payment (${o.payment_method || "?"})`}
                              >
                                {o.payment_method === "cash" ? "💵"
                                  : o.payment_method === "upi" ? "📱"
                                  : o.payment_method === "mixed" ? "💵📱"
                                  : "—"}
                              </button>
                            ) : "—"}
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {new Date(o.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                          </td>
                          <td className="p-3">
                            <Button size="sm" variant="ghost" onClick={() => setBillId(o.id)} title="View bill">
                              <Eye className="h-3.5 w-3.5" /> View
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      <BillDialog
        orderId={billId}
        open={!!billId}
        onOpenChange={(v) => !v && setBillId(null)}
        allowEdit={false}
        allowDelete={false}
      />

      <Dialog open={!!editPay} onOpenChange={(v) => !v && setEditPay(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit payment mode</DialogTitle>
          </DialogHeader>
          {editPay && (() => {
            const grand = withTax(Number(editPay.total || 0));
            const cashNum = Math.max(0, Math.min(grand, Number(editCash || 0)));
            const upiNum = +(grand - cashNum).toFixed(2);
            return (
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-lg bg-secondary/40 p-2 text-xs">
                  <span>Table T{editPay.table_number} · {editPay.customer_name || "Guest"}</span>
                  <b>{formatINR(grand)}</b>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(["cash", "upi", "mixed"] as const).map((m) => (
                    <Button
                      key={m}
                      type="button"
                      size="sm"
                      variant={editMethod === m ? "hero" : "outline"}
                      onClick={() => {
                        setEditMethod(m);
                        if (m === "cash") setEditCash(String(grand));
                        else if (m === "upi") setEditCash("0");
                        else setEditCash("");
                      }}
                    >
                      {m === "cash" ? "💵 Cash" : m === "upi" ? "📱 UPI" : "💵📱 Mixed"}
                    </Button>
                  ))}
                </div>
                {editMethod === "mixed" && (
                  <div className="space-y-2 rounded-lg border border-border/60 p-2">
                    <label className="text-xs text-muted-foreground">Cash amount (₹)</label>
                    <Input
                      type="number"
                      min={0}
                      max={grand}
                      value={editCash}
                      onChange={(e) => setEditCash(e.target.value)}
                      placeholder="0"
                    />
                    <div className="flex items-center justify-between text-xs">
                      <span>UPI (auto)</span>
                      <b>{formatINR(upiNum)}</b>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setEditPay(null)} disabled={editBusy}>Cancel</Button>
            <Button variant="hero" size="sm" onClick={saveEditPay} disabled={editBusy}>
              {editBusy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!openReport} onOpenChange={(v) => !v && setOpenReport(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{openReport?.label} — analysis</DialogTitle></DialogHeader>
          {openReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Revenue" value={formatINR(Number(openReport.total_revenue))} />
                <Stat label="Orders" value={openReport.total_orders} />
                <Stat label="Items" value={openReport.total_items} />
                <Stat label="AOV" value={formatINR(Number(openReport.avg_order_value))} />
              </div>
              <div>
                <h4 className="mb-2 font-display text-sm font-bold">Top items</h4>
                <div className="max-h-72 overflow-auto rounded-xl bg-secondary/30">
                  <table className="w-full text-xs">
                    <thead className="bg-secondary text-left uppercase tracking-wider text-muted-foreground">
                      <tr><th className="p-2">Item</th><th className="p-2">Qty</th><th className="p-2">Orders</th><th className="p-2">Revenue</th></tr>
                    </thead>
                    <tbody>
                      {(openReport.item_breakdown || []).map((it: any, i: number) => (
                        <tr key={i} className="border-t border-border/60">
                          <td className="p-2 font-semibold">{it.item}</td>
                          <td className="p-2">{it.quantity}</td>
                          <td className="p-2">{it.orders}</td>
                          <td className="p-2">{formatINR(Number(it.revenue))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const EarningCard = ({ label, revenue, count, accent }: { label: string; revenue: number; count: number; accent?: boolean }) => (
  <div className={`rounded-2xl p-4 shadow-soft ${accent ? "bg-gradient-primary text-primary-foreground" : "bg-card"}`}>
    <p className={`text-[11px] uppercase tracking-wider ${accent ? "opacity-80" : "text-muted-foreground"}`}>{label}</p>
    <p className="mt-1 font-display text-2xl font-bold">{formatINR(revenue)}</p>
    <p className={`mt-0.5 text-xs ${accent ? "opacity-80" : "text-muted-foreground"}`}>
      {count} {count === 1 ? "order" : "orders"}
    </p>
  </div>
);

const Stat = ({ label, value }: any) => (
  <div className="rounded-2xl bg-card p-4 shadow-soft">
    <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="mt-1 font-display text-2xl font-bold">{value}</p>
  </div>
);

const StatusPill = ({ s }: { s: string }) => {
  const map: Record<string, string> = {
    pending: "bg-secondary text-foreground",
    preparing: "bg-gold/20 text-gold-foreground",
    ready: "bg-primary/15 text-primary",
    served: "bg-secondary text-muted-foreground",
    cancelled: "bg-destructive/15 text-destructive",
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${map[s] || "bg-secondary"}`}>{s}</span>;
};

/* -------- COUNTER BILLS now lives in components/admin/CounterBills.tsx -------- */

/* -------- SETTINGS -------- */
const SettingsPanel = () => {
  const [requireOtp, setRequireOtp] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("app_settings").select("require_order_otp").eq("id", true).maybeSingle()
      .then(({ data }) => setRequireOtp(!!data?.require_order_otp));
  }, []);

  const toggle = async (next: boolean) => {
    setSaving(true);
    const prev = requireOtp;
    setRequireOtp(next);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ id: true, require_order_otp: next, updated_at: new Date().toISOString() }, { onConflict: "id" });
    setSaving(false);
    if (error) {
      setRequireOtp(prev);
      toast.error(error.message);
    } else {
      toast.success(next ? "OTP verification enabled" : "OTP verification disabled");
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-card p-5 shadow-soft">
        <div className="flex items-start gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-soft">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-bold">Require Order OTP</h3>
                <p className="text-xs text-muted-foreground">
                  Customers see a 4-digit code after placing an order.
                  Staff must enter the code on the Kitchen screen to release the order.
                </p>
              </div>
              <Switch
                checked={!!requireOtp}
                onCheckedChange={toggle}
                disabled={requireOtp === null || saving}
              />
            </div>
            <div className="mt-3 rounded-xl bg-secondary/50 p-3 text-xs">
              <p className="font-semibold">
                Current state:{" "}
                <span className={requireOtp ? "text-primary" : "text-muted-foreground"}>
                  {requireOtp === null ? "Loading…" : requireOtp ? "ON — staff verifies every order" : "OFF — orders go straight to the kitchen"}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <VisibilityTogglesPanel />
      <AdminCategoriesPanel />
    </div>
  );
};

const VisibilityTogglesPanel = () => {
  const [showSpecials, setShowSpecials] = useState<boolean | null>(null);
  const [showCombos, setShowCombos] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.from("app_settings").select("show_specials,show_combos").eq("id", true).maybeSingle()
      .then(({ data }: any) => { setShowSpecials(data?.show_specials !== false); setShowCombos(data?.show_combos !== false); });
  }, []);

  const save = async (patch: any) => {
    const { error } = await supabase.from("app_settings")
      .upsert({ id: true, ...patch, updated_at: new Date().toISOString() }, { onConflict: "id" });
    if (error) toast.error(error.message); else toast.success("Saved");
  };

  return (
    <div className="rounded-2xl bg-card p-5 shadow-soft space-y-3">
      <h3 className="font-display text-lg font-bold">Customer-side visibility</h3>
      <label className="flex items-center justify-between rounded-xl bg-secondary/40 p-3">
        <div>
          <p className="font-semibold text-sm">Show "Specials" category</p>
          <p className="text-xs text-muted-foreground">Items/combos marked as Special appear in this section.</p>
        </div>
        <Switch checked={!!showSpecials} disabled={showSpecials === null}
          onCheckedChange={(v) => { setShowSpecials(v); save({ show_specials: v }); }} />
      </label>
      <label className="flex items-center justify-between rounded-xl bg-secondary/40 p-3">
        <div>
          <p className="font-semibold text-sm">Show "Combos" category</p>
          <p className="text-xs text-muted-foreground">Hide all combos from customers without deleting them.</p>
        </div>
        <Switch checked={!!showCombos} disabled={showCombos === null}
          onCheckedChange={(v) => { setShowCombos(v); save({ show_combos: v }); }} />
      </label>
    </div>
  );
};

const AdminCategoriesPanel = () => {
  const [list, setList] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("categories").select("*").order("sort_order").order("name");
    setList(data || []);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("categories").insert({ name: name.trim(), sort_order: list.length });
    setBusy(false);
    if (error) toast.error(error.message);
    else { setName(""); toast.success("Category added"); load(); }
  };

  const rename = async (id: string, current: string) => {
    const next = prompt("Rename category", current);
    if (!next || next.trim() === current) return;
    const { error } = await supabase.from("categories").update({ name: next.trim() }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Renamed"); load(); }
  };

  const remove = async (id: string, n: string) => {
    if (!confirm(`Delete category "${n}"? Items will become uncategorised.`)) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); load(); }
  };

  return (
    <div className="rounded-2xl bg-card p-5 shadow-soft">
      <div className="mb-4 flex items-start gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-soft">
          <Tags className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-display text-lg font-bold">Menu Categories</h3>
          <p className="text-xs text-muted-foreground">Used in the "Add dish" dropdown and on the customer menu.</p>
        </div>
      </div>

      <div className="mb-3 flex gap-2">
        <input
          value={name} onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Starters, Beverages…"
          className="h-10 flex-1 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <Button variant="hero" onClick={add} disabled={busy || !name.trim()}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      {list.length === 0 ? (
        <p className="rounded-xl bg-secondary/40 p-3 text-sm text-muted-foreground">No categories yet.</p>
      ) : (
        <ul className="divide-y divide-border/60 rounded-xl bg-secondary/30">
          {list.map((c) => (
            <li key={c.id} className="flex items-center justify-between p-3">
              <div className="flex items-center gap-2">
                <span className={`font-semibold ${c.is_hidden ? "text-muted-foreground line-through" : ""}`}>{c.name}</span>
                {c.is_hidden && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">Hidden</span>}
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={async () => {
                  const { error } = await supabase.from("categories").update({ is_hidden: !c.is_hidden } as any).eq("id", c.id);
                  if (error) toast.error(error.message); else { toast.success(c.is_hidden ? "Visible" : "Hidden"); load(); }
                }} title={c.is_hidden ? "Show" : "Hide"}>
                  {c.is_hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => rename(c.id, c.name)}>Rename</Button>
                <Button size="icon" variant="ghost" onClick={() => remove(c.id, c.name)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/* -------- ITEM ANALYTICS (sold quantity per dish, per day) -------- */
const toLocalDateKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const ItemAnalytics = () => {
  const [date, setDate] = useState<string>(() => toLocalDateKey(new Date()));
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Array<{ key: string; name: string; image_url: string | null; qty: number; revenue: number }>>([]);
  const [totals, setTotals] = useState<{ orders: number; items: number; revenue: number; cash: number; upi: number }>(
    { orders: 0, items: 0, revenue: 0, cash: 0, upi: 0 }
  );

  const load = async () => {
    setLoading(true);
    try {
      const start = new Date(`${date}T00:00:00`);
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      const { data: ords, error: oe } = await supabase
        .from("orders").select("id,status,total,is_paid,payment_method,cash_amount,upi_amount")
        .gte("created_at", start.toISOString())
        .lt("created_at", end.toISOString());
      if (oe) throw oe;
      const validOrders = (ords || []).filter((o: any) => o.status !== "cancelled");
      const orderIds = validOrders.map((o: any) => o.id);
      // Revenue (incl. tax) for the day — mirrors the "Today" earning card.
      const dayRevenue = validOrders.reduce((s: number, o: any) => s + withTax(Number(o.total || 0)), 0);
      // Cash/UPI split: use stored split columns when present, else fall back to payment_method.
      const cashOf = (o: any) => {
        if (!o.is_paid) return 0;
        if (o.cash_amount != null) return Number(o.cash_amount);
        return o.payment_method === "cash" ? withTax(Number(o.total || 0)) : 0;
      };
      const upiOf = (o: any) => {
        if (!o.is_paid) return 0;
        if (o.upi_amount != null) return Number(o.upi_amount);
        return o.payment_method === "upi" ? withTax(Number(o.total || 0)) : 0;
      };
      const dayCash = validOrders.reduce((s: number, o: any) => s + cashOf(o), 0);
      const dayUpi  = validOrders.reduce((s: number, o: any) => s + upiOf(o), 0);
      if (orderIds.length === 0) {
        setRows([]);
        setTotals({ orders: 0, items: 0, revenue: 0, cash: 0, upi: 0 });
        return;
      }
      const { data: items, error: ie } = await supabase
        .from("order_items")
        .select("menu_item_id,name,quantity,unit_price,is_cancelled")
        .in("order_id", orderIds);
      if (ie) throw ie;
      const live = (items || []).filter((it: any) => !it.is_cancelled);
      const menuIds = Array.from(new Set(live.map((it: any) => it.menu_item_id).filter(Boolean)));
      const imgMap: Record<string, { image_url: string | null; name: string }> = {};
      if (menuIds.length) {
        const { data: menu } = await supabase
          .from("menu_items").select("id,name,image_url").in("id", menuIds as string[]);
        (menu || []).forEach((m: any) => { imgMap[m.id] = { image_url: m.image_url, name: m.name }; });
      }
      const agg = new Map<string, { key: string; name: string; image_url: string | null; qty: number; revenue: number }>();
      let totalItems = 0, totalRev = 0;
      for (const it of live) {
        const key = it.menu_item_id || `name:${(it.name || "").toLowerCase()}`;
        const meta = it.menu_item_id ? imgMap[it.menu_item_id] : null;
        const name = meta?.name || it.name || "Unknown";
        const image_url = meta?.image_url ?? null;
        const q = Number(it.quantity || 0);
        const rev = q * Number(it.unit_price || 0);
        totalItems += q; totalRev += rev;
        const cur = agg.get(key);
        if (cur) { cur.qty += q; cur.revenue += rev; }
        else agg.set(key, { key, name, image_url, qty: q, revenue: rev });
      }
      const list = Array.from(agg.values()).sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name));
      setRows(list);
      setTotals({ orders: orderIds.length, items: totalItems, revenue: dayRevenue, cash: dayCash, upi: dayUpi });
    } catch (e: any) {
      toast.error(e.message || "Failed to load analytics");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [date]);

  useEffect(() => {
    const ch = supabase.channel("analytics-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => {
        if (date === toLocalDateKey(new Date())) load();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        if (date === toLocalDateKey(new Date())) load();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [date]);

  const today = toLocalDateKey(new Date());
  const isToday = date === today;
  const maxQty = rows[0]?.qty || 1;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-card p-4 shadow-soft">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Date</span>
            <input
              type="date" value={date} max={today}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <Button variant="outline" size="sm" onClick={() => setDate(today)} disabled={isToday}>Today</Button>
          <Button variant="outline" size="sm" onClick={() => {
            const d = new Date(`${date}T00:00:00`); d.setDate(d.getDate() - 1);
            setDate(toLocalDateKey(d));
          }}>← Prev day</Button>
          <Button variant="outline" size="sm" disabled={isToday} onClick={() => {
            const d = new Date(`${date}T00:00:00`); d.setDate(d.getDate() + 1);
            const nk = toLocalDateKey(d);
            if (nk <= today) setDate(nk);
          }}>Next day →</Button>
          <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          {isToday && <span className="ml-auto rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">Live · today</span>}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
          <Stat label="Orders" value={String(totals.orders)} />
          <Stat label="Items sold" value={String(totals.items)} />
          <div className="rounded-2xl bg-gradient-primary p-3 text-primary-foreground shadow-soft">
            <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">Revenue</p>
            <p className="mt-1 font-display text-2xl font-bold leading-none">{formatINR(totals.revenue)}</p>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] opacity-90">
              <span>Cash <b>{formatINR(totals.cash)}</b></span>
              <span>UPI <b>{formatINR(totals.upi)}</b></span>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No items sold on {new Date(`${date}T00:00:00`).toLocaleDateString()}.
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r, idx) => (
            <li key={r.key} className="rounded-2xl bg-card p-3 shadow-soft">
              <div className="flex items-center gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold text-foreground">
                  {idx + 1}
                </span>
                <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-secondary">
                  {r.image_url ? (
                    <img src={r.image_url} alt={r.name} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{r.name}</p>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-gradient-primary"
                      style={{ width: `${Math.max(6, (r.qty / maxQty) * 100)}%` }}
                    />
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display text-lg font-bold leading-none">{r.qty}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">sold</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-foreground/80">{formatINR(r.revenue)}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AdminDashboard;
