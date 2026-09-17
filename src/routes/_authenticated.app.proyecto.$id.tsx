import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Copy, Download, RefreshCw, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { generarVideo, publicarTour } from "@/lib/proyectos.functions";

export const Route = createFileRoute("/_authenticated/app/proyecto/$id")({
  head: () => ({ meta: [{ title: "Proyecto · Habitour" }] }),
  component: DetalleProyecto,
});

type Proyecto = {
  id: string;
  nombre: string;
  tipo: "video" | "tour3d";
  estado: "subiendo" | "procesando" | "listo" | "error";
  url_resultado: string | null;
  error_mensaje: string | null;
  creado_en: string;
};

function DetalleProyecto() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [reintentando, setReintentando] = useState(false);

  const { data: p, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", id).single();
      if (error) throw error;
      return data as Proyecto;
    },
    refetchInterval: (q) => {
      const estado = q.state.data?.estado;
      return estado === "procesando" || estado === "subiendo" ? 5000 : false;
    },
  });

  async function reintentar() {
    if (!p) return;
    setReintentando(true);
    try {
      if (p.tipo === "video") await generarVideo({ data: { project_id: p.id } });
      else await publicarTour({ data: { project_id: p.id } });
      toast.success("Listo.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se ha podido reintentar.");
    } finally {
      setReintentando(false);
      qc.invalidateQueries({ queryKey: ["project", id] });
    }
  }

  async function copiar() {
    if (!p?.url_resultado) return;
    await navigator.clipboard.writeText(p.url_resultado);
    toast.success("Enlace copiado.");
  }

  async function compartir() {
    if (!p?.url_resultado) return;
    if (navigator.share) {
      await navigator.share({ title: p.nombre, url: p.url_resultado }).catch(() => {});
    } else {
      await copiar();
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (!p) return <p className="text-sm text-muted-foreground">No encontramos este proyecto.</p>;

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/app/proyectos" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Mis proyectos
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl">{p.nombre}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {p.tipo === "video" ? "Vídeo cinematográfico" : "Tour 3D interactivo"} ·{" "}
            {new Date(p.creado_en).toLocaleDateString("es-ES")}
          </p>
        </div>
      </div>

      <div className="surface-card mt-6 overflow-hidden">
        {p.estado === "listo" && p.url_resultado ? (
          p.tipo === "video" ? (
            <video src={p.url_resultado} controls className="aspect-video w-full bg-black" />
          ) : (
            <iframe
              src={p.url_resultado}
              title={p.nombre}
              className="aspect-video w-full"
              allow="fullscreen; xr-spatial-tracking"
            />
          )
        ) : p.estado === "error" ? (
          <div className="p-8 text-center">
            <p className="text-lg">No se ha podido generar</p>
            <p className="mt-2 text-sm text-muted-foreground">{p.error_mensaje}</p>
            <Button variant="clay" className="mt-6" onClick={reintentar} disabled={reintentando}>
              <RefreshCw className={`h-4 w-4 ${reintentando ? "animate-spin" : ""}`} />
              {reintentando ? "Reintentando…" : "Reintentar"}
            </Button>
          </div>
        ) : (
          <div className="p-8 text-center">
            <div className="mx-auto h-2 w-48 overflow-hidden rounded-full bg-secondary">
              <div className="h-full w-2/3 animate-pulse bg-clay" />
            </div>
            <p className="mt-4 text-lg">
              {p.estado === "subiendo" ? "Subiendo archivos…" : "Procesando…"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Esto suele tardar unos minutos. Se actualizará solo.
            </p>
          </div>
        )}
      </div>

      {p.estado === "listo" && p.url_resultado && (
        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild variant="clay">
            <a href={p.url_resultado} download target="_blank" rel="noreferrer">
              <Download className="h-4 w-4" /> Descargar
            </a>
          </Button>
          <Button variant="soft" onClick={copiar}>
            <Copy className="h-4 w-4" /> Copiar enlace
          </Button>
          <Button variant="soft" onClick={compartir}>
            <Share2 className="h-4 w-4" /> Compartir
          </Button>
        </div>
      )}
    </div>
  );
}
