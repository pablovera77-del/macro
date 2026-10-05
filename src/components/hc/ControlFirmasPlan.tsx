import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SPECIALTY_LABELS } from "@/lib/roles";
import { fechaCortaAR } from "@/lib/hc";
import StatusBadge from "@/components/StatusBadge";
import { IconAlert, IconCheck } from "@/components/icons";

/**
 * Control de la historia clínica para Coordinación, Administración y Dirección (solo lectura):
 * 1) evoluciones a las que les falta la firma del profesional o la conformidad de la familia;
 * 2) visitas realizadas de la semana pasada que no coinciden con el plan de tratamiento
 *    (de menos o de más). Alimentado por las vistas v_hc_sin_firmas y v_hc_visitas_vs_plan.
 */
export default async function ControlFirmasPlan() {
  const supabase = await createClient();
  const [{ data: sinFirmas }, { data: vsPlan }] = await Promise.all([
    supabase.from("v_hc_sin_firmas").select("evolution_id, patient_id, profesional_id, especialidad, created_at, falta_firma_profesional, falta_conformidad").order("created_at", { ascending: false }).limit(50),
    supabase.from("v_hc_visitas_vs_plan").select("patient_id, especialidad, semana_desde, esperadas, realizadas, estado").limit(100),
  ]);

  const firmas = sinFirmas ?? [];
  const plan = vsPlan ?? [];
  const patientIds = [...new Set([...firmas.map((f) => f.patient_id), ...plan.map((p) => p.patient_id)].filter((x): x is string => !!x))];
  const profIds = [...new Set(firmas.map((f) => f.profesional_id).filter((x): x is string => !!x))];
  const [{ data: pacientes }, { data: profesionales }] = await Promise.all([
    patientIds.length ? supabase.from("patients").select("id, nombre_completo").in("id", patientIds) : Promise.resolve({ data: [] as { id: string; nombre_completo: string }[] }),
    profIds.length ? supabase.from("profiles").select("id, full_name").in("id", profIds) : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);
  const nombrePaciente = new Map((pacientes ?? []).map((p) => [p.id, p.nombre_completo]));
  const nombreProf = new Map((profesionales ?? []).map((p) => [p.id, p.full_name]));
  const hayAlgo = firmas.length > 0 || plan.length > 0;

  return (
    <section className="space-y-4 animate-fade-slide-up">
      <div className="flex items-center gap-2">
        <span className={`flex items-center justify-center w-8 h-8 rounded-lg ${hayAlgo ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-600"}`}>
          {hayAlgo ? <IconAlert className="w-4 h-4" /> : <IconCheck className="w-4 h-4" />}
        </span>
        <h2 className="text-sm font-medium text-slate-900">
          {hayAlgo ? "Control de firmas y de visitas contra el plan" : "Todas las evoluciones están firmadas y las visitas coinciden con el plan"}
        </h2>
      </div>

      {firmas.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-amber-100 bg-amber-50 text-sm font-medium text-amber-900">
            Evoluciones sin firma completa ({firmas.length})
          </div>
          <ul className="divide-y divide-slate-100">
            {firmas.map((f) => (
              <li key={f.evolution_id} className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap text-sm">
                <div className="min-w-0">
                  <Link href={`/paciente/${f.patient_id}?tab=clinica`} className="text-slate-900 font-medium hover:underline">
                    {nombrePaciente.get(f.patient_id ?? "") ?? "Paciente"}
                  </Link>
                  <div className="text-xs text-slate-500">
                    {SPECIALTY_LABELS[f.especialidad ?? ""] ?? f.especialidad} · {nombreProf.get(f.profesional_id ?? "") ?? "Profesional"} · {fechaCortaAR(f.created_at)}
                  </div>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {f.falta_firma_profesional && <StatusBadge tone="rojo" label="Falta la firma del profesional" />}
                  {f.falta_conformidad && <StatusBadge tone="amarillo" label="Falta la conformidad de la familia" />}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {plan.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 text-sm font-medium text-slate-900">
            Visitas de la semana pasada que no coinciden con el plan ({plan.length})
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="font-medium px-5 py-2">Paciente</th>
                  <th className="font-medium px-3 py-2">Disciplina</th>
                  <th className="font-medium px-3 py-2">Plan</th>
                  <th className="font-medium px-3 py-2">Realizadas</th>
                  <th className="font-medium px-5 py-2">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {plan.map((p) => (
                  <tr key={`${p.patient_id}-${p.especialidad}`}>
                    <td className="px-5 py-2">
                      <Link href={`/paciente/${p.patient_id}?tab=plan`} className="text-slate-900 hover:underline">
                        {nombrePaciente.get(p.patient_id ?? "") ?? "Paciente"}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{SPECIALTY_LABELS[p.especialidad ?? ""] ?? p.especialidad}</td>
                    <td className="px-3 py-2 text-slate-600">{p.esperadas}</td>
                    <td className="px-3 py-2 text-slate-600">{p.realizadas}</td>
                    <td className="px-5 py-2">
                      {p.estado === "exceso" ? <StatusBadge tone="amarillo" label="Más visitas que el plan" /> : <StatusBadge tone="rojo" label="Faltaron visitas" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
