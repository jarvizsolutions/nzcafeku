import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, ChefHat, Bell, BellOff, Flame, LayoutGrid, ListChecks, X, Wallet, ExternalLink, Ban, Package, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { StaffGate } from "@/components/StaffGate";
import { BrandMark } from "@/components/BrandMark";
import { formatINR } from "@/lib/format";
import { withTax } from "@/lib/tax";
import { WaiterCallsPanel } from "@/components/kitchen/WaiterCallsPanel";
import { GroupedItemsView } from "@/components/kitchen/GroupedItemsView";
import { KitchenAddItemDialog } from "@/components/kitchen/KitchenAddItemDialog";
import { CounterBills } from "@/components/admin/CounterBills";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const Kitchen = () => (
  <StaffGate allow={["admin", "kitchen","pro_admin"]}><Inner /></StaffGate>
);

const STATUSES = ["pending", "preparing", "served", "cancelled"] as const;
type Status = typeof STATUSES[number];
type StatusFilter = "all" | "served";
type View = "cards" | "pull";

const playSound = (file: "order-received.wav" | "items-added.wav") => {
  try {
    const audio = new Audio(`/sounds/${file}`);
    audio.volume = 0.7;
    audio.play().catch(() => {});
  } catch {}
};

const playOrderReceived = () => playSound("order-received.wav");
const playItemsAdded    = () => playSound("items-added.wav");

