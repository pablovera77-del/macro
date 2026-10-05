import Link from "next/link";
import ConfirmButton from "@/components/ConfirmButton";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, SPECIALTY_LABELS } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import ConsentDocumentRow from "@/components/ConsentDocumentRow";
import { IconUser, IconMapPin, IconCheck, IconAlert } from "@/components/icons";
import { type SemanticTone } from "@/lib/semantic-status";
import { calcularCumplimiento, describirPlan, DIAS_CORTOS, DISCIPLINAS_PLAN, semanaActual, type Plan } from "@/lib/plan";
import FamilyAccessPanel from "@/components/FamilyAccessPanel";
import { descripcionFechaHora } from "@/lib/horario";
import ConsentimientoDetalle from "@/components/agenda/ConsentimientoDetalle";
import { familyPortalEnabled, type FamilyAccessInfo } from "@/lib/family";
import HistoriaClinicaFicha from "@/components/hc/HistoriaClinicaFicha";
import UppFicha from "@/components/hc/UppFicha";
import { signLegalDocumentAction } from "../../internacion/actions";
import {
  savePlanAction,
  endPlanAction,
  postMessageAction,
  addMedicationAction,
  removeMedicationAction,
  confirmNoMedicationAction,
  toggleChecklistItemAction,
  toggleRequiredDocAction,
  revokeFamilyAccessAction,
} from "./actions";

const ESTADO_LABELS: Record<string, string> = {
  admitido_pendiente_llegada: "Admitido, pendiente de llegada",
  activo: "Activo",
  dado_de_baja: "Dado de baja",
};
const ESTADO_TONE: Record<string, SemanticTone> = { admitido_pendiente_llegada: "amarillo", activo: "verde", dado_de_baja: "gris" };
const VISITA_LABELS: Record<string, string> = { programada: "Programada", confirmada: "Confirmada", realizada: "Realizada", no_realizada: "No realizada", cancelada: "Cancelada" };
const VISITA_TONE: Record<string, SemanticTone> = { programada: "amarillo", confirmada: "verde", realizada: "verde", no_realizada: "rojo", cancelada: "gris" };
const ORDER_LABELS: Record<string, string> = { borrador: "Esperando autorización", autorizado: "Autorizado", despachado: "Despachado", entregado: "Entregado", cancelado: "No autorizado" };
const ORDER_TONE: Record<string, SemanticTone> = { borrador: "amarillo", autorizado: "amarillo", despachado: "amarillo", entregado: "verde", cancelado: "gris" };
const SEMAFORO_LABELS: Record<string, string> = { vigente: "Vigente", por_vencer: "Por vencer", vencida: "Vencida" };
const SEMAFORO_TONE: Record<string, SemanticTone> = { vigente: "verde", por_vencer: "amarillo", vencida: "rojo" };

type Tab = "resumen" | "plan" | "agenda" | "clinica" | "insumos" | "ingreso" | "mensajes" | "familia";

function fecha(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Argentina/San_Juan" }) : "—";
}
function fechaHora(iso: string) {
  return new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/San_Juan" });
}

const inputCls = "rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm w-full";
const btnPrimary = "rounded-lg bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800 transition-colors";
const btnGhost = "rounded-lg border border-slate-300 text-slate-700 text-xs font-medium px-3 py-1.5 hover:bg-slate-50";

/**
 * Ficha única del paciente: todo lo del paciente en un solo lugar, con pestañas
 * según el rol. Los permisos reales siguen en la base de datos (RLS): las
 * pestañas solo ordenan lo que se muestra.
 */
