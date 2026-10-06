import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SPECIALTY_LABELS } from "@/lib/roles";
import StatusBadge from "@/components/StatusBadge";
import ConfirmButton from "@/components/ConfirmButton";
import IniciarVisitaButton from "@/components/agenda/IniciarVisitaButton";
import { updateVisitStatusAction, noMeAtendieronAction } from "@/app/(dashboard)/agenda/actions";
import ActionDisclosure from "@/components/ActionDisclosure";
import PhotoField from "@/components/stock/PhotoField";
import { linkWhatsapp } from "@/lib/reminders";
import { IconCheck, IconMapPin } from "@/components/icons";
import { calcularCumplimiento, describirPlan, semanaActual, hoyAR, TZ, type Plan } from "@/lib/plan";
import { descripcionHorario, horaAR } from "@/lib/horario";
import { telHref, urlMapa, urlRuta } from "@/lib/mapa";
import { COLUMNAS_VISITA_AGENDA, type VisitaAgenda } from "@/lib/agenda-tipos";

// Inicio de día (00:00 en San Juan, UTC-3 sin horario de verano) como instante ISO.
function inicioDeDia(offsetDias: number): string {
  const ymd = new Intl.DateTimeFormat("sv-SE", { timeZone: TZ }).format(new Date(Date.now() + offsetDias * 86400000));
  return new Date(`${ymd}T00:00:00-03:00`).toISOString();
}

