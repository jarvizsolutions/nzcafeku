import { Link } from "react-router-dom";
import logo from "@/assets/logo.webp";

export const BrandMark = ({ className = "" }: { className?: string }) => (
  <Link to="/" className={`inline-flex items-center gap-2 ${className}`}>
    <img
      src={logo}
      alt="Five Star Chicken"
      className="h-9 w-9 rounded-full object-cover shadow-elegant"
    />
    <span className="leading-tight">
      <span className="block font-display text-base font-bold text-foreground">Five Star Chicken</span>
      <span className="block text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Good Home Place</span>
    </span>
  </Link>
);