const SoundToggle = ({ on, onToggle }: { on: boolean; onToggle: () => void }) => (
  <button
    onClick={onToggle}
    title={on ? "Sound on" : "Sound off"}
    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 transition-colors duration-200 focus:outline-none ${
      on ? "border-primary bg-primary" : "border-border bg-secondary"
    }`}
  >
    <span
      className={`inline-flex h-5 w-5 items-center justify-center rounded-full bg-card shadow-sm transition-transform duration-200 ${
        on ? "translate-x-5" : "translate-x-0.5"
      }`}
    >
      {on
        ? <Bell className="h-3 w-3 text-primary" />
        : <BellOff className="h-3 w-3 text-muted-foreground" />}
    </span>
  </button>
);

const SOUND_PREF_KEY = "kitchen_sound_on";

// ── Helpers ────────────────────────────────────────────────────────────────

/** Returns true if any non-cancelled item in the order is a parcel-charges line. */
const isParcelOrder = (its: any[]) =>
  its.some((it) => !it.is_cancelled && it.name?.toLowerCase().includes("parcel"));

/** Returns true if this specific item is the parcel-charges line. */
const isParcelItem = (it: any) =>
  it.name?.toLowerCase().includes("parcel");

/**
 * Parses trailing "(Regular)" / "(Large)" / "(Small)" etc. from item name.
 */
const parseVariant = (name: string): { baseName: string; variant: string | null } => {
  const match = name.match(/^(.*?)\s*\((regular|large|small|medium|xl|xxl)\)\s*$/i);
  if (!match) return { baseName: name, variant: null };
  return { baseName: match[1].trim(), variant: match[2] };
};

/**
 * Returns Tailwind classes for the quantity badge based on qty value.
 * 1 → primary, 2 → orange, 3 → purple, 4+ → blue.
 * If fully prepared, always muted.
 */
const qtyBadgeColor = (qty: number, fully: boolean, multi: boolean, fromKitchen: boolean): string => {
  if (fully) return "bg-secondary text-muted-foreground";
  if (!multi) {
    return fromKitchen
      ? "bg-gold text-gold-foreground"
      : "bg-primary text-primary-foreground";
  }
  if (qty === 2) return "bg-orange-500 text-white ring-2 ring-orange-400/40 animate-pulse-glow";
  if (qty === 3) return "bg-purple-600 text-white ring-2 ring-purple-400/40 animate-pulse-glow";
  return "bg-blue-600 text-white ring-2 ring-blue-400/40 animate-pulse-glow";
};

// ──────────────────────────────────────────────────────────────────────────

const Inner = () => {
  const [billsOpen, setBillsOpen] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [items, setItems] = useState<Record<string, any[]>>({});
  const [vegMap, setVegMap] = useState<Record<string, boolean>>({});
  // Track collapsed cards: Set of order IDs that are collapsed
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const [soundOn, setSoundOn] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(SOUND_PREF_KEY);
      return stored === null ? true : stored === "true";
    } catch {
      return true;
    }
  });

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [view, setView] = useState<View>("cards");
  const knownIds = useRef<Set<string>>(new Set());
  const seededRef = useRef(false);
  const soundOnRef = useRef(soundOn);
  const [, setNowTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    soundOnRef.current = soundOn;
    try { localStorage.setItem(SOUND_PREF_KEY, String(soundOn)); } catch {}
  }, [soundOn]);

  const toggleSound = () => setSoundOn((s) => !s);
  const toggleCollapsed = (id: string) => setCollapsed((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const load = async () => {
    const since = new Date(Date.now() - 4 * 60 * 60_000).toISOString();
    const { data: os } = await supabase
      .from("orders").select("*")
      .or(`status.in.(pending,preparing),and(status.eq.served,created_at.gte.${since}),and(status.eq.ready,created_at.gte.${since})`)
      .order("is_rush", { ascending: false })
      .order("created_at", { ascending: true });
    const list = os || [];
    if (!seededRef.current) {
      list.forEach((o: any) => knownIds.current.add(o.id));
      seededRef.current = true;
    }
    setOrders(list);
    const ids = list.map((o) => o.id);
    if (ids.length) {
      const { data: its } = await supabase.from("order_items").select("*").in("order_id", ids);
      const grouped: Record<string, any[]> = {};
      const menuItemIds = new Set<string>();
      (its || []).forEach((it: any) => {
        (grouped[it.order_id] ||= []).push(it);
        if (it.menu_item_id) menuItemIds.add(it.menu_item_id);
      });
      setItems(grouped);
      if (menuItemIds.size) {
        const { data: mi } = await supabase
          .from("menu_items").select("id,is_veg").in("id", Array.from(menuItemIds));
        const m: Record<string, boolean> = {};
        (mi || []).forEach((r: any) => { m[r.id] = r.is_veg; });
        setVegMap((prev) => ({ ...prev, ...m }));
      }
    } else setItems({});
  };

  useEffect(() => {
    load();
    const ch = supabase.channel(`kitchen-feed-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (p) => {
        const row = p.new as any;
        if (!knownIds.current.has(row.id)) {
          knownIds.current.add(row.id);
          if (row.otp_verified) {
            toast.success(`🔔 New order from Table ${row.table_number}!`, { duration: 5000 });
            if (soundOnRef.current) playOrderReceived();
          } else {
            toast(`🔐 Table ${row.table_number} placed an order — awaiting OTP verification`, { duration: 5000 });
          }
        }
        load();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, (p) => {
        const row = p.new as any;
        const old = p.old as any;
        if (row?.last_appended_at && row.last_appended_at !== old?.last_appended_at) {
          toast.success(`➕ More items added to Table ${row.table_number}!`, { duration: 5000 });
          if (soundOnRef.current) playItemsAdded();
        }
        load();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setStatus = async (id: string, status: Status) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); load(); return; }
    toast.success(`Marked ${status}`);
    load();
  };

  const toggleRush = async (id: string, current: boolean) => {
    const { error } = await supabase.from("orders").update({ is_rush: !current }).eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  const tickItem = async (item: any, delta: number) => {
    const qty = Number(item.quantity) || 1;
    const cur = Number(item.prepared_quantity) || 0;
    const next = Math.max(0, Math.min(qty, cur + delta));
    if (next === cur) return;
    setItems((prev) => {
      const out: Record<string, any[]> = {};
      Object.entries(prev).forEach(([oid, arr]) => {
        out[oid] = arr.map((i) =>
          i.id === item.id
            ? { ...i, prepared_quantity: next, is_prepared: next >= qty }
            : i
        );
      });
      return out;
    });
    const { error } = await supabase.rpc("tick_item_prepared", { _item_id: item.id, _delta: delta } as any);
    if (error) { toast.error(error.message); }
    load();
  };

  const cancelItem = async (item: any) => {
    if (!confirm(`Cancel "${item.name}"? Customer will see it as cancelled and bill will update.`)) return;
    const { error } = await supabase.rpc("cancel_order_item", { _item_id: item.id } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Item cancelled");
    load();
  };

  const APPEND_WINDOW_MS = 15 * 60_000;

  const pendingVerification = useMemo(
    () => orders.filter((o) => o.staff_otp && !o.otp_verified),
    [orders]
  );

  const visibleOrders = useMemo(() => {
    const filtered = orders.filter((o) => {
      if (!o.otp_verified) return false;
      if (statusFilter === "all" && o.status === "served") return false;
      if (statusFilter === "served" && o.status !== "served") return false;
      return true;
    });
    const isAppended = (o: any) =>
      o.last_appended_at && Date.now() - new Date(o.last_appended_at).getTime() < APPEND_WINDOW_MS;
    return [...filtered].sort((a, b) => {
      if (!!b.is_rush !== !!a.is_rush) return b.is_rush ? 1 : -1;
      if (isAppended(a) !== isAppended(b)) return isAppended(a) ? -1 : 1;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [orders, items, statusFilter]);

  const pullItems = useMemo(() => {
    const flat: any[] = [];
    visibleOrders.forEach((o) => {
      (items[o.id] || []).forEach((it: any) => {
        if (it.is_cancelled) return;
        flat.push(it);
      });
    });
    return flat;
  }, [visibleOrders, items]);

  const ordersByItemOrderId = useMemo(() => {
    const m: Record<string, { table_number: number; is_rush: boolean }> = {};
    visibleOrders.forEach((o) => { m[o.id] = { table_number: o.table_number, is_rush: !!o.is_rush }; });
    return m;
  }, [visibleOrders]);

  return (
    <main className="min-h-screen bg-gradient-warm pb-20">

      {/* ── Header ── */}
      <header className="sticky top-0 z-30 glass border-b border-border/50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">

          {/* Left: logo + label */}
          <div className="flex items-center gap-3">
            <BrandMark />
            <span className="hidden rounded-full bg-gradient-primary px-3 py-1 text-xs font-bold text-primary-foreground sm:inline-flex">
              <ChefHat className="mr-1 h-3.5 w-3.5" /> Kitchen
            </span>
          </div>

          {/* Right: only the essentials */}
          <div className="flex items-center gap-2">
            <SoundToggle on={soundOn} onToggle={toggleSound} />

            <Button variant="hero" size="sm" className="min-w-[72px]" onClick={() => setBillsOpen(true)}>
              <Wallet className="h-3.5 w-3.5" />
              <span className="ml-1">Bills</span>
            </Button>

            <Button asChild variant="outline" size="sm" className="w-8 px-0">
              <a href="/waiter" target="_blank" rel="noopener noreferrer" title="Waiter">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Bills dialog ── */}
      <Dialog open={billsOpen} onOpenChange={setBillsOpen}>
        <DialogContent className="flex flex-col overflow-hidden
          mx-4 my-4 w-[calc(100vw-2rem)] max-w-3xl
          max-h-[calc(100vh-2rem)]
          rounded-2xl
          sm:mx-auto sm:my-auto sm:w-full sm:max-h-[92vh]">
          <DialogHeader><DialogTitle>Counter Bills</DialogTitle></DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <CounterBills />
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Main content ── */}
      <section className="mx-auto max-w-6xl px-4 pt-6">
        <WaiterCallsPanel audioReady={true} />

        {pendingVerification.length > 0 && (
          <PendingVerificationPanel orders={pendingVerification} onVerified={load} />
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold">Live Orders</h1>
            <p className="text-sm text-muted-foreground">{visibleOrders.length} active</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-full bg-secondary p-1">
              <ViewBtn active={view === "cards"} onClick={() => setView("cards")} icon={LayoutGrid} label="Cards" />
              <ViewBtn active={view === "pull"} onClick={() => setView("pull")} icon={ListChecks} label="Pull list" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 flex flex-wrap gap-2">
          <FilterChip label="All"    active={statusFilter === "all"}    onClick={() => setStatusFilter("all")} />
          <FilterChip label="Served" active={statusFilter === "served"} onClick={() => setStatusFilter("served")} />
        </div>

        {view === "pull" ? (
          <div className="mt-6">
            <GroupedItemsView items={pullItems} ordersByItemOrderId={ordersByItemOrderId} />
          </div>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleOrders.length === 0 ? (
              <p className="col-span-full py-20 text-center text-muted-foreground">No active orders. 🍗</p>
            ) : visibleOrders.map((o) => {
              const its = items[o.id] || [];
              const mins = Math.max(0, Math.floor((Date.now() - new Date(o.created_at).getTime()) / 60000));
              const urgent = (mins >= 10 && o.status !== "served") || o.is_rush;
              const activeIts = its.filter((i: any) => !i.is_cancelled);
              const preparedCount = activeIts.filter((i: any) => i.is_prepared).length;
              const allPrepared = activeIts.length > 0 && preparedCount === activeIts.length;
              const appendedRecently = o.last_appended_at &&
                (Date.now() - new Date(o.last_appended_at).getTime()) < APPEND_WINDOW_MS;
              const newItemsCount = appendedRecently
                ? its.filter((it: any) =>
                    it.created_at && o.last_appended_at &&
                    Math.abs(new Date(it.created_at).getTime() - new Date(o.last_appended_at).getTime()) < 60_000
                  ).length
                : 0;

              // ── Parcel detection (only non-cancelled parcel items count) ──
              const parcel = isParcelOrder(its);

              // ── Accordion state ──
              const isCollapsed = collapsed.has(o.id);

              // ── Card border / bg ──
              let cardBorder: string;
              let cardBg: string;
              if (parcel) {
                cardBg = "bg-purple-50/80";
                cardBorder = urgent
                  ? "ring-2 ring-destructive border border-destructive/40"
                  : appendedRecently
                    ? "ring-4 ring-gold border border-gold/60 shadow-elegant"
                    : "border border-purple-200";
              } else {
                cardBg = "bg-card";
                cardBorder = urgent
                  ? "ring-2 ring-destructive border border-destructive/40"
                  : appendedRecently
                    ? "ring-4 ring-gold border border-gold/60 shadow-elegant"
                    : "border border-border";
              }

              return (
                <article
                  key={o.id}
                  className={`animate-scale-in rounded-2xl p-4 shadow-soft transition-smooth ${cardBg} ${cardBorder}`}
                >
                  {appendedRecently && (
                    <div className="mb-2 flex items-center gap-2 rounded-lg bg-gold px-2.5 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-gold-foreground animate-pulse-glow">
                      🆕 {newItemsCount > 0 ? `${newItemsCount} new item${newItemsCount > 1 ? "s" : ""} added` : "Items added"}
                      <span className="ml-auto text-[10px] font-medium normal-case opacity-90">
                        {Math.max(0, Math.floor((Date.now() - new Date(o.last_appended_at).getTime()) / 60000))}m ago
                      </span>
                    </div>
                  )}

                  {/* ── Card header row ── */}
                  <div className="flex items-start justify-between">
                   <div className="flex items-center gap-2">
                      <p className="font-display text-2xl font-bold">Table {o.table_number}</p>
                      <button
                        onClick={() => toggleCollapsed(o.id)}
                        title={isCollapsed ? "Expand" : "Collapse"}
                className="grid h-6 w-6 place-items-center rounded-full border border-primary bg-primary text-primary-foreground hover:bg-primary/80 transition-smooth"
                      >
                        {isCollapsed
                          ? <ChevronDown className="h-3.5 w-3.5" />
                          : <ChevronUp className="h-3.5 w-3.5" />}
                      </button>
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">#{o.id.slice(0, 8)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1 flex-wrap justify-end">
                        {/* Parcel badge inline */}
                        {parcel && (
                          <span className="flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-purple-700 border border-purple-200 shadow-sm">
                            <Package className="h-3 w-3" /> Parcel
                          </span>
                        )}
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${urgent ? "bg-destructive text-destructive-foreground" : "bg-gold text-gold-foreground"}`}>
                          {mins}m
                        </span>
                        {/* Accordion toggle */}
                        {/* <button
                          onClick={() => toggleCollapsed(o.id)}
                          title={isCollapsed ? "Expand" : "Collapse"}
                          className="grid h-7 w-7 place-items-center rounded-full bg-secondary text-muted-foreground hover:bg-secondary/70 transition-smooth"
                        >
                          {isCollapsed
                            ? <ChevronDown className="h-3.5 w-3.5" />
                            : <ChevronUp className="h-3.5 w-3.5" />}
                        </button> */}
                        <button
                          onClick={async () => {
                            if (!confirm(`Cancel order for Table ${o.table_number}?`)) return;
                            const { error } = await supabase.rpc("cancel_order", { _order_id: o.id });
                            if (error) toast.error(error.message); else toast.success("Order cancelled");
                          }}
                          title="Cancel order"
                          className="grid h-7 w-7 place-items-center rounded-full bg-secondary text-muted-foreground tap-scale hover:bg-destructive hover:text-destructive-foreground transition-smooth"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {o.is_rush && (
                        <span className="flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold uppercase text-destructive-foreground">
                          <Flame className="h-3 w-3" /> Rush
                        </span>
                      )}
                    </div>
                  </div>

                  {/* ── Customer name — slightly larger, always visible ── */}
                  {o.customer_name && (
                    <p className="mt-1 text-sm font-semibold text-foreground/80">
                      {o.customer_name}{o.customer_phone ? ` • 📞 ${o.customer_phone}` : ""}
                    </p>
                  )}

                  {/* ── Status summary shown only when collapsed ── */}
                  {isCollapsed && (
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <CurrentBadge s={o.status} />
                      <span className="text-xs text-muted-foreground font-medium">
                        {preparedCount}/{activeIts.length} items sent
                      </span>
                      <span className="text-xs font-semibold">{formatINR(withTax(Number(o.total)))}</span>
                    </div>
                  )}

                  {/* ── Collapsible body ── */}
                  {!isCollapsed && (
                    <>
                      <ul className="mt-3 space-y-1.5 border-t border-border/60 pt-3 text-sm">
                        {its.map((it: any) => {
                          const isNew = appendedRecently && it.created_at && o.last_appended_at &&
                            Math.abs(new Date(it.created_at).getTime() - new Date(o.last_appended_at).getTime()) < 60_000;
                          const fromKitchen = !!it.added_by_kitchen;
                          const qty = Number(it.quantity) || 1;
                          const done = Number(it.prepared_quantity) || 0;
                          const remaining = Math.max(0, qty - done);
                          const fully = done >= qty;
                          const multi = qty > 1;
                          const cancelled = !!it.is_cancelled;
                          const parcelLine = isParcelItem(it);

                          // ── Parse variant tag (Regular / Large etc.) ──
                          const { baseName, variant } = parseVariant(it.name || "");
                          const variantTag = variant ? (
                            <span
                              className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                                variant.toLowerCase() === "large" || variant.toLowerCase() === "xl" || variant.toLowerCase() === "xxl"
                                  ? "bg-red-500 text-white"
                                  : "bg-green-500 text-white"
                              }`}
                            >
                              {variant}
                            </span>
                          ) : null;

                          if (cancelled) {
                            return (
                              <li
                                key={it.id}
                                className="flex items-center gap-2 rounded-lg p-1.5 bg-destructive/10 ring-1 ring-destructive/30"
                              >
                                <span className="grid h-5 w-5 shrink-0 place-items-center rounded border border-destructive/40 bg-background text-[11px] font-bold text-destructive">
                                  <Ban className="h-3 w-3" />
                                </span>
                                <span className="grid h-8 min-w-8 shrink-0 place-items-center rounded-lg px-1.5 text-sm font-extrabold bg-secondary text-muted-foreground line-through">
                                  {qty}
                                </span>
                                <span className="flex-1 font-medium leading-tight line-through opacity-70">
                                  {baseName}
                                </span>
                                <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[9px] font-bold uppercase text-destructive-foreground">
                                  Cancelled
                                </span>
                              </li>
                            );
                          }

                          // ── Parcel charges line: no tick/qty, but HAS cancel button ──
                          if (parcelLine) {
                            return (
                              <li
                                key={it.id}
                                className="flex items-center gap-2 rounded-lg px-2 py-1 bg-purple-50 ring-1 ring-purple-200"
                              >
                                <Package className="h-3.5 w-3.5 shrink-0 text-purple-400" />
                                <span className="flex-1 text-xs text-purple-700/80 italic leading-tight">
                                  {it.name}
                                  {it.price ? ` · ${formatINR(it.price)}` : ""}
                                </span>
                                <span className="text-[9px] font-bold uppercase tracking-wide text-purple-400 mr-1">
                                  charges
                                </span>
                                {/* Cancel parcel charges — makes it a normal dine-in order */}
                                <button
                                  onClick={(e) => { e.stopPropagation(); cancelItem(it); }}
                                  title="Remove parcel charges (converts to dine-in)"
                                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-smooth"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </li>
                            );
                          }

                          const qtyBadgeClass = qtyBadgeColor(qty, fully, multi, fromKitchen);

                          return (
                            <li
                              key={it.id}
                              className={`flex items-center gap-2 rounded-lg p-1.5 select-none transition-smooth ${
                                fully ? "bg-secondary/40 opacity-60" : "hover:bg-secondary/40"
                              } ${isNew && !fully ? "ring-1 ring-gold/50" : ""} ${
                                fromKitchen ? "bg-gold/10 ring-1 ring-gold/40" : ""
                              }`}
                            >
                              <span
                                onClick={() => tickItem(it, fully ? -qty : 1)}
                                title={fully ? "Click to undo" : `Click to mark 1 unit prepared (${remaining} left)`}
                                className="grid h-5 w-5 shrink-0 cursor-pointer place-items-center rounded border border-border bg-background text-[11px] font-bold"
                              >
                                {fully ? "✓" : done > 0 ? done : ""}
                              </span>
                              <span
                                onClick={() => tickItem(it, fully ? -qty : 1)}
                                className={`grid h-8 min-w-8 shrink-0 cursor-pointer place-items-center rounded-lg px-1.5 text-sm font-extrabold ${qtyBadgeClass}`}
                              >
                                {fully ? qty : `${remaining}/${qty}`}
                              </span>
                              <span
                                onClick={() => tickItem(it, fully ? -qty : 1)}
                                className={`flex-1 cursor-pointer font-medium leading-tight ${fully ? "line-through" : ""}`}
                              >
                                {variantTag ? (
                                  <span className="flex items-center gap-1.5 flex-wrap">
                                    <span>{baseName}</span>
                                    {variantTag}
                                  </span>
                                ) : baseName}
                              </span>
                              {fromKitchen && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-gold px-1.5 py-0.5 text-[9px] font-bold uppercase text-gold-foreground">
                                  <ChefHat className="h-2.5 w-2.5" /> Kitchen
                                </span>
                              )}
                              {isNew && !fully && !fromKitchen && (
                                <span className="rounded-full bg-gold px-1.5 py-0.5 text-[9px] font-bold uppercase text-gold-foreground">New</span>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); cancelItem(it); }}
                                title="Cancel this item"
                                className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-smooth"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </li>
                          );
                        })}
                      </ul>

                      {activeIts.length > 0 && (
                        <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {preparedCount}/{activeIts.length} items sent
                        </p>
                      )}

                      {o.notes && (
                        <p className="mt-3 rounded-lg bg-secondary p-2 text-xs italic text-muted-foreground">"{o.notes}"</p>
                      )}

                      <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3 text-sm">
                        <span className="font-semibold">{formatINR(withTax(Number(o.total)))}</span>
                        <CurrentBadge s={o.status} />
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {o.status === "pending" && (
                          <Button size="sm" variant="hero" className="col-span-2" onClick={() => setStatus(o.id, "preparing")}>
                            Start Preparing
                          </Button>
                        )}
                        {(o.status === "preparing" || o.status === ("ready" as any)) && (
                          <Button size="sm" variant="hero" className="col-span-2" onClick={() => setStatus(o.id, "served")}>
                            {allPrepared ? "✓ All sent — Mark Served" : "Mark Served"}
                          </Button>
                        )}
                        <KitchenAddItemDialog orderId={o.id} onAdded={load} />
                        <Button size="sm" variant={o.is_rush ? "destructive" : "outline"} onClick={() => toggleRush(o.id, !!o.is_rush)}>
                          <Flame className="h-3.5 w-3.5" /> {o.is_rush ? "Un-rush" : "Rush"}
                        </Button>
                      </div>
                    </>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Sticky footer: sign out ── */}
      <footer className="fixed bottom-0 left-0 right-0 z-30 glass border-t border-border/50 px-4 py-2 flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            if (!confirm("Sign out of Kitchen?")) return;
            await supabase.auth.signOut();
            window.location.href = "/admin";
          }}
        >
          <LogOut className="h-3.5 w-3.5 mr-1" /> Sign out
        </Button>
      </footer>

    </main>
  );
};