const dia = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", timeZone: TZ });
const fechaLarga = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", timeZone: TZ });
const etiquetaClave = (k: string) => {
  const t = k.replace(/_/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/** Resumen corto de lo que se cargó en una evolución: los primeros campos con texto, recortados. */
function resumirRespuestas(respuestas: unknown): string {
  if (!respuestas || typeof respuestas !== "object" || Array.isArray(respuestas)) return "";
  const partes: string[] = [];
  for (const [k, v] of Object.entries(respuestas as Record<string, unknown>)) {
    const txt = typeof v === "string" ? v.trim() : typeof v === "number" || typeof v === "boolean" ? String(v) : "";
    if (!txt) continue;
    partes.push(`${etiquetaClave(k)}: ${txt}`);
    if (partes.length === 2) break;
  }
  const out = partes.join(" · ");
  return out.length > 150 ? `${out.slice(0, 147)}…` : out;
}

type Evo = { patient_id: string; especialidad: string; created_at: string; respuestas: unknown };
type Autorizacion = { patient_id: string; especialidad: string; practica: string; cantidad_autorizada: number; periodo_desde: string; periodo_hasta: string };

const btn = "w-full min-h-11 inline-flex items-center justify-center gap-1.5 rounded-xl text-sm font-medium transition-colors";

/**
 * «Mi día» (C3 + benchmark UX): para el profesional, las visitas de hoy y mañana (más las atrasadas que
 * siguen sin cerrarse). Cada tarjeta trae lo necesario antes de entrar al domicilio: ficha del paciente,
 * última evolución, autorización vigente y cupo que queda de la semana.
 */
export default async function MiDia({ userId }: { userId: string }) {
  const supabase = await createClient();
  const hoyInicio = inicioDeDia(0);
  const mananaInicio = inicioDeDia(1);
  const pasadoManana = inicioDeDia(2);
  const { data } = await supabase
    .from("visits")
    .select(COLUMNAS_VISITA_AGENDA)
    .eq("profesional_id", userId)
    .in("estado", ["programada", "confirmada"])
    .lt("fecha_programada", pasadoManana)
    .order("fecha_programada", { ascending: true });
  const visitas = (data ?? []) as unknown as VisitaAgenda[];

  // Información previa a la visita. Si alguna consulta falla, la tarjeta se muestra sin ese dato.
  const pacienteIds = [...new Set(visitas.map((v) => v.patient_id))];
  const sem = semanaActual();
  const hoy = hoyAR();
  const evoPorPaciente = new Map<string, Evo>();
  let autorizaciones: Autorizacion[] = [];
  let cumplimiento: ReturnType<typeof calcularCumplimiento> = [];
  if (pacienteIds.length > 0) {
    const [evos, auts, planes, semana] = await Promise.all([
      supabase.from("evolutions").select("patient_id, especialidad, created_at, respuestas").in("patient_id", pacienteIds).order("created_at", { ascending: false }).limit(200),
      supabase.from("treatment_authorizations").select("patient_id, especialidad, practica, cantidad_autorizada, periodo_desde, periodo_hasta").in("patient_id", pacienteIds),
      supabase.from("treatment_plans").select("id, patient_id, especialidad, cantidad, unidad, dias_semana, desde, hasta, activo, nota").eq("activo", true).in("patient_id", pacienteIds),
      supabase.from("visits").select("patient_id, especialidad, fecha_programada, estado").in("patient_id", pacienteIds).gte("fecha_programada", sem.desde).lt("fecha_programada", sem.hasta),
    ]);
    for (const e of (evos.data ?? []) as unknown as Evo[]) if (!evoPorPaciente.has(e.patient_id)) evoPorPaciente.set(e.patient_id, e);
    autorizaciones = (auts.data ?? []) as Autorizacion[];
    cumplimiento = calcularCumplimiento((planes.data ?? []) as unknown as Plan[], semana.data ?? [], sem);
  }

  const recorridoHoy = visitas.filter((v) => v.fecha_programada >= hoyInicio && v.fecha_programada < mananaInicio);
  const rutaHoy = urlRuta(recorridoHoy.map((v) => ({ lat: null, lng: null, domicilio: v.patients?.domicilio ?? null })));

  const grupos = [
    { titulo: "Atrasadas — cerralas como realizadas o no realizadas", items: visitas.filter((v) => v.fecha_programada < hoyInicio), tone: "rojo" as const },
    { titulo: "Hoy", items: visitas.filter((v) => v.fecha_programada >= hoyInicio && v.fecha_programada < mananaInicio), tone: "verde" as const },
    { titulo: "Mañana", items: visitas.filter((v) => v.fecha_programada >= mananaInicio), tone: "gris" as const },
  ];

  return (
    <section className="animate-fade-slide-up">
      <h2 className="text-sm font-semibold text-slate-900 mb-3">Mi día</h2>
      {visitas.length === 0 ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3 text-sm text-emerald-800">
          <IconCheck className="w-4 h-4" /> No tenés visitas para hoy ni para mañana.
        </div>
      ) : (
        <div className="space-y-5">
          {recorridoHoy.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Recorrido de hoy ({recorridoHoy.length})</h3>
                  <p className="text-xs text-slate-500">En el orden de la agenda. Abrí la ruta en el mapa y avisá a las familias que salís.</p>
                </div>
                {rutaHoy && (
                  <a href={rutaHoy} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800">Ver recorrido en el mapa</a>
                )}
              </div>
              <ul className="divide-y divide-slate-100 text-sm">
                {recorridoHoy.map((v) => {
                  const wa = linkWhatsapp(
                    v.patients?.contacto_familiar_telefono ?? v.patients?.telefono_contacto,
                    `Hola, le escribimos de Profesionales SRL. Salimos hacia el domicilio de ${v.patients?.nombre_completo ?? "su familiar"} para la visita de ${(SPECIALTY_LABELS[v.especialidad] ?? v.especialidad).toLowerCase()} de hoy. Cualquier inconveniente, por favor avísenos por este medio.`
                  );
                  return (
                    <li key={v.id} className="py-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-xs text-slate-500 w-28">{descripcionHorario(v)}</span>
                      <span className="font-medium text-slate-900">{v.patients?.nombre_completo}</span>
                      {wa ? (
                        <a href={wa} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-700 underline underline-offset-2 ml-auto">Avisar a la familia por WhatsApp</a>
                      ) : (
                        <span className="text-xs text-slate-400 ml-auto">Sin teléfono de la familia cargado</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {grupos.filter((g) => g.items.length > 0).map((g) => (
            <div key={g.titulo}>
              <div className="mb-2 flex items-center gap-2">
                <StatusBadge tone={g.tone} label={`${g.items.length}`} />
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{g.titulo}</h3>
              </div>
              <ul className="space-y-3">
                {g.items.map((v) => {
                  const p = v.patients;
                  const evo = evoPorPaciente.get(v.patient_id);
                  const resumen = evo ? resumirRespuestas(evo.respuestas) : "";
                  const aut = autorizaciones
                    .filter((a) => a.patient_id === v.patient_id && a.especialidad === v.especialidad && a.periodo_desde <= hoy && a.periodo_hasta >= hoy)
                    .sort((a, b) => b.periodo_hasta.localeCompare(a.periodo_hasta))[0];
                  const cupo = cumplimiento.find((c) => c.plan.patient_id === v.patient_id && c.plan.especialidad === v.especialidad);
                  const telFamiliar = telHref(p?.contacto_familiar_telefono);
                  const telPaciente = telHref(p?.telefono_contacto);
                  const enCurso = !!v.abierta_at;
                  return (
                    <li key={v.id} className="bg-white rounded-2xl border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link href={`/paciente/${v.patient_id}`} className="font-medium text-slate-900 hover:underline underline-offset-2">
                            {p?.nombre_completo}
                          </Link>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {g.tone === "rojo" ? `${dia(v.fecha_programada)} · ` : ""}
                            {descripcionHorario(v)} · {SPECIALTY_LABELS[v.especialidad] ?? v.especialidad}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {enCurso && <StatusBadge tone="amarillo" label={`En curso desde las ${horaAR(v.abierta_at as string)}`} />}
                          <StatusBadge tone={v.estado === "confirmada" ? "verde" : "amarillo"} label={v.estado === "confirmada" ? "Confirmada" : "Programada"} />
                        </div>
                      </div>

                      {p?.domicilio && (
                        <a href={urlMapa(p.domicilio)} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-1.5 text-sm text-slate-700 hover:underline">
                          <IconMapPin className="w-4 h-4 text-slate-400 shrink-0" /> {p.domicilio}
                        </a>
                      )}
                      {(telFamiliar || telPaciente) && (
                        <div className="mt-1 flex flex-col gap-0.5 text-sm text-slate-700">
                          {telFamiliar && (
                            <a href={telFamiliar} className="hover:underline">
                              Familiar: {p?.contacto_familiar_nombre ?? "contacto"} · {p?.contacto_familiar_telefono}
                            </a>
                          )}
                          {telPaciente && (
                            <a href={telPaciente} className="hover:underline">
                              Paciente: {p?.telefono_contacto}
                            </a>
                          )}
                        </div>
                      )}

                      <div className="mt-3 rounded-xl bg-slate-50 border border-slate-100 p-3 text-xs text-slate-600 space-y-1.5">
                        <div>
                          <span className="font-medium text-slate-700">Última evolución: </span>
                          {evo ? (
                            <>
                              {fechaLarga(evo.created_at)} · {SPECIALTY_LABELS[evo.especialidad] ?? evo.especialidad}
                              {resumen ? <> — {resumen}</> : null}
                            </>
                          ) : (
                            "todavía no hay evoluciones cargadas."
                          )}
                        </div>
                        <div>
                          <span className="font-medium text-slate-700">Autorización: </span>
                          {aut ? (
                            <>
                              {aut.cantidad_autorizada} de {aut.practica} vigente hasta el {new Date(`${aut.periodo_hasta}T12:00:00-03:00`).toLocaleDateString("es-AR", { timeZone: TZ, day: "numeric", month: "short" })}
                            </>
                          ) : (
                            <span className="text-amber-700">no hay una autorización vigente cargada para esta disciplina.</span>
                          )}
                        </div>
                        <div>
                          <span className="font-medium text-slate-700">Cupo de la semana: </span>
                          {cupo ? (
                            <>
                              {cupo.realizadas} de {cupo.esperadas} realizadas (plan {describirPlan(cupo.plan)})
                              {cupo.esperadas - cupo.realizadas > 0 ? <> · quedan {cupo.esperadas - cupo.realizadas}</> : <> · cupo completo</>}
                            </>
                          ) : (
                            "el paciente no tiene plan cargado para esta disciplina."
                          )}
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {!enCurso && <IniciarVisitaButton visitId={v.id} className={`${btn} bg-slate-900 text-white hover:bg-slate-800 col-span-2 disabled:opacity-60`} />}
                        <form action={updateVisitStatusAction}>
                          <input type="hidden" name="visit_id" value={v.id} />
                          <input type="hidden" name="estado" value="realizada" />
                          <button className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}>
                            <IconCheck className="w-4 h-4" /> Realizada
                          </button>
                        </form>
                        <form action={updateVisitStatusAction}>
                          <input type="hidden" name="visit_id" value={v.id} />
                          <input type="hidden" name="estado" value="no_realizada" />
                          <ConfirmButton className={`${btn} bg-red-100 text-red-700 hover:bg-red-200`} confirmLabel="¿No se hizo? Tocá de nuevo">
                            No realizada
                          </ConfirmButton>
                        </form>
                      </div>
                      <ActionDisclosure label="No me atendieron en el domicilio" tone="subtle">
                        <form action={noMeAtendieronAction} className="mt-2 space-y-3 rounded-xl bg-slate-50 border border-slate-200 p-3">
                          <input type="hidden" name="visit_id" value={v.id} />
                          <p className="text-xs text-slate-600">Dejá constancia con una foto de la fachada. La visita queda como no realizada y Coordinación la reprograma.</p>
                          <label className="block text-xs font-medium text-slate-600">
                            Motivo
                            <select name="motivo" defaultValue="no_atendieron" className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm">
                              <option value="no_atendieron">Nadie atendió en el domicilio</option>
                              <option value="paciente_ausente">El paciente no estaba</option>
                              <option value="otro">Otro motivo</option>
                            </select>
                          </label>
                          <PhotoField name="foto_fachada" label="Foto de la fachada" required />
                          <button className={`${btn} bg-slate-900 text-white hover:bg-slate-800`}>Registrar y cerrar la visita</button>
                        </form>
                      </ActionDisclosure>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
