import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Image as ImageIcon, Upload, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const normalizeImageUrl = (raw: string): string => {
  const url = (raw || "").trim();
  if (!url) return url;
  const driveFile = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (driveFile) return `https://drive.google.com/uc?export=view&id=${driveFile[1]}`;
  const driveOpen = url.match(/drive\.google\.com\/open\?id=([^&]+)/);
  if (driveOpen) return `https://drive.google.com/uc?export=view&id=${driveOpen[1]}`;
  return url;
};

const isValidHttpUrl = (s: string) => {
  try { const u = new URL(s); return u.protocol === "http:" || u.protocol === "https:"; }
  catch { return false; }
};

/**
 * Reusable image input — supports both pasting a public URL and uploading a file (≤2MB)
 * to the public `menu-images` bucket. Calls onChange with the final public URL.
 */
export const ImageUploadField = ({
  value, onChange, label = "Image", folder = "menu",
}: {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  folder?: string;
}) => {
  const [url, setUrl] = useState(value || "");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const commitUrl = () => {
    const norm = normalizeImageUrl(url);
    if (!norm) { onChange(""); return; }
    if (!isValidHttpUrl(norm)) { toast.error("Enter a valid http(s) URL"); return; }
    onChange(norm);
    setUrl(norm);
    toast.success("Image URL set");
  };

  const onFile = async (file: File) => {
    if (!ALLOWED.includes(file.type)) {
      toast.error("Only JPG, PNG or WEBP allowed");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("File too large — max 2MB");
      return;
    }
    setBusy(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("menu-images").upload(path, file, {
        cacheControl: "3600", upsert: false, contentType: file.type,
      });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("menu-images").getPublicUrl(path);
      const publicUrl = data.publicUrl;
      setUrl(publicUrl);
      onChange(publicUrl);
      toast.success("Image uploaded");
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="flex items-start gap-3">
        <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-secondary">
          {value ? (
            <img src={value} alt="preview" className="h-full w-full object-cover" />
          ) : busy ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={commitUrl}
              placeholder="Paste public URL (Drive, Imgur…)"
              className="h-9 flex-1 rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
            />
            <Button type="button" size="sm" variant="outline" disabled={busy}
              onClick={() => fileRef.current?.click()}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {busy ? "Uploading…" : "Upload (≤2MB)"}
            </Button>
            {value && (
              <Button type="button" size="sm" variant="ghost"
                onClick={() => { setUrl(""); onChange(""); }}>
                Remove
              </Button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">JPG · PNG · WEBP — max 2 MB</p>
        </div>
      </div>
    </div>
  );
};