// ── Small reusable components ──────────────────────────────────────────────

const FilterChip = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-bold transition-smooth ${
      active ? "bg-gradient-primary text-primary-foreground shadow-soft" : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
    }`}
  >
    {label}
  </button>
);

const ViewBtn = ({ active, onClick, icon: Icon, label }: any) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-smooth ${
      active ? "bg-card shadow-soft" : "text-muted-foreground"
    }`}
  >
    <Icon className="h-3.5 w-3.5" /> {label}
  </button>
);

const CurrentBadge = ({ s }: { s: string }) => {
  const display = s === "ready" ? "preparing" : s;
  const m: Record<string, string> = {
    pending: "bg-secondary text-foreground",
    preparing: "bg-gold/25 text-gold-foreground",
    served: "bg-primary text-primary-foreground",
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${m[display] || "bg-secondary"}`}>
      {display}
    </span>
  );
};

const PendingVerificationPanel = ({ orders, onVerified }: { orders: any[]; onVerified: () => void }) => (
  <div className="mb-6 rounded-2xl border-2 border-dashed border-gold bg-gold/5 p-4 shadow-soft">
    <div className="mb-3 flex items-center gap-2">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-gold text-gold-foreground">🔐</span>
      <div>
        <h2 className="font-display text-lg font-bold">Awaiting OTP verification</h2>
        <p className="text-xs text-muted-foreground">
          Ask the customer for their 4-digit code, then enter it to release the order to the kitchen.
        </p>
      </div>
    </div>
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {orders.map((o) => (
        <VerifyCard key={o.id} order={o} onVerified={onVerified} />
      ))}
    </div>
  </div>
);

const VerifyCard = ({ order, onVerified }: { order: any; onVerified: () => void }) => {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    if (code.length !== 4) { setError("Enter the 4-digit code"); return; }
    setBusy(true); setError(null);
    const { data, error: rpcErr } = await supabase.rpc("verify_order_otp", {
      _order_id: order.id, _code: code,
    });
    setBusy(false);
    if (rpcErr) { setError(rpcErr.message); return; }
    if (data === true) {
      toast.success(`✓ Table ${order.table_number} verified`);
      setCode("");
      onVerified();
    } else {
      setError("Wrong code — please try again");
    }
  };

  return (
    <form onSubmit={submit} className="rounded-xl bg-card p-3 shadow-soft">
      <div className="flex items-baseline justify-between">
        <p className="font-display text-lg font-bold">Table {order.table_number}</p>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">#{order.id.slice(0, 8)}</p>
      </div>
      {order.customer_name && (
        <p className="text-xs text-muted-foreground">
          {order.customer_name} • {formatINR(withTax(Number(order.total)))}
        </p>
      )}
      <div className="mt-2 flex items-stretch gap-2">
        <input
          inputMode="numeric"
          pattern="\d{4}"
          maxLength={4}
          value={code}
          onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 4)); if (error) setError(null); }}
          placeholder="• • • •"
          className="h-10 w-full rounded-lg border border-border bg-background px-3 text-center font-display text-lg font-bold tracking-[0.4em] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          autoComplete="off"
        />
        <Button type="submit" size="sm" variant="hero" disabled={busy || code.length !== 4}>
          {busy ? "…" : "Verify"}
        </Button>
      </div>
      {error && <p className="mt-1.5 text-[11px] font-semibold text-destructive">{error}</p>}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="mt-2 w-full"
        disabled={busy}
        onClick={async () => {
          if (!confirm(`Cancel pending order for Table ${order.table_number}?`)) return;
          setBusy(true);
          const { error: rpcErr } = await supabase.rpc("cancel_order", { _order_id: order.id });
          setBusy(false);
          if (rpcErr) toast.error(rpcErr.message);
          else { toast.success("Order cancelled"); onVerified(); }
        }}
      >
        <X className="h-3.5 w-3.5" /> Cancel order
      </Button>
    </form>
  );
};

export default Kitchen;