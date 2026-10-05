import { createClient } from "@/lib/supabase/server";
import { requireProfile, SPECIALTY_LABELS } from "@/lib/auth";
import { createVisitAction, marcarRecordatorioEnviadoAction } from "./actions";
import { calcularCumplimiento, semanaActual, describirPlan, hoyAR, ymdAR, TZ, type Plan } from "@/lib/plan";
import StatusBadge from "@/components/StatusBadge";
import PageHeader from "@/components/PageHeader";
import SidePanel from "@/components/SidePanel";
import HorarioFields from "@/components/agenda/HorarioFields";
import VisitaCard from "@/components/agenda/VisitaCard";
import ReprogramarForm from "@/components/agenda/ReprogramarForm";
import GenerarSemanaForm from "@/components/agenda/GenerarSemanaForm";
import { linkWhatsapp, mensajeRecordatorio, rangoManiana } from "@/lib/reminders";
import { cargarPropuestasSemana } from "@/lib/agenda-semana";
import { descripcionFechaHora, descripcionHorario, estaAtrasada, horaAR, visitasEnConflicto } from "@/lib/horario";
import { COLUMNAS_VISITA_AGENDA, type VisitaAgenda } from "@/lib/agenda-tipos";
import { duracion } from "@/lib/mapa";
import Link from "next/link";
import { IconCalendar, IconCheck, IconAlert, IconClock } from "@/components/icons";

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

const campo = "rounded-xl border border-slate-300 px-3 py-2.5 text-sm";

