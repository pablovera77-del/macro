// Sistema de color semántico único — DF-C1 §10 "Lineamientos transversales de UX y arquitectura"
//
// Los cinco módulos usan semáforos o indicadores de color (DF-C3 §10, DF-C4 §9, DF-C5 §3)
// y es fácil que terminen significando cosas distintas en cada pantalla. Esta es la ÚNICA
// paleta semántica válida para toda la plataforma — cualquier semáforo/alerta de estado debe
// mapear su propio vocabulario de negocio (p. ej. "vencida", "pendiente", "dado_de_baja") a
// uno de estos cuatro tonos, en vez de elegir un color Tailwind a mano.
//
// No reemplaza los catálogos de texto configurables de DF-C1 §4.2 (los mensajes de alerta
// siguen siendo editables) — es la paleta visual de fondo sobre la que esos mensajes se muestran.

export type SemanticTone = "verde" | "amarillo" | "rojo" | "gris";

export const SEMANTIC_TONE_MEANING: Record<SemanticTone, string> = {
  verde: "Vigente / al día / sin acción pendiente",
  amarillo: "Próximo a vencer o requiere atención en los próximos días",
  rojo: "Vencido, bloqueado o requiere acción inmediata",
  gris: "Inactivo, dado de baja o no aplica",
};

export const SEMANTIC_TONE_BADGE_STYLES: Record<SemanticTone, string> = {
  verde: "bg-emerald-100 text-emerald-700",
  amarillo: "bg-amber-100 text-amber-700",
  rojo: "bg-red-100 text-red-700",
  gris: "bg-slate-200 text-slate-600",
};

// Variante "panel" (fondo + borde), usada en bloques de alerta más grandes
// (ej. el panel de semáforo de vencimientos o el de débitos pendientes).
export const SEMANTIC_TONE_PANEL_STYLES: Record<SemanticTone, { bg: string; border: string; icon: string; title: string; body: string }> = {
  verde: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    icon: "bg-emerald-100 text-emerald-600",
    title: "text-emerald-800",
    body: "text-emerald-800",
  },
  amarillo: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    icon: "bg-amber-100 text-amber-600",
    title: "text-amber-800",
    body: "text-amber-800",
  },
  rojo: {
    bg: "bg-red-50",
    border: "border-red-200",
    icon: "bg-red-100 text-red-600",
    title: "text-red-800",
    body: "text-red-700",
  },
  gris: {
    bg: "bg-slate-50",
    border: "border-slate-200",
    icon: "bg-slate-200 text-slate-600",
    title: "text-slate-700",
    body: "text-slate-600",
  },
};
