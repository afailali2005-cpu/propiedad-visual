/**
 * Integración con SuperSplat (PlayCanvas) para publicar tours 3D.
 *
 * API real (developer.playcanvas.com/user-manual/api/supersplat):
 *   Base: https://playcanvas.com/api/supersplat
 *   Authorization: Bearer {PlayCanvas access token}
 *   1) POST /v1/splats/uploads                       -> sesión { id, partSize }
 *   2) POST /v1/splats/uploads/{id}/part-upload-urls  -> URLs firmadas por parte
 *   3) PUT  bytes de cada parte a su URL              -> guardar cabecera ETag
 *   4) POST /v1/splats/uploads/{id}/complete          -> { splatId, editUrl }
 *   5) GET  /v1/splats/{splatId}                      -> { viewerUrl, status }
 *
 * Importante: el archivo puede pesar cientos de MB (escaneos 3D). Para no
 * agotar la memoria del servidor, NUNCA se descarga el archivo entero a
 * memoria: se pide una URL firmada de Supabase Storage y cada parte se lee
 * con una petición Range directa a esa URL, transmitiéndose en streaming a
 * la URL firmada de SuperSplat (sin buffer intermedio del tamaño completo).
 *
 * Formatos admitidos: ply | sog | ssog | lcc.
 * Secreto necesario: SUPERSPLAT_TOKEN.
 */

export const SUPERSPLAT_BASE = "https://playcanvas.com/api/supersplat";

type Formato = "ply" | "sog" | "ssog" | "lcc";

function token(): string | undefined {
  return process.env["SUPERSPLAT_TOKEN"]?.trim();
}

export function supersplatConfigurado(): boolean {
  return Boolean(token());
}

function cabeceras(extra: Record<string, string> = {}): Record<string, string> {
  return { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...extra };
}

export function formatoDesdeNombre(nombre: string): Formato {
  const ext = nombre.toLowerCase().split(".").pop() ?? "";
  if (ext === "ply") return "ply";
  if (ext === "sog") return "sog";
  if (ext === "ssog") return "ssog";
  if (ext === "lcc") return "lcc";
  throw new Error(
    `Formato .${ext} no admitido. Exporta el escaneo en PLY (Scaniverse → Exportar → PLY) y vuelve a subirlo.`,
  );
}

async function leerError(res: Response): Promise<string> {
  const txt = await res.text().catch(() => "");
  try {
    return (JSON.parse(txt) as { error?: string }).error ?? txt.slice(0, 200);
  } catch {
    return txt.slice(0, 200);
  }
}

/**
 * Publica un archivo de splat a partir de su URL firmada en Supabase Storage
 * (no del contenido en memoria) y devuelve la URL pública del visor.
 */
export async function publicarSplatDesdeUrl(
  urlOrigen: string,
  tamanoBytes: number,
  nombreArchivo: string,
  titulo: string,
): Promise<string> {
  if (!token()) throw new Error("Falta la credencial SUPERSPLAT_TOKEN.");
  const sourceFormat = formatoDesdeNombre(nombreArchivo);

  const sesionRes = await fetch(`${SUPERSPLAT_BASE}/v1/splats/uploads`, {
    method: "POST",
    headers: cabeceras({ "Idempotency-Key": `habitour-${crypto.randomUUID()}` }),
    body: JSON.stringify({
      sourceFormat,
      contentLength: tamanoBytes,
      title: titulo.slice(0, 100),
      description: "Tour 3D generado con Habitour",
      uploadClient: { id: "habitour", version: "0.1.0" },
    }),
  });
  if (!sesionRes.ok) throw new Error(`SuperSplat (crear subida) ${sesionRes.status}: ${await leerError(sesionRes)}`);
  const sesion = (await sesionRes.json()) as { id: string; partSize: number };

  const partSize = sesion.partSize;
  const numPartes = Math.max(1, Math.ceil(tamanoBytes / partSize));
  const numeros = Array.from({ length: numPartes }, (_, i) => i + 1);

  const urlsRes = await fetch(`${SUPERSPLAT_BASE}/v1/splats/uploads/${sesion.id}/part-upload-urls`, {
    method: "POST",
    headers: cabeceras(),
    body: JSON.stringify({ parts: numeros }),
  });
  if (!urlsRes.ok) throw new Error(`SuperSplat (URLs) ${urlsRes.status}: ${await leerError(urlsRes)}`);
  const { urls } = (await urlsRes.json()) as { urls: { partNumber: number; url: string }[] };

  const partes: { partNumber: number; etag: string }[] = [];
  for (const { partNumber, url } of urls.sort((a, b) => a.partNumber - b.partNumber)) {
    const inicio = (partNumber - 1) * partSize;
    const fin = Math.min(inicio + partSize, tamanoBytes) - 1;

    const origenRes = await fetch(urlOrigen, {
      headers: { Range: `bytes=${inicio}-${fin}` },
    });
    if (!origenRes.ok && origenRes.status !== 206) {
      throw new Error(`No hemos podido leer la parte ${partNumber} del archivo original (${origenRes.status}).`);
    }
    if (!origenRes.body) throw new Error(`El origen no devolvió datos para la parte ${partNumber}.`);

    const put = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(fin - inicio + 1),
      },
      body: origenRes.body,
      // @ts-expect-error -- requerido por fetch/undici para enviar un body en streaming
      duplex: "half",
    });
    if (!put.ok) throw new Error(`La subida de la parte ${partNumber} falló (${put.status}).`);
    const etag = put.headers.get("etag") ?? put.headers.get("ETag");
    if (!etag) throw new Error(`S3 no devolvió ETag para la parte ${partNumber}.`);
    partes.push({ partNumber, etag });
  }

  const compRes = await fetch(`${SUPERSPLAT_BASE}/v1/splats/uploads/${sesion.id}/complete`, {
    method: "POST",
    headers: cabeceras(),
    body: JSON.stringify({ parts: partes }),
  });
  if (!compRes.ok) throw new Error(`SuperSplat (completar) ${compRes.status}: ${await leerError(compRes)}`);
  const { splatId } = (await compRes.json()) as { splatId: string; editUrl: string };

  const splatRes = await fetch(`${SUPERSPLAT_BASE}/v1/splats/${splatId}`, { headers: cabeceras() });
  if (splatRes.ok) {
    const splat = (await splatRes.json()) as { viewerUrl?: string };
    if (splat.viewerUrl) return splat.viewerUrl;
  }
  return `https://superspl.at/scene/${splatId}`;
}
