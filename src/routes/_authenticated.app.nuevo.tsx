import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Camera, Sparkles, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { generarVideo, publicarTour } from "@/lib/proyectos.functions";

export const Route = createFileRoute("/_authenticated/app/nuevo")({
  head: () => ({ meta: [{ title: "Nuevo proyecto · Habitour" }] }),
  component: NuevoProyecto,
});

type Tipo = "video" | "tour3d";
type Fase = "idle" | "subiendo" | "procesando" | "listo" | "error";

const ACEPTA: Record<Tipo, string> = {
  video: "image/jpeg,image/png,image/webp",
  tour3d: ".ply,.spz,.splat",
};

function NuevoProyecto() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const [tipo, setTipo] = useState<Tipo>("video");
  const [nombre, setNombre] = useState("");
  const [archivos, setArchivos] = useState<File[]>([]);
  const [fase, setFase] = useState<Fase>("idle");
  const [progreso, setProgreso] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function elegirTipo(t: Tipo) {
    setTipo(t);
    setArchivos([]);
  }

  function añadirArchivos(lista: FileList | null) {
    if (!lista) return;
    const nuevos = Array.from(lista);
    setArchivos(tipo === "tour3d" ? nuevos.slice(0, 1) : [...archivos, ...nuevos]);
  }

  function quitar(i: number) {
    setArchivos(archivos.filter((_, idx) => idx !== i));
  }

  async function generar() {
    if (!user) return;
    if (!nombre.trim()) {
      toast.error("Ponle un nombre a la propiedad.");
      return;
    }
    if (archivos.length === 0) {
      toast.error(tipo === "video" ? "Sube al menos una foto." : "Sube el archivo del escaneo.");
      return;
    }

    setFase("subiendo");
    setProgreso(0);
    setErrorMsg(null);

    try {
      const { data: proyecto, error: errInsert } = await supabase
        .from("projects")
        .insert({ user_id: user.id, nombre: nombre.trim(), tipo, estado: "subiendo" })
        .select("id")
        .single();
      if (errInsert || !proyecto) throw new Error("No hemos podido crear el proyecto.");

      const entradas: { path: string; nombre: string }[] = [];
      for (let i = 0; i < archivos.length; i++) {
        const f = archivos[i]!;
        const limpio = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${user.id}/${proyecto.id}/${Date.now()}_${limpio}`;
        const { error: errUp } = await supabase.storage.from("uploads").upload(path, f);
        if (errUp) throw new Error(`No hemos podido subir ${f.name}.`);
        entradas.push({ path, nombre: f.name });
        setProgreso(Math.round(((i + 1) / archivos.length) * 100));
      }

      await supabase.from("projects").update({ archivos_entrada: entradas }).eq("id", proyecto.id);

      setFase("procesando");
      if (tipo === "video") {
        await generarVideo({ data: { project_id: proyecto.id } });
      } else {
        await publicarTour({ data: { project_id: proyecto.id } });
      }

      setFase("listo");
      toast.success("Proyecto listo.");
      navigate({ to: "/app/proyecto/$id", params: { id: proyecto.id } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Algo ha fallado.";
      setFase("error");
      setErrorMsg(msg);
      toast.error(msg);
    }
  }

  const ocupado = fase === "subiendo" || fase === "procesando";

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl">Nuevo proyecto</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Elige el formato, sube el material y genera.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <TarjetaTipo
          activo={tipo === "video"}
          onClick={() => elegirTipo("video")}
          icono={Camera}
          titulo="Vídeo cinematográfico"
          texto="Sube las fotos del anuncio."
        />
        <TarjetaTipo
          activo={tipo === "tour3d"}
          onClick={() => elegirTipo("tour3d")}
          icono={Sparkles}
          titulo="Tour 3D interactivo"
          texto="Sube el escaneo del móvil (.ply, .spz o .splat)."
        />
      </div>

      <div className="mt-6">
        <Label htmlFor="nombre">Nombre de la propiedad</Label>
        <Input
          id="nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Piso en calle Mayor 12, 3º"
          className="mt-1.5"
          disabled={ocupado}
        />
      </div>

      <div
        className="surface-card mt-6 cursor-pointer border-dashed p-8 text-center"
        onClick={() => !ocupado && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!ocupado) añadirArchivos(e.dataTransfer.files);
        }}
      >
        <Upload className="mx-auto h-7 w-7 text-clay" />
        <p className="mt-3 text-sm">
          {tipo === "video"
            ? "Arrastra tus fotos aquí o haz clic para elegirlas"
            : "Arrastra tu archivo .ply / .spz / .splat o haz clic para elegirlo"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {tipo === "video" ? "JPG, PNG o WEBP · varias fotos" : "Un solo archivo · hasta 200 MB"}
        </p>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={ACEPTA[tipo]}
          multiple={tipo === "video"}
          onChange={(e) => añadirArchivos(e.target.files)}
        />
      </div>

      {archivos.length > 0 && (
        <ul className="mt-4 space-y-2">
          {archivos.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              <span className="truncate">{f.name}</span>
              {!ocupado && (
                <button onClick={() => quitar(i)} aria-label="Quitar" className="text-muted-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {fase !== "idle" && (
        <div className="mt-6">
          <div className="flex items-center justify-between text-sm">
            <span>
              {fase === "subiendo" && `Subiendo… ${progreso}%`}
              {fase === "procesando" && "Procesando…"}
              {fase === "listo" && "Listo"}
              {fase === "error" && "Error"}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className={`h-full transition-all ${fase === "error" ? "bg-destructive" : "bg-clay"}`}
              style={{
                width:
                  fase === "subiendo"
                    ? `${progreso * 0.6}%`
                    : fase === "procesando"
                      ? "85%"
                      : "100%",
              }}
            />
          </div>
          {errorMsg && <p className="mt-2 text-sm text-destructive">{errorMsg}</p>}
        </div>
      )}

      <Button
        variant="clay"
        size="xl"
        className="mt-8 w-full"
        onClick={generar}
        disabled={ocupado}
      >
        {ocupado ? "Generando…" : tipo === "video" ? "Generar vídeo" : "Publicar tour 3D"}
      </Button>
    </div>
  );
}

function TarjetaTipo({
  activo,
  onClick,
  icono: Icono,
  titulo,
  texto,
}: {
  activo: boolean;
  onClick: () => void;
  icono: typeof Camera;
  titulo: string;
  texto: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`surface-card p-5 text-left transition ${
        activo ? "ring-2 ring-clay" : "hover:border-clay/40"
      }`}
    >
      <Icono className="h-6 w-6 text-clay" />
      <p className="mt-3 font-display text-lg">{titulo}</p>
      <p className="mt-1 text-sm text-muted-foreground">{texto}</p>
    </button>
  );
}
