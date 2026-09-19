import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Copy, Download, Palette, RefreshCw, Share2, Box } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Anotacion, EditorAnotaciones } from "@/components/EditorAnotaciones";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { colorizarPlanoProyecto, generarPlano3D, guardarAnotaciones } from "@/lib/plano2d.functions";
import { generarVideo, publicarTour } from "@/lib/proyectos.functions";

export const Route = createFileRoute("/_authenticated/app/proyecto/$id")({
  head: () => ({ meta: [{ title: "Proyecto · Habitour" }] }),
  component: DetalleProyecto,
});

type Proyecto = {
  id: string;
  nombre: string;
  tipo: "video" | "tour3d" | "plano2d";
  estado: "subiendo" | "procesando" | "listo" | "error";
  url_resultado: string | null;
  plano_colorizado_url: string | null;
  plano_3d_url: string | null;
  anotaciones: Anotacion[] | null;
  error_mensaje: string | null;
  creado_en: string;
};

function DetalleProyecto() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [reintentando, setReintentando] = useState(false);
  const [anotaciones, setAnotaciones] = useState<Anotacion[]>([]);
  const [anotacionesCargadas, setAnotacionesCargadas] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [generandoExtra, setGenerandoExtra] = useState<"colorizar" | "3d" | "pdf" | "png" | null>(null);

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

  useEffect(() => {
    if (p && !anotacionesCargadas) {
      setAnotaciones(p.anotaciones ?? []);
      setAnotacionesCargadas(true);
    }
  }, [p, anotacionesCargadas]);

  async function reintentar() {
    if (!p) return;
    setReintentando(true);
    try {
      if (p.tipo === "video") await generarVideo({ data: { project_id: p.id } });
      else if (p.tipo === "tour3d") await publicarTour({ data: { project_id: p.id } });
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

  async function guardarAnotacionesAhora() {
    if (!p) return;
    setGuardando(true);
    try {
      await guardarAnotaciones({ data: { project_id: p.id, anotaciones } });
      toast.success("Anotaciones guardadas.");
    } catch {
      toast.error("No hemos podido guardar las anotaciones.");
    } finally {
      setGuardando(false);
    }
  }

  async function colorizar() {
    if (!p) return;
    setGenerandoExtra("colorizar");
    try {
      await colorizarPlanoProyecto({ data: { project_id: p.id } });
      toast.success("Versión coloreada lista.");
      qc.invalidateQueries({ queryKey: ["project", id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No hemos podido colorear el plano.");
    } finally {
      setGenerandoExtra(null);
    }
  }

  async function vista3D() {
    if (!p) return;
    setGenerandoExtra("3d");
    try {
      await generarPlano3D({ data: { project_id: p.id } });
      toast.success("Vista 3D lista.");
      qc.invalidateQueries({ queryKey: ["project", id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No hemos podido generar la vista 3D.");
    } finally {
      setGenerandoExtra(null);
    }
  }

  async function descargarPNG() {
    setGenerandoExtra("png");
    try {
      const nodo = document.getElementById("plano-lienzo");
      if (!nodo) throw new Error("No encontramos el plano.");
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(nodo, { pixelRatio: 2 });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${p?.nombre ?? "plano"}.png`;
      a.click();
    } catch {
      toast.error("No hemos podido exportar el PNG.");
    } finally {
      setGenerandoExtra(null);
    }
  }

  async function descargarPDF() {
    setGenerandoExtra("pdf");
    try {
      const nodo = document.getElementById("plano-lienzo");
      if (!nodo) throw new Error("No encontramos el plano.");
      const { toPng } = await import("html-to-image");
      const { jsPDF } = await import("jspdf");
      const dataUrl = await toPng(nodo, { pixelRatio: 2 });
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("No se pudo procesar la imagen."));
        img.src = dataUrl;
      });
      const orientacion = img.width >= img.height ? "landscape" : "portrait";
      const pdf = new jsPDF({ orientation: orientacion, unit: "px", format: [img.width, img.height] });
      pdf.addImage(dataUrl, "PNG", 0, 0, img.width, img.height);
      pdf.save(`${p?.nombre ?? "plano"}.pdf`);
    } catch {
      toast.error("No hemos podido exportar el PDF.");
    } finally {
      setGenerandoExtra(null);
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
            {p.tipo === "video" ? "Vídeo cinematográfico" : p.tipo === "tour3d" ? "Tour 3D interactivo" : "Plano 2D profesional"}{" "}
            · {new Date(p.creado_en).toLocaleDateString("es-ES")}
          </p>
        </div>
      </div>

      {p.tipo === "plano2d" ? (
        <PlanoDetalle
          p={p}
          anotaciones={anotaciones}
          onAnotacionesCambiar={setAnotaciones}
          guardando={guardando}
          onGuardar={guardarAnotacionesAhora}
          generandoExtra={generandoExtra}
          onColorizar={colorizar}
          onVista3D={vista3D}
          onDescargarPNG={descargarPNG}
          onDescargarPDF={descargarPDF}
          onReintentar={reintentar}
          reintentando={reintentando}
        />
      ) : (
        <>
          <div className="surface-card mt-6 overflow-hidden">
            {p.estado === "listo" && p.url_resultado ? (
              p.tipo === "video" ? (
                <ReproductorSecuencial urls={listaClips(p.url_resultado)} />
              ) : p.url_resultado.toLowerCase().endsWith(".glb") ? (
                <VisorModelo url={p.url_resultado} />
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
                <a href={listaClips(p.url_resultado)[0]} download target="_blank" rel="noreferrer">
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
        </>
      )}
    </div>
  );
}

function PlanoDetalle({
  p,
  anotaciones,
  onAnotacionesCambiar,
  guardando,
  onGuardar,
  generandoExtra,
  onColorizar,
  onVista3D,
  onDescargarPNG,
  onDescargarPDF,
  onReintentar,
  reintentando,
}: {
  p: Proyecto;
  anotaciones: Anotacion[];
  onAnotacionesCambiar: (a: Anotacion[]) => void;
  guardando: boolean;
  onGuardar: () => void;
  generandoExtra: "colorizar" | "3d" | "pdf" | "png" | null;
  onColorizar: () => void;
  onVista3D: () => void;
  onDescargarPNG: () => void;
  onDescargarPDF: () => void;
  onReintentar: () => void;
  reintentando: boolean;
}) {
  if (p.estado === "error") {
    return (
      <div className="surface-card mt-6 p-8 text-center">
        <p className="text-lg">No se ha podido generar</p>
        <p className="mt-2 text-sm text-muted-foreground">{p.error_mensaje}</p>
        <Button variant="clay" className="mt-6" onClick={onReintentar} disabled={reintentando}>
          <RefreshCw className={`h-4 w-4 ${reintentando ? "animate-spin" : ""}`} />
          {reintentando ? "Reintentando…" : "Reintentar"}
        </Button>
      </div>
    );
  }

  if (p.estado !== "listo" || !p.url_resultado) {
    return (
      <div className="surface-card mt-6 p-8 text-center">
        <div className="mx-auto h-2 w-48 overflow-hidden rounded-full bg-secondary">
          <div className="h-full w-2/3 animate-pulse bg-clay" />
        </div>
        <p className="mt-4 text-lg">{p.estado === "subiendo" ? "Subiendo imagen…" : "Generando el plano…"}</p>
        <p className="mt-1 text-sm text-muted-foreground">Suele tardar entre 20 y 60 segundos.</p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="surface-card p-4">
        <EditorAnotaciones urlImagen={p.url_resultado} anotaciones={anotaciones} onCambiar={onAnotacionesCambiar} />
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="clay" onClick={onGuardar} disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar anotaciones"}
          </Button>
          <Button variant="soft" onClick={onDescargarPNG} disabled={generandoExtra === "png"}>
            <Download className="h-4 w-4" /> {generandoExtra === "png" ? "Exportando…" : "Descargar PNG"}
          </Button>
          <Button variant="soft" onClick={onDescargarPDF} disabled={generandoExtra === "pdf"}>
            <Download className="h-4 w-4" /> {generandoExtra === "pdf" ? "Exportando…" : "Descargar PDF"}
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="surface-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">Versión coloreada</p>
            <Palette className="h-4 w-4 text-clay" />
          </div>
          {p.plano_colorizado_url ? (
            <img src={p.plano_colorizado_url} alt="Plano coloreado" className="w-full rounded-lg" />
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-lg bg-secondary">
              <Button variant="outline" onClick={onColorizar} disabled={generandoExtra === "colorizar"}>
                {generandoExtra === "colorizar" ? "Coloreando…" : "Generar versión coloreada"}
              </Button>
            </div>
          )}
        </div>
        <div className="surface-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">Vista 3D (dollhouse)</p>
            <Box className="h-4 w-4 text-clay" />
          </div>
          {p.plano_3d_url ? (
            <img src={p.plano_3d_url} alt="Vista 3D del plano" className="w-full rounded-lg" />
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-lg bg-secondary">
              <Button variant="outline" onClick={onVista3D} disabled={generandoExtra === "3d"}>
                {generandoExtra === "3d" ? "Generando…" : "Generar vista 3D"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** url_resultado puede ser una URL o un JSON con varias URLs de clips. */
function listaClips(valor: string): string[] {
  if (valor.trim().startsWith("[")) {
    try {
      const arr = JSON.parse(valor) as unknown;
      if (Array.isArray(arr)) return arr.filter((x): x is string => typeof x === "string");
    } catch {
      /* cae al caso simple */
    }
  }
  return [valor];
}

/** Reproduce varios clips uno detrás de otro como si fueran un único vídeo. */
function ReproductorSecuencial({ urls }: { urls: string[] }) {
  const [i, setI] = useState(0);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    ref.current?.play().catch(() => {});
  }, [i]);

  return (
    <div className="relative">
      <video
        ref={ref}
        key={urls[i]}
        src={urls[i]}
        controls
        autoPlay={i > 0}
        playsInline
        className="aspect-video w-full bg-black"
        onEnded={() => setI((n) => (n + 1 < urls.length ? n + 1 : 0))}
      />
      {urls.length > 1 && (
        <div className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
          Escena {i + 1} / {urls.length}
        </div>
      )}
    </div>
  );
}

function VisorModelo({ url }: { url: string }) {
  useEffect(() => {
    if (customElements.get("model-viewer")) return;
    const s = document.createElement("script");
    s.type = "module";
    s.src = "https://cdn.jsdelivr.net/npm/@google/model-viewer/dist/model-viewer.min.js";
    document.head.appendChild(s);
  }, []);
  // @ts-expect-error -- web component sin tipos
  return <model-viewer src={url} camera-controls auto-rotate style={{ width: "100%", aspectRatio: "16/9" }} />;
}
