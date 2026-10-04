import { createClient } from "@/lib/supabase/server";
import { requireProfile, SPECIALTY_LABELS } from "@/lib/auth";
import { createVisitAction, updateVisitStatusAction, cancelVisitAction, rescheduleVisitAction } from "./actions";
import { calcularCumplimiento, semanaActual, describirPlan, type Plan } from "@/lib/plan";
import StatusBadge from "@/components/StatusBadge";
import PageHeader from "@/components/PageHeader";
import SidePanel from "@/components/SidePanel";
import { linkWhatsapp, mensajeRecordatorio, rangoManiana } from "@/lib/reminders";
import Link from "next/link";
import { IconCalendar, IconMapPin, IconCheck, IconAlert } from "@/components/icons";

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

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ paciente?: string; esp?: string; ver?: string }>;
}) {
  const { paciente: pacienteSel, esp: espSel, ver } = await searchParams;
  const { profile } = await requireProfile();
  const supabase = await createClient();

  const isCoordinador = profile.role === "coordinador_internacion";

  let visitsQuery = supabase
    .from("visits")
    .select("id, patient_id, profesional_id, especialidad, fecha_programada, estado, observacion_agenda, patients(nombre_completo, domicilio, telefono_contacto, contacto_familiar_telefono), profiles(full_name)")
    .order("fecha_programada", { ascending: true });

  if (profile.role === "profesional_asistencial") {
    visitsQuery = visitsQuery.eq("profesional_id", profile.id);
  }

  const [{ data: visits }, { data: patients }, { data: profesionales }, { data: evoLinks }, { data: plansRaw }, { data: teamRaw }] = await Promise.all([
    visitsQuery,
    isCoordinador ? supabase.from("patients").select("id, nombre_completo").eq("estado", "activo").order("nombre_completo") : Promise.resolve({ data: null }),
    isCoordinador
      ? supabase.from("profiles").select("id, full_name").eq("role", "profesional_asistencial").eq("active", true).order("full_name")
      : Promise.resolve({ data: null }),
    supabase.from("evolutions").select("visit_id"),
    isCoordinador ? supabase.from("treatment_plans").select("id, patient_id, especialidad, cantidad, unidad, dias_semana, desde, hasta, activo, nota").eq("activo", true) : Promise.resolve({ data: null }),
    isCoordinador ? supabase.from("patient_care_team").select("patient_id, especialidad, profesional_id") : Promise.resolve({ data: null }),
  ]);
  const conEvolucion = new Set((evoLinks ?? []).map((e) => e.visit_id));
  const esProfesional = profile.role === "profesional_asistencial";
  const sinEvolucion = (visits ?? []).filter((v) => v.estado === "realizada" && !conEvolucion.has(v.id));

  // E4: lo que el plan de tratamiento pide y todavía no está en la agenda de esta semana.
  const nombresPaciente = new Map((patients ?? []).map((p) => [p.id, p.nombre_completo]));
  const faltantes = isCoordinador
    ? calcularCumplimiento(
        ((plansRaw ?? []) as unknown as Plan[]).filter((pl) => nombresPaciente.has(pl.patient_id)),
        (visits ?? []).map((v) => ({ patient_id: v.patient_id, especialidad: v.especialidad, fecha_programada: v.fecha_programada, estado: v.estado })),
        semanaActual()
      ).filter((c) => c.faltan > 0)
    : [];
  const equipoPorPaciente = new Map((teamRaw ?? []).map((t) => [`${t.patient_id}|${t.especialidad}`, t.profesional_id]));
  const profesionalSugerido = pacienteSel && espSel ? equipoPorPaciente.get(`${pacienteSel}|${espSel}`) ?? "" : "";

  const now = new Date().getTime();
  // F3: desde el Dashboard, "Visitas de esta semana" abre la agenda ya filtrada.
  const sem = semanaActual();
  const soloSemana = ver === "semana";
  const visitasLista = soloSemana
    ? (visits ?? []).filter((v) => v.fecha_programada >= sem.desde && v.fecha_programada < sem.hasta)
    : (visits ?? []);
  // G4: visitas de mañana, con un link de WhatsApp ya escrito (se envía a mano).
  const maniana = rangoManiana();
  const visitasManiana = isCoordinador
    ? (visits ?? []).filter(
        (v) => (v.estado === "programada" || v.estado === "confirmada") && v.fecha_programada >= maniana.desde && v.fecha_programada < maniana.hasta
      )
    : [];
  const proximas = visitasLista.filter((v) => v.estado !== "realizada" && v.estado !== "cancelada" && v.estado !== "no_realizada");
  const atrasadas = isCoordinador ? (visits ?? []).filter((v) => v.estado !== "realizada" && v.estado !== "cancelada" && v.estado !== "no_realizada").filter((v) => new Date(v.fecha_programada).getTime() < now) : [];
  const historial = visitasLista.filter((v) => v.estado === "realizada" || v.estado === "cancelada" || v.estado === "no_realizada");

  return (
    <div className="space-y-8">
      <PageHeader
        action={isCoordinador ? { label: "+ Programar visita", href: "#programar-visita" } : undefined}
        icon={<IconCalendar className="w-5 h-5" />}
        title={isCoordinador ? "Agenda de visitas" : "Mi agenda"}
        section="DF-C2 §4"
        purpose={
          isCoordinador
            ? "Programá la visita de cada profesional a cada paciente y seguí cuáles ya se hicieron."
            : "Tus visitas asignadas. Al terminar una, tocá «Realizada» y te llevamos a cargar su evolución."
        }
        description="Toda visita marcada 'realizada' debe tener una evolución asociada (control DF-C2 §8)."
      />

      {esProfesional && sinEvolucion.length > 0 && (
        <section className="bg-amber-50 border border-amber-300 rounded-2xl p-5 animate-fade-slide-up">
          <div className="flex items-center gap-2 mb-3">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100 text-amber-600">
              <IconAlert className="w-4 h-4" />
            </span>
            <h2 className="text-sm font-semibold text-amber-900">Te falta cargar {sinEvolucion.length === 1 ? "1 evolución" : `${sinEvolucion.length} evoluciones`}</h2>
          </div>
          <ul className="space-y-2">
            {sinEvolucion.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 flex-wrap bg-white border border-amber-200 rounded-xl px-3.5 py-2.5 text-sm">
                <span>
                  <span className="font-medium text-slate-900">{(v.patients as unknown as { nombre_completo: string } | null)?.nombre_completo}</span>
                  <span className="text-xs text-slate-500 ml-2">{SPECIALTY_LABELS[v.especialidad] ?? v.especialidad} · {formatFecha(v.fecha_programada)}</span>
                </span>
                <Link href={`/evoluciones?visita=${v.id}`} className="rounded-lg bg-emerald-600 text-white text-xs font-medium px-3 py-1.5 hover:bg-emerald-700 transition-colors">
                  Cargar evolución
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isCoordinador && faltantes.length > 0 && (
        <section className="bg-blue-50 border border-blue-200 rounded-2xl p-5 animate-fade-slide-up">
          <h2 className="text-sm font-semibold text-blue-900 mb-3">Faltan programar visitas esta semana según el plan de tratamiento</h2>
          <ul className="space-y-2">
            {faltantes.map((c) => (
              <li key={c.plan.id} className="flex items-center justify-between gap-3 flex-wrap bg-white border border-blue-100 rounded-xl px-3.5 py-2.5 text-sm">
                <span>
                  <Link href={`/paciente/${c.plan.patient_id}?tab=plan`} className="font-medium text-slate-900 hover:underline underline-offset-2">{nombresPaciente.get(c.plan.patient_id)}</Link>
                  <span className="text-xs text-slate-500 ml-2">{SPECIALTY_LABELS[c.plan.especialidad] ?? c.plan.especialidad} · plan {describirPlan(c.plan)} · hay {c.cubiertas} de {c.esperadas}</span>
                </span>
                <span className="flex items-center gap-2">
                  <StatusBadge tone="amarillo" label={`Faltan ${c.faltan}`} />
                  <Link href={`/agenda?paciente=${c.plan.patient_id}&esp=${c.plan.especialidad}#programar-visita`} className="rounded-lg bg-slate-900 text-white text-xs font-medium px-3 py-1.5 hover:bg-slate-800">Programar</Link>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isCoordinador && atrasadas.length > 0 && (
        <section className="bg-red-50 border border-red-200 rounded-2xl p-5 animate-fade-slide-up">
          <h2 className="text-sm font-semibold text-red-900 mb-3">Visitas atrasadas: la fecha pasó y nadie las cerró ({atrasadas.length})</h2>
          <ul className="space-y-2">
            {atrasadas.map((v) => (
              <li key={v.id} className="bg-white border border-red-100 rounded-xl px-3.5 py-2.5 text-sm">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span>
                    <span className="font-medium text-slate-900">{(v.patients as unknown as { nombre_completo: string } | null)?.nombre_completo}</span>
                    <span className="text-xs text-slate-500 ml-2">{SPECIALTY_LABELS[v.especialidad] ?? v.especialidad} · {formatFecha(v.fecha_programada)} · {(v.profiles as unknown as { full_name: string } | null)?.full_name}</span>
                  </span>
                  <form action={rescheduleVisitAction} className="flex items-center gap-2">
                    <input type="hidden" name="visit_id" value={v.id} />
                    <input name="fecha_programada" type="datetime-local" required className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" aria-label="Nueva fecha" />
                    <button className="rounded-lg bg-slate-900 text-white text-xs font-medium px-3 py-1.5 hover:bg-slate-800">Reprogramar</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isCoordinador && visitasManiana.length > 0 && (
        <section className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 animate-fade-slide-up">
          <h2 className="text-sm font-semibold text-emerald-900 mb-1">Recordatorios para mañana ({maniana.etiqueta})</h2>
          <p className="text-xs text-emerald-800 mb-3">Se abre WhatsApp con el mensaje escrito. Revisá el número y tocá «Enviar»: la app no manda nada sola.</p>
          <ul className="space-y-2">
            {visitasManiana.map((v) => {
              const pac = v.patients as unknown as { nombre_completo: string; telefono_contacto: string | null; contacto_familiar_telefono: string | null } | null;
              const profNombre = (v.profiles as unknown as { full_name: string } | null)?.full_name ?? null;
              const tel = pac?.telefono_contacto || pac?.contacto_familiar_telefono || null;
              const link = linkWhatsapp(
                tel,
                mensajeRecordatorio({ paciente: pac?.nombre_completo ?? "el paciente", disciplina: SPECIALTY_LABELS[v.especialidad] ?? v.especialidad, fechaIso: v.fecha_programada, profesional: profNombre })
              );
              return (
                <li key={v.id} className="flex items-center justify-between gap-3 flex-wrap bg-white border border-emerald-200 rounded-xl px-3.5 py-2.5 text-sm">
                  <span>
                    <span className="font-medium text-slate-900">{pac?.nombre_completo}</span>
                    <span className="text-xs text-slate-500 ml-2">
                      {SPECIALTY_LABELS[v.especialidad] ?? v.especialidad} · {new Date(v.fecha_programada).toLocaleTimeString("es-AR", { timeZone: "America/Argentina/San_Juan", hour: "2-digit", minute: "2-digit", hour12: false })} hs{profNombre ? ` · ${profNombre}` : ""}
                    </span>
                  </span>
                  {link ? (
                    <a href={link} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-emerald-600 text-white text-xs font-medium px-3 py-1.5 hover:bg-emerald-700 transition-colors">
                      Avisar por WhatsApp
                    </a>
                  ) : (
                    <span className="text-xs text-amber-700">Sin teléfono cargado</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        {soloSemana && (
          <div className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm">
            <span className="text-slate-800">
              Mostrando: <strong>visitas de esta semana</strong> ({visitasLista.length})
            </span>
            <Link href="/agenda" className="text-xs font-medium text-[var(--brand-teal)] underline underline-offset-2">
              Quitar filtro y ver todas
            </Link>
          </div>
        )}
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
                  <Link href={`/paciente/${v.patient_id}`} className="font-medium text-slate-900 hover:underline underline-offset-2">{(v.patients as unknown as { nombre_completo: string } | null)?.nombre_completo}</Link>
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
        <SidePanel id="programar-visita" title="Programar visita">
          <form key={`${pacienteSel ?? ""}|${espSel ?? ""}`} action={createVisitAction} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <select name="patient_id" required defaultValue={pacienteSel ?? ""} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm sm:col-span-2">
              <option value="">Paciente...</option>
              {(patients ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.nombre_completo}</option>
              ))}
            </select>
            <select name="profesional_id" required defaultValue={profesionalSugerido} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm sm:col-span-2">
              <option value="">Profesional...</option>
              {(profesionales ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
            <select name="especialidad" required defaultValue={espSel ?? "enfermeria"} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
              {Object.entries(SPECIALTY_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <input name="fecha_programada" type="datetime-local" required className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
            <input name="observacion_agenda" placeholder="Observación (opcional)" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm sm:col-span-2" />
            <button className="rounded-xl bg-slate-900 text-white text-sm font-medium px-4 py-2.5 hover:bg-slate-800 transition-colors">Programar</button>
          </form>
        </SidePanel>
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
                  <th className="text-left px-5 py-2.5 font-medium">Evolución</th>
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
                    <td className="px-5 py-2.5 text-xs">
                      {v.estado !== "realizada" ? (
                        <span className="text-slate-300">—</span>
                      ) : conEvolucion.has(v.id) ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700"><IconCheck className="w-3 h-3" /> Cargada</span>
                      ) : esProfesional ? (
                        <Link href={`/evoluciones?visita=${v.id}`} className="font-medium text-amber-700 underline underline-offset-2">Pendiente · cargar</Link>
                      ) : (
                        <span className="text-amber-700">Pendiente</span>
                      )}
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
