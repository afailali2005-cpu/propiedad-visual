/**
 * Integración con Higgsfield (image-to-video, modelo DoP, clips de 5 s).
 *
 * TODA la lógica de llamada al proveedor vive aquí, aislada del resto de la app.
 *
 * Contrato verificado (2026-09):
 * - POST https://api.higgsfield.ai/higgsfield-ai/dop/{tier}   (tier: lite|turbo|standard)
 * - Header:  Authorization: Key {HIGGSFIELD_API_KEY}   (la clave ya viene en formato id:secret)
 * - Body:    { prompt, image_url, motions? }   (NO enviar enhance_prompt: provoca 500)
 * - Respuesta: { status, request_id, status_url, cancel_url }
 * - Polling a status_url (mismo header) hasta status "completed" (video.url o videos[0].url),
 *   "failed", "nsfw" o "canceled".
 */

export const HIGGSFIELD_API_BASE = "https://api.higgsfield.ai/higgsfield-ai/dop";
export const DURACION_CLIP_SEGUNDOS = 5;

export type TierHiggsfield = "lite" | "turbo" | "standard";
export type ClipGenerado = { url: string; duracion: number };

function apiKey(): string | undefined {
  return process.env["HIGGSFIELD_API_KEY"];
}

function tier(): TierHiggsfield {
  const t = (process.env["HIGGSFIELD_TIER"] ?? "turbo").trim().toLowerCase();
  return t === "lite" || t === "standard" ? t : "turbo";
}

function endpoint(): string {
  return `${HIGGSFIELD_API_BASE}/${tier()}`;
}

export function higgsfieldConfigurado(): boolean {
  return Boolean(apiKey());
}

type RespuestaCreacion = {
  status?: string;
  request_id?: string;
  status_url?: string;
  cancel_url?: string;
};

type RespuestaEstado = {
  status?: string;
  video?: { url?: string };
  videos?: { url?: string }[];
};

const POLL_INTERVALO_MS = 5000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000; // 10 min

async function esperarClip(statusUrl: string, key: string): Promise<string> {
  const inicio = Date.now();
  for (;;) {
    if (Date.now() - inicio > POLL_TIMEOUT_MS) {
      throw new Error("Higgsfield tardó demasiado en generar el clip (tiempo máximo agotado).");
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVALO_MS));

    const res = await fetch(statusUrl, {
      headers: { Authorization: `Key ${key}` },
    });
    if (!res.ok) {
      const detalle = await res.text().catch(() => "");
      throw new Error(`Higgsfield (polling) devolvió ${res.status}: ${detalle.slice(0, 300)}`);
    }
    const data = (await res.json()) as RespuestaEstado;
    const status = (data.status ?? "").toLowerCase();

    if (status === "completed") {
      const url = data.video?.url ?? data.videos?.[0]?.url;
      if (!url) throw new Error("Higgsfield completó el clip pero no devolvió la URL del vídeo.");
      return url;
    }
    if (status === "failed" || status === "nsfw" || status === "canceled") {
      throw new Error(`Higgsfield no pudo generar el clip (estado: ${status}).`);
    }
    // queued / in_progress / etc. → seguir esperando
  }
}

/**
 * Genera un clip de ~5 s a partir de una única foto.
 */
export async function generarClipDesdeFoto(urlFoto: string, prompt: string): Promise<ClipGenerado> {
  const key = apiKey();
  if (!key) {
    throw new Error("Falta la credencial HIGGSFIELD_API_KEY.");
  }

  const body: Record<string, unknown> = { prompt, image_url: urlFoto };
  const motionId = process.env["HIGGSFIELD_MOTION_ID"];
  if (motionId) body["motions"] = motionId;

  const res = await fetch(endpoint(), {
    method: "POST",
    headers: {
      Authorization: `Key ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detalle = await res.text().catch(() => "");
    throw new Error(`Higgsfield devolvió ${res.status}: ${detalle.slice(0, 300)}`);
  }

  const data = (await res.json()) as RespuestaCreacion;
  if (!data.status_url) {
    throw new Error("Higgsfield no devolvió la URL de seguimiento del clip.");
  }

  const url = await esperarClip(data.status_url, key);
  return { url, duracion: DURACION_CLIP_SEGUNDOS };
}

/**
 * Genera varios clips en paralelo, uno por foto.
 * TODO: revisar límites de concurrencia del proveedor.
 */
export async function generarClipsEnParalelo(
  fotos: { url: string; prompt: string }[],
): Promise<ClipGenerado[]> {
  return Promise.all(fotos.map((f) => generarClipDesdeFoto(f.url, f.prompt)));
}

/**
 * Une varios clips en un único vídeo final.
 * Versión provisional: devuelve las URLs unidas (una por línea); sin ffmpeg real.
 * TODO: sustituir por el servicio de concatenación definitivo (p. ej. un
 * worker con ffmpeg o el endpoint de stitching del proveedor).
 */
export async function concatenarClips(clips: ClipGenerado[]): Promise<string> {
  if (clips.length === 0) throw new Error("No hay clips que unir.");
  if (clips.length === 1) return clips[0]!.url;
  return JSON.stringify(clips.map((c) => c.url));
}
