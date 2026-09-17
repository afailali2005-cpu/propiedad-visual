/**
 * Integración con SuperSplat / PlayCanvas para publicar tours 3D.
 *
 * Flujo: signed-url -> PUT a S3 -> publish. Todo aislado en este módulo.
 * Credencial: secreto SUPERSPLAT_TOKEN.
 *
 * TODO: completar cuando el token esté disponible.
 */

export const SUPERSPLAT_BASE = "https://playcanvas.com/api";
export const SUPERSPLAT_SIGNED_URL = `${SUPERSPLAT_BASE}/upload/signed-url`;
export const SUPERSPLAT_PUBLISH = `${SUPERSPLAT_BASE}/splats/publish`;

function token(): string | undefined {
  return process.env["SUPERSPLAT_TOKEN"];
}

export function supersplatConfigurado(): boolean {
  return Boolean(token());
}

/**
 * Publica un archivo .ply/.spz/.splat y devuelve la URL del visor.
 * TODO: ajustar los nombres de campo reales de la API de SuperSplat.
 */
export async function publicarSplat(
  archivo: ArrayBuffer,
  nombreArchivo: string,
  titulo: string,
): Promise<string> {
  const t = token();
  if (!t) throw new Error("Falta la credencial SUPERSPLAT_TOKEN.");

  // 1) Pedir URL firmada
  const firmaRes = await fetch(SUPERSPLAT_SIGNED_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({ filename: nombreArchivo, size: archivo.byteLength }),
  });
  if (!firmaRes.ok) {
    throw new Error(`SuperSplat (signed-url) devolvió ${firmaRes.status}`);
  }
  const firma = (await firmaRes.json()) as { url: string; key?: string; id?: string };

  // 2) Subir el archivo a S3
  const subida = await fetch(firma.url, {
    method: "PUT",
    headers: { "Content-Type": "application/octet-stream" },
    body: archivo,
  });
  if (!subida.ok) throw new Error(`La subida del archivo 3D falló (${subida.status}).`);

  // 3) Publicar
  const pubRes = await fetch(SUPERSPLAT_PUBLISH, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({ key: firma.key, id: firma.id, name: titulo }),
  });
  if (!pubRes.ok) throw new Error(`SuperSplat (publish) devolvió ${pubRes.status}`);

  const pub = (await pubRes.json()) as { url?: string; viewer_url?: string };
  const url = pub.viewer_url ?? pub.url;
  if (!url) throw new Error("SuperSplat no devolvió la URL del visor.");
  return url;
}
