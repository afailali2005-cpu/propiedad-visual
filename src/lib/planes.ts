export type PlanId = "free" | "starter" | "pro" | "agency";

export type Plan = {
  id: PlanId;
  nombre: string;
  precio: string;
  periodo: string;
  resumen: string;
  videos: number;
  tours: number;
  destacado?: boolean;
  ventajas: string[];
};

export const PLANES: Plan[] = [
  {
    id: "free",
    nombre: "Pay-per-uso",
    precio: "19€",
    periodo: "por vídeo · 15€ por tour 3D",
    resumen: "Sin cuota mensual. Pagas solo lo que generas.",
    videos: 0,
    tours: 0,
    ventajas: [
      "19€ por vídeo cinematográfico",
      "15€ por tour 3D interactivo",
      "Entrega en minutos",
      "Sin permanencia",
    ],
  },
  {
    id: "starter",
    nombre: "Starter",
    precio: "49€",
    periodo: "al mes",
    resumen: "Para el agente que publica unos pocos anuncios al mes.",
    videos: 5,
    tours: 1,
    ventajas: ["5 vídeos al mes", "1 tour 3D al mes", "Descarga en MP4 y enlace web", "Soporte por email"],
  },
  {
    id: "pro",
    nombre: "Pro",
    precio: "99€",
    periodo: "al mes",
    resumen: "El equilibrio ideal para una cartera activa.",
    videos: 15,
    tours: 4,
    destacado: true,
    ventajas: [
      "15 vídeos al mes",
      "4 tours 3D al mes",
      "Formatos vertical y horizontal",
      "Soporte prioritario",
    ],
  },
  {
    id: "agency",
    nombre: "Agency",
    precio: "199€",
    periodo: "al mes",
    resumen: "Para agencias con varios comerciales y volumen alto.",
    videos: 40,
    tours: 12,
    ventajas: ["40 vídeos al mes", "12 tours 3D al mes", "Varios usuarios", "Gestor de cuenta dedicado"],
  },
];

export const LIMITES: Record<PlanId, { videos: number; tours: number }> = {
  free: { videos: 1, tours: 1 },
  starter: { videos: 5, tours: 1 },
  pro: { videos: 15, tours: 4 },
  agency: { videos: 40, tours: 12 },
};

export const NOMBRE_PLAN: Record<PlanId, string> = {
  free: "Pay-per-uso",
  starter: "Starter",
  pro: "Pro",
  agency: "Agency",
};
