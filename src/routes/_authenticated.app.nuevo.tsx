import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Camera, ChevronDown, ChevronUp, MapIcon, Plus, Sparkles, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { CAMARA_INICIAL, CameraEditor, type CameraValues } from "@/components/CameraEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { generarPlano } from "@/lib/plano2d.functions";
import { generarVideo, generarVideoConCamaras, publicarTour } from "@/lib/proyectos.functions";

export const Route = createFileRoute("/_authenticated/app/nuevo")({
  head: () => ({ meta: [{ title: "Nuevo proyecto · Habitour" }] }),
  component: NuevoProyecto,
});

type Tipo = "video" | "tour3d" | "plano2d";
type ModoVideo = "automatico" | "editor";
type Fase = "idle" | "subiendo" | "procesando" | "listo" | "error";

const ACEPTA: Record<Tipo, string> = {
  video: "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif",
  tour3d: ".ply,.sog,.ssog,.lcc,.glb",
  plano2d: "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif",
};

const TIPOS_COMPATIBLES = new Set(["image/jpeg", "image/png", "image/webp"]);

const SUPABASE_URL_BASE =
  (import.meta.env['VITE_SUPABASE_URL'] as string | undefined) ?? "";

async function subirResumable(
  file: File,
  bucketName: string,
  objectName: string,
  onProgreso: (pct: number) => void,
): Promise<void> {
  const tus = await import("tus-js-client");
  const { data: sesion } = await supabase.auth.getSession();
  const token = sesion.session?.access_token;
  if (!token) throw new Error("Tu sesión ha caducado. Vuelve a iniciar sesión.");

  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${SUPABASE_URL_BASE}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        Authorization: `Bearer ${token}`,
        "x-upsert": "true",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: 6 * 1024 * 1024,
      metadata: {
        bucketName,
        objectName,
        contentType: file.type || "application/octet-stream",
        cacheControl: "3600",
      },
      onError: (error) => reject(error instanceof Error ? error : new Error(String(error))),
      onProgress: (bytesUploaded, bytesTotal) => {
        if (bytesTotal > 0) onProgreso(Math.round((bytesUploaded / bytesTotal) * 100));
      },
      onSuccess: () => resolve(),
    });
    void upload.start();
  });
}
const EXTENSIONES_RAW = new Set(["arw", "cr2", "cr3", "nef", "dng", "raf", "orf", "rw2", "pef", "srw"]);
const MAXIMO_BYTES = 15 * 1024 * 1024;

/** Valida (y convierte HEIC si hace falta) una única foto. Devuelve null y avisa por toast si se rechaza. */
async function validarFoto(archivo: File): Promise<File | null> {
  const extension = archivo.name.toLowerCase().split(".").pop() ?? "";
  const esHeic =
    archivo.type === "image/heic" || archivo.type === "image/heif" || extension === "heic" || extension === "heif";

  if (archivo.size > MAXIMO_BYTES) {
    toast.error("La foto supera el límite de 15 MB.");
    return null;
  }

  if (esHeic) {
    const toastId = toast.loading("Convirtiendo…");
    try {
      const { default: heic2any } = await import("heic2any");
      const resultado = await heic2any({ blob: archivo, toType: "image/jpeg", quality: 0.9 });
      const blob = Array.isArray(resultado) ? resultado[0] : resultado;
      if (!blob) throw new Error("Conversión HEIC vacía.");
      const nombreJpeg = archivo.name.replace(/\.(heic|heif)$/i, ".jpg");
      return new File([blob], nombreJpeg, { type: "image/jpeg" });
    } catch {
      toast.error("No hemos podido convertir esta foto HEIC.");
      return null;
    } finally {
      toast.dismiss(toastId);
    }
  }

  if (!TIPOS_COMPATIBLES.has(archivo.type)) {
    toast.error(
      EXTENSIONES_RAW.has(extension)
        ? "Formato no compatible: usa JPG, PNG o WEBP. Exporta la foto a JPG antes de subirla."
        : "Formato no compatible: usa JPG, PNG o WEBP.",
    );
    return null;
  }
  return archivo;
}

