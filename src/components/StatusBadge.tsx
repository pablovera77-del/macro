import { SEMANTIC_TONE_BADGE_STYLES, SemanticTone } from "@/lib/semantic-status";

// Badge de estado que usa siempre el sistema de color semántico único (DF-C1 §10).
// Cada pantalla define su propio vocabulario de estados (ej. "vencida", "pendiente",
// "dado_de_baja") y los mapea a uno de los 4 tonos (verde/amarillo/rojo/gris) — nunca
// elige un color Tailwind directamente.
export default function StatusBadge({
  tone,
  label,
  className = "",
}: {
  tone: SemanticTone;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${SEMANTIC_TONE_BADGE_STYLES[tone]} ${className}`}
    >
      {label}
    </span>
  );
}
