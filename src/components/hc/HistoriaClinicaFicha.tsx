import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SPECIALTY_LABELS, type AppRole } from "@/lib/auth";
import StatusBadge from "@/components/StatusBadge";
import EvolucionDetalle from "@/components/hc/EvolucionDetalle";
import NotaAclaratoria from "@/components/hc/NotaAclaratoria";
import { IconChevronDown } from "@/components/icons";
import { asNova5, EVOLUCION_COLS, fechaHoraAR, parseCampos, RIESGO_TONE } from "@/lib/hc";

/**
 * Solapa "Historia clínica" de la ficha: cada evolución se abre y muestra su contenido,
 * firmas y notas aclaratorias. Administración y Dirección la ven en solo lectura.
 */
export default async function HistoriaClinicaFicha({ patientId, role, userId }: { patientId: string; role: AppRole; userId: string }) {
  const supabase = await createClient();
  const [{ data: evolutions }, { data: templates }] = await Promise.all([
    supabase
      .from("evolutions")
      .select(`${EVOLUCION_COLS}, profiles(full_name)`)
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("discipline_form_templates").select("id, especialidad, campos"),
  ]);
  const lista = evolutions ?? [];
  const ids = lista.map((e) => e.id);
  const { data: notasRaw } = ids.length
    ? await supabase.from("evolution_notes").select("id, evolution_id, texto, created_at, profiles(full_name)").in("evolution_id", ids).order("created_at", { ascending: true })
    : { data: [] };
  const notas = new Map<string, { id: string; texto: string; created_at: string; autor: string }[]>();
  for (const n of notasRaw ?? []) {
    const arr = notas.get(n.evolution_id) ?? [];
    arr.push({ id: n.id, texto: n.texto, created_at: n.created_at, autor: (n.profiles as unknown as { full_name: string } | null)?.full_name ?? "Profesional" });
    notas.set(n.evolution_id, arr);
  }
  const soloLectura = role === "administracion" || role === "direccion" || role === "facturacion";

  return (
    <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-900">Evoluciones del paciente</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Tocá una evolución para leerla completa. {soloLectura ? "Es solo lectura." : "Las firmadas no se editan: si hay que corregir algo, agregá una nota aclaratoria."}
        </p>
      </div>
      {lista.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-400">Sin evoluciones registradas todavía.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {lista.map((e) => {
            const campos = parseCampos((templates ?? []).find((t) => t.id === e.template_id)?.campos ?? (templates ?? []).find((t) => t.especialidad === e.especialidad)?.campos);
            const autor = (e.profiles as unknown as { full_name: string } | null)?.full_name;
            const nova = asNova5(e.upp_escala_nova5);
            const lasNotas = notas.get(e.id) ?? [];
            const puedeNota = role === "coordinador_internacion" || (role === "profesional_asistencial" && e.profesional_id === userId);
            return (
              <details key={e.id} className="group">
                <summary className="px-5 py-3.5 flex items-start gap-3 cursor-pointer list-none">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-900">
                        {SPECIALTY_LABELS[e.especialidad] ?? e.especialidad}
                        {autor ? <span className="font-normal text-slate-500"> · {autor}</span> : null}
                      </span>
                      <span className="text-xs text-slate-400">{fechaHoraAR(e.created_at)}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                      {e.firma_profesional_at ? <StatusBadge tone="verde" label="Firmada" /> : <StatusBadge tone="amarillo" label="Sin firma del profesional" />}
                      {e.conformidad_familiar ? <StatusBadge tone="verde" label="Conformidad familiar" /> : <StatusBadge tone="amarillo" label="Sin conformidad familiar" />}
                      {e.alerta_cambio && <StatusBadge tone="rojo" label="Cambio de medicación" />}
                      {nova && <StatusBadge tone={RIESGO_TONE[nova.riesgo] ?? "gris"} label={`Riesgo de úlceras: ${nova.riesgo}`} />}
                      {lasNotas.length > 0 && <StatusBadge tone="gris" label={`${lasNotas.length} nota${lasNotas.length === 1 ? "" : "s"} aclaratoria${lasNotas.length === 1 ? "" : "s"}`} />}
                    </div>
                  </div>
                  <IconChevronDown className="w-4 h-4 text-slate-400 mt-1 shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-5 pb-5 pt-1 space-y-4">
                  <EvolucionDetalle e={e} campos={campos} profesionalNombre={autor} />
                  {lasNotas.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Notas aclaratorias</h4>
                      {lasNotas.map((n) => (
                        <div key={n.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                          <p className="text-sm text-slate-900 whitespace-pre-line">{n.texto}</p>
                          <p className="text-[11px] text-slate-500 mt-1">{n.autor} · {fechaHoraAR(n.created_at)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/evoluciones/${e.id}/imprimir`} className="inline-flex items-center rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-medium px-3 py-1.5 hover:bg-slate-50">
                      Imprimir completa
                    </Link>
                    {campos.some((c) => c.narrativa) && (
                      <Link href={`/evoluciones/${e.id}/imprimir?modo=os`} className="inline-flex items-center rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-medium px-3 py-1.5 hover:bg-slate-50">
                        Imprimir para obra social
                      </Link>
                    )}
                  </div>
                  {puedeNota && <NotaAclaratoria evolutionId={e.id} />}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </section>
  );
}
