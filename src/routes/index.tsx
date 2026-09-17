import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Camera,
  Check,
  Clock,
  Cpu,
  Download,
  Images,
  Share2,
  Sparkles,
  Upload,
  Wallet,
} from "lucide-react";

import heroVivienda from "@/assets/hero-vivienda.jpg";
import { Logo } from "@/components/Logo";
import { Waitlist } from "@/components/landing/Waitlist";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { PLANES } from "@/lib/planes";

const TITULO = "Habitour · Vídeos cinematográficos y tours 3D para tus anuncios";
const DESCRIPCION =
  "Convierte las fotos de tus anuncios inmobiliarios en vídeos cinematográficos y tours 3D interactivos en minutos, desde 15€.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITULO },
      { name: "description", content: DESCRIPCION },
      { property: "og:title", content: TITULO },
      { property: "og:description", content: DESCRIPCION },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <Cabecera />
      <Hero />
      <Problema />
      <Solucion />
      <ComoFunciona />
      <Precios />
      <Faq />
      <PieDePagina />
    </div>
  );
}

function Cabecera() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <a href="#solucion" className="hover:text-foreground">
            Cómo lo hacemos
          </a>
          <a href="#pasos" className="hover:text-foreground">
            Cómo funciona
          </a>
          <a href="#precios" className="hover:text-foreground">
            Precios
          </a>
          <a href="#faq" className="hover:text-foreground">
            Preguntas
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/auth">Entrar</Link>
          </Button>
          <Button asChild variant="clay" size="sm">
            <Link to="/auth">Probar gratis</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="hero-surface relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 md:py-24 lg:grid-cols-2">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-forest-foreground/20 px-3 py-1 text-xs tracking-wide text-forest-foreground/80">
            <Sparkles className="h-3.5 w-3.5" /> Para agentes inmobiliarios
          </span>
          <h1 className="mt-6 text-4xl leading-[1.08] text-forest-foreground md:text-5xl lg:text-[3.4rem]">
            Convierte las fotos de tu anuncio en vídeos cinematográficos y tours 3D en minutos
          </h1>
          <p className="mt-5 max-w-xl text-lg text-forest-foreground/75">
            Sin fotógrafos, sin equipos caros y sin esperas. Subes lo que ya tienes y recibes
            material que hace que tu propiedad destaque en portales y redes.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="clay" size="xl">
              <Link to="/auth">
                Probar gratis <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="onDark" size="xl">
              <a href="#solucion">Ver ejemplo</a>
            </Button>
          </div>
          <p className="mt-4 text-sm text-forest-foreground/60">
            Desde 15€ por entrega · Sin permanencia
          </p>
        </div>

        <div className="relative">
          <div className="overflow-hidden rounded-3xl border border-forest-foreground/15 shadow-lift">
            <img
              src={heroVivienda}
              alt="Salón luminoso de una vivienda premium con vistas al mar"
              width={1600}
              height={1200}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="absolute -bottom-5 left-5 rounded-2xl bg-background px-4 py-3 shadow-lift">
            <p className="text-xs text-muted-foreground">Entrega media</p>
            <p className="font-display text-xl">4 min 20 s</p>
          </div>
        </div>
      </div>
    </section>
  );
}

const PROBLEMAS = [
  {
    icono: Images,
    titulo: "Las fotos planas no venden",
    texto:
      "En un portal lleno de anuncios idénticos, una galería estática se pasa por alto en segundos.",
  },
  {
    icono: Wallet,
    titulo: "Un tour profesional cuesta 300-800€",
    texto:
      "Contratar fotógrafo o empresa de tours dispara el coste por anuncio y tarda varios días.",
  },
  {
    icono: Clock,
    titulo: "No hay alternativa rápida y barata",
    texto:
      "O gastas mucho y esperas, o publicas con lo mínimo. Habitour rompe esa disyuntiva.",
  },
];

