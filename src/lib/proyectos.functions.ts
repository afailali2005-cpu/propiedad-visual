import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LIMITES, type PlanId } from "@/lib/planes";

const entrada = z.object({ project_id: z.string().uuid() });

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

/** Genera el vídeo cinematográfico a partir de las fotos del proyecto. */
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
      const rutas: string[] = (proyecto.archivos_entrada ?? []).map((a: any) => a.path);
      if (rutas.length === 0) throw new Error("El proyecto no tiene fotos.");

      const { data: firmadas, error: errFirma } = await supabase.storage
        .from("uploads")
        .createSignedUrls(rutas, 3600);
      if (errFirma) throw new Error("No hemos podido leer las fotos subidas.");

      const { generarClipDesdeFoto, concatenarClips } = await import("@/lib/higgsfield.server");

      const clips = [];
      for (const f of firmadas ?? []) {
        if (!f.signedUrl) continue;
        clips.push(
          await generarClipDesdeFoto(
            f.signedUrl,
            `Recorrido cinematográfico de interior inmobiliario: ${proyecto.nombre}. Movimiento de cámara suave y elegante.`,
          ),
        );
      }

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

/** Publica el tour 3D a partir del archivo .ply/.spz/.splat del proyecto. */
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
