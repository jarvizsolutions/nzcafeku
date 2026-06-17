import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Minus, Search, ArrowLeft, Sparkles, Package, Menu as MenuIcon, ClipboardList, UtensilsCrossed, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useCart } from "@/contexts/CartContext";
import { formatINR } from "@/lib/format";
import { BrandMark } from "@/components/BrandMark";
import { FloatingCartBar } from "@/components/FloatingCartBar";
import { VariantPicker, type Variant } from "@/components/VariantPicker";
import { CallWaiterButton } from "@/components/CallWaiterButton";
import { useTableSession } from "@/hooks/useTableSession";
import { useAppSettings } from "@/hooks/useAppSettings";
import { toast } from "sonner";
import { UserSquare2 } from "lucide-react";
import { AnnouncementsBell } from "@/components/menu/AnnouncementsBell";
import { ComboCard, ComboModal, type Combo } from "@/components/menu/ComboCard";

type Item = {
  id: string; name: string; description: string | null; price: number;
  image_url: string | null; is_available: boolean; is_veg: boolean;
  category_id: string | null; sort_order: number;
  variants: Variant[] | null; is_special?: boolean;
};

type Category = { id: string; name: string; sort_order: number; is_hidden?: boolean };

type DietFilter = "all" | "veg" | "nonveg";
const SPECIALS_KEY = "__specials__";
const COMBOS_KEY = "__combos__";

// Splits "Chicken Bucket( 5/10 pcs)" into ["Chicken Bucket", "( 5/10 pcs)"]
const splitItemName = (name: string): { main: string; sub: string | null } => {
  const idx = name.indexOf("(");
  if (idx === -1) return { main: name, sub: null };
  return { main: name.slice(0, idx).trim(), sub: name.slice(idx).trim() };
};

// ─── Category Overlay ────────────────────────────────────────────────────────

const TILE_ACCENTS = [
  { solid: "#7f1d1d", light: "rgba(239,68,68,0.15)",  border: "rgba(239,68,68,0.65)",  dot: "#f87171", abbr: "#fca5a5" },
  { solid: "#7c2d12", light: "rgba(249,115,22,0.15)", border: "rgba(249,115,22,0.65)", dot: "#fb923c", abbr: "#fdba74" },
  { solid: "#713f12", light: "rgba(234,179,8,0.15)",  border: "rgba(234,179,8,0.65)",  dot: "#fbbf24", abbr: "#fde047" },
  { solid: "#14532d", light: "rgba(34,197,94,0.15)",  border: "rgba(34,197,94,0.65)",  dot: "#4ade80", abbr: "#86efac" },
  { solid: "#164e63", light: "rgba(6,182,212,0.15)",  border: "rgba(6,182,212,0.65)",  dot: "#22d3ee", abbr: "#67e8f9" },
  { solid: "#1e1b4b", light: "rgba(99,102,241,0.15)", border: "rgba(99,102,241,0.65)", dot: "#818cf8", abbr: "#a5b4fc" },
  { solid: "#831843", light: "rgba(236,72,153,0.15)", border: "rgba(236,72,153,0.65)", dot: "#f472b6", abbr: "#f9a8d4" },
  { solid: "#3b0764", light: "rgba(168,85,247,0.15)", border: "rgba(168,85,247,0.65)", dot: "#c084fc", abbr: "#d8b4fe" },
];

type CategoryOverlayProps = {
  open: boolean; onClose: () => void; catFilter: string;
  setCatFilter: (v: string) => void; visibleCats: Category[];
  hasSpecials: boolean; hasCombos: boolean; items: Item[]; combos: Combo[];
};