function NuevoProyecto() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const inputEditorRef = useRef<HTMLInputElement>(null);
  const inputPlanoRef = useRef<HTMLInputElement>(null);
  const arrastrandoRef = useRef<number | null>(null);

  const [tipo, setTipo] = useState<Tipo>("video");
  const [modoVideo, setModoVideo] = useState<ModoVideo>("automatico");
  const [nombre, setNombre] = useState("");
  const [archivos, setArchivos] = useState<File[]>([]);
  const [archivoPlano, setArchivoPlano] = useState<File | null>(null);

  const [archivosEditor, setArchivosEditor] = useState<File[]>([]);
  const [camarasEditor, setCamarasEditor] = useState<CameraValues[]>([]);
  const [indiceActivo, setIndiceActivo] = useState(0);

  const [fase, setFase] = useState<Fase>("idle");
  const [progreso, setProgreso] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function reiniciarSelecciones() {
    setArchivos([]);
    setArchivoPlano(null);
    setArchivosEditor([]);
    setCamarasEditor([]);
    setIndiceActivo(0);
  }

  function elegirTipo(t: Tipo) {
    setTipo(t);
    setModoVideo("automatico");
    reiniciarSelecciones();
  }

  function elegirModoVideo(m: ModoVideo) {
    setModoVideo(m);
    reiniciarSelecciones();
  }

  async function añadirArchivos(lista: FileList | null) {
    if (!lista) return;
    const nuevos = Array.from(lista);
    if (tipo === "tour3d") {
      setArchivos(nuevos.slice(0, 1));
      return;
    }
    const compatibles: File[] = [];
    for (const archivo of nuevos) {
      const ok = await validarFoto(archivo);
      if (ok) compatibles.push(ok);
    }
    setArchivos((actuales) => [...actuales, ...compatibles]);
  }

  async function elegirArchivoPlano(lista: FileList | null) {
    if (!lista || lista.length === 0) return;
    const ok = await validarFoto(lista[0]!);
    if (ok) setArchivoPlano(ok);
  }

  async function añadirArchivosEditor(lista: FileList | null) {
    if (!lista) return;
    const nuevos = Array.from(lista);
    const compatibles: File[] = [];
    for (const archivo of nuevos) {
      const ok = await validarFoto(archivo);
      if (ok) compatibles.push(ok);
    }
    if (compatibles.length === 0) return;
    setArchivosEditor((actuales) => [...actuales, ...compatibles]);
    setCamarasEditor((actuales) => [...actuales, ...compatibles.map(() => ({ ...CAMARA_INICIAL }))]);
  }

  function quitar(i: number) {
    setArchivos((actuales) => actuales.filter((_, idx) => idx !== i));
  }

  function mover(desde: number, hasta: number) {
    setArchivos((actuales) => {
      if (desde === hasta || desde < 0 || hasta < 0 || desde >= actuales.length || hasta >= actuales.length) {
        return actuales;
      }
      const reordenados = [...actuales];
      const [archivo] = reordenados.splice(desde, 1);
      if (!archivo) return actuales;
      reordenados.splice(hasta, 0, archivo);
      return reordenados;
    });
  }

  function quitarEditor(i: number) {
    setArchivosEditor((actuales) => actuales.filter((_, idx) => idx !== i));
    setCamarasEditor((actuales) => actuales.filter((_, idx) => idx !== i));
    setIndiceActivo((actual) => Math.max(0, Math.min(actual, archivosEditor.length - 2)));
  }

  function moverEditor(desde: number, hasta: number) {
    if (desde === hasta || desde < 0 || hasta < 0 || desde >= archivosEditor.length || hasta >= archivosEditor.length) {
      return;
    }
    setArchivosEditor((actuales) => {
      const r = [...actuales];
      const [x] = r.splice(desde, 1);
      if (!x) return actuales;
      r.splice(hasta, 0, x);
      return r;
    });
    setCamarasEditor((actuales) => {
      const r = [...actuales];
      const [x] = r.splice(desde, 1);
      if (!x) return actuales;
      r.splice(hasta, 0, x);
      return r;
    });
    setIndiceActivo(hasta);
  }

  function actualizarCamaraActiva(camara: CameraValues) {
    setCamarasEditor((actuales) => actuales.map((c, i) => (i === indiceActivo ? camara : c)));
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
        const esEscaneoGrande =
          tipo === "tour3d" && archivos.length === 1 && !f.name.toLowerCase().endsWith(".glb");

        if (esEscaneoGrande) {
          try {
            await subirResumable(f, "uploads", path, (pct) => setProgreso(pct));
          } catch (err) {
            const detalle = err instanceof Error ? err.message : JSON.stringify(err);
            throw new Error(`No hemos podido subir ${f.name}. Detalle: ${detalle}`);
          }
          entradas.push({ path, nombre: f.name });
          setProgreso(100);
        } else {
          const { error: errUp } = await supabase.storage.from("uploads").upload(path, f);
          if (errUp)
            throw new Error(
              `No hemos podido subir ${f.name}. Detalle: ${errUp.message ?? JSON.stringify(errUp)}`,
            );
          entradas.push({ path, nombre: f.name });
          setProgreso(Math.round(((i + 1) / archivos.length) * 100));
        }
      }

      await supabase.from("projects").update({ archivos_entrada: entradas }).eq("id", proyecto.id);

      setFase("procesando");
      if (tipo === "video") {
        await generarVideo({ data: { project_id: proyecto.id } });
      } else if (archivos[0]!.name.toLowerCase().endsWith(".glb")) {
        const f = archivos[0]!;
        const path = `${user.id}/${proyecto.id}_${Date.now()}.glb`;
        const { error: errPub } = await supabase.storage.from("modelos-3d").upload(path, f);
        if (errPub)
          throw new Error(
            `No hemos podido subir el modelo. Detalle: ${errPub.message ?? JSON.stringify(errPub)}`,
          );
        const { data: pub } = supabase.storage.from("modelos-3d").getPublicUrl(path);
        await supabase
          .from("projects")
          .update({ estado: "listo", url_resultado: pub.publicUrl })
          .eq("id", proyecto.id);
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

  function guardarYSiguiente() {
    setIndiceActivo((i) => Math.min(i + 1, archivosEditor.length - 1));
  }

  async function generarConCamaras() {
    if (!user || archivosEditor.length === 0) return;
    if (!nombre.trim()) {
      toast.error("Ponle un nombre a la propiedad.");
      return;
    }

    setFase("subiendo");
    setProgreso(0);
    setErrorMsg(null);

    try {
      const { data: proyecto, error: errInsert } = await supabase
        .from("projects")
        .insert({ user_id: user.id, nombre: nombre.trim(), tipo: "video", estado: "subiendo" })
        .select("id")
        .single();
      if (errInsert || !proyecto) throw new Error("No hemos podido crear el proyecto.");

      const entradas: { path: string; nombre: string }[] = [];
      for (let i = 0; i < archivosEditor.length; i++) {
        const f = archivosEditor[i]!;
        const limpio = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${user.id}/${proyecto.id}/${Date.now()}_${limpio}`;
        const { error: errUp } = await supabase.storage.from("uploads").upload(path, f);
        if (errUp)
          throw new Error(
            `No hemos podido subir ${f.name}. Detalle: ${errUp.message ?? JSON.stringify(errUp)}`,
          );
        entradas.push({ path, nombre: f.name });
        setProgreso(Math.round(((i + 1) / archivosEditor.length) * 100));
      }

      await supabase.from("projects").update({ archivos_entrada: entradas }).eq("id", proyecto.id);

      setFase("procesando");
      await generarVideoConCamaras({ data: { project_id: proyecto.id, camaras: camarasEditor } });

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

  /** Flujo del tipo Plano 2D: una sola foto/boceto -> plano limpio vía Roomagen. */
  async function generarPlanoProyecto() {
    if (!user || !archivoPlano) return;
    if (!nombre.trim()) {
      toast.error("Ponle un nombre a la propiedad.");
      return;
    }

    setFase("subiendo");
    setProgreso(0);
    setErrorMsg(null);

    try {
      const { data: proyecto, error: errInsert } = await supabase
        .from("projects")
        .insert({ user_id: user.id, nombre: nombre.trim(), tipo: "plano2d", estado: "subiendo" })
        .select("id")
        .single();
      if (errInsert || !proyecto) throw new Error("No hemos podido crear el proyecto.");

      const limpio = archivoPlano.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/${proyecto.id}/${Date.now()}_${limpio}`;
      const { error: errUp } = await supabase.storage.from("uploads").upload(path, archivoPlano);
      if (errUp)
        throw new Error(
          `No hemos podido subir la imagen. Detalle: ${errUp.message ?? JSON.stringify(errUp)}`,
        );
      await supabase
        .from("projects")
        .update({ archivos_entrada: [{ path, nombre: archivoPlano.name }] })
        .eq("id", proyecto.id);
      setProgreso(100);

      setFase("procesando");
      await generarPlano({ data: { project_id: proyecto.id } });

      setFase("listo");
      toast.success("Plano listo.");
      navigate({ to: "/app/proyecto/$id", params: { id: proyecto.id } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Algo ha fallado.";
      setFase("error");
      setErrorMsg(msg);
      toast.error(msg);
    }
  }

  const ocupado = fase === "subiendo" || fase === "procesando";
  const modoEditorActivo = tipo === "video" && modoVideo === "editor";
  const esUltimaEnEditor = indiceActivo === archivosEditor.length - 1;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl">Nuevo proyecto</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Elige el formato, sube el material y genera.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
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
          texto="Sube el escaneo del móvil exportado en PLY."
        />
        <TarjetaTipo
          activo={tipo === "plano2d"}
          onClick={() => elegirTipo("plano2d")}
          icono={MapIcon}
          titulo="Plano 2D profesional"
          texto="Sube una foto o boceto y conviértelo en un plano limpio."
        />
      </div>

      {tipo === "video" && (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => elegirModoVideo("automatico")}
            disabled={ocupado}
            className={`rounded-full px-3 py-1.5 text-sm ${
              modoVideo === "automatico"
                ? "bg-forest text-forest-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-border"
            }`}
          >
            Automático
          </button>
          <button
            type="button"
            onClick={() => elegirModoVideo("editor")}
            disabled={ocupado}
            className={`rounded-full px-3 py-1.5 text-sm ${
              modoVideo === "editor"
                ? "bg-forest text-forest-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-border"
            }`}
          >
            Editor (control de cámara)
          </button>
        </div>
      )}

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

      {tipo === "plano2d" ? (
        <div className="mt-6">
          {!archivoPlano ? (
            <div
              className="surface-card cursor-pointer border-dashed p-8 text-center"
              onClick={() => !ocupado && inputPlanoRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (!ocupado) elegirArchivoPlano(e.dataTransfer.files);
              }}
            >
              <Upload className="mx-auto h-7 w-7 text-clay" />
              <p className="mt-3 text-sm">Arrastra la foto del boceto/plano o haz clic para elegirla</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Vale una foto de un boceto a mano, un plano antiguo o de mala calidad. JPG, PNG o WEBP.
              </p>
              <input
                ref={inputPlanoRef}
                type="file"
                className="hidden"
                accept={ACEPTA.plano2d}
                onChange={(e) => {
                  elegirArchivoPlano(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
          ) : (
            <div className="surface-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium">{archivoPlano.name}</p>
                {!ocupado && (
                  <button
                    type="button"
                    onClick={() => setArchivoPlano(null)}
                    className="text-xs text-clay underline underline-offset-2"
                  >
                    Cambiar imagen
                  </button>
                )}
              </div>
              <VistaPreviaPlano archivo={archivoPlano} />
              <Button variant="clay" size="xl" className="mt-4 w-full" onClick={generarPlanoProyecto} disabled={ocupado}>
                {ocupado ? "Generando…" : "Generar plano profesional"}
              </Button>
            </div>
          )}
        </div>
      ) : modoEditorActivo ? (
        <div className="mt-6">
          {archivosEditor.length === 0 ? (
            <div
              className="surface-card cursor-pointer border-dashed p-8 text-center"
              onClick={() => !ocupado && inputEditorRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (!ocupado) añadirArchivosEditor(e.dataTransfer.files);
              }}
            >
              <Upload className="mx-auto h-7 w-7 text-clay" />
              <p className="mt-3 text-sm">Arrastra las fotos que quieras trabajar o haz clic para elegirlas</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Formatos admitidos: JPG, PNG, WEBP. Los HEIC se convierten automáticamente. Puedes subir varias.
              </p>
              <input
                ref={inputEditorRef}
                type="file"
                className="hidden"
                accept={ACEPTA.video}
                multiple
                onChange={(e) => {
                  añadirArchivosEditor(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
          ) : (
            <>
              <p className="mb-2 text-xs text-muted-foreground">
                Ajusta la cámara de cada foto. Haz clic en cualquier número para saltar directamente a esa foto.
              </p>
              <ul className="mb-4 space-y-2">
                {archivosEditor.map((f, i) => (
                  <li
                    key={`${f.name}-${f.size}-${f.lastModified}-${i}`}
                    draggable={!ocupado}
                    onDragStart={() => {
                      arrastrandoRef.current = i;
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const desde = arrastrandoRef.current;
                      if (desde !== null) moverEditor(desde, i);
                      arrastrandoRef.current = null;
                    }}
                    onDragEnd={() => {
                      arrastrandoRef.current = null;
                    }}
                    onClick={() => setIndiceActivo(i)}
                    className={`surface-card flex min-w-0 cursor-pointer items-center gap-3 p-2 text-sm transition ${
                      i === indiceActivo ? "ring-2 ring-clay" : ""
                    }`}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-clay font-semibold text-clay-foreground">
                      {i + 1}
                    </span>
                    <Miniatura archivo={f} />
                    <span className="min-w-0 flex-1 truncate" title={f.name}>
                      {f.name}
                    </span>
                    {!ocupado && (
                      <div className="flex shrink-0 items-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10"
                          onClick={(e) => {
                            e.stopPropagation();
                            moverEditor(i, i - 1);
                          }}
                          disabled={i === 0}
                          aria-label={`Subir ${f.name}`}
                        >
                          <ChevronUp className="h-5 w-5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10"
                          onClick={(e) => {
                            e.stopPropagation();
                            moverEditor(i, i + 1);
                          }}
                          disabled={i === archivosEditor.length - 1}
                          aria-label={`Bajar ${f.name}`}
                        >
                          <ChevronDown className="h-5 w-5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 text-muted-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            quitarEditor(i);
                          }}
                          aria-label={`Quitar ${f.name}`}
                        >
                          <X className="h-5 w-5" />
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              {!ocupado && (
                <Button
                  type="button"
                  variant="outline"
                  className="mb-4 w-full"
                  onClick={() => inputEditorRef.current?.click()}
                >
                  <Plus className="h-4 w-4" />
                  Añadir más fotos
                </Button>
              )}
              <input
                ref={inputEditorRef}
                type="file"
                className="hidden"
                accept={ACEPTA.video}
                multiple
                onChange={(e) => {
                  añadirArchivosEditor(e.target.files);
                  e.target.value = "";
                }}
              />

              <p className="mb-2 text-sm font-medium">
                Editando foto {indiceActivo + 1} de {archivosEditor.length}
              </p>
              <CameraEditor
                archivo={archivosEditor[indiceActivo]!}
                camera={camarasEditor[indiceActivo] ?? CAMARA_INICIAL}
                onCameraChange={actualizarCamaraActiva}
                generando={ocupado}
                etiquetaBoton={esUltimaEnEditor ? "Aplicar movimiento" : "Guardar y siguiente foto"}
                onSubmit={esUltimaEnEditor ? generarConCamaras : guardarYSiguiente}
              />
            </>
          )}
        </div>
      ) : (
        <>
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
                : "Arrastra tu archivo .ply (o .sog) o haz clic para elegirlo"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {tipo === "video"
                ? "Formatos admitidos: JPG, PNG, WEBP. Los HEIC se convierten automáticamente."
                : "Un solo archivo · PLY para tour fotorrealista, o GLB como alternativa (menos calidad)"}
            </p>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept={ACEPTA[tipo]}
              multiple={tipo === "video"}
              onChange={(e) => {
                añadirArchivos(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {archivos.length > 0 && tipo === "video" && (
            <div className="mt-4">
              <p className="mb-2 text-xs text-muted-foreground">
                El orden de las fotos será el orden de las escenas del vídeo.
              </p>
              <ul className="space-y-2">
                {archivos.map((f, i) => (
                  <li
                    key={`${f.name}-${f.size}-${f.lastModified}-${i}`}
                    draggable={!ocupado}
                    onDragStart={() => {
                      arrastrandoRef.current = i;
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const desde = arrastrandoRef.current;
                      if (desde !== null) mover(desde, i);
                      arrastrandoRef.current = null;
                    }}
                    onDragEnd={() => {
                      arrastrandoRef.current = null;
                    }}
                    className="surface-card flex min-w-0 items-center gap-3 p-2 text-sm"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-clay font-semibold text-clay-foreground">
                      {i + 1}
                    </span>
                    <Miniatura archivo={f} />
                    <span className="min-w-0 flex-1 truncate" title={f.name}>
                      {f.name}
                    </span>
                    {!ocupado && (
                      <div className="flex shrink-0 items-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10"
                          onClick={() => mover(i, i - 1)}
                          disabled={i === 0}
                          aria-label={`Subir ${f.name}`}
                        >
                          <ChevronUp className="h-5 w-5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10"
                          onClick={() => mover(i, i + 1)}
                          disabled={i === archivos.length - 1}
                          aria-label={`Bajar ${f.name}`}
                        >
                          <ChevronDown className="h-5 w-5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 text-muted-foreground"
                          onClick={() => quitar(i)}
                          aria-label={`Quitar ${f.name}`}
                        >
                          <X className="h-5 w-5" />
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              {!ocupado && (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3 w-full"
                  onClick={() => inputRef.current?.click()}
                >
                  <Plus className="h-4 w-4" />
                  Añadir más fotos
                </Button>
              )}
            </div>
          )}

          {archivos.length > 0 && tipo === "tour3d" && (
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
        </>
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

      {tipo !== "plano2d" && !modoEditorActivo && (
        <Button variant="clay" size="xl" className="mt-8 w-full" onClick={generar} disabled={ocupado}>
          {ocupado ? "Generando…" : tipo === "video" ? "Generar vídeo" : "Publicar tour 3D"}
        </Button>
      )}
    </div>
  );
}

function Miniatura({ archivo }: { archivo: File }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const nuevaUrl = URL.createObjectURL(archivo);
    setUrl(nuevaUrl);
    return () => URL.revokeObjectURL(nuevaUrl);
  }, [archivo]);

  return url ? (
    <img src={url} alt="" className="h-12 w-16 shrink-0 rounded-md object-cover" />
  ) : (
    <div className="h-12 w-16 shrink-0 rounded-md bg-muted" />
  );
}

function VistaPreviaPlano({ archivo }: { archivo: File }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const nuevaUrl = URL.createObjectURL(archivo);
    setUrl(nuevaUrl);
    return () => URL.revokeObjectURL(nuevaUrl);
  }, [archivo]);

  return url ? (
    <img src={url} alt="" className="max-h-72 w-full rounded-lg object-contain" />
  ) : (
    <div className="h-40 w-full rounded-lg bg-muted" />
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