function tituloDia(ymd: string, hoy: string): string {
  const txt = new Date(`${ymd}T12:00:00-03:00`).toLocaleDateString("es-AR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
  const mañana = ymdAR(new Date(new Date(`${hoy}T12:00:00-03:00`).getTime() + 86400000));
  const etiqueta = ymd === hoy ? "Hoy · " : ymd === mañana ? "Mañana · " : "";
  return `${etiqueta}${txt.charAt(0).toUpperCase()}${txt.slice(1)}`;
}

/** Agrupa por día (hora de San Juan) y ordena cada día por hora o por domicilio. */
function porDia(items: VisitaAgenda[], orden: "hora" | "domicilio"): [string, VisitaAgenda[]][] {
  const mapa = new Map<string, VisitaAgenda[]>();
  for (const v of items) {
    const d = ymdAR(v.fecha_programada);
    mapa.set(d, [...(mapa.get(d) ?? []), v]);
  }
  return [...mapa.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([d, vs]) => [
      d,
      [...vs].sort((x, y) =>
        orden === "domicilio"
          ? (x.patients?.domicilio ?? "").localeCompare(y.patients?.domicilio ?? "", "es") || x.fecha_programada.localeCompare(y.fecha_programada)
          : x.fecha_programada.localeCompare(y.fecha_programada)
      ),
    ]);
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ paciente?: string; esp?: string; ver?: string; vista?: string; orden?: string; prof?: string }>;
}) {
  const { paciente: pacienteSel, esp: espSel, ver, vista, orden: ordenSel, prof: profSel } = await searchParams;
  const { profile } = await requireProfile();
  const supabase = await createClient();

  const isCoordinador = profile.role === "coordinador_internacion";
  const esProfesional = profile.role === "profesional_asistencial";
  const veInterno = isCoordinador || profile.role === "direccion";
  const orden: "hora" | "domicilio" = ordenSel === "domicilio" ? "domicilio" : "hora";
  // R07: Coordinación ve la agenda agrupada por profesional (se puede pasar a «por fecha»).
  const agruparPorProfesional = isCoordinador && vista !== "fecha";

  let visitsQuery = supabase.from("visits").select(COLUMNAS_VISITA_AGENDA).order("fecha_programada", { ascending: true });
  if (esProfesional) visitsQuery = visitsQuery.eq("profesional_id", profile.id);

  const [{ data: visitsRaw }, { data: patients }, { data: profesionales }, { data: evoLinks }, { data: plansRaw }, propuestasSemana] = await Promise.all([
    visitsQuery,
    isCoordinador ? supabase.from("patients").select("id, nombre_completo").eq("estado", "activo").order("nombre_completo") : Promise.resolve({ data: null }),
    isCoordinador
      ? supabase.from("profiles").select("id, full_name").eq("role", "profesional_asistencial").eq("active", true).order("full_name")
      : Promise.resolve({ data: null }),
    supabase.from("evolutions").select("visit_id"),
    isCoordinador ? supabase.from("treatment_plans").select("id, patient_id, especialidad, cantidad, unidad, dias_semana, desde, hasta, activo, nota").eq("activo", true) : Promise.resolve({ data: null }),
    isCoordinador ? cargarPropuestasSemana() : Promise.resolve(null),
  ]);
  const visits = (visitsRaw ?? []) as unknown as VisitaAgenda[];
  const { data: teamRaw } = isCoordinador ? await supabase.from("patient_care_team").select("patient_id, especialidad, profesional_id") : { data: null };

  const conEvolucion = new Set((evoLinks ?? []).map((e) => e.visit_id));
  const sinEvolucion = visits.filter((v) => v.estado === "realizada" && !conEvolucion.has(v.id));

  // E4: lo que el plan de tratamiento pide y todavía no está en la agenda de esta semana.
  const nombresPaciente = new Map((patients ?? []).map((p) => [p.id, p.nombre_completo]));
  const faltantes = isCoordinador
    ? calcularCumplimiento(
        ((plansRaw ?? []) as unknown as Plan[]).filter((pl) => nombresPaciente.has(pl.patient_id)),
        visits.map((v) => ({ patient_id: v.patient_id, especialidad: v.especialidad, fecha_programada: v.fecha_programada, estado: v.estado })),
        semanaActual()
      ).filter((c) => c.faltan > 0)
    : [];
  const equipoPorPaciente = new Map((teamRaw ?? []).map((t) => [`${t.patient_id}|${t.especialidad}`, t.profesional_id]));
  const profesionalSugerido = pacienteSel && espSel ? equipoPorPaciente.get(`${pacienteSel}|${espSel}`) ?? "" : "";

  const ahora = new Date();
  const hoy = hoyAR();
  // F3: desde el Dashboard, "Visitas de esta semana" abre la agenda ya filtrada.
  const sem = semanaActual();
  const soloSemana = ver === "semana";
  const semDesde = new Date(sem.desde).getTime();
  const semHasta = new Date(sem.hasta).getTime();
  let visitasLista = soloSemana ? visits.filter((v) => new Date(v.fecha_programada).getTime() >= semDesde && new Date(v.fecha_programada).getTime() < semHasta) : visits;
  if (isCoordinador && profSel) visitasLista = visitasLista.filter((v) => v.profesional_id === profSel);

  const abiertas = (v: VisitaAgenda) => v.estado === "programada" || v.estado === "confirmada";
  const conflictos = visitasEnConflicto(visits);
  // G4: visitas de mañana, con un link de WhatsApp ya escrito (se envía a mano).
  const maniana = rangoManiana();
  const visitasManiana = isCoordinador
    ? visits
        .filter((v) => abiertas(v) && v.fecha_programada >= maniana.desde && v.fecha_programada < maniana.hasta)
        .sort((a, b) => Number(!!a.recordatorio_enviado_at) - Number(!!b.recordatorio_enviado_at) || a.fecha_programada.localeCompare(b.fecha_programada))
    : [];
  const proximas = visitasLista.filter(abiertas);
  const atrasadas = isCoordinador ? visits.filter((v) => abiertas(v) && estaAtrasada(v, ahora)) : [];
  const enCurso = veInterno ? visits.filter((v) => abiertas(v) && v.abierta_at) : [];
  const historial = visitasLista.filter((v) => !abiertas(v)).sort((a, b) => b.fecha_programada.localeCompare(a.fecha_programada));

  // Visitas próximas: por profesional (Coordinación) o por día.
  const bloques: { titulo: string | null; dias: [string, VisitaAgenda[]][] }[] = agruparPorProfesional
    ? [...new Set(proximas.map((v) => v.profesional_id))]
        .map((pid) => ({ pid, nombre: proximas.find((v) => v.profesional_id === pid)?.profiles?.full_name ?? "Sin profesional" }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
        .map(({ pid, nombre }) => {
          const del = proximas.filter((v) => v.profesional_id === pid);
          return { titulo: `${nombre} · ${del.length} ${del.length === 1 ? "visita" : "visitas"}`, dias: porDia(del, orden) };
        })
    : [{ titulo: null, dias: porDia(proximas, orden) }];

  return (
    <div className="space-y-8">
      <PageHeader
        action={isCoordinador ? { label: "+ Programar visita", href: "#programar-visita" } : undefined}
        icon={<IconCalendar className="w-5 h-5" />}
        title={esProfesional ? "Mi agenda" : "Agenda de visitas"}
        section="DF-C2 §4"
        purpose={
          isCoordinador
            ? "Programá la visita de cada profesional a cada paciente y seguí cuáles ya se hicieron."
            : profile.role === "direccion"
            ? "Vista de consulta de las visitas de todos los profesionales y su estado."
            : "Tus visitas asignadas. Tocá «Iniciar visita» al llegar y «Realizada» al terminar: te llevamos a cargar su evolución."
        }
        description="Toda visita marcada 'realizada' debe tener una evolución asociada (control DF-C2 §8). Horario opcional, franja y rango: R08/R09; apertura y cierre: R12-R14."
      />

      {isCoordinador && (
        <div className="flex flex-wrap gap-2 -mt-4">
          <Link href="#generar-semana" className="rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-medium px-4 py-2.5 hover:bg-slate-50">
            Generar visitas de la semana
          </Link>
          <Link href="/productividad" className="rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-medium px-4 py-2.5 hover:bg-slate-50">
            Productividad y cupos
          </Link>
        </div>
      )}

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
                  <span className="font-medium text-slate-900">{v.patients?.nombre_completo}</span>
                  <span className="text-xs text-slate-500 ml-2">{SPECIALTY_LABELS[v.especialidad] ?? v.especialidad} · {descripcionFechaHora(v)}</span>
                </span>
                <Link href={`/evoluciones?visita=${v.id}`} className="rounded-lg bg-emerald-600 text-white text-xs font-medium px-3 py-1.5 hover:bg-emerald-700 transition-colors">
                  Cargar evolución
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {enCurso.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-2xl p-5 animate-fade-slide-up">
          <div className="flex items-center gap-2 mb-1">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100 text-amber-600">
              <IconClock className="w-4 h-4" />
            </span>
            <h2 className="text-sm font-semibold text-slate-900">Visitas en curso ({enCurso.length})</h2>
          </div>
          <p className="text-xs text-slate-500 mb-3">Profesionales que ya llegaron al domicilio y todavía no cerraron la visita. Es un dato interno: no figura en la historia clínica.</p>
          <ul className="space-y-2">
            {enCurso.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 flex-wrap bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm">
                <span>
                  <span className="font-medium text-slate-900">{v.patients?.nombre_completo}</span>
                  <span className="text-xs text-slate-500 ml-2">{SPECIALTY_LABELS[v.especialidad] ?? v.especialidad} · {v.profiles?.full_name}</span>
                </span>
                <span className="flex items-center gap-2">
                  <StatusBadge tone="amarillo" label={`Desde las ${horaAR(v.abierta_at as string)}`} />
                  <span className="text-xs text-slate-600">hace {duracion(v.abierta_at as string, ahora)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isCoordinador && faltantes.length > 0 && (
        <section id="faltan-programar" className="scroll-mt-20 bg-blue-50 border border-blue-200 rounded-2xl p-5 animate-fade-slide-up">
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
        <section id="atrasadas" className="scroll-mt-20 bg-red-50 border border-red-200 rounded-2xl p-5 animate-fade-slide-up">
          <h2 className="text-sm font-semibold text-red-900 mb-3">Visitas atrasadas: la fecha pasó y nadie las cerró ({atrasadas.length})</h2>
          <ul className="space-y-2">
            {atrasadas.map((v) => (
              <li key={v.id} className="bg-white border border-red-100 rounded-xl px-3.5 py-2.5 text-sm">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <span>
                    <span className="font-medium text-slate-900">{v.patients?.nombre_completo}</span>
                    <span className="text-xs text-slate-500 ml-2">{SPECIALTY_LABELS[v.especialidad] ?? v.especialidad} · {descripcionFechaHora(v)} · {v.profiles?.full_name}</span>
                  </span>
                  <ReprogramarForm visitId={v.id} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isCoordinador && visitasManiana.length > 0 && (
        <section className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 animate-fade-slide-up">
          <h2 className="text-sm font-semibold text-emerald-900 mb-1">Recordatorios para mañana ({maniana.etiqueta})</h2>
          <p className="text-xs text-emerald-800 mb-3">Se abre WhatsApp con el mensaje escrito. Revisá el número y tocá «Enviar»: la app no manda nada sola. Después marcalo como enviado para saber cuáles faltan.</p>
          <ul className="space-y-2">
            {visitasManiana.map((v) => {
              const pac = v.patients;
              const profNombre = v.profiles?.full_name ?? null;
              const tel = pac?.telefono_contacto || pac?.contacto_familiar_telefono || null;
              const link = linkWhatsapp(
                tel,
                mensajeRecordatorio({
                  paciente: pac?.nombre_completo ?? "el paciente",
                  disciplina: SPECIALTY_LABELS[v.especialidad] ?? v.especialidad,
                  fechaIso: v.fecha_programada,
                  profesional: profNombre,
                  horario: { sin_hora: v.sin_hora, franja: v.franja, hora_desde: v.hora_desde, hora_hasta: v.hora_hasta },
                })
              );
              return (
                <li key={v.id} className="flex items-center justify-between gap-3 flex-wrap bg-white border border-emerald-200 rounded-xl px-3.5 py-2.5 text-sm">
                  <span>
                    <span className="font-medium text-slate-900">{pac?.nombre_completo}</span>
                    <span className="text-xs text-slate-500 ml-2">
                      {SPECIALTY_LABELS[v.especialidad] ?? v.especialidad} · {descripcionHorario(v)}{profNombre ? ` · ${profNombre}` : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 flex-wrap">
                    {v.recordatorio_enviado_at ? (
                      <>
                        <StatusBadge tone="verde" label={`Enviado a las ${horaAR(v.recordatorio_enviado_at)}`} />
                        <form action={marcarRecordatorioEnviadoAction}>
                          <input type="hidden" name="visit_id" value={v.id} />
                          <input type="hidden" name="deshacer" value="1" />
                          <button className="text-xs text-slate-500 underline underline-offset-2 px-1 py-1.5">Deshacer</button>
                        </form>
                      </>
                    ) : (
                      <>
                        {link ? (
                          <a href={link} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-emerald-600 text-white text-xs font-medium px-3 py-1.5 hover:bg-emerald-700 transition-colors">
                            Avisar por WhatsApp
                          </a>
                        ) : (
                          <span className="text-xs text-amber-700">Sin teléfono cargado</span>
                        )}
                        <form action={marcarRecordatorioEnviadoAction}>
                          <input type="hidden" name="visit_id" value={v.id} />
                          <button className="rounded-lg border border-emerald-300 bg-white text-emerald-800 text-xs font-medium px-3 py-1.5 hover:bg-emerald-50">Ya lo mandé</button>
                        </form>
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="space-y-4">
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

        <form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-3">
          {ver && <input type="hidden" name="ver" value={ver} />}
          {isCoordinador && (
            <>
              <label className="block">
                <span className="text-xs font-medium text-slate-600">Ver</span>
                <select name="vista" defaultValue={agruparPorProfesional ? "profesional" : "fecha"} className={`${campo} mt-1 block`}>
                  <option value="profesional">Agrupado por profesional</option>
                  <option value="fecha">Por fecha</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600">Profesional</span>
                <select name="prof" defaultValue={profSel ?? ""} className={`${campo} mt-1 block`}>
                  <option value="">Todos</option>
                  {(profesionales ?? []).map((p) => (
                    <option key={p.id} value={p.id}>{p.full_name}</option>
                  ))}
                </select>
              </label>
            </>
          )}
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Ordenar cada día por</span>
            <select name="orden" defaultValue={orden} className={`${campo} mt-1 block`}>
              <option value="hora">Hora</option>
              <option value="domicilio">Domicilio (para agrupar por zona)</option>
            </select>
          </label>
          <button className="rounded-xl bg-slate-900 text-white text-sm font-medium px-4 py-2.5 hover:bg-slate-800">Aplicar</button>
        </form>

        {proximas.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-sm animate-fade-slide-up">
            No hay visitas próximas.
          </div>
        )}
        {bloques.map((b, bi) => (
          <div key={b.titulo ?? bi} className="space-y-4">
            {b.titulo && <h2 className="text-base font-semibold text-slate-900 border-b border-slate-200 pb-1">{b.titulo}</h2>}
            {b.dias.map(([ymd, items]) => (
              <div key={`${b.titulo}-${ymd}`}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">{tituloDia(ymd, hoy)}</h3>
                <div className="space-y-3">
                  {items.map((v) => (
                    <VisitaCard key={v.id} v={v} rol={profile.role} atrasada={estaAtrasada(v, ahora)} conflicto={conflictos.has(v.id)} mostrarProfesional={isCoordinador && !agruparPorProfesional} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </section>

      {isCoordinador && (
        <SidePanel id="programar-visita" title="Programar visita">
          <form key={`${pacienteSel ?? ""}|${espSel ?? ""}`} action={createVisitAction} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <select name="patient_id" required defaultValue={pacienteSel ?? ""} className={`${campo} sm:col-span-2`}>
              <option value="">Paciente...</option>
              {(patients ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.nombre_completo}</option>
              ))}
            </select>
            <select name="profesional_id" required defaultValue={profesionalSugerido} className={`${campo} sm:col-span-2`}>
              <option value="">Profesional...</option>
              {(profesionales ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
            <select name="especialidad" required defaultValue={espSel ?? "enfermeria"} className={campo}>
              {Object.entries(SPECIALTY_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <HorarioFields className="sm:col-span-4" />
            <input name="observacion_agenda" placeholder="Observación (opcional)" className={`${campo} sm:col-span-2`} />
            <button className="rounded-xl bg-slate-900 text-white text-sm font-medium px-4 py-2.5 hover:bg-slate-800 transition-colors">Programar</button>
          </form>
        </SidePanel>
      )}

      {isCoordinador && propuestasSemana && (
        <SidePanel id="generar-semana" title="Generar visitas de la semana">
          <GenerarSemanaForm propuestas={propuestasSemana.propuestas} nombres={propuestasSemana.nombres} profesionales={propuestasSemana.profesionales} />
        </SidePanel>
      )}

      {historial.length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden animate-fade-slide-up card-hover">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-medium text-slate-900">Historial reciente</h2>
            {veInterno && <p className="text-xs text-slate-500 mt-0.5">«Llegada», «cierre» y «duración» son datos internos de Coordinación: no se imprimen en la historia clínica.</p>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-5 py-2.5 font-medium">Paciente</th>
                  <th className="text-left px-5 py-2.5 font-medium">Disciplina</th>
                  <th className="text-left px-5 py-2.5 font-medium">Fecha</th>
                  <th className="text-left px-5 py-2.5 font-medium">Estado</th>
                  {veInterno && <th className="text-left px-5 py-2.5 font-medium">Llegada</th>}
                  {veInterno && <th className="text-left px-5 py-2.5 font-medium">Cierre</th>}
                  {veInterno && <th className="text-left px-5 py-2.5 font-medium">Duración</th>}
                  <th className="text-left px-5 py-2.5 font-medium">Evolución</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historial.slice(0, 15).map((v) => (
                  <tr key={v.id} className="row-hover hover:bg-slate-50">
                    <td className="px-5 py-2.5 text-slate-900">{v.patients?.nombre_completo}</td>
                    <td className="px-5 py-2.5 text-slate-600">{SPECIALTY_LABELS[v.especialidad] ?? v.especialidad}</td>
                    <td className="px-5 py-2.5 text-slate-500 text-xs whitespace-nowrap">{descripcionFechaHora(v)}</td>
                    <td className="px-5 py-2.5">
                      <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${ESTADO_STYLES[v.estado]}`}>{ESTADO_LABELS[v.estado]}</span>
                    </td>
                    {veInterno && <td className="px-5 py-2.5 text-xs text-slate-600">{v.abierta_at ? `${horaAR(v.abierta_at)} hs` : "—"}</td>}
                    {veInterno && <td className="px-5 py-2.5 text-xs text-slate-600">{v.cerrada_at ? `${horaAR(v.cerrada_at)} hs` : "—"}</td>}
                    {veInterno && <td className="px-5 py-2.5 text-xs text-slate-600">{v.abierta_at && v.cerrada_at ? duracion(v.abierta_at, v.cerrada_at) : "—"}</td>}
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
