import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/auth";
import { fechaHoraAR } from "@/lib/hc";
import { IconAlert, IconArrowRight } from "@/components/icons";

type Alerta = {
  id: string;
  patient_id: string;
  alerta_motivo: string | null;
  created_at: string;
  patients: { nombre_completo: string } | null;
  profiles: { full_name: string } | null;
};

/**
 * Tarjeta de Inicio: cambios relevantes de medicación avisados por el médico en los últimos 7 días.
 * Administración y Coordinación ven todos; cada profesional ve los de los pacientes de su equipo.
 * Si no hay ninguno (o la consulta falla), no muestra nada.
 */
async function cargarAlertas(role: AppRole, userId: string): Promise<Alerta[]> {
  const supabase = await createClient();
  try {
    const desde = new Date(Date.now() - 7 * 86400000).toISOString();
    let ids: string[] | null = null;
    if (role === "profesional_asistencial") {
      const { data: equipo } = await supabase.from("patient_care_team").select("patient_id").eq("profesional_id", userId);
      ids = [...new Set((equipo ?? []).map((t) => t.patient_id))];
      if (ids.length === 0) return [];
    }
    let q = supabase
      .from("evolutions")
      .select("id, patient_id, alerta_motivo, created_at, patients(nombre_completo), profiles(full_name)")
      .eq("alerta_cambio", true)
      .gte("created_at", desde)
      .order("created_at", { ascending: false })
      .limit(8);
    if (ids) q = q.in("patient_id", ids);
    const { data, error } = await q;
    if (error) return [];
    return (data ?? []) as unknown as Alerta[];
  } catch {
    return [];
  }
}

export default async function AlertasCambioMedicacion({ role, userId }: { role: AppRole; userId: string }) {
  if (role !== "administracion" && role !== "coordinador_internacion" && role !== "profesional_asistencial") return null;
  const alertas = await cargarAlertas(role, userId);
  if (alertas.length === 0) return null;
  {
    return (
      <section className="animate-fade-slide-up">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Cambios de medicación avisados</h2>
        <ul className="space-y-2">
          {alertas.map((a) => (
            <li key={a.id}>
              <Link
                href={`/paciente/${a.patient_id}?tab=mensajes`}
                className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 hover:bg-red-100 transition-colors"
              >
                <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-red-100 text-red-700 shrink-0">
                  <IconAlert className="w-4 h-4" />
                </span>
                <span className="text-sm text-slate-700 flex-1 min-w-0">
                  <strong className="text-slate-900">{a.patients?.nombre_completo ?? "Paciente"}</strong>
                  <span className="block text-slate-700">{a.alerta_motivo ?? "El médico avisó un cambio relevante."}</span>
                  <span className="block text-[11px] text-slate-500 mt-0.5">
                    {a.profiles?.full_name} · {fechaHoraAR(a.created_at)}
                  </span>
                </span>
                <IconArrowRight className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    );
  }
}
