import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LIMITES, type PlanId } from "@/lib/planes";

const entrada = z.object({ project_id: z.string().uuid() });

const camaraSchema = z.object({
  horizontal: z.number().min(-10).max(10),
  vertical: z.number().min(-10).max(10),
  zoom: z.number().min(-10).max(10),
  pan: z.number().min(-10).max(10),
  tilt: z.number().min(-10).max(10),
  rotate: z.number().min(-10).max(10),
});

const entradaEditor = z.object({ project_id: z.string().uuid(), camera: camaraSchema });
const entradaEditorMulti = z.object({
  project_id: z.string().uuid(),
  camaras: z.array(camaraSchema).min(1).max(12),
});

type Perfil = {
  plan: PlanId;
  videos_usados_mes: number;
  tours_usados_mes: number;
  periodo_inicio: string;
};

function periodoCaducado(inicio: string) {
  const d = new Date(inicio);
  const ahora = new Date();
  return d.getUTCFullYear() !== ahora.getUTCFullYear() || d.getUTCMonth() !== ahora.getUTCMonth();
}

/** Comprueba la cuota del plan y devuelve el uso ya reiniciado si toca. */
async function comprobarCuota(
  supabase: any,
  userId: string,
  tipo: "video" | "tour3d",
): Promise<Perfil> {
  const { data, error } = await supabase
    .from("profiles")
    .select("plan, videos_usados_mes, tours_usados_mes, periodo_inicio")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error("No hemos podido comprobar tu plan.");
  let perfil = (data ?? {
    plan: "free",
    videos_usados_mes: 0,
    tours_usados_mes: 0,
    periodo_inicio: new Date().toISOString(),
  }) as Perfil;

  if (periodoCaducado(perfil.periodo_inicio)) {
    const inicio = new Date();
    inicio.setUTCDate(1);
    inicio.setUTCHours(0, 0, 0, 0);
    await supabase
      .from("profiles")
      .update({ videos_usados_mes: 0, tours_usados_mes: 0, periodo_inicio: inicio.toISOString() })
      .eq("id", userId);
    perfil = { ...perfil, videos_usados_mes: 0, tours_usados_mes: 0, periodo_inicio: inicio.toISOString() };
  }

  const limite = LIMITES[perfil.plan] ?? LIMITES.free;
  const usados = tipo === "video" ? perfil.videos_usados_mes : perfil.tours_usados_mes;
  const max = tipo === "video" ? limite.videos : limite.tours;

  if (usados >= max) {
    throw new Error(
      `Has agotado tu plan ${perfil.plan} este mes (${usados}/${max} ${
        tipo === "video" ? "vídeos" : "tours 3D"
      }). Cambia de plan desde tu cuenta para seguir generando.`,
    );
  }
  return perfil;
}

async function marcarError(supabase: any, projectId: string, mensaje: string) {
  await supabase
    .from("projects")
    .update({ estado: "error", error_mensaje: mensaje })
    .eq("id", projectId);
}

async function sumarUso(supabase: any, userId: string, perfil: Perfil, tipo: "video" | "tour3d") {
  await supabase
    .from("profiles")
    .update(
      tipo === "video"
        ? { videos_usados_mes: perfil.videos_usados_mes + 1 }
        : { tours_usados_mes: perfil.tours_usados_mes + 1 },
    )
    .eq("id", userId);
}

/** Prompt por escena: intenta inferir la estancia del nombre del archivo (modo Automático). */
function promptEscena(nombreArchivo: string, propiedad: string): string {
  const n = nombreArchivo.toLowerCase();
  const estancia =
    n.includes("salon") || n.includes("living") ? "salón"
    : n.includes("cocina") || n.includes("kitchen") ? "cocina"
    : n.includes("dorm") || n.includes("habit") || n.includes("bed") ? "dormitorio"
    : n.includes("bano") || n.includes("baño") || n.includes("bath") ? "baño"
    : n.includes("terraza") || n.includes("balc") || n.includes("exterior") || n.includes("jardin") ? "exterior"
    : "estancia";

  return (
    `Real estate cinematic walkthrough of a ${estancia} in "${propiedad}". ` +
    "Slow, smooth camera dolly forward with a gentle glide, natural daylight, " +
    "steady and elegant motion, no people, no distortion of walls or furniture, " +
    "photorealistic, architectural video style."
  );
}

/**
 * Traduce los 6 valores del editor de cámara (Fase 1: estilo Rendy "Camera
 * Control", rango -10..10) a una descripción textual para Higgsfield.
 * No es control geométrico literal — es la mejor aproximación en lenguaje
 * natural mientras Higgsfield no exponga parámetros de cámara crudos.
 */
