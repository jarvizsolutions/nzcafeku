import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bell, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Announcement = { id: string; title: string; message: string; image_url: string | null; is_active: boolean; created_at: string };

export const AnnouncementsBell = () => {
  const [list, setList] = useState<Announcement[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("announcements").select("*")
        .eq("is_active", true).order("sort_order").order("created_at", { ascending: false });
      setList((data as Announcement[]) || []);
    };
    load();
    const ch = supabase.channel("ann-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const hasActive = list.length > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => hasActive && setOpen(true)}
        title={hasActive ? "View announcements" : "No announcements"}
        className={`relative grid h-10 w-10 place-items-center rounded-full transition-smooth tap-scale ${
          hasActive
            ? "bg-gradient-gold text-gold-foreground shadow-gold animate-pulse"
            : "bg-secondary text-muted-foreground"
        }`}
      >
        <Bell className="h-4 w-4" />
        {hasActive && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
            {list.length}
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-gold-foreground" /> Announcements</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {list.map((a) => (
              <article key={a.id} className="rounded-2xl border border-border bg-secondary/30 p-3">
                {a.image_url && (
                  <div className="mb-3 overflow-hidden rounded-xl">
                    <img src={a.image_url} alt={a.title} className="h-32 w-full object-cover" />
                  </div>
                )}
                <h3 className="font-display text-base font-bold">{a.title}</h3>
                <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{a.message}</p>
              </article>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
