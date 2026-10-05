import StatusBadge from "@/components/StatusBadge";
import type { Semaforo } from "@/lib/semaforo";

/**
 * Insignia única de vencimiento de autorizaciones de un paciente (peor caso entre sus prácticas).
 * Verde: más de 7 días. Amarillo: de 3 a 7 días (o sin autorización cargada). Rojo: vencida o 2 días o menos.
 * Los días se calculan en la app, en hora de San Juan (src/lib/semaforo.ts).
 */
export default function SemaforoBadge({ semaforo, conPrefijo = true, className = "" }: { semaforo: Semaforo; conPrefijo?: boolean; className?: string }) {
  const sinAuth = semaforo.dias === null;
  const label = conPrefijo && !sinAuth ? `Autorización: ${semaforo.label.charAt(0).toLowerCase()}${semaforo.label.slice(1)}` : semaforo.label;
  return <StatusBadge tone={semaforo.tone} label={label} className={className} />;
}
