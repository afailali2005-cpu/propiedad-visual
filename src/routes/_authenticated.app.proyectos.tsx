import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Camera, MapIcon, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/proyectos")({
  head: () => ({ meta: [{ title: "Mis proyectos · Habitour" }] }),
  component: MisProyectos,
});

type Proyecto = {
  id: string;
  nombre: string;
  tipo: "video" | "tour3d" | "plano2d";
  estado: "subiendo" | "procesando" | "listo" | "error";
  miniatura_url: string | null;
  creado_en: string;
};

const ESTADO: Record<Proyecto["estado"], { etiqueta: string; clase: string }> = {
  subiendo: { etiqueta: "Subiendo", clase: "bg-secondary text-secondary-foreground" },
  procesando: { etiqueta: "Procesando", clase: "bg-clay/15 text-clay" },
  listo: { etiqueta: "Listo", clase: "bg-forest/10 text-forest" },
  error: { etiqueta: "Error", clase: "bg-destructive/10 text-destructive" },
};

const TIPO_LABEL: Record<Proyecto["tipo"], string> = {
  video: "Vídeo",
  tour3d: "Tour 3D",
  plano2d: "Plano 2D",
};

const FILTROS = [
  { id: "todos", etiqueta: "Todos" },
  { id: "video", etiqueta: "Vídeos" },
  { id: "tour3d", etiqueta: "Tours 3D" },
  { id: "plano2d", etiqueta: "Planos 2D" },
] as const;

function MisProyectos() {
  const { user } = useAuth();
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["id"]>("todos");
  const [borrando, setBorrando] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["projects", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, nombre, tipo, estado, miniatura_url, creado_en")
        .order("creado_en", { ascending: false });
      if (error) throw error;
      return data as Proyecto[];
    },
  });

  async function eliminar(id: string, nombre: string) {
    if (!window.confirm(`¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`)) return;
    setBorrando(id);
    const { error } = await supabase.from("projects").delete().eq("id", id);
    setBorrando(null);
    if (error) {
      toast.error("No hemos podido eliminar el proyecto.");
      return;
    }
    toast.success("Proyecto eliminado.");
    refetch();
  }

  const lista = (data ?? []).filter((p) => filtro === "todos" || p.tipo === filtro);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">Mis proyectos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Todo lo que has generado, ordenado por fecha.
          </p>
        </div>
        <Button asChild variant="clay">
          <Link to="/app/nuevo">
            <Plus className="h-4 w-4" /> Nuevo proyecto
          </Link>
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            className={`rounded-full px-3 py-1.5 text-sm ${
              filtro === f.id
                ? "bg-forest text-forest-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-border"
            }`}
          >
            {f.etiqueta}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="mt-10 text-sm text-muted-foreground">Cargando…</p>
      ) : lista.length === 0 ? (
        <div className="surface-card mt-8 p-10 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-clay" />
          <h2 className="mt-4 text-xl">Aún no tienes proyectos</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sube las fotos de un anuncio o el escaneo de una propiedad y genera tu primer resultado.
          </p>
          <Button asChild variant="clay" className="mt-6">
            <Link to="/app/nuevo">Crear tu primer proyecto</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((p) => (
            <div key={p.id} className="surface-card relative overflow-hidden transition hover:shadow-lift">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  eliminar(p.id, p.nombre);
                }}
                disabled={borrando === p.id}
                aria-label={`Eliminar ${p.nombre}`}
                className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-destructive disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <Link to="/app/proyecto/$id" params={{ id: p.id }} className="block">
                <div className="flex aspect-video items-center justify-center bg-secondary">
                  {p.miniatura_url ? (
                    <img src={p.miniatura_url} alt="" className="h-full w-full object-cover" />
                  ) : p.tipo === "video" ? (
                    <Camera className="h-8 w-8 text-muted-foreground" />
                  ) : p.tipo === "plano2d" ? (
                    <MapIcon className="h-8 w-8 text-muted-foreground" />
                  ) : (
                    <Sparkles className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-medium">{p.nombre}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${ESTADO[p.estado].clase}`}>
                      {ESTADO[p.estado].etiqueta}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {TIPO_LABEL[p.tipo]} ·{" "}
                    {new Date(p.creado_en).toLocaleDateString("es-ES", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