const CategoryOverlay = ({ open, onClose, catFilter, setCatFilter, visibleCats, hasSpecials, hasCombos, items, combos }: CategoryOverlayProps) => {
  if (!open) return null;

  const specialEntries = [
    { key: "all",       label: "All Items", emoji: "🍽️", count: items.filter(i => i.is_available).length, accent: null },
    ...(hasSpecials ? [{ key: SPECIALS_KEY, label: "Specials", emoji: "✨", count: items.filter(i => i.is_special).length + combos.filter(c => c.is_special).length, accent: null }] : []),
    ...(hasCombos   ? [{ key: COMBOS_KEY,   label: "Combos",   emoji: "🎁", count: combos.length, accent: null }] : []),
  ];
  const catEntries = visibleCats.map((c, idx) => ({
    key: c.id, label: c.name, emoji: null as string | null,
    count: items.filter(i => i.category_id === c.id && i.is_available).length,
    accent: TILE_ACCENTS[idx % TILE_ACCENTS.length],
  }));
  const allEntries = [...specialEntries, ...catEntries];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{
        background: "rgba(0,0,0,0.52)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm rounded-3xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.94)",
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
          border: "1px solid rgba(0,0,0,0.07)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.22), 0 1px 0 rgba(255,255,255,0.9) inset",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div className="flex items-center gap-2.5">
            <div
              className="grid h-8 w-8 place-items-center rounded-xl"
              style={{
                background: "linear-gradient(135deg, rgba(251,191,36,0.25) 0%, rgba(245,158,11,0.15) 100%)",
                border: "1px solid rgba(251,191,36,0.45)",
              }}
            >
              <UtensilsCrossed className="h-3.5 w-3.5" style={{ color: "#d97706" }} />
            </div>
            <div>
              <p className="font-display text-sm font-bold leading-tight" style={{ color: "#111" }}>Browse Menu</p>
              <p style={{ fontSize: 10, color: "rgba(0,0,0,0.4)" }}>{allEntries.length} categories</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-7 w-7 place-items-center rounded-full transition-all active:scale-90"
            style={{ background: "rgba(0,0,0,0.06)", border: "1px solid rgba(0,0,0,0.1)" }}
          >
            <X className="h-3.5 w-3.5" style={{ color: "rgba(0,0,0,0.55)" }} />
          </button>
        </div>

        <div style={{ height: "0.5px", background: "rgba(0,0,0,0.08)", margin: "0 16px 12px" }} />

        {/* Grid */}
        <div className="grid grid-cols-3 gap-2 px-3 pb-5" style={{ maxHeight: "55vh", overflowY: "auto" }}>
          {allEntries.map((entry) => {
            const isActive = catFilter === entry.key;
            const isSpl = !entry.accent;
            const dot = isSpl ? "#d97706" : entry.accent!.dot;

            const idleBg = isSpl
              ? "rgba(0,0,0,0.04)"
              : `linear-gradient(135deg, ${entry.accent!.solid}dd 0%, ${entry.accent!.solid}aa 100%)`;
            const activeBg = isSpl
              ? "linear-gradient(135deg, rgba(251,191,36,0.22) 0%, rgba(245,158,11,0.14) 100%)"
              : `linear-gradient(135deg, ${entry.accent!.solid}ff 0%, ${entry.accent!.solid}ee 100%)`;
            const idleBorder = isSpl
              ? "1px solid rgba(0,0,0,0.09)"
              : `1px solid ${entry.accent!.border.replace("0.65", "0.35")}`;
            const activeBorder = isSpl
              ? "1px solid rgba(251,191,36,0.7)"
              : `1px solid ${entry.accent!.border}`;

            return (
              <button
                key={entry.key}
                onClick={() => { setCatFilter(entry.key); onClose(); }}
                className="flex flex-col items-start rounded-2xl text-left transition-all active:scale-95"
                style={{
                  padding: "10px 10px 9px",
                  background: isActive ? activeBg : idleBg,
                  border: isActive ? activeBorder : idleBorder,
                  boxShadow: isActive
                    ? `0 0 16px ${isSpl ? "rgba(251,191,36,0.3)" : dot + "55"}, 0 2px 8px rgba(0,0,0,0.3)`
                    : "0 1px 3px rgba(0,0,0,0.2)",
                  minHeight: 78,
                  position: "relative",
                }}
              >
                {/* Icon */}
                <div style={{ marginBottom: 7 }}>
                  {entry.emoji ? (
                    <span style={{ fontSize: 20, lineHeight: 1, filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4))" }}>
                      {entry.emoji}
                    </span>
                  ) : (
                    <div
                      className="grid place-items-center rounded-lg"
                      style={{
                        width: 28, height: 28,
                        background: "rgba(0,0,0,0.18)",
                        border: `1px solid rgba(255,255,255,0.25)`,
                      }}
                    >
                      <span style={{ fontSize: 9, fontWeight: 800, color: entry.accent!.abbr, letterSpacing: "0.04em" }}>
                        {entry.label.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>

                <span style={{
                  fontSize: 11.5, fontWeight: 700, lineHeight: 1.2, display: "block", marginBottom: 3,
                  color: isSpl ? (isActive ? "#92400e" : "rgba(0,0,0,0.8)") : "rgba(255,255,255,0.96)",
                  textShadow: isSpl ? "none" : "0 1px 3px rgba(0,0,0,0.5)",
                }}>
                  {entry.label}
                </span>
                <span style={{
                  fontSize: 11.5,
                  color: isSpl
                    ? (isActive ? "rgba(146,64,14,0.7)" : "rgba(0,0,0,0.4)")
                    : (isActive ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.55)"),
                  textShadow: isSpl ? "none" : "0 1px 2px rgba(0,0,0,0.4)",
                }}>
                  {entry.count} item{entry.count !== 1 ? "s" : ""}
                </span>

                {isActive && (
                  <div style={{
                    position: "absolute", top: 8, right: 8,
                    width: 7, height: 7, borderRadius: "50%",
                    background: dot,
                    boxShadow: `0 0 6px ${dot}, 0 0 2px ${dot}`,
                  }} />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── Menu ────────────────────────────────────────────────────────────────────

const Menu = () => {
  const [params] = useSearchParams();
  const tableNumber = Number(params.get("table") || "1");
  const [items, setItems] = useState<Item[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [catFilter, setCatFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [diet, setDiet] = useState<DietFilter>("all");
  const [query, setQuery] = useState("");
  const [openCombo, setOpenCombo] = useState<Combo | null>(null);
  const [catOverlayOpen, setCatOverlayOpen] = useState(false);
  const cart = useCart();
  const { sessionId } = useTableSession(tableNumber);
  const settings = useAppSettings();
  const waiterMode = settings?.ordering_mode === "waiter";
  const showSpecials = (settings as any)?.show_specials !== false;
  const showCombos = (settings as any)?.show_combos !== false;

  useEffect(() => {
    sessionStorage.setItem("fsc_table", String(tableNumber));
  }, [tableNumber]);

  useEffect(() => {
    const load = async () => {
      const [{ data: its }, { data: cs }, { data: cb }] = await Promise.all([
        supabase.from("menu_items").select("*").order("sort_order"),
        supabase.from("categories").select("*").order("sort_order").order("name"),
        supabase.from("combos").select("*, combo_items(menu_item_id,quantity,menu_items(name))")
          .eq("is_active", true).order("sort_order"),
      ]);
      const normalized: Item[] = (its || []).map((it: any) => {
        const rawVariants = Array.isArray(it.variants) ? (it.variants as Variant[]) : [];
        return { ...it, variants: rawVariants };
      });
      // Items with explicit priority (sort_order > 0) come first ascending;
      // unprioritized items (0 / null) fall to the bottom, ordered by name.
      normalized.sort((a, b) => {
        const ao = a.sort_order || 0;
        const bo = b.sort_order || 0;
        const aHas = ao > 0, bHas = bo > 0;
        if (aHas && bHas) return ao - bo;
        if (aHas) return -1;
        if (bHas) return 1;
        return (a.name || "").localeCompare(b.name || "");
      });
      setItems(normalized);
      setCats((cs as any) || []);
      setCombos((cb as Combo[]) || []);
      setLoading(false);
    };
    load();

    const ch = supabase
      .channel("menu-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "combos" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "combo_items" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const visibleCats = useMemo(() => cats.filter((c) => !c.is_hidden), [cats]);
  const visibleCatIds = useMemo(() => new Set(visibleCats.map((c) => c.id)), [visibleCats]);

  const specialItems = useMemo(() => items.filter((i) => i.is_special), [items]);
  const specialCombos = useMemo(() => combos.filter((c) => c.is_special), [combos]);
  const hasSpecials = showSpecials && (specialItems.length + specialCombos.length) > 0;
  const hasCombos = showCombos && combos.length > 0;

  const activeCatLabel = useMemo(() => {
    if (catFilter === "all") return null;
    if (catFilter === SPECIALS_KEY) return "✨ Specials";
    if (catFilter === COMBOS_KEY) return "🎁 Combos";
    return visibleCats.find((c) => c.id === catFilter)?.name ?? null;
  }, [catFilter, visibleCats]);

  const isGoldFilter = catFilter === SPECIALS_KEY || catFilter === COMBOS_KEY;

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (i.category_id && !visibleCatIds.has(i.category_id) && catFilter !== "all" && catFilter !== i.category_id) return false;
      if (i.category_id && !visibleCatIds.has(i.category_id) && catFilter === "all") return false;
      if (diet === "veg" && !i.is_veg) return false;
      if (diet === "nonveg" && i.is_veg) return false;
      if (catFilter === SPECIALS_KEY || catFilter === COMBOS_KEY) return false;
      if (catFilter !== "all" && i.category_id !== catFilter) return false;
      if (query && !i.name.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [items, diet, catFilter, query, visibleCatIds]);

  const filteredCombos = useMemo(() => {
    if (!query) return combos;
    return combos.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));
  }, [combos, query]);

  const [pickerItem, setPickerItem] = useState<Item | null>(null);

  const addToCart = (i: Item, variant?: Variant) => {
    if (!i.is_available) return;
    const price = variant ? Number(variant.price) : Number(i.price);
    cart.add({
      menu_item_id: i.id,
      name: i.name,
      price,
      variant_label: variant?.label || null,
      image_url: i.image_url,
    });
    toast.success(`${i.name}${variant ? ` (${variant.label})` : ""} added`, { duration: 1500 });
  };

  const handleAdd = (i: Item) => {
    if (!i.is_available) return;
    if (i.variants && i.variants.length > 0) setPickerItem(i);
    else addToCart(i);
  };

  if (waiterMode) {
    return (
      <main className="grid min-h-screen place-items-center bg-gradient-warm px-6 text-center">
        <div className="max-w-sm rounded-3xl bg-card p-8 shadow-elegant">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-gold text-gold-foreground shadow-gold">
            <UserSquare2 className="h-7 w-7" />
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold">Waiter service</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Self-ordering is currently disabled. Please call a waiter to take your order at Table {tableNumber}.
          </p>
          <div className="mt-5">
            <CallWaiterButton tableNumber={tableNumber} sessionId={sessionId} />
          </div>
          <Link to={`/my-orders?table=${tableNumber}`} className="mt-3 inline-block text-xs font-semibold text-primary hover:underline">
            Track my orders →
          </Link>
        </div>
      </main>
    );
  }

  const showSpecialsView = catFilter === SPECIALS_KEY && hasSpecials;
  const showCombosView = catFilter === COMBOS_KEY && hasCombos;
  const showAllSections = catFilter === "all";

  return (
    <main className="min-h-screen bg-gradient-warm pb-32">
      {/* Sticky header */}
      <header className="sticky top-0 z-30 glass border-b border-border/50">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 sm:px-6 lg:px-10 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label="Open menu"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary text-foreground tap-scale"
                >
                  <MenuIcon className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                <DropdownMenuItem asChild>
                  <Link to="/" className="flex items-center gap-2 cursor-pointer">
                    <ArrowLeft className="h-4 w-4" /> Back to home
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to={`/my-orders?table=${tableNumber}`} className="flex items-center gap-2 cursor-pointer">
                    <ClipboardList className="h-4 w-4" /> My Orders
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <BrandMark className="min-w-0" />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <AnnouncementsBell />
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-gold text-xs font-bold text-gold-foreground shadow-gold">
              T{tableNumber}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-10 pb-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search dishes…"
              className="h-11 w-full rounded-full border border-border bg-background/80 pl-11 pr-4 text-sm outline-none transition-smooth focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* Diet filter */}
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-10 pb-3">
          <div className="flex gap-2">
            <DietChip label="All" active={diet === "all"} onClick={() => setDiet("all")} />
            <DietChip label="🟢 Veg" active={diet === "veg"} onClick={() => setDiet("veg")} />
            <DietChip label="🔴 Non-Veg" active={diet === "nonveg"} onClick={() => setDiet("nonveg")} />
          </div>
        </div>

        {/* Category row — overlay trigger */}
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10 pb-3">
          <div className="flex items-center gap-2">
            <CatChip label="All" active={catFilter === "all"} onClick={() => setCatFilter("all")} />
            {activeCatLabel && (
              <CatChip label={activeCatLabel} active onClick={() => setCatOverlayOpen(true)} gold={isGoldFilter} />
            )}
            <div className="flex-1" />
            <button
              onClick={() => setCatOverlayOpen(true)}
              aria-label="Browse categories"
              className="flex items-center gap-1.5 rounded-full bg-secondary px-3.5 py-2 text-xs font-bold text-secondary-foreground tap-scale transition-smooth hover:bg-secondary/70 active:scale-95"
              style={{ border: "1.5px solid rgba(0,0,0,0.14)", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}
            >
              <UtensilsCrossed className="h-3.5 w-3.5" />
              <span>Categories</span>
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10 pt-4 space-y-8">
        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 sm:gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)}
          </div>
        ) : (
          <>
            {showAllSections && hasSpecials && (
              <SectionHeader icon={<Sparkles className="h-4 w-4" />} title="Today's Specials" gold />
            )}
            {(showAllSections || showSpecialsView) && hasSpecials && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 sm:gap-4">
                {specialCombos.map((c) => (
                  <ComboCard key={c.id} combo={c} onOpen={() => setOpenCombo(c)} />
                ))}
                {specialItems
                  .filter((i) => (diet === "veg" ? i.is_veg : diet === "nonveg" ? !i.is_veg : true))
                  .filter((i) => !query || i.name.toLowerCase().includes(query.toLowerCase()))
                  .map((i, idx) => (
                    <ItemCard key={i.id} i={i} idx={idx} cart={cart} onAdd={handleAdd} highlight />
                  ))}
              </div>
            )}

            {showAllSections && hasCombos && (
              <SectionHeader icon={<Package className="h-4 w-4" />} title="Combo Offers" gold />
            )}
            {(showAllSections || showCombosView) && hasCombos && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 sm:gap-4">
                {filteredCombos.map((c) => (
                  <ComboCard key={c.id} combo={c} onOpen={() => setOpenCombo(c)} />
                ))}
              </div>
            )}

            {!showSpecialsView && !showCombosView && (
              <>
                {showAllSections && (hasSpecials || hasCombos) && filtered.length > 0 && (
                  <SectionHeader title="Menu" />
                )}
                {filtered.length === 0 && !hasCombos && !hasSpecials ? (
                  <p className="py-20 text-center text-muted-foreground">No dishes found.</p>
                ) : filtered.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 sm:gap-4">
                    {filtered.map((i, idx) => (
                      <ItemCard key={i.id} i={i} idx={idx} cart={cart} onAdd={handleAdd} />
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </>
        )}

        <div className="mt-6">
          <CallWaiterButton tableNumber={tableNumber} sessionId={sessionId} />
        </div>
      </section>

      <FloatingCartBar tableNumber={tableNumber} />

      {pickerItem && (
        <VariantPicker
          open={!!pickerItem}
          onOpenChange={(v) => { if (!v) setPickerItem(null); }}
          itemName={pickerItem.name}
          variants={pickerItem.variants || []}
          onConfirm={(v) => { addToCart(pickerItem, v); setPickerItem(null); }}
        />
      )}

      <ComboModal combo={openCombo} open={!!openCombo} onOpenChange={(v) => !v && setOpenCombo(null)} />

      <CategoryOverlay
        open={catOverlayOpen}
        onClose={() => setCatOverlayOpen(false)}
        catFilter={catFilter}
        setCatFilter={setCatFilter}
        visibleCats={visibleCats}
        hasSpecials={hasSpecials}
        hasCombos={hasCombos}
        items={items}
        combos={combos}
      />
    </main>
  );
};

// ─── Supporting components ────────────────────────────────────────────────────

const SectionHeader = ({ title, icon, gold }: { title: string; icon?: React.ReactNode; gold?: boolean }) => (
  <div className="flex items-center gap-2">
    {icon && (
      <span className={`grid h-7 w-7 place-items-center rounded-full ${gold ? "bg-gradient-gold text-gold-foreground" : "bg-secondary text-foreground"}`}>
        {icon}
      </span>
    )}
    <h2 className={`font-display text-xl font-bold ${gold ? "text-gold-foreground" : ""}`}>{title}</h2>
  </div>
);

const ItemCard = ({ i, idx, cart, onAdd, highlight }: { i: Item; idx: number; cart: ReturnType<typeof useCart>; onAdd: (i: Item) => void; highlight?: boolean }) => {
  const hasVariants = (i.variants?.length || 0) > 0;
  const inCart = !hasVariants ? cart.items.find((c) => c.menu_item_id === i.id && !c.variant_label) : null;
  const variantQty = hasVariants
    ? cart.items.filter((c) => c.menu_item_id === i.id).reduce((s, c) => s + c.quantity, 0)
    : 0;
  const minPrice = hasVariants ? Math.min(...i.variants!.map((v) => Number(v.price))) : Number(i.price);
  const { main, sub } = splitItemName(i.name);

  return (
    <article
      style={{ animationDelay: `${idx * 30}ms` }}
      className={`animate-fade-in-up flex gap-3 rounded-2xl bg-card p-3 shadow-soft transition-smooth hover:shadow-float ${
        highlight ? "border-2 border-gold/40" : ""
      }`}
    >
      <div className="relative grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-secondary to-muted">
        {i.image_url ? (
          <img src={i.image_url} alt={i.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <span className="font-display text-3xl text-primary/40">★</span>
        )}
        {!i.is_available && (
          <div className="absolute inset-0 grid place-items-center bg-foreground/70 text-[10px] font-bold uppercase tracking-wider text-background">
            Sold Out
          </div>
        )}
        {i.is_special && (
          <span className="absolute left-1 top-1 rounded-full bg-gradient-gold px-1.5 py-0.5 text-[8px] font-bold uppercase text-gold-foreground shadow-gold">
            ★
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col min-w-0">
        <div className="flex items-start gap-1.5">
          <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-sm border ${i.is_veg ? "border-green-600" : "border-red-700"}`}>
            <span className={`h-2 w-2 rounded-full ${i.is_veg ? "bg-green-600" : "bg-red-700"}`} />
          </span>
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-1 flex-wrap">
              <h3 className="font-semibold text-[15px] leading-tight text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{main}</h3>
              {hasVariants && (
                <span className="rounded-full bg-gold/15 px-1.5 py-0.5 text-[9px] font-bold text-gold-foreground leading-tight">
                  {i.variants!.length} opts
                </span>
              )}
            </div>
            {sub && (
              <span className="text-[11px] text-muted-foreground leading-tight mt-0.5">{sub}</span>
            )}
          </div>
        </div>
        {i.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{i.description}</p>}
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="font-display text-lg font-bold text-foreground">
            {hasVariants && <span className="mr-1 text-xs font-normal text-muted-foreground">from</span>}
            {formatINR(minPrice)}
          </span>
          {hasVariants ? (
            <Button size="sm" variant="hero" disabled={!i.is_available} onClick={() => onAdd(i)}>
              <Plus className="h-3.5 w-3.5" /> {variantQty > 0 ? `Add more (${variantQty})` : "Choose"}
            </Button>
          ) : inCart ? (
            <div className="flex items-center gap-2 rounded-full bg-primary p-1 text-primary-foreground shadow-soft">
              <button onClick={() => cart.setQuantity(inCart.key, inCart.quantity - 1)} className="grid h-7 w-7 place-items-center rounded-full bg-primary-foreground/15 tap-scale">
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="min-w-[18px] text-center text-sm font-bold">{inCart.quantity}</span>
              <button onClick={() => cart.setQuantity(inCart.key, inCart.quantity + 1)} className="grid h-7 w-7 place-items-center rounded-full bg-primary-foreground/15 tap-scale">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <Button size="sm" variant="hero" disabled={!i.is_available} onClick={() => onAdd(i)}>
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          )}
        </div>
      </div>
    </article>
  );
};

const DietChip = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`flex-1 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold transition-bounce ${
      active ? "bg-gradient-primary text-primary-foreground shadow-soft" : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
    }`}
  >
    {label}
  </button>
);

const CatChip = ({ label, active, onClick, gold }: { label: string; active: boolean; onClick: () => void; gold?: boolean }) => (
  <button
    onClick={onClick}
    className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-bold transition-smooth ${
      active
        ? gold ? "bg-gradient-gold text-gold-foreground shadow-gold" : "bg-primary text-primary-foreground shadow-soft"
        : gold ? "bg-gold/20 text-gold-foreground hover:bg-gold/30" : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
    }`}
  >
    {label}
  </button>
);

export default Menu;
