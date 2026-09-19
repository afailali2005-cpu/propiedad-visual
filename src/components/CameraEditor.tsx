import { Video } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

export type CameraValues = {
  horizontal: number;
  vertical: number;
  zoom: number;
  pan: number;
  tilt: number;
  rotate: number;
};

export const CAMARA_INICIAL: CameraValues = {
  horizontal: 0,
  vertical: 0,
  zoom: 0,
  pan: 0,
  tilt: 0,
  rotate: 0,
};

const CAMPOS: { key: keyof CameraValues; label: string }[] = [
  { key: "horizontal", label: "Horizontal" },
  { key: "pan", label: "Pan" },
  { key: "vertical", label: "Vertical" },
  { key: "tilt", label: "Tilt" },
  { key: "zoom", label: "Zoom" },
  { key: "rotate", label: "Rotate" },
];

function acotar(v: number) {
  return Math.max(-10, Math.min(10, v));
}

/** Slider bipolar (-10..10) con "estela" de segmentos y valor editable al hacer clic. */
function SliderBipolar({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(value.toFixed(1));

  useEffect(() => {
    if (!editando) setTexto(value.toFixed(1));
  }, [value, editando]);

  function confirmar() {
    const n = Number(texto.replace(",", "."));
    if (!Number.isNaN(n)) onChange(acotar(n));
    setEditando(false);
  }

  const pct = ((value + 10) / 20) * 100;
  const pasos = Math.min(5, Math.round(Math.abs(value) / 2));
  const dir = value >= 0 ? 1 : -1;

  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        {editando ? (
          <input
            type="number"
            step={0.1}
            min={-10}
            max={10}
            value={texto}
            autoFocus
            disabled={disabled}
            onChange={(e) => setTexto(e.target.value)}
            onBlur={confirmar}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmar();
              if (e.key === "Escape") setEditando(false);
            }}
            className="w-16 rounded border border-clay bg-card px-1.5 py-0.5 text-right text-sm tabular-nums outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => !disabled && setEditando(true)}
            disabled={disabled}
            className="rounded px-1 font-medium tabular-nums hover:bg-clay/10 disabled:hover:bg-transparent"
            title="Haz clic para escribir el valor exacto"
          >
            {value.toFixed(1)}
          </button>
        )}
      </div>
      <div className="relative mt-1.5 h-9 w-full overflow-hidden rounded-lg border border-border bg-clay/5">
        {Array.from({ length: pasos }).map((_, i) => (
          <div
            key={i}
            className="pointer-events-none absolute top-1/2 w-1 -translate-y-1/2 rounded-full bg-clay"
            style={{
              left: `${50 + dir * (((i + 1) / 5) * 42)}%`,
              height: "55%",
              opacity: 0.15 + (i / Math.max(pasos, 1)) * 0.35,
            }}
          />
        ))}
        <div
          className="pointer-events-none absolute top-1/2 h-[70%] w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-clay"
          style={{ left: `${pct}%` }}
        />
        <input
          type="range"
          min={-10}
          max={10}
          step={0.1}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
      </div>
    </div>
  );
}

