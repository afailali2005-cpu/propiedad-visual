import { ArrowUpRight, Image as ImageIcon, Plus, Ruler, Tag, Trash2, Type } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";

export type TipoAnotacion = "etiqueta" | "cota" | "texto" | "flecha" | "logo";

export type Anotacion = {
  id: string;
  tipo: TipoAnotacion;
  texto: string;
  /** Posición en porcentaje (0-100) relativa a la imagen, para que funcione a cualquier tamaño. */
  x: number;
  y: number;
  /** Solo para "flecha": punto final, también en porcentaje. */
  x2?: number;
  y2?: number;
  /** Solo para "logo": URL de la imagen (subida por el usuario). */
  logoUrl?: string;
};

const ESTILOS: Record<TipoAnotacion, string> = {
  etiqueta: "bg-forest text-forest-foreground",
  cota: "bg-clay text-clay-foreground",
  texto: "bg-card text-foreground border border-border",
  flecha: "",
  logo: "",
};

function nuevoId() {
  return Math.random().toString(36).slice(2, 10);
}

export function EditorAnotaciones({
  urlImagen,
  anotaciones,
  onCambiar,
}: {
  urlImagen: string;
  anotaciones: Anotacion[];
  onCambiar: (a: Anotacion[]) => void;
}) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const arrastreRef = useRef<{ id: string; extremo?: "fin" } | null>(null);

  function coordenadas(e: { clientX: number; clientY: number }) {
    const rect = contenedorRef.current?.getBoundingClientRect();
    if (!rect) return { x: 50, y: 50 };
    return {
      x: Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)),
    };
  }

  function añadir(tipo: TipoAnotacion) {
    const base: Anotacion = {
      id: nuevoId(),
      tipo,
      texto:
        tipo === "etiqueta" ? "Salón" : tipo === "cota" ? "4,20 m" : tipo === "texto" ? "Texto" : "",
      x: 45,
      y: 45,
    };
    if (tipo === "flecha") {
      base.x2 = 60;
      base.y2 = 60;
    }
    onCambiar([...anotaciones, base]);
    setSeleccion(base.id);
  }

  function añadirLogo(archivo: File) {
    const url = URL.createObjectURL(archivo);
    onCambiar([...anotaciones, { id: nuevoId(), tipo: "logo", texto: "", x: 85, y: 90, logoUrl: url }]);
  }

  function actualizar(id: string, cambios: Partial<Anotacion>) {
    onCambiar(anotaciones.map((a) => (a.id === id ? { ...a, ...cambios } : a)));
  }

  function eliminar(id: string) {
    onCambiar(anotaciones.filter((a) => a.id !== id));
    if (seleccion === id) setSeleccion(null);
  }

  function iniciarArrastre(id: string, extremo?: "fin") {
    return (e: React.PointerEvent) => {
      e.stopPropagation();
      (e.target as Element).setPointerCapture(e.pointerId);
      arrastreRef.current = { id, extremo };
      setSeleccion(id);
    };
  }

  function mover(e: React.PointerEvent) {
    if (!arrastreRef.current) return;
    const { x, y } = coordenadas(e);
    const { id, extremo } = arrastreRef.current;
    if (extremo === "fin") actualizar(id, { x2: x, y2: y });
    else actualizar(id, { x, y });
  }

  function soltar() {
    arrastreRef.current = null;
  }

  const activa = anotaciones.find((a) => a.id === seleccion) ?? null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => añadir("etiqueta")}>
          <Tag className="h-4 w-4" /> Etiqueta de estancia
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => añadir("cota")}>
          <Ruler className="h-4 w-4" /> Cota
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => añadir("texto")}>
          <Type className="h-4 w-4" /> Texto libre
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => añadir("flecha")}>
          <ArrowUpRight className="h-4 w-4" /> Flecha
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => logoInputRef.current?.click()}>
          <ImageIcon className="h-4 w-4" /> Logo
        </Button>
        <input
          ref={logoInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) añadirLogo(f);
            e.target.value = "";
          }}
        />
      </div>

      <div
        ref={contenedorRef}
        id="plano-lienzo"
        className="relative w-full touch-none select-none overflow-hidden rounded-xl border border-border bg-secondary"
        onPointerMove={mover}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        onClick={() => setSeleccion(null)}
      >
        <img src={urlImagen} alt="Plano" className="pointer-events-none block w-full" crossOrigin="anonymous" />

        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          {anotaciones
            .filter((a) => a.tipo === "flecha")
            .map((a) => (
              <line
                key={a.id}
                x1={`${a.x}%`}
                y1={`${a.y}%`}
                x2={`${a.x2 ?? a.x}%`}
                y2={`${a.y2 ?? a.y}%`}
                stroke={a.id === seleccion ? "hsl(var(--clay))" : "#1c201d"}
                strokeWidth={2.5}
                markerEnd="url(#punta-flecha)"
              />
            ))}
          <defs>
            <marker id="punta-flecha" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill="#1c201d" />
            </marker>
          </defs>
        </svg>

        {anotaciones.map((a) => {
          if (a.tipo === "flecha") {
            return (
              <button
                key={a.id}
                type="button"
                onPointerDown={iniciarArrastre(a.id)}
                className={`absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 ${
                  a.id === seleccion ? "border-clay bg-clay/40" : "border-card bg-forest"
                }`}
                style={{ left: `${a.x}%`, top: `${a.y}%` }}
              >
                <span
                  role="presentation"
                  onPointerDown={iniciarArrastre(a.id, "fin")}
                  className="absolute -right-3 -top-3 h-4 w-4 cursor-grab rounded-full border-2 border-card bg-clay"
                />
              </button>
            );
          }
          if (a.tipo === "logo") {
            return (
              <img
                key={a.id}
                src={a.logoUrl}
                alt="Logo"
                onPointerDown={iniciarArrastre(a.id)}
                className={`absolute h-12 w-auto max-w-[120px] -translate-x-1/2 -translate-y-1/2 cursor-grab rounded bg-card/80 p-1 ${
                  a.id === seleccion ? "ring-2 ring-clay" : ""
                }`}
                style={{ left: `${a.x}%`, top: `${a.y}%` }}
              />
            );
          }
          return (
            <div
              key={a.id}
              onPointerDown={iniciarArrastre(a.id)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-grab whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium shadow ${ESTILOS[a.tipo]} ${
                a.id === seleccion ? "ring-2 ring-clay" : ""
              }`}
              style={{ left: `${a.x}%`, top: `${a.y}%` }}
            >
              {a.texto || " "}
            </div>
          );
        })}
      </div>

      {activa && activa.tipo !== "logo" && activa.tipo !== "flecha" && (
        <div className="mt-3 flex items-center gap-2">
          <input
            value={activa.texto}
            onChange={(e) => actualizar(activa.id, { texto: e.target.value })}
            className="flex-1 rounded-lg border border-border bg-card px-3 py-1.5 text-sm"
            placeholder="Texto de la anotación"
          />
          <Button type="button" variant="ghost" size="icon" onClick={() => eliminar(activa.id)} aria-label="Eliminar">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      )}
      {activa && (activa.tipo === "logo" || activa.tipo === "flecha") && (
        <div className="mt-3 flex justify-end">
          <Button type="button" variant="ghost" size="icon" onClick={() => eliminar(activa.id)} aria-label="Eliminar">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        <Plus className="mr-1 inline h-3 w-3" />
        Añade elementos con los botones de arriba, arrástralos sobre el plano y toca uno para editar su texto o borrarlo.
      </p>
    </div>
  );
}
