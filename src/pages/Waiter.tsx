import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  LogOut, Plus, Minus, ShoppingBag, Trash2,
  Search, Send, ChevronLeft, Sparkles, Package,
  UtensilsCrossed, X,
} from "lucide-react";
import { toast } from "sonner";
import { StaffGate } from "@/components/StaffGate";
import { BrandMark } from "@/components/BrandMark";
import { formatINR } from "@/lib/format";
import { withTax, taxOf, TAX_LABEL } from "@/lib/tax";
import { ComboModal, type Combo } from "@/components/menu/ComboCard";

/* ── Types ────────────────────────────────────────────────────────── */
type Variant  = { label: string; price: number };
type Item     = {
  id: string; name: string; price: number; image_url: string | null;
  is_available: boolean; is_veg: boolean; variants: Variant[] | null;
  category_id: string | null; is_special?: boolean;
};
type Category = { id: string; name: string; sort_order: number; is_hidden?: boolean };
type Line     = {
  key: string; menu_item_id: string | null; combo_id?: string | null;
  name: string; variant_label: string | null; unit_price: number; quantity: number;
};

const SPECIALS_KEY = "__specials__";
const COMBOS_KEY   = "__combos__";
const normalizePersonName = (value: string) => value.trim().replace(/\s+/g, " ");

/* ── Category Overlay ─────────────────────────────────────────────── */

const TILE_ACCENTS = [
  { solid: "#7f1d1d", border: "rgba(239,68,68,0.65)",  dot: "#f87171", abbr: "#fca5a5" },
  { solid: "#7c2d12", border: "rgba(249,115,22,0.65)", dot: "#fb923c", abbr: "#fdba74" },
  { solid: "#713f12", border: "rgba(234,179,8,0.65)",  dot: "#fbbf24", abbr: "#fde047" },
  { solid: "#14532d", border: "rgba(34,197,94,0.65)",  dot: "#4ade80", abbr: "#86efac" },
  { solid: "#164e63", border: "rgba(6,182,212,0.65)",  dot: "#22d3ee", abbr: "#67e8f9" },
  { solid: "#1e1b4b", border: "rgba(99,102,241,0.65)", dot: "#818cf8", abbr: "#a5b4fc" },
  { solid: "#831843", border: "rgba(236,72,153,0.65)", dot: "#f472b6", abbr: "#f9a8d4" },
  { solid: "#3b0764", border: "rgba(168,85,247,0.65)", dot: "#c084fc", abbr: "#d8b4fe" },
];

type CategoryOverlayProps = {
  open: boolean; onClose: () => void; catFilter: string;
  setCatFilter: (v: string) => void; visibleCats: Category[];
  hasSpecials: boolean; hasCombos: boolean; items: Item[]; combos: Combo[];
};

