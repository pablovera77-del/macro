import StatusBadge from "@/components/StatusBadge";
import { asNova5, RIESGO_TONE, fechaCortaAR } from "@/lib/hc";
import type { Json } from "@/types/database";

/** Último riesgo de úlceras por presión (Nova 5) del paciente, para la ficha. */
export default function UppBadge({ nova5, fecha }: { nova5: Json | null | undefined; fecha?: string | null }) {
  const n = asNova5(nova5);
  if (!n) return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      <StatusBadge tone={RIESGO_TONE[n.riesgo] ?? "gris"} label={`Riesgo de úlceras: ${n.riesgo} (Nova 5 = ${n.total})`} />
      {fecha && <span className="text-[11px] text-slate-400">valorado el {fechaCortaAR(fecha)}</span>}
    </span>
  );
}