/** Foto + rectángulo de encuadre arrastrable (mover = horizontal/vertical, tiradores laterales = zoom). */
function VisorEncuadre({
  url,
  camera,
  onCamera,
  disabled,
}: {
  url: string;
  camera: CameraValues;
  onCamera: (c: CameraValues) => void;
  disabled?: boolean;
}) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const modoRef = useRef<"mover" | "zoom" | null>(null);
  const inicioRef = useRef<{ x: number; y: number; camera: CameraValues } | null>(null);

  function empezar(modo: "mover" | "zoom") {
    return (e: React.PointerEvent) => {
      if (disabled) return;
      (e.target as Element).setPointerCapture(e.pointerId);
      modoRef.current = modo;
      inicioRef.current = { x: e.clientX, y: e.clientY, camera: { ...camera } };
    };
  }

  function mover(e: React.PointerEvent) {
    if (!modoRef.current || !inicioRef.current || !contenedorRef.current) return;
    const rect = contenedorRef.current.getBoundingClientRect();
    const dx = e.clientX - inicioRef.current.x;
    const dy = e.clientY - inicioRef.current.y;
    if (modoRef.current === "mover") {
      onCamera({
        ...camera,
        horizontal: acotar(inicioRef.current.camera.horizontal + (dx / rect.width) * 22),
        vertical: acotar(inicioRef.current.camera.vertical - (dy / rect.height) * 22),
      });
    } else {
      onCamera({ ...camera, zoom: acotar(inicioRef.current.camera.zoom + (dx / rect.width) * 22) });
    }
  }

  function soltar() {
    modoRef.current = null;
    inicioRef.current = null;
  }

  const ancho = Math.max(22, Math.min(96, 88 - camera.zoom * 3.4));
  const izq = Math.max(1, Math.min(99 - ancho, 50 - ancho / 2 + camera.horizontal * 2.1));
  const arr = Math.max(1, Math.min(99 - ancho * 0.66, 50 - (ancho * 0.66) / 2 - camera.vertical * 2.1));
  const perspectiva = `perspective(600px) rotateX(${camera.tilt * 1.3}deg) rotateY(${camera.pan * 1.3}deg) rotate(${camera.rotate}deg)`;

  return (
    <div
      ref={contenedorRef}
      className="relative aspect-video w-full touch-none select-none overflow-hidden rounded-xl bg-secondary"
      onPointerMove={mover}
      onPointerUp={soltar}
      onPointerCancel={soltar}
    >
      <img src={url} alt="" draggable={false} className="h-full w-full object-cover" />
      <div className="absolute inset-0 bg-background/35" />

      {[0, 1, 2, 3, 4].map((i) => {
        const t = i / 5;
        const w = 100 - (100 - ancho) * t;
        const l = 50 - w / 2 + (izq + ancho / 2 - 50) * t;
        const tp = 50 - (w * 0.66) / 2 + (arr + (ancho * 0.66) / 2 - 50) * t;
        return (
          <div
            key={i}
            className="pointer-events-none absolute rounded-md border border-card/60"
            style={{
              left: `${l}%`,
              top: `${tp}%`,
              width: `${w}%`,
              height: `${w * 0.66}%`,
              opacity: 0.1 + t * 0.2,
              transform: perspectiva,
            }}
          />
        );
      })}

      <div
        className="absolute rounded-lg border-2 border-clay"
        style={{ left: `${izq}%`, top: `${arr}%`, width: `${ancho}%`, height: `${ancho * 0.66}%`, transform: perspectiva }}
      >
        <button
          type="button"
          aria-label="Mover encuadre"
          onPointerDown={empezar("mover")}
          disabled={disabled}
          className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full bg-forest text-forest-foreground shadow-lift active:cursor-grabbing disabled:opacity-50"
        >
          <Video className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Zoom"
          onPointerDown={empezar("zoom")}
          disabled={disabled}
          className="absolute right-0 top-1/2 h-7 w-3.5 -translate-y-1/2 translate-x-1/2 cursor-ew-resize rounded-full bg-card shadow disabled:opacity-50"
        />
        <button
          type="button"
          aria-label="Zoom"
          onPointerDown={empezar("zoom")}
          disabled={disabled}
          className="absolute left-0 top-1/2 h-7 w-3.5 -translate-y-1/2 -translate-x-1/2 cursor-ew-resize rounded-full bg-card shadow disabled:opacity-50"
        />
      </div>
    </div>
  );
}

/**
 * Componente controlado: el padre guarda los valores de cámara de CADA foto
 * (para poder editar varias sin perder lo ya ajustado al cambiar de foto).
 */
export function CameraEditor({
  archivo,
  camera,
  onCameraChange,
  generando,
  etiquetaBoton,
  onSubmit,
}: {
  archivo: File;
  camera: CameraValues;
  onCameraChange: (c: CameraValues) => void;
  generando: boolean;
  etiquetaBoton: string;
  onSubmit: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const nuevaUrl = URL.createObjectURL(archivo);
    setUrl(nuevaUrl);
    return () => URL.revokeObjectURL(nuevaUrl);
  }, [archivo]);

  return (
    <div className="surface-card grid gap-6 p-5 md:grid-cols-[1.2fr_1fr]">
      {url && <VisorEncuadre url={url} camera={camera} onCamera={onCameraChange} disabled={generando} />}
      <div className="flex flex-col">
        <div className="grid grid-cols-2 gap-x-4 gap-y-5">
          {CAMPOS.map((c) => (
            <SliderBipolar
              key={c.key}
              label={c.label}
              value={camera[c.key]}
              disabled={generando}
              onChange={(v) => onCameraChange({ ...camera, [c.key]: v })}
            />
          ))}
        </div>
        <Button variant="clay" size="xl" className="mt-6 w-full" disabled={generando} onClick={onSubmit}>
          {generando ? "Generando…" : etiquetaBoton}
        </Button>
      </div>
    </div>
  );
}
