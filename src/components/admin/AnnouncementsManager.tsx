import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Edit, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImageUploadField } from "./ImageUploadField";

type Announcement = {
  id: string; title: string; message: string; image_url: string | null;
  is_active: boolean; sort_order: number;
};

export const AnnouncementsManager = () => {
  const [list, setList] = useState<Announcement[]>([]);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("announcements").select("*").order("sort_order").order("created_at", { ascending: false });
    setList((data as Announcement[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const toggleActive = async (a: Announcement) => {
    const { error } = await supabase.from("announcements").update({ is_active: !a.is_active }).eq("id", a.id);
    if (error) toast.error(error.message); else load();
  };

  const remove = async (a: Announcement) => {
    if (!confirm(`Delete "${a.title}"?`)) return;
    const { error } = await supabase.from("announcements").delete().eq("id", a.id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); load(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold">Announcements</h2>
          <p className="text-xs text-muted-foreground">Notices customers see via the bell icon on the menu page.</p>
        </div>
        <Button variant="hero" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New Announcement</Button>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : list.length === 0 ? (
        <p className="rounded-2xl bg-card p-10 text-center text-sm text-muted-foreground shadow-soft">No announcements yet.</p>
      ) : (
        <div className="space-y-2">
          {list.map((a) => (
            <article key={a.id} className={`flex gap-3 rounded-2xl bg-card p-3 shadow-soft ${!a.is_active ? "opacity-60" : ""}`}>
              <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-secondary">
                {a.image_url ? <img src={a.image_url} alt={a.title} className="h-full w-full object-cover" /> : <Megaphone className="h-5 w-5 text-muted-foreground" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{a.title}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">{a.message}</p>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={a.is_active} onCheckedChange={() => toggleActive(a)} />
                <Button size="icon" variant="ghost" onClick={() => setEditing(a)}><Edit className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => remove(a)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Editor open={creating || !!editing} ann={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSaved={() => { setCreating(false); setEditing(null); load(); }} />
    </div>
  );
};

const Editor = ({ open, ann, onClose, onSaved }: { open: boolean; ann: Announcement | null; onClose: () => void; onSaved: () => void }) => {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (ann) { setTitle(ann.title); setMessage(ann.message); setImageUrl(ann.image_url || ""); setIsActive(ann.is_active); }
    else { setTitle(""); setMessage(""); setImageUrl(""); setIsActive(true); }
  }, [open, ann]);

  const save = async () => {
    if (!title.trim() || !message.trim()) { toast.error("Title and message are required"); return; }
    setBusy(true);
    const payload = { title: title.trim(), message: message.trim(), image_url: imageUrl || null, is_active: isActive };
    const { error } = ann
      ? await supabase.from("announcements").update(payload).eq("id", ann.id)
      : await supabase.from("announcements").insert(payload);
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success(ann ? "Updated" : "Created"); onSaved(); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>{ann ? "Edit Announcement" : "New Announcement"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <ImageUploadField value={imageUrl} onChange={setImageUrl} folder="announcements" label="Banner image (optional)" />
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
          </label>
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Message</span>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4}
              className="mt-1 w-full resize-none rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
          </label>
          <label className="flex items-center gap-2 text-sm"><Switch checked={isActive} onCheckedChange={setIsActive} /> Active</label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="hero" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
