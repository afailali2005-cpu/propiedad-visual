/**
 * Integración con Roomagen (planos a partir de foto/boceto).
 *
 * Contrato verificado (roomagen.com/api/floor-plan, 2026-09):
 *   POST https://api.roomagen.com/api/v1/jobs
 *   Header: X-Api-Key: {ROOMAGEN_API_KEY}
 *   Body:   { tool, image_url, options? }
 *   → 201 { job_id, status: "processing" }
 *   GET  https://api.roomagen.com/api/v1/jobs/{job_id}  (mismo header)
 *   → { status: "processing"|"completed"|"failed", result_url? , error? }
 *
 * Herramientas usadas:
 *   - "sketch-to-floor-plan": foto/boceto cutre -> plano 2D limpio
 *   - "floor-plan-colorize":  plano en blanco y negro -> versión coloreada
 *   - "floor-plan-to-3d":     plano 2D -> vista isométrica 3D "dollhouse"
 *
 * Precio: prepago por imagen ($0.20-0.25 según el pack, o el tier gratis de
 * 50 imágenes con marca de agua para pruebas). No se paga por request fallida.
 *
 * Secreto necesario: ROOMAGEN_API_KEY (formato "rmg_live_...").
 */

export const ROOMAGEN_API_BASE = "https://api.roomagen.com/api/v1";

export type HerramientaRoomagen = "sketch-to-floor-plan" | "floor-plan-colorize" | "floor-plan-to-3d";

function apiKey(): string | undefined {
  return process.env["ROOMAGEN_API_KEY"];
}

export function roomagenConfigurado(): boolean {
  return Boolean(apiKey());
}

function cabeceras(): Record<string, string> {
  return {
    "X-Api-Key": apiKey() ?? "",
    "Content-Type": "application/json",
  };
}

type RespuestaEnvio = { job_id?: string; status?: string };
type RespuestaEstado = {
  status?: string;
  result_url?: string;
  image_url?: string;
  error?: string;
};

const POLL_INTERVALO_MS = 4000;
const POLL_TIMEOUT_MS = 3 * 60 * 1000; // 3 min (Roomagen tarda 10-60s típicamente)

async function esperarTrabajo(jobId: string): Promise<string> {
  const inicio = Date.now();
  for (;;) {
    if (Date.now() - inicio > POLL_TIMEOUT_MS) {
      throw new Error("Roomagen tardó demasiado en generar el resultado.");
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVALO_MS));

    const res = await fetch(`${ROOMAGEN_API_BASE}/jobs/${jobId}`, { headers: cabeceras() });
    if (!res.ok) {
      const detalle = await res.text().catch(() => "");
      throw new Error(`Roomagen (estado) devolvió ${res.status}: ${detalle.slice(0, 300)}`);
    }
    const data = (await res.json()) as RespuestaEstado;
    const status = (data.status ?? "").toLowerCase();

    if (status === "completed") {
      const url = data.result_url ?? data.image_url;
      if (!url) throw new Error("Roomagen completó el trabajo pero no devolvió la imagen.");
      return url;
    }
    if (status === "failed") {
      throw new Error(`Roomagen no pudo generar el resultado${data.error ? `: ${data.error}` : "."}`);
    }
    // processing / queued → seguir esperando
  }
}

/** Envía una imagen a una herramienta de Roomagen y espera el resultado. */
async function ejecutarHerramienta(
  tool: HerramientaRoomagen,
  imageUrl: string,
  options?: Record<string, unknown>,
): Promise<string> {
  if (!apiKey()) throw new Error("Falta la credencial ROOMAGEN_API_KEY.");

  const res = await fetch(`${ROOMAGEN_API_BASE}/jobs`, {
    method: "POST",
    headers: cabeceras(),
    body: JSON.stringify({ tool, image_url: imageUrl, options: options ?? {} }),
  });

  if (!res.ok) {
    const detalle = await res.text().catch(() => "");
    throw new Error(`Roomagen devolvió ${res.status}: ${detalle.slice(0, 300)}`);
  }

  const data = (await res.json()) as RespuestaEnvio;
  if (!data.job_id) throw new Error("Roomagen no devolvió job_id.");

  return esperarTrabajo(data.job_id);
}

/** Convierte una foto o boceto cutre en un plano 2D limpio y profesional. */
export async function generarPlanoDesdeFoto(urlFoto: string): Promise<string> {
  return ejecutarHerramienta("sketch-to-floor-plan", urlFoto);
}

/** Colorea un plano en blanco y negro (versión más atractiva para portales). */
export async function colorizarPlano(urlPlano: string): Promise<string> {
  return ejecutarHerramienta("floor-plan-colorize", urlPlano);
}

/** Genera una vista isométrica 3D "dollhouse" a partir del plano 2D. */
export async function planoA3D(urlPlano: string): Promise<string> {
  return ejecutarHerramienta("floor-plan-to-3d", urlPlano);
}