function promptCamara(
  camera: { horizontal: number; vertical: number; zoom: number; pan: number; tilt: number; rotate: number },
  propiedad: string,
): string {
  const partes: string[] = [];

  if (camera.zoom > 3) partes.push("slow cinematic push-in toward the subject");
  else if (camera.zoom < -3) partes.push("slow pull-back revealing more of the room");

  if (camera.horizontal > 3) partes.push("gliding to the right");
  else if (camera.horizontal < -3) partes.push("gliding to the left");

  if (camera.vertical > 3) partes.push("rising smoothly");
  else if (camera.vertical < -3) partes.push("lowering smoothly");

  if (camera.pan > 3) partes.push("with a gentle rightward pan");
  else if (camera.pan < -3) partes.push("with a gentle leftward pan");

  if (camera.tilt > 3) partes.push("tilting slightly upward");
  else if (camera.tilt < -3) partes.push("tilting slightly downward");

  if (Math.abs(camera.rotate) > 4) partes.push("with a very subtle cinematic roll");

  const movimiento = partes.length > 0 ? partes.join(", ") : "slow steady dolly forward";

  return (
    `Real estate cinematic shot of "${propiedad}", camera ${movimiento}. ` +
    "Smooth, elegant, physically plausible motion, natural daylight, no people, " +
    "no distortion of walls, windows or furniture, photorealistic, architectural video style."
  );
}

/** Genera el vídeo cinematográfico a partir de las fotos del proyecto (modo Automático). */
export const generarVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => entrada.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;

    const { data: proyecto, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", data.project_id)
      .maybeSingle();
    if (error || !proyecto) throw new Error("No encontramos el proyecto.");
    if (proyecto.tipo !== "video") throw new Error("Este proyecto no es de tipo vídeo.");

    const perfil = await comprobarCuota(supabase, userId, "video");

    await supabase
      .from("projects")
      .update({ estado: "procesando", error_mensaje: null })
      .eq("id", proyecto.id);

    try {
      const archivos: { path: string; nombre?: string }[] = proyecto.archivos_entrada ?? [];
      if (archivos.length === 0) throw new Error("El proyecto no tiene fotos.");
      if (archivos.length > 12) throw new Error("Máximo 12 fotos por vídeo.");

      const { data: firmadas, error: errFirma } = await supabase.storage
        .from("uploads")
        .createSignedUrls(archivos.map((a) => a.path), 3600);
      if (errFirma) throw new Error("No hemos podido leer las fotos subidas.");

      const { generarClipsEnParalelo, concatenarClips } = await import("@/lib/higgsfield.server");

      const fotos = (firmadas ?? [])
        .map((f: any, i: number) => ({
          url: f.signedUrl as string | null,
          prompt: promptEscena(archivos[i]?.nombre ?? "", proyecto.nombre),
        }))
        .filter((f: any): f is { url: string; prompt: string } => Boolean(f.url));

      const clips = await generarClipsEnParalelo(fotos);
      const urlFinal = await concatenarClips(clips);

      await supabase
        .from("projects")
        .update({ estado: "listo", url_resultado: urlFinal, error_mensaje: null })
        .eq("id", proyecto.id);

      await sumarUso(supabase, userId, perfil, "video");
      return { ok: true as const, url: urlFinal };
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : "Error desconocido al generar el vídeo.";
      await marcarError(supabase, proyecto.id, mensaje);
      throw new Error(mensaje);
    }
  });

/** Genera un único clip a partir de la foto del proyecto y los 6 valores del editor de cámara (una sola foto). */
export const generarClipEditor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => entradaEditor.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;

    const { data: proyecto, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", data.project_id)
      .maybeSingle();
    if (error || !proyecto) throw new Error("No encontramos el proyecto.");
    if (proyecto.tipo !== "video") throw new Error("Este proyecto no es de tipo vídeo.");

    const perfil = await comprobarCuota(supabase, userId, "video");

    await supabase
      .from("projects")
      .update({ estado: "procesando", error_mensaje: null })
      .eq("id", proyecto.id);

    try {
      const archivo = (proyecto.archivos_entrada ?? [])[0];
      if (!archivo?.path) throw new Error("El proyecto no tiene foto.");

      const { data: firmada, error: errFirma } = await supabase.storage
        .from("uploads")
        .createSignedUrl(archivo.path, 3600);
      if (errFirma || !firmada?.signedUrl) throw new Error("No hemos podido leer la foto subida.");

      const { generarClipDesdeFoto } = await import("@/lib/higgsfield.server");
      const prompt = promptCamara(data.camera, proyecto.nombre);
      const clip = await generarClipDesdeFoto(firmada.signedUrl, prompt);

      await supabase
        .from("projects")
        .update({ estado: "listo", url_resultado: clip.url, error_mensaje: null })
        .eq("id", proyecto.id);

      await sumarUso(supabase, userId, perfil, "video");
      return { ok: true as const, url: clip.url };
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : "Error desconocido al generar el vídeo.";
      await marcarError(supabase, proyecto.id, mensaje);
      throw new Error(mensaje);
    }
  });

