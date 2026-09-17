/**
 * Integración con Higgsfield (image-to-video, modelo DoP, clips de 5 s).
 *
 * TODA la lógica de llamada al proveedor vive aquí, aislada del resto de la app.
 * Las credenciales se leen del secreto HIGGSFIELD_API_KEY.
 *
 * TODO: completar cuando las credenciales estén disponibles.
 */

/** Endpoint configurable del proveedor. */
export const HIGGSFIELD_ENDPOINT = "https://platform.higgsfield.ai/v1/image2video";
export const HIGGSFIELD_MODELO = "dop";
export const DURACION_CLIP_SEGUNDOS = 5;

export type ClipGenerado = { url: string; duracion: number };

function apiKey(): string | undefined {
  return process.env["HIGGSFIELD_API_KEY"];
}

export function higgsfieldConfigurado(): boolean {
  return Boolean(apiKey());
}

/**
 * Genera un clip de 5 s a partir de una única foto.
 * TODO: ajustar el cuerpo de la petición y el parseo de la respuesta al
 * contrato real de Higgsfield (job asíncrono + polling) cuando tengamos la key.
 */
export async function generarClipDesdeFoto(urlFoto: string, prompt: string): Promise<ClipGenerado> {
  const key = apiKey();
  if (!key) {
    throw new Error("Falta la credencial HIGGSFIELD_API_KEY.");
  }

  const res = await fetch(HIGGSFIELD_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: HIGGSFIELD_MODELO,
      image_url: urlFoto,
      prompt,
      duration: DURACION_CLIP_SEGUNDOS,
      motion: "cinematic_dolly",
    }),
  });

  if (!res.ok) {
    const detalle = await res.text().catch(() => "");
    throw new Error(`Higgsfield devolvió ${res.status}: ${detalle.slice(0, 300)}`);
  }

  const data = (await res.json()) as { video_url?: string; url?: string };
  const url = data.video_url ?? data.url;
  if (!url) throw new Error("Higgsfield no devolvió la URL del clip.");
  return { url, duracion: DURACION_CLIP_SEGUNDOS };
}

/**
 * Une varios clips en un único vídeo final.
 * TODO: sustituir por el servicio de concatenación definitivo (p. ej. un
 * worker con ffmpeg o el endpoint de stitching del proveedor).
 */
export async function concatenarClips(clips: ClipGenerado[]): Promise<string> {
  if (clips.length === 0) throw new Error("No hay clips que unir.");
  if (clips.length === 1) return clips[0]!.url;
  throw new Error("La concatenación de clips aún no está configurada.");
}
