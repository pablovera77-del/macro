import { SPECIALTY_LABELS } from "@/lib/roles";
import { describirPlan, type Plan } from "@/lib/plan";

/**
 * Datos del paciente que incluye el consentimiento informado detallado (R PFS 05): quién es, el
 * diagnóstico y el plan de tratamiento por disciplina con su frecuencia. Se arma con lo que ya está
 * cargado en la ficha, para que el familiar lo lea antes de aceptar.
 */
export default function ConsentimientoDetalle({
  paciente,
  planes,
}: {
  paciente: { nombre_completo: string; dni: string | null; diagnostico_principal: string | null };
  planes: Pick<Plan, "id" | "especialidad" | "cantidad" | "unidad" | "dias_semana">[];
}) {
  return (
    <dl className="mt-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
      <dt className="text-xs font-medium text-slate-500">Paciente</dt>
      <dd className="text-slate-900">
        {paciente.nombre_completo}
        {paciente.dni ? ` · DNI ${paciente.dni}` : ""}
      </dd>
      <dt className="text-xs font-medium text-slate-500">Diagnóstico</dt>
      <dd className="text-slate-900">{paciente.diagnostico_principal || <span className="text-amber-700">Falta cargar el diagnóstico en el alta del paciente.</span>}</dd>
      <dt className="text-xs font-medium text-slate-500">Plan de tratamiento</dt>
      <dd className="text-slate-900">
        {planes.length === 0 ? (
          <span className="text-amber-700">Todavía no hay plan de tratamiento cargado (se carga en la solapa «Plan de tratamiento»).</span>
        ) : (
          <ul className="space-y-0.5">
            {planes.map((pl) => (
              <li key={pl.id}>
                {SPECIALTY_LABELS[pl.especialidad] ?? pl.especialidad}: {describirPlan(pl)}
              </li>
            ))}
          </ul>
        )}
      </dd>
    </dl>
  );
}