function Problema() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-20">
      <p className="eyebrow">El problema</p>
      <h2 className="mt-3 max-w-2xl text-3xl md:text-4xl">
        Publicar bien una propiedad es caro, lento o poco atractivo
      </h2>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {PROBLEMAS.map((p) => (
          <div key={p.titulo} className="surface-card p-6">
            <p.icono className="h-6 w-6 text-clay" />
            <h3 className="mt-4 text-xl">{p.titulo}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.texto}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Solucion() {
  return (
    <section id="solucion" className="bg-sand py-20">
      <div className="mx-auto max-w-6xl px-5">
        <p className="eyebrow">La solución</p>
        <h2 className="mt-3 max-w-2xl text-3xl md:text-4xl">Dos formatos, el mismo esfuerzo: casi ninguno</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <article className="surface-card flex flex-col p-8">
            <Camera className="h-7 w-7 text-clay" />
            <h3 className="mt-5 text-2xl">Vídeo cinematográfico</h3>
            <p className="mt-3 text-muted-foreground">
              Sube las fotos que ya tienes del anuncio y recibe un vídeo con movimiento de cámara
              profesional en minutos, listo para el portal, para redes y para WhatsApp.
            </p>
            <ul className="mt-6 space-y-2 text-sm">
              {["Movimientos de cámara suaves", "Formato horizontal y vertical", "Descarga en MP4"].map(
                (t) => (
                  <li key={t} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-clay" /> {t}
                  </li>
                ),
              )}
            </ul>
            <Button asChild variant="forest" className="mt-7 self-start" size="lg">
              <Link to="/auth">Crear un vídeo</Link>
            </Button>
          </article>

          <article className="surface-card flex flex-col p-8">
            <Sparkles className="h-7 w-7 text-clay" />
            <h3 className="mt-5 text-2xl">Tour 3D interactivo</h3>
            <p className="mt-3 text-muted-foreground">
              Escanea la propiedad con tu móvil usando la app gratuita Scaniverse, sube el archivo y
              recibe un enlace navegable en 3D que tu cliente abre sin instalar nada.
            </p>
            <ul className="mt-6 space-y-2 text-sm">
              {["Solo necesitas tu móvil", "Enlace para compartir o insertar", "Se abre en el navegador"].map(
                (t) => (
                  <li key={t} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-clay" /> {t}
                  </li>
                ),
              )}
            </ul>
            <Button asChild variant="forest" className="mt-7 self-start" size="lg">
              <Link to="/auth">Crear un tour 3D</Link>
            </Button>
          </article>
        </div>
      </div>
    </section>
  );
}

const PASOS = [
  { icono: Upload, titulo: "Subir", texto: "Arrastra tus fotos o el escaneo del móvil." },
  { icono: Cpu, titulo: "Procesar", texto: "Habitour genera el vídeo o publica el tour." },
  { icono: Download, titulo: "Recibir", texto: "Descarga el MP4 o abre tu enlace 3D." },
  { icono: Share2, titulo: "Compartir", texto: "Publícalo en el portal, redes o WhatsApp." },
];

function ComoFunciona() {
  return (
    <section id="pasos" className="mx-auto max-w-6xl px-5 py-20">
      <p className="eyebrow">Cómo funciona</p>
      <h2 className="mt-3 text-3xl md:text-4xl">Cuatro pasos, cero conocimientos técnicos</h2>
      <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {PASOS.map((p, i) => (
          <li key={p.titulo} className="surface-card p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest font-display text-forest-foreground">
                {i + 1}
              </span>
              <p.icono className="h-5 w-5 text-clay" />
            </div>
            <h3 className="mt-4 text-xl">{p.titulo}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{p.texto}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Precios() {
  return (
    <section id="precios" className="bg-sand py-20">
      <div className="mx-auto max-w-6xl px-5">
        <p className="eyebrow">Precios</p>
        <h2 className="mt-3 text-3xl md:text-4xl">Paga por uso o elige un plan mensual</h2>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Todos los planes incluyen entrega en minutos y descarga sin marcas de agua.
        </p>
        <div className="mt-10 grid gap-5 lg:grid-cols-4">
          {PLANES.map((plan) => (
            <div
              key={plan.id}
              className={`surface-card relative flex flex-col p-6 ${
                plan.destacado ? "ring-2 ring-clay shadow-lift" : ""
              }`}
            >
              {plan.destacado && (
                <span className="absolute -top-3 left-6 rounded-full bg-clay px-3 py-1 text-xs font-semibold text-clay-foreground">
                  Más popular
                </span>
              )}
              <h3 className="text-xl">{plan.nombre}</h3>
              <p className="mt-3 font-display text-3xl">{plan.precio}</p>
              <p className="text-sm text-muted-foreground">{plan.periodo}</p>
              <p className="mt-3 text-sm text-muted-foreground">{plan.resumen}</p>
              <ul className="mt-5 flex-1 space-y-2 text-sm">
                {plan.ventajas.map((v) => (
                  <li key={v} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-clay" /> {v}
                  </li>
                ))}
              </ul>
              <Button
                asChild
                variant={plan.destacado ? "clay" : "soft"}
                className="mt-6"
                size="lg"
              >
                <Link to="/auth">Empezar</Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const PREGUNTAS = [
  {
    q: "¿Qué necesito para escanear una propiedad?",
    a: "Solo tu móvil y la app gratuita Scaniverse. Recorre la vivienda despacio, guarda el escaneo, expórtalo como .ply, .spz o .splat y súbelo a Habitour.",
  },
  {
    q: "¿Cuánto tarda?",
    a: "La mayoría de vídeos están listos en menos de cinco minutos. Los tours 3D dependen del tamaño del escaneo, normalmente entre 5 y 15 minutos.",
  },
  {
    q: "¿En qué formatos recibo el resultado?",
    a: "Los vídeos se entregan en MP4 listo para portales y redes. Los tours 3D se entregan como enlace navegable que puedes compartir o insertar en tu web.",
  },
  {
    q: "¿Puedo cancelar cuando quiera?",
    a: "Sí. Los planes son mensuales y sin permanencia: cancelas desde tu cuenta y mantienes el acceso hasta el final del periodo pagado.",
  },
  {
    q: "¿Funciona desde el móvil?",
    a: "Sí. Habitour está pensado para usarse desde el móvil mientras estás en la propiedad: subes, generas y compartes sin volver a la oficina.",
  },
];

function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-5 py-20">
      <p className="eyebrow">Preguntas frecuentes</p>
      <h2 className="mt-3 text-3xl md:text-4xl">Lo que suelen preguntarnos</h2>
      <Accordion type="single" collapsible className="mt-8">
        {PREGUNTAS.map((p) => (
          <AccordionItem key={p.q} value={p.q}>
            <AccordionTrigger className="text-left text-base">{p.q}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">{p.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

function PieDePagina() {
  return (
    <footer className="bg-forest text-forest-foreground">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-2">
        <div>
          <Logo claro />
          <p className="mt-4 max-w-sm text-sm text-forest-foreground/70">
            Vídeos cinematográficos y tours 3D para anuncios inmobiliarios, hechos en minutos desde
            el material que ya tienes.
          </p>
          <div className="mt-6 flex flex-wrap gap-5 text-sm text-forest-foreground/70">
            <a href="#" className="hover:text-forest-foreground">
              Aviso legal
            </a>
            <a href="#" className="hover:text-forest-foreground">
              Privacidad
            </a>
            <a href="#" className="hover:text-forest-foreground">
              Cookies
            </a>
            <a href="#" className="hover:text-forest-foreground">
              Contacto
            </a>
          </div>
        </div>
        <div>
          <h3 className="text-xl text-forest-foreground">Únete a la lista de espera</h3>
          <p className="mt-2 text-sm text-forest-foreground/70">
            Te avisamos cuando abramos nuevas plazas en tu zona.
          </p>
          <div className="mt-5">
            <Waitlist />
          </div>
        </div>
      </div>
      <div className="border-t border-forest-foreground/15 py-5 text-center text-xs text-forest-foreground/60">
        © {new Date().getFullYear()} Habitour
      </div>
    </footer>
  );
}
