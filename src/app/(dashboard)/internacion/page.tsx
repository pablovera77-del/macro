import Link from "next/link";
import ConfirmButton from "@/components/ConfirmButton";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, SPECIALTY_LABELS, ROLES_ALTA } from "@/lib/auth";
import {
  confirmArrivalAction,
  reportarEgresoAction,
  addTreatmentAuthorizationAction,
  assignCareTeamAction,
  signLegalDocumentAction,
} from "./actions";
import PageHeader from "@/components/PageHeader";
import ActionDisclosure from "@/components/ActionDisclosure";
import ConsentDocumentRow from "@/components/ConsentDocumentRow";
import AdmissionWizard from "@/components/AdmissionWizard";
import { IconClipboard, IconUser, IconMapPin, IconAlert, IconCheck, IconClock, IconSignature } from "@/components/icons";
import { SEMANTIC_TONE_BADGE_STYLES, SemanticTone } from "@/lib/semantic-status";
import ProrrogasPanel from "@/components/pacientes/ProrrogasPanel";
import LinkLlegada from "@/components/pacientes/LinkLlegada";
import HistorialInternaciones from "@/components/pacientes/HistorialInternaciones";
import SemaforoBadge from "@/components/pacientes/SemaforoBadge";
import { semaforoPaciente, semaforoPorDias, diasRestantes } from "@/lib/semaforo";
import { MOTIVOS_EGRESO_OPCIONES, motivoEgresoLabel, datetimeLocalAR } from "@/lib/egreso";
import StatusBadge from "@/components/StatusBadge";

const ESTADO_LABELS: Record<string, string> = {
  admitido_pendiente_llegada: "Admitido, pendiente de llegada",
  activo: "Activo",
  dado_de_baja: "Dado de baja",
};
// Color semántico único (DF-C1 §10): cada estado de negocio mapea a uno de los 4 tonos.
const ESTADO_TONE: Record<string, SemanticTone> = {
  admitido_pendiente_llegada: "amarillo",
  activo: "verde",
  dado_de_baja: "gris",
};
const ESTADO_STYLES: Record<string, string> = Object.fromEntries(
  Object.entries(ESTADO_TONE).map(([k, tone]) => [k, SEMANTIC_TONE_BADGE_STYLES[tone]])
);
// Semáforo de vencimientos de autorizaciones (DF-C3 §10) — mismo tono que el resto
// de los semáforos de la plataforma (DF-C4 §9, DF-C5 §3), ver DF-C1 §10.
const SEMAFORO_TONE: Record<string, SemanticTone> = {
  vigente: "verde",
  por_vencer: "amarillo",
  vencida: "rojo",
};
const SEMAFORO_STYLES: Record<string, string> = Object.fromEntries(
  Object.entries(SEMAFORO_TONE).map(([k, tone]) => [k, SEMANTIC_TONE_BADGE_STYLES[tone]])
);
const SEMAFORO_LABELS: Record<string, string> = {
  vigente: "Vigente",
  por_vencer: "Por vencer",
  vencida: "Vencida",
};

