import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/BrandMark";
import { ArrowLeft, Utensils } from "lucide-react";

type TableRow = { id: string; table_number: number; label: string | null; is_active: boolean };

const SelectTable = () => {
  const navigate = useNavigate();
  const [tables, setTables] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("restaurant_tables")
        .select("id,table_number,label,is_active")
        .eq("is_active", true)
        .order("table_number", { ascending: true });
      setTables((data as TableRow[]) || []);
      setLoading(false);
    })();
  }, []);

  const pick = (n: number) => navigate(`/menu?table=${n}`);

  return (
    <main className="min-h-[100dvh] bg-background">
      <header className="flex items-center justify-between px-5 pt-5 sm:px-8">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <BrandMark />
        <span className="w-12" />
      </header>

      <section className="mx-auto max-w-2xl px-5 pb-16 pt-8 sm:px-8">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Pick your table
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tap the table number printed on your table to start ordering.
        </p>

        {loading ? (
          <div className="mt-8 grid grid-cols-3 gap-3 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : tables.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">No tables available right now.</p>
            <Button asChild variant="hero" className="mt-4">
              <Link to="/menu?table=1">Continue with Table 1</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-3 gap-3 sm:grid-cols-4">
            {tables.map((t) => (
              <button
                key={t.id}
                onClick={() => pick(t.table_number)}
                className="group flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-card shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
              >
                <Utensils className="h-5 w-5 text-primary opacity-80 group-hover:opacity-100" />
                <span className="font-display text-3xl font-bold leading-none">{t.table_number}</span>
                {t.label && (
                  <span className="px-2 text-[10px] uppercase tracking-wider text-muted-foreground line-clamp-1">
                    {t.label}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};

export default SelectTable;
