import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { FolderOpen, LogOut, Plus, User } from "lucide-react";

import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppShell,
});

const NAV = [
  { to: "/app/nuevo", etiqueta: "Nuevo", icono: Plus },
  { to: "/app/proyectos", etiqueta: "Proyectos", icono: FolderOpen },
  { to: "/app/cuenta", etiqueta: "Cuenta", icono: User },
] as const;

function AppShell() {
  const navigate = useNavigate();

  async function salir() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen bg-sand pb-20 md:pb-0">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "bg-secondary text-foreground" }}
              >
                {n.etiqueta}
              </Link>
            ))}
            <button
              onClick={salir}
              className="ml-2 inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" /> Salir
            </button>
          </nav>
          <button onClick={salir} className="text-muted-foreground md:hidden" aria-label="Salir">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-8">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-border bg-background md:hidden">
        {NAV.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className="flex flex-col items-center gap-1 py-3 text-xs text-muted-foreground"
            activeProps={{ className: "text-clay" }}
          >
            <n.icono className="h-5 w-5" />
            {n.etiqueta}
          </Link>
        ))}
      </nav>
    </div>
  );
}
