import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LIMITES, type PlanId } from "@/lib/planes";

const entrada = z.object({ project_id: z.string().uuid() });

type Perfil = {
  plan: PlanId;
  planos_usados_mes: number;
  periodo_inicio: string;
};

function periodoCaducado(inicio: string) {
  const d = new Date(inicio);
  const ahora = new Date();
  return d.getUTCFullYear() !== ahora.getUTCFullYear() || d.getUTCMonth() !== ahora.getUTCMonth();
}

async function comprobarCuotaPlano(supabase: any, userId: string): Promise<Perfil> {
  const { data, error } = await supabase
    .from("profiles")
    .select("plan, planos_usados_mes, periodo_inicio")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error("No hemos podido comprobar tu plan.");
  let perfil = (data ?? {
    plan: "free",
    planos_usados_mes: 0,
    periodo_inicio: new Date().toISOString(),
  }) as Perfil;

  if (periodoCaducado(perfil.periodo_inicio)) {
    const inicio = new Date();
    inicio.setUTCDate(1);
    inicio.setUTCHours(0, 0, 0, 0);
    await supabase
      .from("profiles")
      .update({ planos_usados_mes: 0, periodo_inicio: inicio.toISOString() })
      .eq("id", userId);
    perfil = { ...perfil, planos_usados_mes: 0, periodo_inicio: inicio.toISOString() };
  }

  const limite = LIMITES[perfil.plan] ?? LIMITES.free;
  const max = limite.planos ?? 0;
  if (perfil.planos_usados_mes >= max) {
    throw new Error(
      `Has agotado tu plan ${perfil.plan} este mes (${perfil.planos_usados_mes}/${max} planos 2D). Cambia de plan desde tu cuenta para seguir generando.`,
    );
  }
  return perfil;
}

async function sumarUsoPlano(supabase: any, userId: string, perfil: Perfil) {
  await supabase
    .from("profiles")
    .update({ planos_usados_mes: perfil.planos_usados_mes + 1 })
    .eq("id", userId);
}

async function marcarError(supabase: any, projectId: string, mensaje: string) {
  await supabase.from("projects").update({ estado: "error", error_mensaje: mensaje }).eq("id", projectId);
}

/** Genera el plano 2D limpio a partir de la foto/boceto subido al proyecto. */
export const generarPlano = createServerFn({ method: "POST" })
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
    if (proyecto.tipo !== "plano2d") throw new Error("Este proyecto no es de tipo plano 2D.");

    const perfil = await comprobarCuotaPlano(supabase, userId);

    await supabase.from("projects").update({ estado: "procesando", error_mensaje: null }).eq("id", proyecto.id);

    try {
      const archivo = (proyecto.archivos_entrada ?? [])[0];
      if (!archivo?.path) throw new Error("El proyecto no tiene foto ni boceto.");

      const { data: firmada, error: errFirma } = await supabase.storage
        .from("uploads")
        .createSignedUrl(archivo.path, 3600);
      if (errFirma || !firmada?.signedUrl) throw new Error("No hemos podido leer la foto subida.");

      const { generarPlanoDesdeFoto } = await import("@/lib/roomagen.server");
      const url = await generarPlanoDesdeFoto(firmada.signedUrl);

      await supabase
        .from("projects")
        .update({ estado: "listo", url_resultado: url, error_mensaje: null })
        .eq("id", proyecto.id);

      await sumarUsoPlano(supabase, userId, perfil);
      return { ok: true as const, url };
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : "Error desconocido al generar el plano.";
      await marcarError(supabase, proyecto.id, mensaje);
      throw new Error(mensaje);
    }
  });

/** Genera (o regenera) la versión coloreada del plano ya existente. */
export const colorizarPlanoProyecto = createServerFn({ method: "POST" })
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
    if (proyecto.tipo !== "plano2d") throw new Error("Este proyecto no es de tipo plano 2D.");
    if (!proyecto.url_resultado) throw new Error("Genera primero el plano base.");

    const perfil = await comprobarCuotaPlano(supabase, userId);

    try {
      const { colorizarPlano } = await import("@/lib/roomagen.server");
      const url = await colorizarPlano(proyecto.url_resultado);

      await supabase.from("projects").update({ plano_colorizado_url: url }).eq("id", proyecto.id);

      await sumarUsoPlano(supabase, userId, perfil);
      return { ok: true as const, url };
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : "Error desconocido al colorear el plano.";
      throw new Error(mensaje);
    }
  });

/** Genera la vista 3D "dollhouse" a partir del plano ya existente. */
export const generarPlano3D = createServerFn({ method: "POST" })
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
    if (proyecto.tipo !== "plano2d") throw new Error("Este proyecto no es de tipo plano 2D.");
    if (!proyecto.url_resultado) throw new Error("Genera primero el plano base.");

    const perfil = await comprobarCuotaPlano(supabase, userId);

    try {
      const { planoA3D } = await import("@/lib/roomagen.server");
      const url = await planoA3D(proyecto.url_resultado);

      await supabase.from("projects").update({ plano_3d_url: url }).eq("id", proyecto.id);

      await sumarUsoPlano(supabase, userId, perfil);
      return { ok: true as const, url };
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : "Error desconocido al generar la vista 3D.";
      throw new Error(mensaje);
    }
  });

/** Guarda las anotaciones (etiquetas, cotas, texto libre, logo) del plano. */
export const guardarAnotaciones = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ project_id: z.string().uuid(), anotaciones: z.array(z.record(z.string(), z.unknown())) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { error } = await supabase
      .from("projects")
      .update({ anotaciones: data.anotaciones })
      .eq("id", data.project_id);
    if (error) throw new Error("No hemos podido guardar las anotaciones.");
    return { ok: true as const };
  });
