import { createClient } from "@/lib/supabase/server";
import { requireProfile, SPECIALTY_LABELS } from "@/lib/auth";
import { createEvolutionAction } from "./actions";
import PageHeader from "@/components/PageHeader";
import { IconSignature, IconAlert, IconCheck, IconUser } from "@/components/icons";

type Campo = { label: string; tipo: string; obligatorio?: boolean };

function slug(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function inputFor(campo: Campo) {
  const name = `campo__${slug(campo.label)}`;
  const common = "rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs w-full";
  switch (campo.tipo) {
    case "Texto largo":
      return <textarea name={name} required={campo.obligatorio} rows={2} className={common} />;
    case "Número":
    case "Año":
      return <input name={name} type="number" required={campo.obligatorio} className={common} />;
    case "Fecha y hora":
      return <input name={name} type="datetime-local" required={campo.obligatorio} className={common} />;
    case "Fecha":
    case "Día":
      return <input name={name} type="date" required={campo.obligatorio} className={common} />;
    case "Hora":
      return <input name={name} type="time" required={campo.obligatorio} className={common} />;
    default:
      return <input name={name} type="text" required={campo.obligatorio} className={common} />;
  }
}

export default async function EvolucionesPage() {
  const { profile } = await requireProfile();
  const supabase = await createClient();

  const isMedico = profile.role === "medico_coordinador";

  let pendingQuery = supabase
    .from("visits")
    .select("id, patient_id, especialidad, fecha_realizada, patients(nombre_completo)")
    .eq("estado", "realizada")
    .order("fecha_realizada", { ascending: false });
  if (!isMedico) pendingQuery = pendingQuery.eq("profesional_id", profile.id);

  let historyQuery = supabase
    .from("evolutions")
    .select("id, patient_id, especialidad, respuestas, upp_escala_nova5, firma_profesional_at, conformidad_familiar, created_at, patients(nombre_completo), profiles(full_name)")
    .order("created_at", { ascending: false })
    .limit(20);
  if (!isMedico) historyQuery = historyQuery.eq("profesional_id", profile.id);

  const [{ data: visitsRealizadas }, { data: evolutions }, { data: templates }, { data: discrepancias }] = await Promise.all([
    pendingQuery,
    historyQuery,
    supabase.from("discipline_form_templates").select("id, titulo, especialidad, campos").eq("activo", true),
    isMedico ? supabase.from("v_visit_evolution_discrepancies").select("*") : Promise.resolve({ data: null }),
  ]);

  const evolutionVisitIds = new Set((evolutions ?? []).map((e) => e.id));
  void evolutionVisitIds;

  // Visitas realizadas que todavía no tienen evolución cargada (join en memoria
  // porque necesitamos cruzar contra la tabla evolutions por visit_id, no por id).
  const { data: evoVisitLinks } = await supabase.from("evolutions").select("visit_id");
  const linkedVisitIds = new Set((evoVisitLinks ?? []).map((e) => e.visit_id));
  const pendientes = (visitsRealizadas ?? []).filter((v) => !linkedVisitIds.has(v.id));

  return (
    <div className="space-y-8">
      <PageHeader
        icon={<IconSignature className="w-5 h-5" />}
        title="Historia clínica digital"
        section="DF-C2 §5"
        description="Formulario dinámico por disciplina — operacionaliza el motor config-driven del sistema viejo (informe-tecnico §3.2) con las definiciones clínicas reales de DF-C2, incluida la Escala Nova 5 de riesgo UPP (§5.4)."
      />

      {isMedico && (discrepancias ?? []).length > 0 && (
        <section className="bg-red-50 border border-red-200 rounded-2xl p-5 animate-fade-slide-up">
          <div className="flex items-center gap-2 mb-3">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-100 text-red-600">
              <IconAlert className="w-4 h-4" />
            </span>
            <h2 className="text-sm font-medium text-red-800">Visitas realizadas sin evolución cargada — auditoría DF-C2 §8</h2>
          </div>
          <ul className="text-sm text-red-700 space-y-1">
            {(discrepancias ?? []).map((d) => (
              <li key={d.visit_id} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                {SPECIALTY_LABELS[d.especialidad ?? ""] ?? d.especialidad} · {new Date(d.fecha_programada ?? "").toLocaleDateString("es-AR")}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        {pendientes.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-sm animate-fade-slide-up">
            No hay visitas realizadas pendientes de evolución.
          </div>
        )}
        {pendientes.map((v, i) => {
          const template = (templates ?? []).find((t) => t.especialidad === v.especialidad);
          const campos = ((template?.campos as unknown as Campo[]) ?? []);
          return (
            <details key={v.id} className={`bg-white rounded-2xl border border-slate-200 p-5 card-hover animate-fade-slide-up stagger-${Math.min(i + 1, 8)}`}>
              <summary className="cursor-pointer flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <span className="font-medium text-slate-900">{(v.patients as unknown as { nombre_completo: string } | null)?.nombre_completo}</span>
                  <span className="text-xs text-slate-400 ml-2">{SPECIALTY_LABELS[v.especialidad] ?? v.especialidad} · {template?.titulo ?? "sin plantilla"}</span>
                </div>
                <span className="text-xs font-medium text-amber-600 bg-amber-50 rounded-full px-2.5 py-1">Pendiente de evolución</span>
              </summary>

              <form action={createEvolutionAction} className="mt-4 space-y-3">
                <input type="hidden" name="visit_id" value={v.id} />
                <input type="hidden" name="patient_id" value={v.patient_id} />
                <input type="hidden" name="especialidad" value={v.especialidad} />
                {template && <input type="hidden" name="template_id" value={template.id} />}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {campos.map((c) => (
                    <div key={c.label} className={c.tipo === "Texto largo" ? "sm:col-span-2" : ""}>
                      <label className="text-[11px] text-slate-500 mb-1 block">
                        {c.label}
                        {c.obligatorio && <span className="text-red-500"> *</span>}
                      </label>
                      {inputFor(c)}
                    </div>
                  ))}
                </div>

                {v.especialidad === "enfermeria" && (
                  <div className="bg-slate-50 rounded-xl p-3">
                    <div className="text-xs font-medium text-slate-700 mb-2">Escala Nova 5 — riesgo de UPP (DF-C2 §5.4)</div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {[
                        ["estado_mental", "Estado mental"],
                        ["incontinencia", "Incontinencia"],
                        ["movilidad", "Movilidad"],
                        ["nutricion", "Nutrición/Ingesta"],
                        ["actividad", "Actividad"],
                      ].map(([key, label]) => (
                        <div key={key}>
                          <label className="text-[10px] text-slate-500 mb-1 block">{label}</label>
                          <select name={`nova5__${key}`} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs w-full">
                            <option value="0">0</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                          </select>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2">Suma 1–4 riesgo bajo · 5–8 medio · 9–15 alto. Dejar en 0 si no aplica.</p>
                  </div>
                )}

                <div className="flex items-center gap-4 flex-wrap pt-1">
                  <label className="flex items-center gap-1.5 text-xs text-slate-600">
                    <input type="checkbox" name="firmar" defaultChecked className="rounded border-slate-300" /> Firmar como profesional
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-600">
                    <input type="checkbox" name="conformidad_familiar" className="rounded border-slate-300" /> Conformidad familiar registrada
                  </label>
                  <button className="rounded-lg bg-slate-900 text-white text-xs font-medium px-4 py-2 hover:bg-slate-800 transition-colors ml-auto">
                    Guardar evolución
                  </button>
                </div>
              </form>
            </details>
          );
        })}
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden animate-fade-slide-up card-hover">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-medium text-slate-900">{isMedico ? "Últimas evoluciones registradas" : "Mi historial reciente"}</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {(evolutions ?? []).map((e) => (
            <div key={e.id} className="px-5 py-3.5 flex items-start gap-3">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-400 shrink-0">
                <IconUser className="w-4 h-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm text-slate-900 font-medium">{(e.patients as unknown as { nombre_completo: string } | null)?.nombre_completo}</span>
                  <span className="text-xs text-slate-400">{new Date(e.created_at).toLocaleString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {SPECIALTY_LABELS[e.especialidad] ?? e.especialidad}
                  {isMedico && <> · {(e.profiles as unknown as { full_name: string } | null)?.full_name}</>}
                  {e.firma_profesional_at && (
                    <span className="inline-flex items-center gap-0.5 text-emerald-600 ml-2"><IconCheck className="w-3 h-3" /> Firmada</span>
                  )}
                  {e.conformidad_familiar && <span className="text-violet-600 ml-2">· Conformidad familiar</span>}
                </div>
                {e.upp_escala_nova5 && (
                  <div className="text-[11px] mt-1">
                    <span className={`inline-block rounded-full px-2 py-0.5 font-medium ${
                      (e.upp_escala_nova5 as { riesgo?: string }).riesgo === "alto"
                        ? "bg-red-100 text-red-700"
                        : (e.upp_escala_nova5 as { riesgo?: string }).riesgo === "medio"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}>
                      Riesgo UPP: {(e.upp_escala_nova5 as { riesgo?: string }).riesgo} (Nova5 = {(e.upp_escala_nova5 as { total?: number }).total})
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
          {(evolutions ?? []).length === 0 && <div className="px-5 py-8 text-center text-slate-400 text-xs">Sin evoluciones registradas todavía.</div>}
        </div>
      </section>
    </div>
  );
}