/**
 * Genera un vídeo a partir de VARIAS fotos del proyecto, cada una con sus
 * propios 6 valores de cámara (modo Editor multi-foto). `camaras[i]`
 * corresponde a `archivos_entrada[i]` en el mismo orden en que se subieron.
 */
export const generarVideoConCamaras = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => entradaEditorMulti.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;

    const { data: proyecto, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", data.project_id)
      .maybeSingle();
    if (error || !proyecto) throw new Error("No encontramos el proyecto.");
    if (proyecto.tipo !== "video") throw new Error("Este proyecto no es de tipo vídeo.");

    const perfil = await comprobarCuota(supabase, userId, "video");

    await supabase
      .from("projects")
      .update({ estado: "procesando", error_mensaje: null })
      .eq("id", proyecto.id);

    try {
      const archivos: { path: string; nombre?: string }[] = proyecto.archivos_entrada ?? [];
      if (archivos.length === 0) throw new Error("El proyecto no tiene fotos.");
      if (archivos.length !== data.camaras.length) {
        throw new Error("El número de fotos no coincide con el número de ajustes de cámara.");
      }

      const { data: firmadas, error: errFirma } = await supabase.storage
        .from("uploads")
        .createSignedUrls(archivos.map((a) => a.path), 3600);
      if (errFirma) throw new Error("No hemos podido leer las fotos subidas.");

      const { generarClipsEnParalelo, concatenarClips } = await import("@/lib/higgsfield.server");

      const fotos = (firmadas ?? [])
        .map((f: any, i: number) => ({
          url: f.signedUrl as string | null,
          prompt: promptCamara(data.camaras[i]!, proyecto.nombre),
        }))
        .filter((f: any): f is { url: string; prompt: string } => Boolean(f.url));

      const clips = await generarClipsEnParalelo(fotos);
      const urlFinal = await concatenarClips(clips);

      await supabase
        .from("projects")
        .update({ estado: "listo", url_resultado: urlFinal, error_mensaje: null })
        .eq("id", proyecto.id);

      await sumarUso(supabase, userId, perfil, "video");
      return { ok: true as const, url: urlFinal };
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : "Error desconocido al generar el vídeo.";
      await marcarError(supabase, proyecto.id, mensaje);
      throw new Error(mensaje);
    }
  });

/** Publica el tour 3D a partir del archivo .ply/.sog del proyecto. */
export const publicarTour = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => entrada.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;

    const { data: proyecto, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", data.project_id)
      .maybeSingle();
    if (error || !proyecto) throw new Error("No encontramos el proyecto.");
    if (proyecto.tipo !== "tour3d") throw new Error("Este proyecto no es un tour 3D.");

    const perfil = await comprobarCuota(supabase, userId, "tour3d");

    await supabase
      .from("projects")
      .update({ estado: "procesando", error_mensaje: null })
      .eq("id", proyecto.id);

    try {
      const archivo = (proyecto.archivos_entrada ?? [])[0];
      if (!archivo?.path) throw new Error("El proyecto no tiene archivo de escaneo.");

      const { data: blob, error: errDescarga } = await supabase.storage
        .from("uploads")
        .download(archivo.path);
      if (errDescarga || !blob) throw new Error("No hemos podido leer el archivo del escaneo.");

      const { publicarSplat } = await import("@/lib/supersplat.server");
      const url = await publicarSplat(
        await blob.arrayBuffer(),
        archivo.nombre ?? "escaneo.ply",
        proyecto.nombre,
      );

      await supabase
        .from("projects")
        .update({ estado: "listo", url_resultado: url, error_mensaje: null })
        .eq("id", proyecto.id);

      await sumarUso(supabase, userId, perfil, "tour3d");
      return { ok: true as const, url };
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : "Error desconocido al publicar el tour.";
      await marcarError(supabase, proyecto.id, mensaje);
      throw new Error(mensaje);
    }
  });
