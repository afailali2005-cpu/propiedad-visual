# Propiedad Visual

Construye "Habitour", una SaaS para el sector inmobiliario que convierte fotos y escaneos móviles en vídeos cinematográficos y tours 3D interactivos para anuncios de propiedades. Público objetivo: agentes inmobiliarios, no técnicos. Idioma de la interfaz: español.

## LANDING PAGE (pública)

1. Hero: titular "Convierte las fotos de tu anuncio en vídeos cinematográficos y tours 3D en minutos" + subtítulo corto + CTA principal "Probar gratis" + CTA secundario "Ver ejemplo". Diseño limpio y profesional, tonos cálidos/neutros tipo inmobiliaria premium — NO estética genérica de startup tech.
2. Problema: 3 bullets — las fotos planas no venden; un fotógrafo o tour profesional cuesta 300-800€ y tarda días; no existe una alternativa rápida y barata.
3. Solución, dos tarjetas lado a lado:
   - "Vídeo cinematográfico": sube tus fotos existentes → recibe un vídeo con movimiento de cámara profesional en minutos.
   - "Tour 3D interactivo": escanea la propiedad con el móvil usando la app gratuita Scaniverse → sube el archivo → recibe un enlace navegable en 3D sin instalar nada.
4. Cómo funciona: 4 pasos numerados con iconos (Subir → Procesar → Recibir → Compartir).
5. Precios, tabla comparativa de 4 planes:
   - Pay-per-uso: 19€ por vídeo · 15€ por tour 3D
   - Starter: 49€/mes — 5 vídeos + 1 tour 3D
   - Pro: 99€/mes — 15 vídeos + 4 tours 3D — marcar "Más popular"
   - Agency: 199€/mes — 40 vídeos + 12 tours 3D
6. FAQ con 5 preguntas: qué necesito para escanear, cuánto tarda, en qué formatos entrego, puedo cancelar, funciona en móvil.
7. Footer con logo, enlaces legales placeholder y formulario de waitlist (email + botón) que guarde en una tabla `waitlist` de Supabase.

## APP / DASHBOARD (requiere login)

- Autenticación con Supabase (email + contraseña, y Google).
- Pantalla "Nuevo proyecto": el usuario elige "Vídeo" o "Tour 3D", pone nombre de la propiedad, sube archivos con drag & drop (fotos JPG/PNG para vídeo, o un archivo .ply/.spz/.splat para el tour). Al pulsar "Generar" se crea el registro y muestra barra de progreso con estados: Subiendo → Procesando → Listo / Error.
- Pantalla de resultado: reproductor de vídeo (para vídeo) o iframe embebido (para tour 3D), con botones Descargar, Copiar enlace y Compartir.
- Pantalla "Mis proyectos": galería de proyectos con miniatura, tipo, nombre, fecha y estado, con filtros por tipo.
- Pantalla "Cuenta": plan actual, uso del mes (X de Y vídeos y tours usados), botón "Cambiar de plan" que lleva a Stripe Checkout.
- Responsive y mobile-first (muchos agentes lo usarán desde el móvil en la propiedad).

## BACKEND (Supabase)

Tablas:
- `profiles` (id = auth user, nombre, plan: 'free'|'starter'|'pro'|'agency', videos_usados_mes, tours_usados_mes, periodo_inicio, stripe_customer_id)
- `projects` (id, user_id, nombre, tipo: 'video'|'tour3d', estado: 'subiendo'|'procesando'|'listo'|'error', archivos_entrada (jsonb con URLs de Storage), url_resultado, error_mensaje, creado_en, actualizado_en)
- `waitlist` (id, email, creado_en)
Activa RLS: cada usuario solo ve sus propios registros.
Storage: bucket privado `uploads` para archivos de entrada y bucket `results` para resultados.

Edge Functions (Deno):
- `generate-video`: recibe project_id, lee las fotos del proyecto, y por cada foto llama a la API de Higgsfield (image-to-video, modelo DoP, clips de 5 s) usando el secret HIGGSFIELD_API_KEY; concatena los clips en un único vídeo y guarda la URL en `url_resultado`. Deja la lógica de llamada a Higgsfield claramente aislada en una función con TODO y el endpoint como constante configurable, porque las credenciales las añadiré yo después.
- `publish-tour`: recibe project_id, toma el archivo .ply/.spz del proyecto y lo publica vía la API REST de SuperSplat (playcanvas.com/api/upload/signed-url → PUT a S3 → playcanvas.com/api/splats/publish) usando el secret SUPERSPLAT_TOKEN; guarda la URL del visor en `url_resultado`. Misma estructura aislada y con TODO.
- `stripe-webhook`: actualiza el plan del usuario en `profiles` cuando Stripe confirma el pago.
Ambas funciones de generación deben actualizar `estado` del proyecto en cada paso y guardar `error_mensaje` si algo falla. Añade una comprobación de cuota antes de generar (si el usuario ha agotado su plan, devolver error claro).

## ESTILO
Paleta: azul o verde oscuro como base, con acento cálido (terracota o dorado suave). Tipografía moderna y legible. Que se note que es un producto para el sector inmobiliario, no una plantilla SaaS genérica.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/77fb26d2-9dc6-40c8-ab95-ddb2c57a7d23).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
