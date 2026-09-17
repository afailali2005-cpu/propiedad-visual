import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { LIMITES, NOMBRE_PLAN, type PlanId } from "@/lib/planes";

export const Route = createFileRoute("/_authenticated/app/cuenta")({
  head: () => ({ meta: [{ title: "Cuenta · Habitour" }] }),
  component: Cuenta,
});

// TODO: sustituir por el enlace real de Stripe Checkout / Customer Portal.
const STRIPE_CHECKOUT_URL = "#";

type Perfil = {
  nombre: string | null;
  plan: PlanId;
  videos_usados_mes: number;
  tours_usados_mes: number;
  periodo_inicio: string;
};

function Cuenta() {
  const { user } = useAuth();

  const { data: perfil, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("nombre, plan, videos_usados_mes, tours_usados_mes, periodo_inicio")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data as Perfil;
    },
  });

  if (isLoading || !perfil) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  const limite = LIMITES[perfil.plan] ?? LIMITES.free;
  const renovacion = new Date(perfil.periodo_inicio);
  renovacion.setMonth(renovacion.getMonth() + 1);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl">Cuenta</h1>

      <div className="surface-card mt-8 p-6">
        <p className="text-sm text-muted-foreground">Sesión iniciada como</p>
        <p className="mt-1 font-medium">{perfil.nombre ?? user?.email}</p>
        <p className="text-sm text-muted-foreground">{user?.email}</p>
      </div>

      <div className="surface-card mt-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Plan actual</p>
            <p className="mt-1 font-display text-2xl">{NOMBRE_PLAN[perfil.plan]}</p>
            <p className="text-xs text-muted-foreground">
              Se renueva el {renovacion.toLocaleDateString("es-ES")}
            </p>
          </div>
          <Button asChild variant="clay">
            <a href={STRIPE_CHECKOUT_URL}>Cambiar de plan</a>
          </Button>
        </div>

        <div className="mt-6 space-y-5">
          <Uso etiqueta="Vídeos este mes" usados={perfil.videos_usados_mes} max={limite.videos} />
          <Uso etiqueta="Tours 3D este mes" usados={perfil.tours_usados_mes} max={limite.tours} />
        </div>
      </div>
    </div>
  );
}

function Uso({ etiqueta, usados, max }: { etiqueta: string; usados: number; max: number }) {
  const pct = max === 0 ? 0 : Math.min(100, Math.round((usados / max) * 100));
  const agotado = usados >= max;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span>{etiqueta}</span>
        <span className={agotado ? "text-destructive" : "text-muted-foreground"}>
          {usados} de {max}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full transition-all ${agotado ? "bg-destructive" : "bg-clay"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
