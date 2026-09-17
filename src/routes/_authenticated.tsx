import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { session, cargando } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!cargando && !session) navigate({ to: "/auth" });
  }, [cargando, session, navigate]);

  if (cargando || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sand">
        <p className="text-sm text-muted-foreground">Cargando…</p>
      </div>
    );
  }

  return <Outlet />;
}
