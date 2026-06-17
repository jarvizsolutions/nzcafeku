import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, QrCode, Sparkles } from "lucide-react";
import heroImg from "@/assets/hero-chicken.jpg";
import { BrandMark } from "@/components/BrandMark";

const Landing = () => {
  return (
    <main className="relative overflow-hidden bg-background" style={{ height: "100dvh" }}>
      {/* Hero image */}
      <div className="absolute inset-0">
        <img
          src={heroImg}
          alt="Five Star Chicken signature crispy bucket and tandoori"
          className="h-full w-full object-cover object-center"
          width={1920}
          height={1080}
        />
        {/* Layered overlays for depth + readable text on any screen size */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/55 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div
        className="relative z-10 mx-auto flex w-full max-w-md flex-col px-5 pb-10 pt-6 sm:max-w-lg sm:px-8 sm:pb-14 sm:pt-10"
        style={{ height: "100dvh" }}
      >
        <header className="flex items-center justify-between">
          <div className="glass rounded-full px-3 py-2 shadow-soft">
            <BrandMark />
          </div>
          <Link to="/admin" className="text-xs font-medium text-white/80 hover:text-white transition-smooth">
            Staff
          </Link>
        </header>

        <div className="mt-auto animate-fade-in-up space-y-6 text-white">
          <span className="inline-flex items-center gap-2 rounded-full bg-gold/95 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-gold-foreground shadow-gold">
            <Sparkles className="h-3.5 w-3.5" />
            Famous since day one
          </span>
          <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight text-balance text-white sm:text-6xl">
            Crispy. Smoky.<br />
            <span className="bg-gradient-to-r from-yellow-400 to-amber-600 bg-clip-text text-transparent">
              Unforgettable.
            </span>
          </h1>
          <p className="max-w-sm text-base text-white/85 text-balance sm:text-lg">
            Scan, order, and track your meal — straight from your seat. No queues, no waiting.
          </p>
          <div className="space-y-3 pt-2">
            <Button asChild variant="gold" size="xl" className="w-full">
              <Link to="/menu?table=1">
                Grab Your Meal <ArrowRight />
              </Link>
            </Button>
            <p className="flex items-center justify-center gap-2 text-xs text-white/70">
              <QrCode className="h-3.5 w-3.5" />
              Or scan the QR code on your table
            </p>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Landing;