export default async function FichaPacientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: tabParam } = await searchParams;
  const { profile } = await requireProfile();
  const role = profile.role;
  if (!["administracion", "coordinador_internacion", "profesional_asistencial", "direccion"].includes(role)) redirect("/inicio");

  const esAdmin = role === "administracion";
  const puedeEditarPlan = role === "administracion" || role === "coordinador_internacion";
  const verClinica = role === "profesional_asistencial" || role === "coordinador_internacion" || role === "administracion" || role === "direccion";
  const verInsumos = role === "administracion" || role === "coordinador_internacion";
  const tabs: { id: Tab; label: string }[] = [
    { id: "resumen", label: "Resumen" },
    { id: "plan", label: "Plan de tratamiento" },
    { id: "agenda", label: "Agenda" },
    ...(verClinica ? [{ id: "clinica" as Tab, label: "Historia clínica" }] : []),
    ...(verInsumos ? [{ id: "insumos" as Tab, label: "Insumos y equipos" }] : []),
    { id: "ingreso", label: "Ingreso y egreso" },
    { id: "mensajes", label: "Mensajes del equipo" },
    ...(puedeEditarPlan ? [{ id: "familia" as Tab, label: "Familia" }] : []),
  ];
  const tab: Tab = tabs.some((t) => t.id === tabParam) ? (tabParam as Tab) : "resumen";

  const supabase = await createClient();
  const { data: p } = await supabase
    .from("patients")
    .select("id, nombre_completo, dni, fecha_nacimiento, domicilio, telefono_contacto, contacto_familiar_nombre, contacto_familiar_telefono, diagnostico_principal, obra_social, obra_social_id, numero_afiliado, medico_derivante, estado, fecha_ingreso, fecha_egreso, motivo_egreso, llegada_confirmada_at, egreso_informado_at, medicacion_confirmada_at, obras_sociales(nombre)")
    .eq("id", id)
    .maybeSingle();
  if (!p) notFound();

  const [{ data: team }, { data: visits }, { data: auths }, { data: legalDocs }, { data: sigs }, { data: plansRaw }] = await Promise.all([
    supabase.from("patient_care_team").select("id, especialidad, profesional_id, profiles(full_name)").eq("patient_id", id),
    supabase.from("visits").select("id, patient_id, especialidad, fecha_programada, sin_hora, franja, hora_desde, hora_hasta, estado, profiles(full_name)").eq("patient_id", id).order("fecha_programada", { ascending: false }).limit(80),
    supabase.from("v_treatment_authorization_status").select("*").eq("patient_id", id).order("periodo_hasta"),
    supabase.from("legal_documents").select("id, codigo, titulo, resumen, requiere_firma_profesional").eq("activo", true).order("orden"),
    supabase.from("patient_document_signatures").select("legal_document_id, firmante_nombre, firmado_at, profesional_id").eq("patient_id", id),
    supabase.from("treatment_plans").select("id, patient_id, especialidad, cantidad, unidad, dias_semana, desde, hasta, activo, nota, created_at").eq("patient_id", id).order("created_at", { ascending: false }),
  ]);

  const puedeEscribirMensajes =
    role === "administracion" ||
    role === "coordinador_internacion" ||
    (role === "profesional_asistencial" && (team ?? []).some((t) => t.profesional_id === profile.id));
  const plans = (plansRaw ?? []) as unknown as (Plan & { created_at: string })[];
  const planesActivos = plans.filter((x) => x.activo);
  const historialPlanes = plans.filter((x) => !x.activo);

  const { data: evolutions } = verClinica
    ? await supabase.from("evolutions").select("id, especialidad, created_at, firma_profesional_at, conformidad_familiar, profiles(full_name)").eq("patient_id", id).order("created_at", { ascending: false }).limit(10)
    : { data: null };
  const [{ data: stockAuths }, { data: orders }, { data: equipos }] = verInsumos
    ? await Promise.all([
        supabase.from("patient_authorizations").select("id, cantidad_autorizada, vigente_hasta, products(descripcion)").eq("patient_id", id),
        supabase.from("orders").select("id, estado, created_at").eq("patient_id", id).order("created_at", { ascending: false }).limit(8),
        supabase.from("v_equipos_en_domicilio").select("asset_id, descripcion, numero_serie, desde").eq("patient_id", id),
      ])
    : [{ data: null }, { data: null }, { data: null }];

  // Pestañas que necesitan datos extra: se piden solo cuando se abren.
  const { data: mensajes } = tab === "mensajes"
    ? await supabase.from("patient_messages").select("id, mensaje, created_at, autor_id, profiles(full_name)").eq("patient_id", id).order("created_at", { ascending: false }).limit(50)
    : { data: null };

  // Familia (G1): accesos emitidos y confirmaciones recibidas.
  const [{ data: accesosRaw }, { data: confirmacionesFam }] = tab === "familia"
    ? await Promise.all([
        supabase.rpc("fn_family_access_list", { p_patient: id }),
        supabase.from("family_visit_confirmations").select("id, nombre, confirmed_at, visit_id").order("confirmed_at", { ascending: false }).limit(200),
      ])
    : [{ data: null }, { data: null }];
  const accesos = (accesosRaw ?? []) as unknown as FamilyAccessInfo[];
  const visitasPorId = new Map((visits ?? []).map((v) => [v.id, v]));
  const confirmacionesDelPaciente = (confirmacionesFam ?? []).filter((c) => visitasPorId.has(c.visit_id));

  const ingresoData = tab === "ingreso"
    ? await Promise.all([
        supabase.from("patient_medications").select("id, medicamento, dosis, via, frecuencia").eq("patient_id", id).eq("activo", true).order("created_at"),
        supabase.from("info_checklist_items").select("id, orden, texto").eq("activo", true).order("orden"),
        supabase.from("patient_info_checklist").select("item_id").eq("patient_id", id),
        p.obra_social_id ? supabase.from("os_required_documents").select("id, nombre, obligatorio").eq("obra_social_id", p.obra_social_id).eq("activo", true).order("orden") : Promise.resolve({ data: [] as { id: string; nombre: string; obligatorio: boolean }[] }),
        supabase.from("patient_required_documents").select("doc_id").eq("patient_id", id),
        esAdmin ? supabase.from("profiles").select("id, full_name").eq("role", "profesional_asistencial").eq("active", true).order("full_name") : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
      ])
    : null;
  const medicacion = ingresoData?.[0].data ?? [];
  const checkItems = ingresoData?.[1].data ?? [];
  const checkHechos = new Set((ingresoData?.[2].data ?? []).map((x) => x.item_id));
  const docsOS = ingresoData?.[3].data ?? [];
  const docsRecibidos = new Set((ingresoData?.[4].data ?? []).map((x) => x.doc_id));
  const profesionales = (ingresoData?.[5].data ?? []) as { id: string; full_name: string }[];

  const obraSocial = (p.obras_sociales as unknown as { nombre: string } | null)?.nombre ?? p.obra_social ?? "Sin obra social";
  const firmados = new Map((sigs ?? []).map((s) => [s.legal_document_id, s]));
  const nombreDe = (x: unknown) => (x as { full_name: string } | null)?.full_name ?? "—";
  const card = "bg-white rounded-2xl border border-slate-200 p-5";

  const semana = semanaActual();
  const cumplimiento = calcularCumplimiento(planesActivos, (visits ?? []).map((v) => ({ patient_id: id, especialidad: v.especialidad, fecha_programada: v.fecha_programada, estado: v.estado })), semana);

  // Los 6 pasos del ingreso (DF-C3 §3). Los pasos 1 a 3 se completan al dar de alta.
  const pasos = [
    { n: 1, titulo: "Datos personales y de contacto", ok: true },
    { n: 2, titulo: "Obra social y afiliado", ok: !!p.obra_social_id || !!p.obra_social },
    { n: 3, titulo: "Diagnóstico, plan y equipo", ok: planesActivos.length > 0 && (team ?? []).length > 0 },
    { n: 4, titulo: "Medicación vigente", ok: medicacion.length > 0 || !!p.medicacion_confirmada_at },
    { n: 5, titulo: "Información y consentimientos", ok: checkItems.length > 0 && checkItems.every((i) => checkHechos.has(i.id)) && (legalDocs ?? []).every((d) => firmados.has(d.id)) },
    { n: 6, titulo: "Documentación de la obra social", ok: docsOS.filter((d) => d.obligatorio).every((d) => docsRecibidos.has(d.id)) },
  ];
  const pasosHechos = pasos.filter((x) => x.ok).length;

  // Cronología del Resumen: lo último que pasó con el paciente, de todas las fuentes que el rol puede ver.
  type Evento = { fecha: string; texto: string };
  const eventos: Evento[] = [
    ...(visits ?? []).filter((v) => v.estado === "realizada" || v.estado === "no_realizada").map((v) => ({ fecha: v.fecha_programada, texto: `Visita de ${SPECIALTY_LABELS[v.especialidad] ?? v.especialidad} ${v.estado === "realizada" ? "realizada" : "no realizada"} · ${nombreDe(v.profiles)}` })),
    ...(evolutions ?? []).map((e) => ({ fecha: e.created_at, texto: `Evolución de ${SPECIALTY_LABELS[e.especialidad] ?? e.especialidad} · ${nombreDe(e.profiles)}` })),
    ...(orders ?? []).map((o) => ({ fecha: o.created_at, texto: `Pedido: ${ORDER_LABELS[o.estado] ?? o.estado}` })),
    ...(p.llegada_confirmada_at ? [{ fecha: p.llegada_confirmada_at, texto: "Llegada al domicilio confirmada" }] : []),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 10);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<IconUser className="w-5 h-5" />}
        title={p.nombre_completo}
        badge={ESTADO_LABELS[p.estado]}
        purpose={`DNI ${p.dni} · ${obraSocial}${p.numero_afiliado ? ` · afiliado ${p.numero_afiliado}` : ""}`}
      />

      <div className="flex items-center gap-3 flex-wrap text-sm">
        <Link href="/internacion" className="text-slate-500 hover:text-slate-900 underline underline-offset-2">← Volver a Pacientes</Link>
        <StatusBadge tone={ESTADO_TONE[p.estado] ?? "gris"} label={ESTADO_LABELS[p.estado]} />
        {verClinica && <UppFicha patientId={id} />}
        {p.estado !== "dado_de_baja" && puedeEditarPlan && (
          <Link href="/agenda#programar-visita" className={btnGhost}>Programar una visita</Link>
        )}
      </div>

      <nav aria-label="Secciones de la ficha" className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={`/paciente/${id}?tab=${t.id}`}
            aria-current={t.id === tab ? "page" : undefined}
            className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${t.id === tab ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "resumen" && (
        <div className="grid gap-4 md:grid-cols-2">
          <section className={card}>
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Datos del paciente</h2>
            <dl className="text-sm space-y-1.5">
              <div className="flex gap-2"><dt className="text-slate-500 w-32 shrink-0">Domicilio</dt><dd className="flex items-start gap-1"><IconMapPin className="w-3.5 h-3.5 mt-0.5 text-slate-400" />{p.domicilio}</dd></div>
              <div className="flex gap-2"><dt className="text-slate-500 w-32 shrink-0">Teléfono</dt><dd>{p.telefono_contacto ?? "—"}</dd></div>
              <div className="flex gap-2"><dt className="text-slate-500 w-32 shrink-0">Familiar responsable</dt><dd>{p.contacto_familiar_nombre ?? "—"}{p.contacto_familiar_telefono ? ` · ${p.contacto_familiar_telefono}` : ""}</dd></div>
              <div className="flex gap-2"><dt className="text-slate-500 w-32 shrink-0">Nacimiento</dt><dd>{fecha(p.fecha_nacimiento)}</dd></div>
              <div className="flex gap-2"><dt className="text-slate-500 w-32 shrink-0">Diagnóstico</dt><dd>{p.diagnostico_principal ?? "—"}</dd></div>
              <div className="flex gap-2"><dt className="text-slate-500 w-32 shrink-0">Médico derivante</dt><dd>{p.medico_derivante ?? "—"}</dd></div>
              <div className="flex gap-2"><dt className="text-slate-500 w-32 shrink-0">Ingreso</dt><dd>{fecha(p.fecha_ingreso)}{p.llegada_confirmada_at ? ` · llegó el ${fecha(p.llegada_confirmada_at)}` : ""}</dd></div>
            </dl>
          </section>
          <section className={card}>
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Equipo asistencial</h2>
            {(team ?? []).length === 0 ? (
              <p className="text-sm text-slate-400">Todavía no tiene equipo asignado.</p>
            ) : (
              <ul className="text-sm space-y-1.5">
                {(team ?? []).map((t) => (
                  <li key={t.id}><span className="text-slate-500">{SPECIALTY_LABELS[t.especialidad] ?? t.especialidad}:</span> {nombreDe(t.profiles)}</li>
                ))}
              </ul>
            )}
            <h2 className="text-sm font-semibold text-slate-900 mt-5 mb-3">Próxima visita</h2>
            {(() => {
              const prox = [...(visits ?? [])].filter((v) => v.estado === "programada" || v.estado === "confirmada").sort((a, b) => a.fecha_programada.localeCompare(b.fecha_programada))[0];
              return prox ? (
                <p className="text-sm">{descripcionFechaHora(prox)} · {SPECIALTY_LABELS[prox.especialidad] ?? prox.especialidad} · {nombreDe(prox.profiles)}</p>
              ) : (
                <p className="text-sm text-slate-400">No hay visitas programadas.</p>
              );
            })()}
          </section>
          <section className={card}>
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-sm font-semibold text-slate-900">Plan de la semana</h2>
              <Link href={`/paciente/${id}?tab=plan`} className="text-xs text-slate-500 underline underline-offset-2">Ver plan</Link>
            </div>
            {cumplimiento.length === 0 ? (
              <p className="text-sm text-slate-400">Todavía no tiene plan de tratamiento cargado.</p>
            ) : (
              <ul className="text-sm space-y-2">
                {cumplimiento.map((c) => (
                  <li key={c.plan.id} className="flex items-center justify-between gap-3">
                    <span>{SPECIALTY_LABELS[c.plan.especialidad] ?? c.plan.especialidad}: {c.cubiertas} de {c.esperadas}</span>
                    <StatusBadge tone={c.faltan === 0 ? "verde" : "amarillo"} label={c.faltan === 0 ? "Completo" : `Faltan ${c.faltan}`} />
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className={card}>
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Lo último que pasó</h2>
            {eventos.length === 0 ? (
              <p className="text-sm text-slate-400">Todavía no hay actividad registrada.</p>
            ) : (
              <ol className="text-sm space-y-2 border-l border-slate-200 pl-4">
                {eventos.map((e, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-slate-300" />
                    <span className="block text-xs text-slate-400">{fecha(e.fecha)}</span>
                    {e.texto}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}

      {tab === "plan" && (
        <div className="space-y-4">
          <section className={card}>
            <h2 className="text-sm font-semibold text-slate-900">Plan de tratamiento por disciplina</h2>
            <p className="text-xs text-slate-500 mt-1 mb-4">Cuántas visitas necesita el paciente. Con el plan cargado, la Agenda avisa qué visitas faltan programar cada semana.</p>
            {planesActivos.length === 0 ? (
              <p className="text-sm text-slate-400">Todavía no hay disciplinas en el plan.</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {planesActivos.map((pl) => {
                  const c = cumplimiento.find((x) => x.plan.id === pl.id);
                  return (
                    <li key={pl.id} className="py-3 flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <span className="font-medium text-slate-900">{SPECIALTY_LABELS[pl.especialidad] ?? pl.especialidad}</span>
                        <span className="text-slate-500"> · {describirPlan(pl)}</span>
                        <span className="block text-xs text-slate-400">Desde {fecha(pl.desde)}{pl.nota ? ` · ${pl.nota}` : ""}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {c && <StatusBadge tone={c.faltan === 0 ? "verde" : "amarillo"} label={`Esta semana: ${c.cubiertas} de ${c.esperadas}${c.faltan > 0 ? ` · faltan ${c.faltan}` : ""}`} />}
                        {puedeEditarPlan && (
                          <form action={endPlanAction}>
                            <input type="hidden" name="plan_id" value={pl.id} />
                            <input type="hidden" name="patient_id" value={id} />
                            <ConfirmButton className={btnGhost} confirmLabel="¿Quitar? Tocá de nuevo">Quitar</ConfirmButton>
                          </form>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {puedeEditarPlan && p.estado !== "dado_de_baja" && (
            <section className={card}>
              <h2 className="text-sm font-semibold text-slate-900 mb-1">Agregar o cambiar una disciplina</h2>
              <p className="text-xs text-slate-500 mb-4">Si la disciplina ya está en el plan, el plan anterior queda en el historial.</p>
              <form action={savePlanAction} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                <input type="hidden" name="patient_id" value={id} />
                <label className="block text-xs text-slate-600">Disciplina
                  <select name="especialidad" required className={`${inputCls} mt-1`}>
                    {DISCIPLINAS_PLAN.map((d) => <option key={d} value={d}>{SPECIALTY_LABELS[d]}</option>)}
                  </select>
                </label>
                <label className="block text-xs text-slate-600">Cantidad de visitas
                  <input name="cantidad" type="number" min={1} max={50} required defaultValue={3} className={`${inputCls} mt-1`} />
                </label>
                <label className="block text-xs text-slate-600">Cada
                  <select name="unidad" defaultValue="semana" className={`${inputCls} mt-1`}>
                    <option value="semana">semana</option>
                    <option value="dia">día</option>
                  </select>
                </label>
                <label className="block text-xs text-slate-600">Nota (opcional)
                  <input name="nota" placeholder="Ej. a la mañana" className={`${inputCls} mt-1`} />
                </label>
                <fieldset className="sm:col-span-4">
                  <legend className="text-xs text-slate-600 mb-1">Días específicos (opcional; si no marcás ninguno, cualquier día)</legend>
                  <div className="flex flex-wrap gap-3">
                    {DIAS_CORTOS.map((d, i) => (
                      <label key={d} className="flex items-center gap-1.5 text-xs text-slate-700">
                        <input type="checkbox" name="dias" value={i + 1} className="rounded border-slate-300" /> {d}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="sm:col-span-4"><button className={btnPrimary}>Guardar en el plan</button></div>
              </form>
            </section>
          )}

          {historialPlanes.length > 0 && (
            <section className={card}>
              <h2 className="text-sm font-semibold text-slate-900 mb-3">Historial del plan</h2>
              <ul className="text-sm space-y-1.5 text-slate-600">
                {historialPlanes.map((pl) => (
                  <li key={pl.id}>{SPECIALTY_LABELS[pl.especialidad] ?? pl.especialidad} · {describirPlan(pl)} <span className="text-xs text-slate-400">({fecha(pl.desde)} a {fecha(pl.hasta)})</span></li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {tab === "agenda" && (
        <section className={card}>
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Visitas</h2>
          {(visits ?? []).length === 0 ? (
            <p className="text-sm text-slate-400">Este paciente todavía no tiene visitas.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {(visits ?? []).slice(0, 30).map((v) => (
                <li key={v.id} className="py-2 flex items-center justify-between gap-3 flex-wrap">
                  <span>{descripcionFechaHora(v)} · {SPECIALTY_LABELS[v.especialidad] ?? v.especialidad} · {nombreDe(v.profiles)}</span>
                  <StatusBadge tone={VISITA_TONE[v.estado] ?? "gris"} label={VISITA_LABELS[v.estado] ?? v.estado} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "clinica" && <HistoriaClinicaFicha patientId={id} role={role} userId={profile.id} />}

      {tab === "insumos" && (
        <div className="grid gap-4 md:grid-cols-2">
          <section className={card}>
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Insumos autorizados</h2>
            {(stockAuths ?? []).length === 0 ? (
              <p className="text-sm text-slate-400">No tiene insumos ni equipos autorizados.</p>
            ) : (
              <ul className="text-sm space-y-1.5">
                {(stockAuths ?? []).map((a) => (
                  <li key={a.id}>{(a.products as unknown as { descripcion: string } | null)?.descripcion ?? "—"} · {a.cantidad_autorizada} <span className="text-xs text-slate-400">(hasta {fecha(a.vigente_hasta)})</span></li>
                ))}
              </ul>
            )}
            <h2 className="text-sm font-semibold text-slate-900 mt-5 mb-3">Equipos en el domicilio</h2>
            {(equipos ?? []).length === 0 ? (
              <p className="text-sm text-slate-400">No hay equipos en el domicilio.</p>
            ) : (
              <ul className="text-sm space-y-1.5">
                {(equipos ?? []).map((e) => (
                  <li key={e.asset_id}>{e.descripcion} <span className="text-xs text-slate-400">· serie {e.numero_serie} · desde {fecha(e.desde)}</span></li>
                ))}
              </ul>
            )}
          </section>
          <section className={card}>
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Pedidos recientes</h2>
            {(orders ?? []).length === 0 ? (
              <p className="text-sm text-slate-400">Sin pedidos.</p>
            ) : (
              <ul className="text-sm space-y-1.5">
                {(orders ?? []).map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-3">
                    <span>{fecha(o.created_at)}</span>
                    <StatusBadge tone={ORDER_TONE[o.estado] ?? "gris"} label={ORDER_LABELS[o.estado] ?? o.estado} />
                  </li>
                ))}
              </ul>
            )}
            <Link href="/pedidos" className={`${btnGhost} inline-block mt-4`}>Ir a Pedidos para cargar uno nuevo</Link>
          </section>
        </div>
      )}

      {tab === "ingreso" && (
        <div className="space-y-4">
          <section className={card}>
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <h2 className="text-sm font-semibold text-slate-900">Ingreso del paciente: {pasosHechos} de 6 pasos completos</h2>
              <StatusBadge tone={pasosHechos === 6 ? "verde" : "amarillo"} label={pasosHechos === 6 ? "Ingreso completo" : "Ingreso en curso"} />
            </div>
            <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
              {pasos.map((x) => (
                <li key={x.n} className={`rounded-xl border px-3 py-2 flex items-center gap-2 ${x.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                  <span className="font-semibold">{x.ok ? "✓" : x.n}</span> {x.titulo}{!x.ok && <span className="ml-auto text-[11px]">pendiente</span>}
                </li>
              ))}
            </ol>
            <p className="text-xs text-slate-500 mt-3">Los pasos 1 y 2 se completan al dar de alta; el 3 es el plan de tratamiento y el equipo; del 4 al 6 se completan acá abajo.</p>
          </section>

          <section className={card} id="paso-3">
            <h2 className="text-sm font-semibold text-slate-900 mb-2">Paso 3 · Plan de tratamiento y equipo</h2>
            <p className="text-sm text-slate-600">
              {planesActivos.length > 0 ? `${planesActivos.length} disciplina${planesActivos.length === 1 ? "" : "s"} en el plan` : "Sin plan cargado"} · {(team ?? []).length > 0 ? `${(team ?? []).length} profesional${(team ?? []).length === 1 ? "" : "es"} en el equipo` : "sin equipo asignado"}.
            </p>
            <div className="flex gap-2 mt-3 flex-wrap">
              <Link href={`/paciente/${id}?tab=plan`} className={btnGhost}>Ir al plan de tratamiento</Link>
              <Link href="/internacion" className={btnGhost}>Asignar equipo en Pacientes</Link>
            </div>
          </section>

          <section className={card} id="paso-4">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Paso 4 · Medicación vigente y equipamiento</h2>
            {medicacion.length === 0 ? (
              <p className="text-sm text-slate-400">No hay medicación cargada{p.medicacion_confirmada_at ? ": se confirmó que no toma medicación" : ""}.</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {medicacion.map((m) => (
                  <li key={m.id} className="py-2 flex items-center justify-between gap-3 flex-wrap">
                    <span><span className="font-medium text-slate-900">{m.medicamento}</span> <span className="text-slate-500">{[m.dosis, m.via, m.frecuencia].filter(Boolean).join(" · ")}</span></span>
                    {puedeEditarPlan && (
                      <form action={removeMedicationAction}>
                        <input type="hidden" name="id" value={m.id} />
                        <input type="hidden" name="patient_id" value={id} />
                        <ConfirmButton className={btnGhost} confirmLabel="¿Quitar? Tocá de nuevo">Quitar</ConfirmButton>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {puedeEditarPlan && (
              <form action={addMedicationAction} className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4 items-end">
                <input type="hidden" name="patient_id" value={id} />
                <input name="medicamento" required placeholder="Medicamento" className={`${inputCls} col-span-2`} />
                <input name="dosis" placeholder="Dosis" className={inputCls} />
                <input name="via" placeholder="Vía (oral, EV…)" className={inputCls} />
                <input name="frecuencia" placeholder="Frecuencia" className={inputCls} />
                <div className="col-span-2 sm:col-span-5 flex gap-2 flex-wrap">
                  <button className={btnPrimary}>Agregar medicamento</button>
                </div>
              </form>
            )}
            {esAdmin && medicacion.length === 0 && !p.medicacion_confirmada_at && (
              <form action={confirmNoMedicationAction} className="mt-3">
                <input type="hidden" name="patient_id" value={id} />
                <button className={btnGhost}>El paciente no toma medicación</button>
              </form>
            )}
            <p className="text-xs text-slate-500 mt-4">El equipamiento (cama, oxígeno, etc.) se asigna cargando un pedido: <Link href="/pedidos" className="underline underline-offset-2">ir a Pedidos</Link>.</p>
          </section>

          <section className={card} id="paso-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-1">Paso 5 · Información al paciente y consentimientos</h2>
            <p className="text-xs text-slate-500 mb-3">Checklist «Información al Paciente» (R PFS 01): se tilda cada punto que se le explicó al familiar responsable.</p>
            <ul className="space-y-1.5 text-sm">
              {checkItems.map((it) => {
                const hecho = checkHechos.has(it.id);
                return (
                  <li key={it.id} className="flex items-start gap-2">
                    {esAdmin ? (
                      <form action={toggleChecklistItemAction}>
                        <input type="hidden" name="patient_id" value={id} />
                        <input type="hidden" name="item_id" value={it.id} />
                        <input type="hidden" name="marcado" value={hecho ? "1" : "0"} />
                        <button aria-label={hecho ? "Quitar tilde" : "Tildar"} className={`w-5 h-5 mt-0.5 rounded border text-[11px] leading-none ${hecho ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 text-transparent hover:border-slate-500"}`}>✓</button>
                      </form>
                    ) : (
                      <span className={`w-5 h-5 mt-0.5 rounded border text-[11px] leading-none flex items-center justify-center ${hecho ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300"}`}>{hecho ? "✓" : ""}</span>
                    )}
                    <span className={hecho ? "text-slate-700" : "text-slate-600"}>{it.texto}</span>
                  </li>
                );
              })}
            </ul>
            <h3 className="text-sm font-semibold text-slate-900 mt-6 mb-2">Consentimientos</h3>
            <div className="space-y-2">
              {(legalDocs ?? []).map((d, idx, todos) => {
                const s = firmados.get(d.id);
                // R60: los consentimientos se firman en orden; el siguiente espera hasta que se firme el anterior.
                const anteriorPendiente = todos.slice(0, idx).find((x) => !firmados.has(x.id));
                return (
                  <ConsentDocumentRow
                    bloqueadoPor={anteriorPendiente?.titulo ?? null}
                    detalle={d.codigo === "r_pfs_05" ? <ConsentimientoDetalle paciente={p} planes={planesActivos} /> : undefined}
                    key={d.id}
                    signAction={signLegalDocumentAction}
                    patientId={id}
                    documentId={d.id}
                    titulo={d.titulo}
                    resumen={d.resumen}
                    requiereFirmaProfesional={d.requiere_firma_profesional}
                    profesionales={profesionales}
                    firmado={s ? { firmante_nombre: s.firmante_nombre, firmado_at: s.firmado_at, profesional_id: s.profesional_id } : null}
                    canSign={esAdmin}
                  />
                );
              })}
              {(legalDocs ?? []).length === 0 && <p className="text-sm text-slate-400">Sin documentos configurados.</p>}
            </div>
          </section>

          <section className={card} id="paso-6">
            <h2 className="text-sm font-semibold text-slate-900 mb-1">Paso 6 · Documentación de la obra social</h2>
            {docsOS.length === 0 ? (
              <p className="text-sm text-slate-500">Esta obra social todavía no tiene documentación configurada. Administración puede cargarla en <Link href="/obras-sociales" className="underline underline-offset-2">Obras sociales</Link>.</p>
            ) : (
              <ul className="space-y-1.5 text-sm mt-2">
                {docsOS.map((d) => {
                  const hecho = docsRecibidos.has(d.id);
                  return (
                    <li key={d.id} className="flex items-start gap-2">
                      {esAdmin ? (
                        <form action={toggleRequiredDocAction}>
                          <input type="hidden" name="patient_id" value={id} />
                          <input type="hidden" name="doc_id" value={d.id} />
                          <input type="hidden" name="marcado" value={hecho ? "1" : "0"} />
                          <button aria-label={hecho ? "Marcar como no recibido" : "Marcar como recibido"} className={`w-5 h-5 mt-0.5 rounded border text-[11px] leading-none ${hecho ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 text-transparent hover:border-slate-500"}`}>✓</button>
                        </form>
                      ) : (
                        <span className={`w-5 h-5 mt-0.5 rounded border text-[11px] leading-none flex items-center justify-center ${hecho ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300"}`}>{hecho ? "✓" : ""}</span>
                      )}
                      <span>{d.nombre}{!d.obligatorio && <span className="text-xs text-slate-400"> · opcional</span>}{!hecho && d.obligatorio && <span className="text-xs text-amber-700"> · falta recibir</span>}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className={card}>
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Prácticas autorizadas por la obra social</h2>
            {(auths ?? []).length === 0 ? (
              <p className="text-sm text-slate-400">Sin autorizaciones cargadas.</p>
            ) : (
              <ul className="text-sm space-y-1.5">
                {(auths ?? []).map((a) => (
                  <li key={a.id} className="flex items-center gap-2 flex-wrap">
                    <StatusBadge tone={SEMAFORO_TONE[a.estado_semaforo ?? "vigente"] ?? "gris"} label={SEMAFORO_LABELS[a.estado_semaforo ?? "vigente"]} />
                    {a.practica} · {a.cantidad_autorizada}x {SPECIALTY_LABELS[a.especialidad ?? ""] ?? a.especialidad} <span className="text-xs text-slate-400">(hasta {fecha(a.periodo_hasta)})</span>
                  </li>
                ))}
              </ul>
            )}
            {p.estado === "dado_de_baja" ? (
              <p className="text-sm text-slate-600 mt-4">Egreso: {p.motivo_egreso ?? "—"} el {fecha(p.fecha_egreso)}.</p>
            ) : p.egreso_informado_at ? (
              <p className="text-sm text-amber-700 mt-4 flex items-center gap-1.5"><IconAlert className="w-4 h-4" /> Egreso informado: falta que Administración confirme la baja.</p>
            ) : null}
          </section>
        </div>
      )}

      {tab === "mensajes" && (
        <section className={card}>
          <h2 className="text-sm font-semibold text-slate-900">Mensajes del equipo</h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">Para coordinar entre el equipo del paciente sin usar WhatsApp personal. Lo ven Administración, Coordinación y los profesionales asignados a este paciente.</p>
          {puedeEscribirMensajes ? (
          <form action={postMessageAction} className="flex gap-2 items-start mb-5">
            <input type="hidden" name="patient_id" value={id} />
            <textarea name="mensaje" required maxLength={1000} rows={2} placeholder="Escribí un mensaje para el equipo…" className={`${inputCls} flex-1`} />
            <button className={btnPrimary}>Enviar</button>
          </form>
          ) : (
            <p className="text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-2 mb-5">Solo el equipo asignado al paciente, Administración y Coordinación escriben acá. Podés leer los mensajes.</p>
          )}
          {(mensajes ?? []).length === 0 ? (
            <p className="text-sm text-slate-400">Todavía no hay mensajes.</p>
          ) : (
            <ul className="space-y-3">
              {(mensajes ?? []).map((m) => (
                <li key={m.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
                  <span className="block text-xs text-slate-400">{nombreDe(m.profiles)} · {fechaHora(m.created_at)}</span>
                  <span className="whitespace-pre-wrap">{m.mensaje}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "familia" && (
        <section className={card}>
          <h2 className="text-sm font-semibold text-slate-900">Acceso de la familia</h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            La familia escanea un código QR, ingresa un PIN y ve las fechas de las visitas programadas y realizadas. Puede confirmar que una visita se hizo.
            No ve diagnósticos, evoluciones ni datos clínicos. El acceso vence a los 90 días y se puede dar de baja cuando quieras.
          </p>
          {!familyPortalEnabled() ? (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
              El portal está apagado hasta contar con la validación legal. Para habilitarlo, definir la variable <code>FAMILY_PORTAL_ENABLED=1</code> en Vercel.
            </p>
          ) : (
            <>
              <FamilyAccessPanel patientId={id} patientName={p.nombre_completo} hayActivo={accesos.some((a) => !a.revoked_at && new Date(a.expires_at) > new Date())} />
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mt-6 mb-2">Tarjetas emitidas</h3>
              {accesos.length === 0 ? (
                <p className="text-sm text-slate-400">Todavía no se emitió ninguna tarjeta.</p>
              ) : (
                <ul className="space-y-2">
                  {accesos.map((a) => {
                    const vigente = !a.revoked_at && new Date(a.expires_at) > new Date();
                    return (
                      <li key={a.id} className="flex items-center justify-between gap-3 flex-wrap rounded-xl bg-slate-50 px-3 py-2 text-sm">
                        <span>
                          <span className="text-slate-800">Emitida el {fechaHora(a.created_at)}{a.creado_por ? ` por ${a.creado_por}` : ""}</span>
                          <span className="block text-xs text-slate-500">
                            {a.revoked_at ? `Dada de baja el ${fechaHora(a.revoked_at)}` : vigente ? `Vence el ${fechaHora(a.expires_at)}` : "Vencida"}
                            {" · "}
                            {a.last_access_at ? `Último ingreso: ${fechaHora(a.last_access_at)}` : "Nunca se usó"}
                          </span>
                        </span>
                        {vigente && (
                          <form action={revokeFamilyAccessAction}>
                            <input type="hidden" name="patient_id" value={id} />
                            <input type="hidden" name="access_id" value={a.id} />
                            <ConfirmButton className="rounded-lg border border-red-200 text-red-700 text-xs font-medium px-3 py-1.5 hover:bg-red-50" confirmLabel="¿Dar de baja? Tocá de nuevo">Dar de baja</ConfirmButton>
                          </form>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mt-6 mb-2">Confirmaciones de la familia</h3>
              {confirmacionesDelPaciente.length === 0 ? (
                <p className="text-sm text-slate-400">La familia todavía no confirmó ninguna visita.</p>
              ) : (
                <ul className="space-y-2">
                  {confirmacionesDelPaciente.map((c) => {
                    const v = visitasPorId.get(c.visit_id);
                    return (
                      <li key={c.id} className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                        {v ? `${SPECIALTY_LABELS[v.especialidad] ?? v.especialidad} del ${fechaHora(v.fecha_programada)}` : "Visita"} — confirmada por {c.nombre} el {fechaHora(c.confirmed_at)}
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
