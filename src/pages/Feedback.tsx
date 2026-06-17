import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Star, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BrandMark } from "@/components/BrandMark";

const Feedback = () => {
  const { id } = useParams();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  const submit = async () => {
    if (!rating) { toast.error("Please rate your experience"); return; }
    const trimmedName = name.trim();
    if (!trimmedName) { toast.error("Please enter your name"); return; }
    setBusy(true);
    const tableNumber = Number(sessionStorage.getItem("fsc_table") || "0");
    const { error } = await supabase.from("feedback").insert({
      order_id: id || null,
      table_number: tableNumber,
      rating,
      comment: comment.trim() || null,
      customer_name: trimmedName.slice(0, 100),
    } as any);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Thank you for your feedback! ❤️");
    nav("/");
  };

  return (
    <main className="min-h-screen bg-gradient-warm">
      <header className="glass border-b border-border/50">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <Link to={-1 as any} className="grid h-10 w-10 place-items-center rounded-full bg-secondary tap-scale">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <BrandMark />
          <span className="w-10" />
        </div>
      </header>

      <section className="mx-auto max-w-md px-5 pt-8 animate-fade-in-up">
        <h1 className="font-display text-3xl font-bold">How was it?</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your feedback helps us serve better.</p>

        <div className="mt-8 flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(n)}
              className="tap-scale transition-bounce"
            >
              <Star
                className={`h-12 w-12 transition-bounce ${
                  (hover || rating) >= n ? "fill-gold text-gold drop-shadow-[0_4px_12px_hsl(var(--gold)/0.5)]" : "text-muted-foreground/40"
                }`}
              />
            </button>
          ))}
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          placeholder="Your name"
          className="mt-8 w-full rounded-2xl border border-border bg-card p-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={1000}
          placeholder="Tell us more (optional)"
          rows={4}
          className="mt-3 w-full resize-none rounded-2xl border border-border bg-card p-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />

        <Button onClick={submit} disabled={busy} variant="hero" size="lg" className="mt-4 w-full">
          {busy ? "Sending…" : "Submit Feedback"}
        </Button>
      </section>
    </main>
  );
};

export default Feedback;

