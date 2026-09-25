import { createClient } from "@/lib/supabase/server";
import { requireProfile, SPECIALTY_LABELS } from "@/lib/auth";
import { createVisitAction, updateVisitStatusAction, cancelVisitAction } from "./actions";
import PageHeader from "@/components/PageHeader";
import { IconCalendar, IconMapPin, IconCheck } from "@/components/icons";

const ESTADO_STYLES: Record<string, string> = {
  programada: "bg-blue-100 text-blue-700",
  confirmada: "bg-violet-100 text-violet-700",
  realizada: "bg-emerald-100 text-emerald-700",
  no_realizada: "bg-red-100 text-red-700",
  cancelada: "bg-slate-200 text-slate-500",
};
const ESTADO_LABELS: Record<string, string> = {
  programada: "Programada",
  confirmada: "Confirmada",
  realizada: "Realizada",
  no_realizada: "No realizada",
  cancelada: "Cancelada",
};

function formatFecha(iso: string) {
  return new Date(iso).toLocaleString("es-AR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default async function AgendaPage() {
  const { profile } = await requireProfile();
  const supabase = await createClient();

  const isCoordinador = profile.role === "coordinador_internacion" || profile.role === "medico_coordinador";

  let visitsQuery = supabase
    .from("visits")
    .select("id, patient_id, profesional_id, especialidad, fecha_programada, estado, observacion_agenda, patients(nombre_completo, domicilio), profiles(full_name)")
    .order("fecha_programada", { ascending: true });

  if (profile.role === "profesional_asistencial") {
    visitsQuery = visitsQuery.eq("profesional_id", profile.id);
  }

  const [{ data: visits }, { data: patients }, { data: profesionales }] = await Promise.all([
    visitsQuery,
    isCoordinador ? supabase.from("patients").select("id, nombre_completo").eq("estado", "activo").order("nombre_completo") : Promise.resolve({ data: null }),
    isCoordinador
      ? supabase.from("profiles").select("id, full_name").eq("role", "profesional_asistencial").eq("active", true).order("full_name")
      : Promise.resolve({ data: null }),
  ]);

  const now = new Date().getTime();
  const proximas = (visits ?? []).filter((v) => v.estado !== "realizada" && v.estado !== "cancelada" && v.estado !== "no_realizada");
  const historial = (visits ?? []).filter((v) => v.estado === "realizada" || v.estado === "cancelada" || v.estado === "no_realizada");

  return (
    <div className="space-y-8">
      <PageHeader
        icon={<IconCalendar className="w-5 h-5" />}
        title={isCoordinador ? "Agenda de visitas" : "Mi agenda"}
        section="DF-C2 §4"
        description="Programación y seguimiento de visitas domiciliarias por disciplina. Toda visita marcada 'realizada' debe tener una evolución asociada (control DF-C2 §8)."
      />

      <section className="space-y-3">
        {proximas.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-sm animate-fade-slide-up">
            No hay visitas próximas.
          </div>
        )}
        {proximas.map((v, i) => {
          const atrasada = new Date(v.fecha_programada).getTime() < now && v.estado === "programada";
          return (
            <div key={v.id} className={`bg-white rounded-2xl border p-5 card-hover animate-fade-slide-up stagger-${Math.min(i + 1, 8)} ${atrasada ? "border-amber-300 bg-amber-50/40" : "border-slate-200"}`}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="font-medium text-slate-900">{(v.patients as unknown as { nombre_completo: string } | null)?.nombre_completo}</div>
                  <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <IconMapPin className="w-3 h-3" /> {(v.patients as unknown as { domicilio: string } | null)?.domicilio}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {formatFecha(v.fecha_programada)} · {SPECIALTY_LABELS[v.especialidad] ?? v.especialidad}
                    {isCoordinador && <> · {(v.profiles as unknown as { full_name: string } | null)?.full_name}</>}
                  </div>
                  {v.observacion_agenda && <div className="text-xs text-slate-400 mt-1">{v.observacion_agenda}</div>}
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${ESTADO_STYLES[v.estado]}`}>{ESTADO_LABELS[v.estado]}</span>
                  {profile.role === "profesional_asistencial" && v.estado === "programada" && (
                    <form action={updateVisitStatusAction}>
                      <input type="hidden" name="visit_id" value={v.id} />
                      <input type="hidden" name="estado" value="confirmada" />
                      <button className="rounded-full bg-violet-600 text-white text-xs font-medium px-3 py-1 hover:bg-violet-700 transition-colors">Confirmar</button>
                    </form>
                  )}
                  {profile.role === "profesional_asistencial" && (v.estado === "programada" || v.estado === "confirmada") && (
                    <>
                      <form action={updateVisitStatusAction}>
                        <input type="hidden" name="visit_id" value={v.id} />
                        <input type="hidden" name="estado" value="realizada" />
                        <button className="inline-flex items-center gap-1 rounded-full bg-emerald-600 text-white text-xs font-medium px-3 py-1 hover:bg-emerald-700 transition-colors">
                          <IconCheck className="w-3 h-3" /> Realizada
                        </button>
                      </form>
                      <form action={updateVisitStatusAction}>
                        <input type="hidden" name="visit_id" value={v.id} />
                        <input type="hidden" name="estado" value="no_realizada" />
                        <button className="rounded-full bg-red-100 text-red-700 text-xs font-medium px-3 py-1 hover:bg-red-200 transition-colors">No realizada</button>
                      </form>
                    </>
                  )}
                  {isCoordinador && (v.estado === "programada" || v.estado === "confirmada") && (
                    <form action={cancelVisitAction}>
                      <input type="hidden" name="visit_id" value={v.id} />
                      <button className="rounded-full bg-slate-100 text-slate-500 text-xs font-medium px-3 py-1 hover:bg-slate-200 transition-colors">Cancelar</button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {isCoordinador && (
        <section className="bg-white rounded-2xl border border-slate-200 p-5 animate-fade-slide-up card-hover">
          <h2 className="text-sm font-medium text-slate-900 mb-4 flex items-center gap-2">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-500">+</span>
            Programar visita
          </h2>
          <form action={createVisitAction} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <select name="patient_id" required className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm sm:col-span-2">
              <option value="">Paciente...</option>
              {(patients ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.nombre_completo}</option>
              ))}
            </select>
            <select name="profesional_id" required className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm sm:col-span-2">
              <option value="">Profesional...</option>
              {(profesionales ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
            <select name="especialidad" required className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
              {Object.entries(SPECIALTY_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <input name="fecha_programada" type="datetime-local" required className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
            <input name="observacion_agenda" placeholder="Observación (opcional)" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm sm:col-span-2" />
            <button className="rounded-xl bg-slate-900 text-white text-sm font-medium px-4 py-2.5 hover:bg-slate-800 transition-colors">Programar</button>
          </form>
        </section>
      )}

      {historial.length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden animate-fade-slide-up card-hover">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-medium text-slate-900">Historial reciente</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-5 py-2.5 font-medium">Paciente</th>
                  <th className="text-left px-5 py-2.5 font-medium">Disciplina</th>
                  <th className="text-left px-5 py-2.5 font-medium">Fecha</th>
                  <th className="text-left px-5 py-2.5 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historial.slice(0, 15).map((v) => (
                  <tr key={v.id} className="row-hover hover:bg-slate-50">
                    <td className="px-5 py-2.5 text-slate-900">{(v.patients as unknown as { nombre_completo: string } | null)?.nombre_completo}</td>
                    <td className="px-5 py-2.5 text-slate-600">{SPECIALTY_LABELS[v.especialidad] ?? v.especialidad}</td>
                    <td className="px-5 py-2.5 text-slate-500 text-xs">{formatFecha(v.fecha_programada)}</td>
                    <td className="px-5 py-2.5">
                      <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${ESTADO_STYLES[v.estado]}`}>{ESTADO_LABELS[v.estado]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
