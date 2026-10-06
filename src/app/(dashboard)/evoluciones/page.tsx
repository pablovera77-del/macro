import { createClient } from "@/lib/supabase/server";
import { requireProfile, SPECIALTY_LABELS } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import EvolucionForm from "@/components/hc/EvolucionForm";
import EvolucionDetalle from "@/components/hc/EvolucionDetalle";
import NotaAclaratoria from "@/components/hc/NotaAclaratoria";
import ControlFirmasPlan from "@/components/hc/ControlFirmasPlan";
import { IconSignature, IconAlert, IconCheck, IconUser, IconChevronDown } from "@/components/icons";
import { asNova5, EVOLUCION_COLS, fechaHoraAR, parseCampos, RIESGO_TONE } from "@/lib/hc";

export default async function EvolucionesPage({
  searchParams,
}: {
  searchParams: Promise<{ visita?: string; q?: string }>;
}) {
  const { visita, q } = await searchParams;
  const { profile } = await requireProfile();
  // La historia clínica es solo para roles clínicos y de control; Depósito y Transporte vuelven al inicio.
  if (!["administracion", "coordinador_internacion", "profesional_asistencial", "direccion", "facturacion"].includes(profile.role)) redirect("/inicio");
  const supabase = await createClient();

  // Coordinación controla y Administración/Dirección consultan (solo lectura); quien carga es el profesional.
  const isMedico = ["coordinador_internacion", "direccion", "administracion", "facturacion"].includes(profile.role);
  const soloLectura = profile.role === "direccion" || profile.role === "administracion" || profile.role === "facturacion";
  const busqueda = (q ?? "").replace(/[%,()]/g, " ").trim().slice(0, 60);

  let pendingQuery = supabase
    .from("visits")
    .select("id, patient_id, profesional_id, especialidad, fecha_realizada, patients(nombre_completo), profiles!visits_profesional_id_fkey(full_name)")
    .eq("estado", "realizada")
    .order("fecha_realizada", { ascending: false });
  if (!isMedico) pendingQuery = pendingQuery.eq("profesional_id", profile.id);

  const historyCols = `${EVOLUCION_COLS}, patients!inner(nombre_completo), profiles(full_name)` as const;
  let historyQuery = supabase.from("evolutions").select(historyCols).order("created_at", { ascending: false }).limit(busqueda ? 50 : 20);
  if (!isMedico) historyQuery = historyQuery.eq("profesional_id", profile.id);
  if (busqueda) historyQuery = historyQuery.ilike("patients.nombre_completo", `%${busqueda}%`);

  const [{ data: visitsRealizadas }, { data: evolutions }, { data: templates }, { data: evoVisitLinks }] = await Promise.all([
    pendingQuery,
    historyQuery,
    supabase.from("discipline_form_templates").select("id, titulo, especialidad, campos, activo"),
    supabase.from("evolutions").select("visit_id"),
  ]);

  // Visitas realizadas que todavía no tienen evolución cargada (se cruza contra evolutions por visit_id).
  const linkedVisitIds = new Set((evoVisitLinks ?? []).map((e) => e.visit_id));
  const pendientes = (visitsRealizadas ?? []).filter((v) => !linkedVisitIds.has(v.id));

  // Notas aclaratorias de las evoluciones que se muestran.
  const evoIds = (evolutions ?? []).map((e) => e.id);
  const { data: notasRaw } = evoIds.length
    ? await supabase.from("evolution_notes").select("id, evolution_id, texto, created_at, profiles(full_name)").in("evolution_id", evoIds).order("created_at", { ascending: true })
    : { data: [] };
  const notasPorEvolucion = new Map<string, { id: string; texto: string; created_at: string; autor: string }[]>();
  for (const n of notasRaw ?? []) {
    const lista = notasPorEvolucion.get(n.evolution_id) ?? [];
    lista.push({ id: n.id, texto: n.texto, created_at: n.created_at, autor: (n.profiles as unknown as { full_name: string } | null)?.full_name ?? "Profesional" });
    notasPorEvolucion.set(n.evolution_id, lista);
  }

  // Formulario del profesional: matrícula guardada y pacientes que ya tienen valoración de úlceras (solo se pide en la primera).
  let matricula: string | null = null;
  const conUppPrevio = new Set<string>();
  if (!isMedico) {
    const [{ data: perfil }, { data: previos }] = await Promise.all([
      supabase.from("profiles").select("matricula").eq("id", profile.id).maybeSingle(),
      pendientes.length
        ? supabase.from("evolutions").select("patient_id").not("upp_escala_nova5", "is", null).in("patient_id", [...new Set(pendientes.map((v) => v.patient_id))])
        : Promise.resolve({ data: [] as { patient_id: string }[] }),
    ]);
    matricula = perfil?.matricula ?? null;
    for (const p of previos ?? []) conUppPrevio.add(p.patient_id);
  }

  // Control (C2): visitas realizadas sin evolución, agrupadas por profesional, la más antigua primero.
  const hoy = new Date().getTime();
  const diasDesde = (iso: string | null) => (iso ? Math.max(0, Math.floor((hoy - new Date(iso).getTime()) / 86400000)) : 0);
  const porProfesional = new Map<string, { nombre: string; items: typeof pendientes }>();
  for (const v of pendientes) {
    const nombre = (v.profiles as unknown as { full_name: string } | null)?.full_name ?? "Sin profesional asignado";
    const key = v.profesional_id ?? "sin-asignar";
    if (!porProfesional.has(key)) porProfesional.set(key, { nombre, items: [] });
    porProfesional.get(key)!.items.push(v);
  }
  const grupos = [...porProfesional.values()]
    .map((g) => ({ ...g, items: [...g.items].sort((a, b) => (a.fecha_realizada ?? "").localeCompare(b.fecha_realizada ?? "")) }))
    .sort((a, b) => diasDesde(b.items[0]?.fecha_realizada ?? null) - diasDesde(a.items[0]?.fecha_realizada ?? null));

  const titulo = soloLectura ? "Historias clínicas (consulta)" : isMedico ? "Control de evoluciones" : "Historia clínica digital";
  const linkCls = "inline-flex items-center rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-medium px-3 py-1.5 hover:bg-slate-50";

  return (
    <div className="space-y-8">
      <PageHeader
        icon={<IconSignature className="w-5 h-5" />}
        title={titulo}
        section="DF-C2 §5"
        purpose={
          profile.role === "administracion"
            ? "Consultá las historias clínicas cargadas por el equipo, con sus firmas. Es solo lectura: acá no se modifica nada."
            : isMedico
            ? "Acá ves qué visitas realizadas todavía no tienen su evolución, qué evoluciones están sin firmar y las últimas evoluciones cargadas por el equipo."
            : "Cargá la evolución de cada visita que ya realizaste. Abrí la visita pendiente, completá el formulario de tu disciplina y firmá."
        }
        description="Formulario dinámico por disciplina — operacionaliza el motor config-driven del sistema viejo (informe-tecnico §3.2). Plantillas DF-C2 §5.1-5.5, firmas §4.5, inmutabilidad §9."
      />

      {!isMedico && visita && pendientes.some((v) => v.id === visita) && (
        <section className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 flex items-start gap-3 animate-fade-slide-up">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 shrink-0">
            <IconCheck className="w-4 h-4" />
          </span>
          <p className="text-sm text-emerald-900">
            <span className="font-semibold">Visita marcada como realizada.</span> Último paso: completá la evolución de abajo (ya está abierta), firmá y tocá «Guardar y firmar evolución».
          </p>
        </section>
      )}

      {isMedico && (
        <section className={`rounded-2xl border p-5 animate-fade-slide-up ${grupos.length > 0 ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"}`}>
          <div className="flex items-center gap-2 mb-3">
            <span className={`flex items-center justify-center w-8 h-8 rounded-lg ${grupos.length > 0 ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600"}`}>
              {grupos.length > 0 ? <IconAlert className="w-4 h-4" /> : <IconCheck className="w-4 h-4" />}
            </span>
            <h2 className={`text-sm font-medium ${grupos.length > 0 ? "text-red-800" : "text-emerald-800"}`}>
              {grupos.length > 0 ? `Evoluciones pendientes: ${pendientes.length} visita${pendientes.length === 1 ? "" : "s"} de ${grupos.length} profesional${grupos.length === 1 ? "" : "es"}` : "Todas las visitas realizadas tienen su evolución"}
            </h2>
          </div>
          <div className="space-y-4">
            {grupos.map((g) => (
              <div key={g.nombre} className="bg-white/70 rounded-xl border border-red-100 p-3">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-sm font-medium text-slate-900">{g.nombre}</span>
                  <span className="text-xs text-red-700 font-medium">{g.items.length} sin evolución</span>
                </div>
                <ul className="text-sm text-slate-700 divide-y divide-slate-100">
                  {g.items.map((v) => {
                    const d = diasDesde(v.fecha_realizada);
                    return (
                      <li key={v.id} className="flex items-center justify-between gap-3 py-1.5 flex-wrap">
                        <Link href={`/paciente/${v.patient_id}?tab=agenda`} className="hover:underline">
                          {(v.patients as unknown as { nombre_completo: string } | null)?.nombre_completo}
                          <span className="text-xs text-slate-400"> · {SPECIALTY_LABELS[v.especialidad] ?? v.especialidad}</span>
                        </Link>
                        <StatusBadge tone={d >= 3 ? "rojo" : d >= 1 ? "amarillo" : "gris"} label={d === 0 ? "Visita de hoy" : `Hace ${d} día${d === 1 ? "" : "s"}`} />
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {isMedico && <ControlFirmasPlan />}

      {!isMedico && (
        <section className="space-y-3">
          {pendientes.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-sm animate-fade-slide-up">
              No hay visitas realizadas pendientes de evolución.
            </div>
          )}
          {pendientes.map((v, i) => {
            const template = (templates ?? []).find((t) => t.especialidad === v.especialidad && t.activo);
            const campos = parseCampos(template?.campos);
            return (
              <details id={`visita-${v.id}`} open={visita === v.id} key={v.id} className={`scroll-mt-6 bg-white rounded-2xl border p-4 sm:p-5 card-hover animate-fade-slide-up stagger-${Math.min(i + 1, 8)} ${visita === v.id ? "border-emerald-400 ring-2 ring-emerald-200" : "border-slate-200"}`}>
                <summary className="cursor-pointer flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <span className="font-medium text-slate-900">{(v.patients as unknown as { nombre_completo: string } | null)?.nombre_completo}</span>
                    <span className="text-xs text-slate-400 ml-2">{SPECIALTY_LABELS[v.especialidad] ?? v.especialidad} · {template?.titulo ?? "sin plantilla"}</span>
                  </div>
                  <span className="text-xs font-medium text-amber-600 bg-amber-50 rounded-full px-2.5 py-1">Pendiente de evolución</span>
                </summary>
                <EvolucionForm
                  visitId={v.id}
                  patientId={v.patient_id}
                  especialidad={v.especialidad}
                  campos={campos}
                  mostrarUpp={v.especialidad === "enfermeria" && !conUppPrevio.has(v.patient_id)}
                  profesionalNombre={profile.full_name}
                  matriculaInicial={matricula}
                />
              </details>
            );
          })}
        </section>
      )}

      <section id="historial" className="scroll-mt-6 bg-white rounded-2xl border border-slate-200 overflow-hidden animate-fade-slide-up card-hover">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-sm font-medium text-slate-900">{isMedico ? (busqueda ? `Evoluciones de «${busqueda}»` : "Últimas evoluciones registradas") : "Mi historial reciente"}</h2>
          {isMedico && (
            <form method="get" action="/evoluciones#historial" className="flex items-center gap-2">
              <input name="q" defaultValue={busqueda} placeholder="Buscar por paciente" aria-label="Buscar evoluciones por paciente" className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm w-44" />
              <button className="rounded-lg bg-slate-900 text-white text-xs font-medium px-3 py-2 hover:bg-slate-800">Buscar</button>
              {busqueda && (
                <Link href="/evoluciones#historial" className="text-xs text-slate-500 underline underline-offset-2">
                  Ver todas
                </Link>
              )}
            </form>
          )}
        </div>
        <div className="divide-y divide-slate-100">
          {(evolutions ?? []).map((e) => {
            const nova = asNova5(e.upp_escala_nova5);
            const campos = parseCampos((templates ?? []).find((t) => t.id === e.template_id)?.campos ?? (templates ?? []).find((t) => t.especialidad === e.especialidad)?.campos);
            const paciente = (e.patients as unknown as { nombre_completo: string } | null)?.nombre_completo;
            const autor = (e.profiles as unknown as { full_name: string } | null)?.full_name;
            const notas = notasPorEvolucion.get(e.id) ?? [];
            const puedeNota = profile.role === "coordinador_internacion" || (profile.role === "profesional_asistencial" && e.profesional_id === profile.id);
            return (
              <details key={e.id} className="group">
                <summary className="px-5 py-3.5 flex items-start gap-3 cursor-pointer list-none">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-400 shrink-0">
                    <IconUser className="w-4 h-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-sm text-slate-900 font-medium">{paciente}</span>
                      <span className="text-xs text-slate-400">{fechaHoraAR(e.created_at)}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-x-2 gap-y-1 flex-wrap">
                      <span>
                        {SPECIALTY_LABELS[e.especialidad] ?? e.especialidad}
                        {isMedico && autor ? <> · {autor}</> : null}
                      </span>
                      {e.firma_profesional_at ? <StatusBadge tone="verde" label="Firmada" /> : <StatusBadge tone="amarillo" label="Sin firma del profesional" />}
                      {e.conformidad_familiar ? <StatusBadge tone="verde" label="Conformidad familiar" /> : <StatusBadge tone="amarillo" label="Sin conformidad familiar" />}
                      {e.alerta_cambio && <StatusBadge tone="rojo" label="Cambio de medicación" />}
                      {nova && <StatusBadge tone={RIESGO_TONE[nova.riesgo] ?? "gris"} label={`Riesgo de úlceras: ${nova.riesgo} (Nova 5 = ${nova.total})`} />}
                      {notas.length > 0 && <StatusBadge tone="gris" label={`${notas.length} nota${notas.length === 1 ? "" : "s"} aclaratoria${notas.length === 1 ? "" : "s"}`} />}
                    </div>
                  </div>
                  <IconChevronDown className="w-4 h-4 text-slate-400 mt-2 shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-5 pb-5 pt-1 sm:pl-16 space-y-4">
                  <EvolucionDetalle e={e} campos={campos} profesionalNombre={autor} />

                  {notas.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Notas aclaratorias</h4>
                      {notas.map((n) => (
                        <div key={n.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                          <p className="text-sm text-slate-900 whitespace-pre-line">{n.texto}</p>
                          <p className="text-[11px] text-slate-500 mt-1">
                            {n.autor} · {fechaHoraAR(n.created_at)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/evoluciones/${e.id}/imprimir`} className={linkCls}>
                      Imprimir completa
                    </Link>
                    {campos.some((c) => c.narrativa) && (
                      <Link href={`/evoluciones/${e.id}/imprimir?modo=os`} className={linkCls}>
                        Imprimir para obra social
                      </Link>
                    )}
                    <Link href={`/paciente/${e.patient_id}?tab=clinica`} className={linkCls}>
                      Ver ficha del paciente
                    </Link>
                  </div>
                  {puedeNota && <NotaAclaratoria evolutionId={e.id} />}
                </div>
              </details>
            );
          })}
          {(evolutions ?? []).length === 0 && (
            <div className="px-5 py-8 text-center text-slate-400 text-xs">{busqueda ? "No encontramos evoluciones de ese paciente." : "Sin evoluciones registradas todavía."}</div>
          )}
        </div>
      </section>
    </div>
  );
}