export default async function InternacionPage({
  searchParams,
}: {
  searchParams: Promise<{ nuevo?: string; admitido?: string; ver?: string; os?: string; atb?: string; cur?: string }>;
}) {
  const { nuevo, admitido, ver, os: osFiltro, atb, cur } = await searchParams;
  const { profile } = await requireProfile();
  const supabase = await createClient();

  // DF-C3 §2/§3: Administración da de alta y gestiona el legajo (firmas, autorizaciones, equipo).
  // Coordinación consulta y confirma la llegada al domicilio. El rol "Médico coordinador" se retiró.
  const canAdmit = ROLES_ALTA.includes(profile.role);
  const isCoord = profile.role === "coordinador_internacion";
  const canArrival = canAdmit || isCoord;
  // DF-C3 §11: cualquier profesional asistencial puede informar un egreso,
  // aunque no tenga el resto de los permisos de gestión.
  const canReportEgreso = canArrival || profile.role === "profesional_asistencial";

  const [
    { data: patients },
    { data: obrasSociales },
    { data: authorizations },
    { data: careTeam },
    { data: profesionales },
    { data: orderNews },
    { data: legalDocuments },
    { data: signatures },
  ] = await Promise.all([
    supabase
      .from("patients")
      .select(
        "id, nombre_completo, dni, domicilio, en_tratamiento_atb, requiere_curaciones, es_particular, contacto_familiar_nombre, contacto_familiar_telefono, obra_social, obra_social_id, estado, fecha_ingreso, fecha_egreso, motivo_egreso, diagnostico_principal, llegada_confirmada_at, medicacion_confirmada_at, egreso_informado_at, egreso_motivo_informado, profiles:egreso_informado_por(full_name), obras_sociales(nombre)"
      )
      .order("fecha_ingreso", { ascending: false }),
    // DF-C3 §2: responsable_id habilita rutear el semáforo de vencimientos (más
    // abajo) hacia la persona de Administración a cargo de cada obra social.
    supabase.from("obras_sociales").select("id, nombre, responsable_id, profiles:responsable_id(full_name)").eq("activa", true).order("nombre"),
    supabase.from("v_treatment_authorization_status").select("*").order("periodo_hasta"),
    supabase.from("patient_care_team").select("id, patient_id, profesional_id, especialidad, profiles(full_name)"),
    supabase.from("profiles").select("id, full_name, role").in("role", ["profesional_asistencial"]).eq("active", true),
    isCoord
      ? supabase
          .from("orders")
          .select(
            "id, estado, autorizacion_automatica, motivo_rechazo, fecha_autorizacion, patient_id, patients(nombre_completo, coordinador_id)"
          )
          .eq("autorizacion_automatica", false)
          .in("estado", ["autorizado", "cancelado"])
          .not("fecha_autorizacion", "is", null)
          .order("fecha_autorizacion", { ascending: false })
          .limit(10)
      : Promise.resolve({ data: null }),
    // DF-C2 §6: catálogo de consentimientos que se firman al ingreso, uno por uno.
    supabase.from("legal_documents").select("id, codigo, titulo, resumen, requiere_firma_profesional").eq("activo", true).order("orden"),
    supabase.from("patient_document_signatures").select("patient_id, legal_document_id, firmante_nombre, firmado_at, profesional_id"),
  ]);

  const vencenPronto = (authorizations ?? []).filter((a) => a.estado_semaforo !== "vigente");
  // DF-C3 §2: nombre del responsable de Administración por obra social, para
  // saber a quién avisar cuando el semáforo de abajo marca por_vencer/vencida.
  const responsableByObraSocial = new Map(
    (obrasSociales ?? []).map((os) => [os.id, (os.profiles as unknown as { full_name: string } | null)?.full_name ?? null])
  );
  // DF-C3 §11: un profesional asistencial solo informa el egreso de sus
  // propios pacientes (los de su equipo tratante), no de cualquiera.
  const misPacientesIds = new Set(
    (careTeam ?? []).filter((t) => t.profesional_id === profile.id).map((t) => t.patient_id)
  );
  const signatureKey = (patientId: string, documentId: string) => `${patientId}:${documentId}`;
  const signaturesByKey = new Map((signatures ?? []).map((s) => [signatureKey(s.patient_id, s.legal_document_id), s]));
  const profesionalesLivianos = (profesionales ?? []).map((p) => ({ id: p.id, full_name: p.full_name }));
  // Notificación de vuelta al coordinador (autorizado / no autorizado) tras la
  // validación manual de Administración — DF-C5 §4, comentario cliente 25/09.
  const misNovedades = orderNews ?? [];

  // Datos de los pasos 3 a 6 del ingreso (DF-C3 §3).
  const [{ data: planesActivos }, { data: medsActivas }, { data: checkItems }, { data: checkHechos }, { data: docsOS }, { data: docsRec }] = await Promise.all([
    supabase.from("treatment_plans").select("patient_id").eq("activo", true),
    supabase.from("patient_medications").select("patient_id").eq("activo", true),
    supabase.from("info_checklist_items").select("id").eq("activo", true),
    supabase.from("patient_info_checklist").select("patient_id, item_id"),
    supabase.from("os_required_documents").select("id, obra_social_id, obligatorio").eq("activo", true),
    supabase.from("patient_required_documents").select("patient_id, doc_id"),
  ]);
  // Prórrogas, internaciones y línea de tiempo (DF-C3 §3.1, §9 y §11.1).
  const [{ data: prorrogas }, { data: internaciones }, { data: eventos }] = await Promise.all([
    supabase.from("authorization_extensions").select("id, patient_id, authorization_id, pedida_at, respondida_at, estado, nueva_fecha_hasta, fecha_hasta_anterior, nota").order("pedida_at", { ascending: false }),
    supabase.from("patient_internaciones").select("id, patient_id, numero, estado, fecha_ingreso, fecha_egreso, motivo_egreso, diagnostico").order("numero", { ascending: false }),
    supabase.from("patient_status_history").select("id, patient_id, evento, fecha_evento, motivo, informado_por, confirmado_por").order("fecha_evento", { ascending: false }).limit(300),
  ]);
  const idsPersonas = [...new Set((eventos ?? []).flatMap((e) => [e.informado_por, e.confirmado_por]).filter((x): x is string => !!x))];
  const { data: personas } = idsPersonas.length > 0 ? await supabase.from("profiles").select("id, full_name").in("id", idsPersonas) : { data: [] as { id: string; full_name: string }[] };
  const nombresPersonas = Object.fromEntries((personas ?? []).map((x) => [x.id, x.full_name]));
  const conPlan = new Set((planesActivos ?? []).map((x) => x.patient_id));
  const conMeds = new Set((medsActivas ?? []).map((x) => x.patient_id));
  const totalChecklist = (checkItems ?? []).length;
  const checkPorPaciente = new Map<string, number>();
  for (const c of checkHechos ?? []) checkPorPaciente.set(c.patient_id, (checkPorPaciente.get(c.patient_id) ?? 0) + 1);
  const recibidosPorPaciente = new Map<string, Set<string>>();
  for (const d of docsRec ?? []) {
    if (!recibidosPorPaciente.has(d.patient_id)) recibidosPorPaciente.set(d.patient_id, new Set());
    recibidosPorPaciente.get(d.patient_id)!.add(d.doc_id);
  }

  // Ingresos en curso: pacientes admitidos a los que todavía les falta algún paso
  // (plan, medicación, información, consentimientos, documentación, prácticas, equipo o llegada).
  const totalDocs = (legalDocuments ?? []).length;
  const ingresosEnCurso = (patients ?? [])
    .filter((p) => p.estado !== "dado_de_baja")
    .map((p) => {
      const firmados = (legalDocuments ?? []).filter((d) => signaturesByKey.has(signatureKey(p.id, d.id))).length;
      const faltan: string[] = [];
      if (!conPlan.has(p.id)) faltan.push("Plan de tratamiento");
      if (!conMeds.has(p.id) && !p.medicacion_confirmada_at) faltan.push("Medicación vigente");
      const chk = checkPorPaciente.get(p.id) ?? 0;
      if (totalChecklist > 0 && chk < totalChecklist) faltan.push(`Información al paciente (${chk}/${totalChecklist})`);
      if (!(totalDocs > 0 && firmados === totalDocs)) faltan.push(`Consentimientos (${firmados}/${totalDocs})`);
      const reqOS = (docsOS ?? []).filter((d) => d.obra_social_id === p.obra_social_id && d.obligatorio);
      const recOS = recibidosPorPaciente.get(p.id);
      const faltanOS = reqOS.filter((d) => !recOS?.has(d.id)).length;
      if (p.obra_social_id && faltanOS > 0) faltan.push(`Documentación de la obra social (faltan ${faltanOS})`);
      if ((authorizations ?? []).filter((a) => a.patient_id === p.id).length === 0) faltan.push("Prácticas autorizadas");
      if ((careTeam ?? []).filter((t) => t.patient_id === p.id).length === 0) faltan.push("Equipo asistencial");
      if (p.estado === "admitido_pendiente_llegada" && !p.llegada_confirmada_at) faltan.push("Llegada al domicilio");
      return { p, faltan };
    })
    .filter((x) => x.faltan.length > 0)
    .sort((a, b) => (a.p.fecha_ingreso ?? "").localeCompare(b.p.fecha_ingreso ?? ""));

  // Filtro de la lista que llega desde las tarjetas del Dashboard (F3): cada
  // número lleva a la lista que lo explica.
  const hoyAR = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/San_Juan" }).format(new Date());
  const mesAR = hoyAR.slice(0, 7);
  const idsPorVencer = new Set(vencenPronto.map((a) => a.patient_id));
  const FILTROS: Record<string, { label: string; test: (p: NonNullable<typeof patients>[number]) => boolean }> = {
    activos: { label: "Pacientes activos", test: (p) => p.estado === "activo" },
    pendientes: { label: "Pendientes de llegada al domicilio", test: (p) => p.estado === "admitido_pendiente_llegada" },
    por_vencer: { label: "Con autorizaciones por vencer o vencidas", test: (p) => idsPorVencer.has(p.id) },
    altas_hoy: { label: "Altas de hoy", test: (p) => p.fecha_ingreso === hoyAR },
    bajas_hoy: { label: "Bajas de hoy", test: (p) => p.fecha_egreso === hoyAR },
    altas_mes: { label: "Altas de este mes", test: (p) => p.fecha_ingreso?.slice(0, 7) === mesAR },
    bajas_mes: { label: "Bajas de este mes", test: (p) => p.fecha_egreso?.slice(0, 7) === mesAR },
  };
  const filtroActivo = ver ? FILTROS[ver] ?? null : null;
  // H2 (Vanina 06/10): además del filtro de las tarjetas, se filtra por obra social, antibiótico y curaciones.
  const filtrosLegajo = [osFiltro, atb === "1" ? "atb" : "", cur === "1" ? "cur" : ""].filter(Boolean).length > 0;
  const pacientesVisibles = (filtroActivo ? (patients ?? []).filter(filtroActivo.test) : (patients ?? [])).filter((p) => {
    if (osFiltro === "__particular" ? !p.es_particular : osFiltro ? p.obra_social_id !== osFiltro : false) return false;
    if (atb === "1" && !p.en_tratamiento_atb) return false;
    if (cur === "1" && !p.requiere_curaciones) return false;
    return true;
  });

  const admitidoPaciente = admitido ? (patients ?? []).find((p) => p.id === admitido) ?? null : null;

  return (
    <div className="space-y-8">
      <PageHeader
        icon={<IconClipboard className="w-5 h-5" />}
        title={canAdmit ? "Pacientes e ingresos" : "Pacientes"}
        section="DF-C3"
        action={canAdmit ? { label: "+ Nuevo paciente", href: "/internacion?nuevo=1" } : undefined}
        purpose={
          canAdmit
            ? "Dá de alta un paciente con «+ Nuevo paciente» y completá su ingreso: consentimientos, autorizaciones, equipo y llegada."
            : isCoord
            ? "Consultá los pacientes y confirmá cuándo llega cada uno a su domicilio."
            : profile.role === "direccion"
            ? "Vista de consulta: pacientes, estado de ingreso y autorizaciones. No se modifica nada desde acá."
            : "Tus pacientes. Desde acá podés informar un egreso."
        }
        description="Contrasta con informe-tecnico §4 (el sistema viejo solo tenía nombre/domicilio/obra social en texto libre)."
      />

      {canAdmit && admitidoPaciente && (
        <section className="bg-emerald-50 border border-emerald-300 rounded-2xl p-5 animate-fade-slide-up">
          <div className="flex items-center gap-2 mb-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600">
              <IconCheck className="w-4 h-4" />
            </span>
            <h2 className="font-semibold text-emerald-900">Paciente admitido: {admitidoPaciente.nombre_completo}</h2>
          </div>
          <p className="text-sm text-emerald-900 mb-2">Ya tiene legajo. Para terminar el ingreso, en su tarjeta (resaltada abajo) hacé estos pasos en orden:</p>
          <ol className="text-sm text-emerald-900 list-decimal pl-5 space-y-0.5">
            <li>Firmar los consentimientos de ingreso.</li>
            <li>Tocar «Gestionar» para autorizar las prácticas y armar el equipo tratante.</li>
            <li>Cuando llegue al domicilio, tocar «Confirmar llegada».</li>
          </ol>
          <a href={`#paciente-${admitidoPaciente.id}`} className="inline-flex mt-3 rounded-xl bg-emerald-600 text-white text-sm font-medium px-4 py-2 hover:bg-emerald-700 transition-colors">
            Ir a la tarjeta del paciente
          </a>
        </section>
      )}

      {(canAdmit || isCoord) && ingresosEnCurso.length > 0 && (
        <section id="ingresos" className="scroll-mt-6 bg-white border border-amber-300 rounded-2xl p-5 animate-fade-slide-up">
          <div className="flex items-center gap-2 mb-3">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100 text-amber-600">
              <IconClock className="w-4 h-4" />
            </span>
            <h2 className="text-sm font-semibold text-slate-900">Ingresos en curso ({ingresosEnCurso.length})</h2>
            <span className="text-xs text-slate-400">Pacientes a los que todavía les falta algo</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {ingresosEnCurso.map(({ p, faltan }) => (
              <li key={p.id} className="py-2.5 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900">{p.nombre_completo} <span className="text-xs font-normal text-slate-400">· ingresó el {p.fecha_ingreso}</span></div>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {faltan.map((f) => (
                      <span key={f} className="rounded-full bg-amber-50 text-amber-700 text-[11px] font-medium px-2 py-0.5">○ {f}</span>
                    ))}
                  </div>
                </div>
                <Link href={`/paciente/${p.id}?tab=ingreso`} className="shrink-0 rounded-lg bg-slate-900 text-white text-xs font-medium px-3 py-1.5 hover:bg-slate-800 transition-colors">
                  {canAdmit ? "Completar ingreso" : "Ver ingreso"}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {canAdmit && <AdmissionWizard obrasSociales={(obrasSociales ?? []).map((o) => ({ id: o.id, nombre: o.nombre }))} profesionales={profesionalesLivianos} defaultOpen={nuevo === "1"} />}

      {isCoord && misNovedades.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-2xl p-5 animate-fade-slide-up card-hover">
          <div className="flex items-center gap-2 mb-3">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-500">
              <IconCheck className="w-4 h-4" />
            </span>
            <h2 className="text-sm font-medium text-slate-900">Novedades de pedidos: lo que Administración autorizó o rechazó</h2>
          </div>
          <ul className="text-sm space-y-1.5">
            {misNovedades.map((o) => {
              const patient = o.patients as unknown as { nombre_completo: string } | null;
              return (
                <li key={o.id} className="flex items-center gap-2 flex-wrap">
                  {o.estado === "autorizado" ? (
                    <span className="inline-block rounded-full px-2 py-0.5 text-[11px] font-medium bg-emerald-100 text-emerald-700">Autorizado</span>
                  ) : (
                    <span className="inline-block rounded-full px-2 py-0.5 text-[11px] font-medium bg-red-100 text-red-700">No autorizado</span>
                  )}
                  {patient?.nombre_completo ?? "—"}
                  {o.motivo_rechazo && <span className="text-xs text-slate-400">— {o.motivo_rechazo}</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {vencenPronto.length > 0 && (
        <section className="bg-amber-50 border border-amber-200 rounded-2xl p-5 animate-fade-slide-up">
          <div className="flex items-center gap-2 mb-3">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100 text-amber-600">
              <IconAlert className="w-4 h-4" />
            </span>
            <h2 className="text-sm font-medium text-amber-800">Autorizaciones por vencer o vencidas</h2>
          </div>
          <ul className="text-sm text-amber-800 space-y-1.5">
            {vencenPronto.map((a) => {
              const patient = (patients ?? []).find((p) => p.id === a.patient_id);
              const responsable = patient?.obra_social_id ? responsableByObraSocial.get(patient.obra_social_id) : null;
              return (
                <li key={a.id} className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${SEMAFORO_STYLES[a.estado_semaforo ?? "vigente"]}`}>
                    {SEMAFORO_LABELS[a.estado_semaforo ?? "vigente"]}
                  </span>
                  {patient?.nombre_completo ?? "—"} · {a.practica} ({SPECIALTY_LABELS[a.especialidad ?? ""] ?? a.especialidad}) · vence {a.periodo_hasta}
                  <span className="text-xs text-amber-500">— avisar a {responsable ?? "Administración (sin responsable asignado)"}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <form method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
          {ver && <input type="hidden" name="ver" value={ver} />}
          <label>Obra social
            <select name="os" defaultValue={osFiltro ?? ""} className="block mt-0.5 rounded-lg border border-slate-300 px-2 py-1.5 text-xs">
              <option value="">Todas</option>
              <option value="__particular">Particular</option>
              {(obrasSociales ?? []).map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1.5 pb-1.5"><input type="checkbox" name="atb" value="1" defaultChecked={atb === "1"} className="rounded border-slate-300" /> En tratamiento antibiótico</label>
          <label className="flex items-center gap-1.5 pb-1.5"><input type="checkbox" name="cur" value="1" defaultChecked={cur === "1"} className="rounded border-slate-300" /> Requiere curaciones</label>
          <button className="rounded-lg bg-slate-900 text-white text-xs font-medium px-3 py-1.5 hover:bg-slate-800 transition-colors">Filtrar</button>
          {filtrosLegajo && (
            <Link href={ver ? `/internacion?ver=${ver}` : "/internacion"} className="text-xs font-medium text-[var(--brand-teal)] underline underline-offset-2 pb-1.5">Limpiar</Link>
          )}
          <span className="ml-auto text-slate-400 pb-1.5">{pacientesVisibles.length} paciente{pacientesVisibles.length === 1 ? "" : "s"}</span>
        </form>
        {filtroActivo && (
          <div className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm">
            <span className="text-slate-800">
              Mostrando: <strong>{filtroActivo.label}</strong> ({pacientesVisibles.length})
            </span>
            <Link href="/internacion" className="text-xs font-medium text-[var(--brand-teal)] underline underline-offset-2">
              Quitar filtro y ver todos
            </Link>
          </div>
        )}
        {pacientesVisibles.length === 0 && (
          <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-8 text-center text-sm text-slate-500">
            {filtroActivo || filtrosLegajo
              ? "No hay pacientes que cumplan este filtro."
              : `Todavía no hay pacientes cargados. ${canAdmit ? "Tocá «+ Nuevo paciente» para dar de alta el primero." : ""}`}
          </div>
        )}
        {pacientesVisibles.map((p, i) => {
          const auths = (authorizations ?? []).filter((a) => a.patient_id === p.id);
          const team = (careTeam ?? []).filter((t) => t.patient_id === p.id);
          const initials = p.nombre_completo.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase()).join("");
          const obraSocial = (p.obras_sociales as unknown as { nombre: string } | null)?.nombre ?? p.obra_social;

          return (
            <div id={`paciente-${p.id}`} key={p.id} className={`scroll-mt-6 bg-white rounded-2xl border border-slate-200 p-5 card-hover animate-fade-slide-up stagger-${Math.min(i + 1, 8)} ${admitido === p.id ? "ring-2 ring-emerald-400" : ""}`}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-900 text-white text-xs font-semibold shrink-0">
                    {initials || <IconUser className="w-4 h-4" />}
                  </span>
                  <div>
                    <Link href={`/paciente/${p.id}`} className="font-medium text-slate-900 hover:underline underline-offset-2">{p.nombre_completo}</Link>
                    <span className="ml-2 text-xs text-slate-400">Ver ficha →</span>
                    <Link href={`/paciente/${p.id}?tab=datos`} className="ml-2 text-xs font-medium text-[var(--brand-teal)] underline underline-offset-2">Consultar datos</Link>
                    {p.en_tratamiento_atb && <span className="ml-2 rounded-full bg-sky-50 text-sky-700 text-[10px] font-medium px-2 py-0.5">ATB</span>}
                    {p.requiere_curaciones && <span className="ml-1 rounded-full bg-sky-50 text-sky-700 text-[10px] font-medium px-2 py-0.5">Curaciones</span>}
                    <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <IconMapPin className="w-3 h-3" /> {p.domicilio} · {obraSocial ?? "sin obra social"}
                      {p.dni && <span className="text-slate-400">· DNI {p.dni}</span>}
                    </div>
                    {p.diagnostico_principal && <div className="text-xs text-slate-400 mt-0.5">Dx: {p.diagnostico_principal}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${ESTADO_STYLES[p.estado]}`}>{ESTADO_LABELS[p.estado]}</span>
                  {p.estado !== "dado_de_baja" && <SemaforoBadge semaforo={semaforoPaciente(auths)} />}
                  {p.estado === "admitido_pendiente_llegada" && !p.llegada_confirmada_at && canArrival && (
                    <form action={confirmArrivalAction}>
                      <input type="hidden" name="patient_id" value={p.id} />
                      <button className="inline-flex items-center gap-1 rounded-full bg-emerald-600 text-white text-xs font-medium px-3 py-1 hover:bg-emerald-700 transition-colors">
                        <IconCheck className="w-3 h-3" /> Confirmar llegada
                      </button>
                    </form>
                  )}
                </div>
              </div>

              {p.estado === "admitido_pendiente_llegada" && !p.llegada_confirmada_at && canArrival && (
                <div className="mt-3">
                  <LinkLlegada patientId={p.id} pacienteNombre={p.nombre_completo} telefonoResponsable={p.contacto_familiar_telefono} responsableNombre={p.contacto_familiar_nombre} />
                </div>
              )}

              {p.estado !== "dado_de_baja" && (() => {
                const totalDocs = (legalDocuments ?? []).length;
                const firmados = (legalDocuments ?? []).filter((d) => signaturesByKey.has(signatureKey(p.id, d.id))).length;
                const pasos = [
                  { label: "Consentimientos", detail: `${firmados}/${totalDocs}`, done: totalDocs > 0 && firmados === totalDocs },
                  { label: "Prácticas autorizadas", detail: "", done: auths.length > 0 },
                  { label: "Equipo asignado", detail: "", done: team.length > 0 },
                  { label: "Llegada confirmada", detail: "", done: p.estado !== "admitido_pendiente_llegada" || !!p.llegada_confirmada_at },
                ];
                if (pasos.every((x) => x.done)) return null;
                return (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="text-slate-500 font-medium mr-1">Ingreso:</span>
                    {pasos.map((x) => (
                      <span key={x.label} className={`rounded-full px-2.5 py-1 font-medium ${x.done ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                        {x.done ? "✓" : "○"} {x.label}{!x.done && x.detail ? ` (${x.detail})` : ""}
                      </span>
                    ))}
                  </div>
                );
              })()}

              {team.length > 0 && (
                <div className="text-xs text-slate-500 mt-3 flex flex-wrap gap-1.5">
                  {team.map((t) => (
                    <span key={t.id} className="bg-slate-50 rounded-full px-2.5 py-1">
                      {SPECIALTY_LABELS[t.especialidad] ?? t.especialidad}: {(t.profiles as unknown as { full_name: string } | null)?.full_name}
                    </span>
                  ))}
                </div>
              )}

              <ul className="text-sm text-slate-600 mt-3 space-y-1 pl-1">
                {auths.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 flex-wrap">
                    {a.periodo_hasta ? <StatusBadge tone={semaforoPorDias(diasRestantes(a.periodo_hasta)).tone} label={semaforoPorDias(diasRestantes(a.periodo_hasta)).label} /> : null}
                    {a.practica} · {a.cantidad_autorizada}x {SPECIALTY_LABELS[a.especialidad ?? ""] ?? a.especialidad}
                    <span className="text-xs text-slate-400">(hasta {a.periodo_hasta})</span>
                  </li>
                ))}
                {auths.length === 0 && <li className="text-slate-400 text-xs">Sin autorizaciones de práctica cargadas.</li>}
              </ul>

              {p.estado !== "dado_de_baja" && (
                <div className="mt-3 bg-slate-50 rounded-xl px-3 py-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1">
                    <IconSignature className="w-3.5 h-3.5" /> Consentimientos de ingreso
                  </div>
                  {(legalDocuments ?? []).map((doc) => {
                    const sig = signaturesByKey.get(signatureKey(p.id, doc.id));
                    return (
                      <ConsentDocumentRow
                        key={doc.id}
                        signAction={signLegalDocumentAction}
                        patientId={p.id}
                        documentId={doc.id}
                        titulo={doc.titulo}
                        resumen={doc.resumen}
                        requiereFirmaProfesional={doc.requiere_firma_profesional}
                        profesionales={profesionalesLivianos}
                        firmado={sig ? { firmante_nombre: sig.firmante_nombre, firmado_at: sig.firmado_at, profesional_id: sig.profesional_id } : null}
                        canSign={canAdmit}
                      />
                    );
                  })}
                  {(legalDocuments ?? []).length === 0 && (
                    <p className="text-xs text-slate-400">Sin documentos configurados en el catálogo.</p>
                  )}
                </div>
              )}

              {p.estado === "dado_de_baja" && p.motivo_egreso && (
                <div className="text-xs text-slate-500 mt-3 flex items-center gap-1">
                  <IconClock className="w-3 h-3" /> Egreso: {motivoEgresoLabel(p.motivo_egreso)} el {p.fecha_egreso}
                </div>
              )}

              {p.estado !== "dado_de_baja" && p.egreso_informado_at && (
                <div className="text-xs text-amber-600 bg-amber-50 rounded-lg px-2.5 py-1.5 mt-3 flex items-center gap-1.5">
                  <IconAlert className="w-3.5 h-3.5" /> Egreso informado
                  {p.motivo_egreso ? "" : ` (${motivoEgresoLabel(p.egreso_motivo_informado)})`}
                  {" "}por {(p.profiles as unknown as { full_name: string } | null)?.full_name ?? "—"} — pendiente de que Administración confirme la baja definitiva.
                </div>
              )}

              {p.estado === "activo" && !p.egreso_informado_at && canReportEgreso && (canArrival || misPacientesIds.has(p.id)) && (
                <form action={reportarEgresoAction} className="flex flex-wrap items-end gap-2 mt-3">
                  <input type="hidden" name="patient_id" value={p.id} />
                  <label className="text-[11px] text-slate-600">Motivo del egreso
                    <select name="motivo" required defaultValue="" className="block mt-0.5 rounded-lg border border-slate-300 px-2 py-1.5 text-xs">
                      <option value="" disabled>Elegí el motivo…</option>
                      {MOTIVOS_EGRESO_OPCIONES.map((m) => (
                        <option key={m} value={m}>{motivoEgresoLabel(m)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-[11px] text-slate-600">Cuándo ocurrió
                    <input name="hecho_at" type="datetime-local" defaultValue={datetimeLocalAR()} max={datetimeLocalAR()} className="block mt-0.5 rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                  </label>
                  <ConfirmButton className="rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs font-medium px-3 py-1.5 hover:bg-red-100 transition-colors" confirmLabel="¿Informar egreso? Tocá de nuevo">
                    Informar egreso
                  </ConfirmButton>
                </form>
              )}

              {canAdmit && p.estado !== "dado_de_baja" && (
                <ActionDisclosure label="Gestionar" tone="subtle">
                  <div className="space-y-3">
                    <form action={addTreatmentAuthorizationAction} className="flex flex-wrap gap-2">
                      <input type="hidden" name="patient_id" value={p.id} />
                      <input name="practica" placeholder="Práctica (ej. Enfermería 3v/sem)" required className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs flex-1 min-w-[180px]" />
                      <select name="especialidad" required className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs">
                        {Object.entries(SPECIALTY_LABELS).map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                      <input name="cantidad_autorizada" type="number" min="1" defaultValue="1" className="w-16 rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                      <input name="periodo_hasta" type="date" required className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                      <details className="basis-full text-xs text-slate-600">
                        <summary className="cursor-pointer text-slate-500">Frecuencia autorizada por la obra social (opcional, la usan los controles de Facturación)</summary>
                        <div className="flex flex-wrap items-end gap-2 mt-2">
                          <label>Tipo
                            <select name="frecuencia_tipo" defaultValue="" className="block mt-0.5 rounded-lg border border-slate-300 px-2 py-1.5 text-xs">
                              <option value="">Sin definir</option>
                              <option value="diaria">Diaria (los días marcados)</option>
                              <option value="semanal">Semanal (N por semana)</option>
                            </select>
                          </label>
                          <label>Veces por día
                            <input name="veces_por_dia" type="number" min="1" max="6" defaultValue="1" className="block mt-0.5 w-16 rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                          </label>
                          <fieldset className="flex items-center gap-2">
                            <legend className="sr-only">Días de la semana</legend>
                            {[["1", "L"], ["2", "M"], ["3", "X"], ["4", "J"], ["5", "V"], ["6", "S"], ["7", "D"]].map(([v, l]) => (
                              <label key={v} className="flex items-center gap-0.5"><input type="checkbox" name="dias_semana" value={v} /> {l}</label>
                            ))}
                          </fieldset>
                        </div>
                      </details>
                      <button className="rounded-lg bg-slate-900 text-white text-xs font-medium px-3 py-1.5 hover:bg-slate-800 transition-colors">Autorizar</button>
                    </form>

                    <ProrrogasPanel
                      patientId={p.id}
                      autorizaciones={auths.map((a) => ({ id: a.id, practica: a.practica, especialidad: a.especialidad, periodo_hasta: a.periodo_hasta }))}
                      prorrogas={(prorrogas ?? []).filter((x) => x.patient_id === p.id)}
                      puedeGestionar={canAdmit}
                    />

                    <form action={assignCareTeamAction} className="flex flex-wrap gap-2">
                      <input type="hidden" name="patient_id" value={p.id} />
                      <select name="profesional_id" required className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs flex-1 min-w-[160px]">
                        <option value="">Profesional...</option>
                        {(profesionales ?? []).map((pr) => (
                          <option key={pr.id} value={pr.id}>{pr.full_name}</option>
                        ))}
                      </select>
                      <select name="especialidad" required className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs">
                        {Object.entries(SPECIALTY_LABELS).map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                      <button className="rounded-lg bg-slate-900 text-white text-xs font-medium px-3 py-1.5 hover:bg-slate-800 transition-colors">Asignar al equipo</button>
                    </form>
                    <HistorialInternaciones
                      internaciones={(internaciones ?? []).filter((x) => x.patient_id === p.id) as never}
                      eventos={(eventos ?? []).filter((x) => x.patient_id === p.id) as never}
                      nombres={nombresPersonas}
                    />
                  </div>
                </ActionDisclosure>
              )}
            </div>
          );
        })}
      </section>

    </div>
  );
}