const CategoryOverlay = ({
  open, onClose, catFilter, setCatFilter,
  visibleCats, hasSpecials, hasCombos, items, combos,
}: CategoryOverlayProps) => {
  if (!open) return null;

  const specialEntries = [
    {
      key: "all", label: "All", emoji: "🍽️",
      count: items.filter(i => i.is_available).length, accent: null,
    },
    ...(hasSpecials ? [{
      key: SPECIALS_KEY, label: "Specials", emoji: "✨",
      count: items.filter(i => i.is_special).length + combos.filter(c => c.is_special).length,
      accent: null,
    }] : []),
    ...(hasCombos ? [{
      key: COMBOS_KEY, label: "Combos", emoji: "🎁",
      count: combos.length, accent: null,
    }] : []),
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
          background: "rgba(255,255,255,0.96)",
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
          border: "1px solid rgba(0,0,0,0.07)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.22), 0 1px 0 rgba(255,255,255,0.9) inset",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5">
          <div className="flex items-center gap-2">
            <div
              className="grid h-7 w-7 place-items-center rounded-lg"
              style={{
                background: "linear-gradient(135deg, rgba(251,191,36,0.25) 0%, rgba(245,158,11,0.15) 100%)",
                border: "1px solid rgba(251,191,36,0.45)",
              }}
            >
              <UtensilsCrossed className="h-3 w-3" style={{ color: "#d97706" }} />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight" style={{ color: "#111" }}>Select Category</p>
              <p style={{ fontSize: 10, color: "rgba(0,0,0,0.4)" }}>{allEntries.length} categories</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-6 w-6 place-items-center rounded-full transition-all active:scale-90"
            style={{ background: "rgba(0,0,0,0.06)", border: "1px solid rgba(0,0,0,0.1)" }}
          >
            <X className="h-3 w-3" style={{ color: "rgba(0,0,0,0.55)" }} />
          </button>
        </div>

        <div style={{ height: "0.5px", background: "rgba(0,0,0,0.08)", margin: "0 14px 10px" }} />

        {/* Grid — 4 cols for waiter (more compact than customer-facing 3-col) */}
        <div className="grid grid-cols-4 gap-1.5 px-3 pb-4" style={{ maxHeight: "60vh", overflowY: "auto" }}>
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
              : `1px solid ${entry.accent!.border.replace("0.65", "0.25")}`;
            const activeBorder = isSpl
              ? "1px solid rgba(251,191,36,0.7)"
              : `1px solid ${entry.accent!.border}`;

            return (
              <button
                key={entry.key}
                onClick={() => { setCatFilter(entry.key); onClose(); }}
                className="flex flex-col items-start rounded-xl text-left transition-all active:scale-95"
                style={{
                  padding: "8px 8px 7px",
                  background: isActive ? activeBg : idleBg,
                  border: isActive ? activeBorder : idleBorder,
                  boxShadow: isActive
                    ? `0 0 12px ${isSpl ? "rgba(251,191,36,0.3)" : dot + "44"}, 0 2px 6px rgba(0,0,0,0.25)`
                    : "0 1px 2px rgba(0,0,0,0.12)",
                  minHeight: 66,
                  position: "relative",
                }}
              >
                {/* Icon */}
                <div style={{ marginBottom: 5 }}>
                  {entry.emoji ? (
                    <span style={{ fontSize: 16, lineHeight: 1, filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))" }}>
                      {entry.emoji}
                    </span>
                  ) : (
                    <div
                      className="grid place-items-center rounded-md"
                      style={{
                        width: 22, height: 22,
                        background: "rgba(0,0,0,0.18)",
                        border: "1px solid rgba(255,255,255,0.22)",
                      }}
                    >
                      <span style={{ fontSize: 7.5, fontWeight: 800, color: entry.accent!.abbr, letterSpacing: "0.04em" }}>
                        {entry.label.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>

                <span style={{
                fontSize: 10, fontWeight: 700, lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden", marginBottom: 2,
                  color: isSpl ? (isActive ? "#92400e" : "rgba(0,0,0,0.8)") : "rgba(255,255,255,0.96)",
                  textShadow: isSpl ? "none" : "0 1px 2px rgba(0,0,0,0.5)",
                }}>
                 {entry.label.length > 14 ? entry.label.slice(0, 13) + "…" : entry.label}
                </span>
                <span style={{
                  fontSize: 9.5,
                  color: isSpl
                    ? (isActive ? "rgba(146,64,14,0.7)" : "rgba(0,0,0,0.38)")
                    : (isActive ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.5)"),
                  textShadow: isSpl ? "none" : "0 1px 2px rgba(0,0,0,0.35)",
                }}>
                  {entry.count}
                </span>

                {isActive && (
                  <div style={{
                    position: "absolute", top: 6, right: 6,
                    width: 5, height: 5, borderRadius: "50%",
                    background: dot,
                    boxShadow: `0 0 5px ${dot}`,
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

/* ── Root (auth gate) ─────────────────────────────────────────────── */
const Waiter = () => (
  <StaffGate allow={["admin", "kitchen", "pro_admin"]}>
    <Inner />
  </StaffGate>
);

/* ── Main component ───────────────────────────────────────────────── */
const Inner = () => {
  const [step, setStep]                   = useState<"table" | "menu">("table");
  const [tables, setTables]               = useState<any[]>([]);
  const [tablesLoading, setTablesLoading] = useState(true);
  const [tableNumber, setTableNumber]     = useState<number | null>(null);

  const [items,  setItems]  = useState<Item[]>([]);
  const [cats,   setCats]   = useState<Category[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);

  const [catFilter,     setCatFilter]     = useState("all");
  const [catOverlayOpen, setCatOverlayOpen] = useState(false);
  const [query,         setQuery]         = useState("");
  const [lines,         setLines]         = useState<Line[]>([]);
  const [name,          setName]          = useState("");
  const [phone,         setPhone]         = useState("");
  const [phoneError,    setPhoneError]    = useState<string | null>(null);
  const [notes,         setNotes]         = useState("");
  const [openCombo,     setOpenCombo]     = useState<Combo | null>(null);

  const [waiterName, setWaiterName] = useState(() => {
    try { return localStorage.getItem("fsc_waiter_name_v1") || ""; } catch { return ""; }
  });
  const [waiterError, setWaiterError] = useState<string | null>(null);
  const [placing, setPlacing]         = useState(false);

  /* ── Fetch tables once on mount ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setTablesLoading(true);
      try {
        const { data, error } = await supabase
          .from("restaurant_tables")
          .select("*")
          .order("table_number");
        if (cancelled) return;
        if (error) {
          console.error("restaurant_tables error:", error);
          toast.error("Could not load tables");
          setTables([]);
        } else {
          setTables(data ?? []);
        }
      } catch (e) {
        console.error("restaurant_tables exception:", e);
        if (!cancelled) setTables([]);
      } finally {
        if (!cancelled) setTablesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ── Fetch menu data when entering the menu step ── */
  useEffect(() => {
    if (step !== "menu") return;
    let cancelled = false;
    (async () => {
      const [{ data: its, error: e1 }, { data: cs, error: e2 }, { data: cb, error: e3 }] =
        await Promise.all([
          supabase.from("menu_items").select("*").order("sort_order").order("name"),
          supabase.from("categories").select("*").order("sort_order").order("name"),
          supabase
            .from("combos")
            .select("*, combo_items(menu_item_id,quantity,menu_items(name))")
            .eq("is_active", true)
            .order("sort_order"),
        ]);
      if (cancelled) return;
      if (e1) console.error("menu_items error:", e1);
      if (e2) console.error("categories error:", e2);
      if (e3) console.error("combos error:", e3);
      setItems(
        ((its as any) ?? []).map((it: any) => ({
          ...it,
          variants: Array.isArray(it.variants) ? it.variants : [],
        }))
      );
      setCats((cs as any) ?? []);
      setCombos((cb as Combo[]) ?? []);
    })();
    return () => { cancelled = true; };
  }, [step]);

  /* ── Derived values ── */
  const total = useMemo(() => lines.reduce((s, l) => s + l.unit_price * l.quantity, 0), [lines]);
  const count = useMemo(() => lines.reduce((s, l) => s + l.quantity, 0), [lines]);

  const visibleCats   = useMemo(() => cats.filter((c) => !c.is_hidden), [cats]);
  const visibleCatIds = useMemo(() => new Set(visibleCats.map((c) => c.id)), [visibleCats]);

  const specialItems  = useMemo(() => items.filter((i) => i.is_special), [items]);
  const specialCombos = useMemo(() => combos.filter((c) => c.is_special), [combos]);
  const hasSpecials   = (specialItems.length + specialCombos.length) > 0;
  const hasCombos     = combos.length > 0;

  const activeCatLabel = useMemo(() => {
    if (catFilter === "all") return null;
    if (catFilter === SPECIALS_KEY) return "✨ Specials";
    if (catFilter === COMBOS_KEY) return "🎁 Combos";
    return visibleCats.find((c) => c.id === catFilter)?.name ?? null;
  }, [catFilter, visibleCats]);

  const isGoldFilter = catFilter === SPECIALS_KEY || catFilter === COMBOS_KEY;

  const filtered = useMemo(() => items.filter((i) => {
    if (catFilter === SPECIALS_KEY || catFilter === COMBOS_KEY) return false;
    if (catFilter === "all" && i.category_id && !visibleCatIds.has(i.category_id)) return false;
    if (catFilter !== "all" && i.category_id !== catFilter) return false;
    if (query && !i.name.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  }), [items, catFilter, query, visibleCatIds]);

  const filteredCombos = useMemo(() =>
    query ? combos.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())) : combos,
  [combos, query]);

  const showSpecialsView = catFilter === SPECIALS_KEY && hasSpecials;
  const showCombosView   = catFilter === COMBOS_KEY   && hasCombos;
  const showAllSections  = catFilter === "all";

  /* ── Cart helpers ── */
  const addLine = (i: Item, variant?: Variant) => {
    if (!i.is_available) return;
    const price = variant ? Number(variant.price) : Number(i.price);
    const key   = variant ? `${i.id}::${variant.label}` : i.id;
    setLines((prev) => {
      const found = prev.find((l) => l.key === key);
      if (found) return prev.map((l) => l.key === key ? { ...l, quantity: l.quantity + 1 } : l);
      return [...prev, {
        key, menu_item_id: i.id, combo_id: null,
        name: i.name, variant_label: variant?.label || null,
        unit_price: price, quantity: 1,
      }];
    });
    toast.success(`${i.name}${variant ? ` (${variant.label})` : ""} added`, { duration: 1200 });
  };

  const addComboLine = (c: Combo) => {
    const key = `combo::${c.id}`;
    setLines((prev) => {
      const found = prev.find((l) => l.key === key);
      if (found) return prev.map((l) => l.key === key ? { ...l, quantity: l.quantity + 1 } : l);
      return [...prev, {
        key, menu_item_id: null, combo_id: c.id,
        name: `🎁 ${c.name}`, variant_label: null,
        unit_price: Number(c.offer_price), quantity: 1,
      }];
    });
    toast.success(`${c.name} combo added`, { duration: 1200 });
  };

  const setQty = (key: string, qty: number) =>
    setLines((prev) =>
      qty <= 0
        ? prev.filter((l) => l.key !== key)
        : prev.map((l) => l.key === key ? { ...l, quantity: qty } : l)
    );

  /* ── Place order ── */
  const place = async () => {
    if (lines.length === 0 || tableNumber == null || placing) return;
    const w = normalizePersonName(waiterName);
    const customer = normalizePersonName(name);
    const phoneTrimmed = phone.replace(/[^\d+]/g, "");
    const phoneDigits = phoneTrimmed.replace(/\D/g, "");
    if (!w) { setWaiterError("Waiter name is required"); toast.error("Enter waiter name"); return; }
    if (!customer) { toast.error("Enter customer name"); return; }
    if (!phoneTrimmed || phoneDigits.length < 10 || phoneDigits.length > 15) {
      setPhoneError("Enter a valid phone number (10+ digits)");
      toast.error("Valid customer phone is required");
      return;
    }
    setWaiterError(null);
    setPhoneError(null);
    setPlacing(true);
    try { localStorage.setItem("fsc_waiter_name_v1", w); } catch {}

    const menuLines  = lines.filter((l) => l.menu_item_id !== null);
    const comboLines = lines.filter((l) => l.combo_id !== null);

    const payload = menuLines.map((l) => ({
      menu_item_id: l.menu_item_id,
      name: l.variant_label ? `${l.name} (${l.variant_label})` : l.name,
      variant_label: l.variant_label,
      unit_price: l.unit_price,
      quantity: l.quantity,
    }));

    const comboNote = comboLines.length > 0
      ? " | Combos: " + comboLines.map((l) => `${l.name} x${l.quantity}`).join(", ")
      : "";
    const stampedNotes = `[Waiter: ${w}]${notes.trim() ? ` ${notes.trim()}` : ""}${comboNote}`;

    const { data, error } = await supabase.rpc("waiter_place_order", {
      _table_number:    tableNumber,
      _customer_name:   customer,
      _customer_phone:  phoneTrimmed,
      _notes:           stampedNotes,
      _items:           payload as any,
      _idempotency_key: crypto.randomUUID(),
    });
    setPlacing(false);
    if (error || !data) { toast.error(error?.message || "Failed to place order"); return; }
    toast.success(`Order sent to kitchen — Table ${tableNumber} (by ${w})`);
    setLines([]); setName(""); setPhone(""); setNotes("");
  };

  /* ════════════════════════════════════════
     STEP 1 — Table picker
  ════════════════════════════════════════ */
  if (step === "table") {
    return (
      <main className="min-h-screen bg-gradient-warm pb-12">
        <Header />
        <section className="mx-auto max-w-4xl px-4 pt-6">
          <h1 className="font-display text-3xl font-bold">Pick a table</h1>
          <p className="text-sm text-muted-foreground">Select the table you're taking the order for.</p>

          {tablesLoading ? (
            <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {[1,2,3,4,5,6].map((n) => (
                <div key={n} className="h-20 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : tables.length === 0 ? (
            <div className="mt-10 text-center space-y-3">
              <p className="text-muted-foreground">No tables found.</p>
              <button
                onClick={async () => {
                  setTablesLoading(true);
                  const { data } = await supabase
                    .from("restaurant_tables").select("*").order("table_number");
                  setTables(data ?? []);
                  setTablesLoading(false);
                }}
                className="text-sm font-semibold text-primary hover:underline"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {tables.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setTableNumber(t.table_number); setStep("menu"); }}
                  className="rounded-2xl bg-card p-4 text-center shadow-soft tap-scale hover:ring-2 hover:ring-primary/40 transition-smooth"
                >
                  <p className="font-display text-2xl font-bold">T{t.table_number}</p>
                  {t.label && <p className="text-[11px] text-muted-foreground">{t.label}</p>}
                </button>
              ))}
            </div>
          )}
        </section>
      </main>
    );
  }

  /* ════════════════════════════════════════
     STEP 2 — Menu + cart
  ════════════════════════════════════════ */
  return (
    <main className="min-h-screen bg-gradient-warm pb-[28rem] sm:pb-80">
      <Header />
      <section className="mx-auto max-w-4xl px-4 pt-4">

        {/* Back + table badge */}
        <div className="mb-3 flex items-center justify-between">
          <button
            onClick={() => { setStep("table"); setCatFilter("all"); setQuery(""); }}
            className="flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-primary"
          >
            <ChevronLeft className="h-4 w-4" /> Tables
          </button>
          <span className="rounded-full bg-gradient-gold px-3 py-1 text-xs font-bold text-gold-foreground shadow-gold">
            Table {tableNumber}
          </span>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search dishes…"
            className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Category row — overlay trigger */}
        <div className="mb-4 flex items-center gap-2">
          <CatChip label="All" active={catFilter === "all"} onClick={() => setCatFilter("all")} />
          {activeCatLabel && (
            <CatChip label={activeCatLabel} active onClick={() => setCatOverlayOpen(true)} gold={isGoldFilter} />
          )}
          <div className="flex-1" />
          <button
            onClick={() => setCatOverlayOpen(true)}
            aria-label="Browse categories"
            className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-secondary-foreground tap-scale transition-smooth hover:bg-secondary/70 active:scale-95"
            style={{ border: "1.5px solid rgba(0,0,0,0.14)", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}
          >
            <UtensilsCrossed className="h-3 w-3" />
            <span>Categories</span>
          </button>
        </div>

        {/* Specials section */}
        {(showAllSections || showSpecialsView) && hasSpecials && (
          <>
            <SectionHeader icon={<Sparkles className="h-4 w-4" />} title="Today's Specials" gold />
            <div className="mt-3 mb-6 grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {specialCombos.map((c) => (
                <ComboRow key={c.id} combo={c}
                  onAdd={addComboLine} onPreview={() => setOpenCombo(c)} />
              ))}
              {specialItems
                .filter((i) => !query || i.name.toLowerCase().includes(query.toLowerCase()))
                .map((i) => (
                  <ItemRow key={i.id} i={i} onAdd={addLine} highlight />
                ))}
            </div>
          </>
        )}

        {/* Combos section */}
        {(showAllSections || showCombosView) && hasCombos && (
          <>
            <SectionHeader icon={<Package className="h-4 w-4" />} title="Combo Offers" gold />
            <div className="mt-3 mb-6 grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {filteredCombos.map((c) => (
                <ComboRow key={c.id} combo={c}
                  onAdd={addComboLine} onPreview={() => setOpenCombo(c)} />
              ))}
            </div>
          </>
        )}

        {/* Regular menu items */}
        {!showSpecialsView && !showCombosView && (
          <>
            {showAllSections && (hasSpecials || hasCombos) && filtered.length > 0 && (
              <SectionHeader title="Menu" />
            )}
            <div className="mt-3 grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {filtered.map((i) => (
                <ItemRow key={i.id} i={i} onAdd={addLine} />
              ))}
              {filtered.length === 0 && (
                <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
                  No dishes found.
                </p>
              )}
            </div>
          </>
        )}
      </section>

      {/* Sticky cart bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 px-4 py-3 backdrop-blur shadow-elegant">
        <div className="mx-auto max-w-4xl">
          {lines.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              <ShoppingBag className="mr-1 inline h-4 w-4" /> No items added yet
            </p>
          ) : (
            <>
              <div className="mb-2 max-h-40 overflow-y-auto space-y-1.5">
                {lines.map((l) => (
                  <div key={l.key} className="flex items-center gap-2 rounded-lg bg-secondary/50 p-2 text-sm">
                    <span className="flex-1 font-medium truncate">
                      {l.name}{l.variant_label ? ` (${l.variant_label})` : ""}
                    </span>
                    <div className="flex items-center gap-1 rounded-full bg-card p-0.5 shadow-soft">
                      <button onClick={() => setQty(l.key, l.quantity - 1)}
                        className="grid h-6 w-6 place-items-center rounded-full bg-secondary">
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="min-w-[16px] text-center text-xs font-bold">{l.quantity}</span>
                      <button onClick={() => setQty(l.key, l.quantity + 1)}
                        className="grid h-6 w-6 place-items-center rounded-full bg-secondary">
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <span className="w-16 text-right text-sm font-semibold">
                      {formatINR(l.unit_price * l.quantity)}
                    </span>
                    <button onClick={() => setQty(l.key, 0)}
                      className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="mb-2 flex flex-col gap-2 sm:flex-row">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Customer name (required)"
                  required
                  className="h-9 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <input
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); if (phoneError) setPhoneError(null); }}
                  placeholder="Customer phone (required)"
                  type="tel"
                  inputMode="tel"
                  required
                  aria-invalid={!!phoneError}
                  className={`h-9 flex-1 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 ${
                    phoneError ? "border-destructive focus:ring-destructive/20" : "border-border focus:border-primary focus:ring-primary/20"
                  }`}
                />
                <input
                  value={waiterName}
                  onChange={(e) => { setWaiterName(e.target.value); if (waiterError) setWaiterError(null); }}
                  placeholder="Waiter name (required)"
                  required
                  aria-invalid={!!waiterError}
                  className={`h-9 flex-1 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 ${
                    waiterError
                      ? "border-destructive focus:ring-destructive/20"
                      : "border-border focus:border-primary focus:ring-primary/20"
                  }`}
                />
              </div>
              {phoneError && (
                <p className="mb-1 text-[11px] font-semibold text-destructive">{phoneError}</p>
              )}
              {waiterError && (
                <p className="mb-1 text-[11px] font-semibold text-destructive">{waiterError}</p>
              )}
              <div className="mb-2">
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes (optional)"
                  className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {count} items{taxOf(total) > 0 && <> · +{TAX_LABEL} tax</>}
                  </p>
                  <p className="font-display text-xl font-bold text-primary">
                    {formatINR(withTax(total))}
                  </p>
                </div>
                <Button variant="hero" size="lg" onClick={place} disabled={placing}>
                  <Send className="h-4 w-4" /> {placing ? "Sending…" : "Send to Kitchen"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      <ComboModal
        combo={openCombo}
        open={!!openCombo}
        onOpenChange={(v) => !v && setOpenCombo(null)}
      />

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

/* ── Sub-components ───────────────────────────────────────────────── */

const ItemRow = ({
  i, onAdd, highlight,
}: {
  i: Item; onAdd: (i: Item, v?: Variant) => void; highlight?: boolean;
}) => {
  const variants = Array.isArray(i.variants) ? i.variants : [];
  return (
    <article className={`flex flex-col rounded-xl bg-card p-2.5 shadow-soft transition-smooth
      ${!i.is_available ? "opacity-50" : ""}
      ${highlight ? "border border-gold/50" : "border border-border/40"}`}
    >
      <div className="flex items-start gap-1.5">
        <span className={`mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-sm border
          ${i.is_veg ? "border-green-600" : "border-red-700"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${i.is_veg ? "bg-green-600" : "bg-red-700"}`} />
        </span>
        <p className="flex-1 text-xs font-semibold leading-tight line-clamp-2">{i.name}</p>
      </div>

      <div className="mt-1 flex flex-wrap gap-1">
        {i.is_special && (
          <span className="rounded-full bg-gradient-gold px-1.5 py-0.5 text-[8px] font-bold uppercase text-gold-foreground">
            ★ Special
          </span>
        )}
        {!i.is_available && (
          <span className="rounded-full bg-destructive/15 px-1.5 py-0.5 text-[8px] font-bold text-destructive">
            Sold out
          </span>
        )}
      </div>

      {variants.length > 0 ? (
        <div className="mt-2 flex flex-col gap-1">
          {variants.map((v) => (
            <button
              key={v.label}
              disabled={!i.is_available}
              onClick={() => onAdd(i, v)}
              className="flex items-center justify-between rounded-lg bg-secondary/60 px-2 py-1 text-[11px] font-semibold hover:bg-secondary disabled:opacity-50 transition-smooth"
            >
              <span className="text-muted-foreground">{v.label}</span>
              <span className="flex items-center gap-1 text-primary">
                {formatINR(Number(v.price))} <Plus className="h-2.5 w-2.5" />
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="font-display text-sm font-bold">{formatINR(Number(i.price))}</span>
          <button
            disabled={!i.is_available}
            onClick={() => onAdd(i)}
            className="flex items-center gap-0.5 rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground shadow-soft hover:bg-primary/90 disabled:opacity-50 transition-smooth"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>
      )}
    </article>
  );
};

const ComboRow = ({
  combo, onAdd, onPreview,
}: {
  combo: Combo; onAdd: (c: Combo) => void; onPreview: () => void;
}) => (
  <article className="flex flex-col rounded-xl bg-card p-2.5 shadow-soft border border-gold/40 transition-smooth">
    <div className="flex items-start gap-1.5">
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gradient-gold text-gold-foreground shadow-gold">
        <Package className="h-2.5 w-2.5" />
      </span>
      <p className="flex-1 text-xs font-semibold leading-tight line-clamp-2">{combo.name}</p>
    </div>

    {combo.combo_items && combo.combo_items.length > 0 && (
      <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground line-clamp-2">
        {combo.combo_items
          .map((ci: any) =>
            `${ci.menu_items?.name ?? ""}${ci.quantity > 1 ? ` ×${ci.quantity}` : ""}`
          )
          .join(" · ")}
      </p>
    )}

    <div className="mt-auto flex items-center justify-between pt-2">
      <div>
        <span className="font-display text-sm font-bold text-foreground">
          {formatINR(Number(combo.offer_price))}
        </span>
        {combo.original_price > combo.offer_price && (
          <span className="ml-1 text-[10px] text-muted-foreground line-through">
            {formatINR(Number(combo.original_price))}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onPreview}
          className="rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold text-secondary-foreground hover:bg-secondary/70 transition-smooth"
        >
          Info
        </button>
        <button
          onClick={() => onAdd(combo)}
          className="flex items-center gap-0.5 rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground shadow-soft hover:bg-primary/90 transition-smooth"
        >
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>
    </div>
  </article>
);

const SectionHeader = ({
  title, icon, gold,
}: {
  title: string; icon?: React.ReactNode; gold?: boolean;
}) => (
  <div className="flex items-center gap-2 mb-1">
    {icon && (
      <span className={`grid h-7 w-7 place-items-center rounded-full
        ${gold ? "bg-gradient-gold text-gold-foreground" : "bg-secondary text-foreground"}`}>
        {icon}
      </span>
    )}
    <h2 className={`font-display text-lg font-bold ${gold ? "text-gold-foreground" : ""}`}>
      {title}
    </h2>
  </div>
);

const CatChip = ({
  label, active, onClick, gold,
}: {
  label: string; active: boolean; onClick: () => void; gold?: boolean;
}) => (
  <button
    onClick={onClick}
    className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-bold transition-smooth ${
      active
        ? gold
          ? "bg-gradient-gold text-gold-foreground shadow-gold"
          : "bg-primary text-primary-foreground shadow-soft"
        : gold
        ? "bg-gold/20 text-gold-foreground hover:bg-gold/30"
        : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
    }`}
  >
    {label}
  </button>
);

const Header = () => (
  <header className="sticky top-0 z-30 glass border-b border-border/50">
    <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3">
        <BrandMark />
        <span className="rounded-full bg-gradient-gold px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-gold-foreground">
          Waiter
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/kitchen">Kitchen</Link>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => { await supabase.auth.signOut(); window.location.href = "/admin"; }}
        >
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </Button>
      </div>
    </div>
  </header>
);

export default Waiter;
