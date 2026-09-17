import { Link } from "@tanstack/react-router";

export function Logo({ claro = false }: { claro?: boolean }) {
  return (
    <Link to="/" className="inline-flex items-center gap-2">
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-lg font-display text-base ${
          claro ? "bg-clay text-clay-foreground" : "bg-forest text-forest-foreground"
        }`}
      >
        H
      </span>
      <span
        className={`font-display text-xl tracking-tight ${claro ? "text-forest-foreground" : "text-foreground"}`}
      >
        Habitour
      </span>
    </Link>
  );
}
