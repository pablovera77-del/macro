import Link from "next/link";
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
const MOTIVO_LABELS: Record<string, string> = {
  alta: "Alta médica",
  fallecimiento: "Fallecimiento",
  fin_internacion: "Fin de internación",
};
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
  searchParams: Promise<{ nuevo?: string; admitido?: string }>;
}) {
  const { nuevo, admitido } = await searchParams;
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
        "id, nombre_completo, dni, domicilio, obra_social, obra_social_id, estado, fecha_ingreso, fecha_egreso, motivo_egreso, diagnostico_principal, llegada_confirmada_at, egreso_informado_at, egreso_motivo_informado, profiles:egreso_informado_por(full_name), obras_sociales(nombre)"
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

  // Ingresos en curso: pacientes admitidos a los que todavía les falta algún paso
  // (consentimientos, prácticas autorizadas, equipo o llegada confirmada).
  const totalDocs = (legalDocuments ?? []).length;
  const ingresosEnCurso = (patients ?? [])
    .filter((p) => p.estado !== "dado_de_baja")
    .map((p) => {
      const firmados = (legalDocuments ?? []).filter((d) => signaturesByKey.has(signatureKey(p.id, d.id))).length;
      const faltan: string[] = [];
      if (!(totalDocs > 0 && firmados === totalDocs)) faltan.push(`Consentimientos (${firmados}/${totalDocs})`);
      if ((authorizations ?? []).filter((a) => a.patient_id === p.id).length === 0) faltan.push("Prácticas autorizadas");
      if ((careTeam ?? []).filter((t) => t.patient_id === p.id).length === 0) faltan.push("Equipo asistencial");
      if (p.estado === "admitido_pendiente_llegada" && !p.llegada_confirmada_at) faltan.push("Llegada al domicilio");
      return { p, faltan };
    })
    .filter((x) => x.faltan.length > 0)
    .sort((a, b) => (a.p.fecha_ingreso ?? "").localeCompare(b.p.fecha_ingreso ?? ""));

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
                <a href={`#paciente-${p.id}`} className="shrink-0 rounded-lg bg-slate-900 text-white text-xs font-medium px-3 py-1.5 hover:bg-slate-800 transition-colors">
                  {canAdmit ? "Completar" : "Ver"}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {canAdmit && <AdmissionWizard obrasSociales={(obrasSociales ?? []).map((o) => ({ id: o.id, nombre: o.nombre }))} defaultOpen={nuevo === "1"} />}

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
        {(patients ?? []).length === 0 && (
          <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-8 text-center text-sm text-slate-500">
            Todavía no hay pacientes cargados. {canAdmit ? "Tocá «+ Nuevo paciente» para dar de alta el primero." : ""}
          </div>
        )}
        {(patients ?? []).map((p, i) => {
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
                    <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <IconMapPin className="w-3 h-3" /> {p.domicilio} · {obraSocial ?? "sin obra social"}
                      {p.dni && <span className="text-slate-400">· DNI {p.dni}</span>}
                    </div>
                    {p.diagnostico_principal && <div className="text-xs text-slate-400 mt-0.5">Dx: {p.diagnostico_principal}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${ESTADO_STYLES[p.estado]}`}>{ESTADO_LABELS[p.estado]}</span>
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
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${SEMAFORO_STYLES[a.estado_semaforo ?? "vigente"]}`}>
                      {SEMAFORO_LABELS[a.estado_semaforo ?? "vigente"]}
                    </span>
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
                  <IconClock className="w-3 h-3" /> Egreso: {MOTIVO_LABELS[p.motivo_egreso]} el {p.fecha_egreso}
                </div>
              )}

              {p.estado !== "dado_de_baja" && p.egreso_informado_at && (
                <div className="text-xs text-amber-600 bg-amber-50 rounded-lg px-2.5 py-1.5 mt-3 flex items-center gap-1.5">
                  <IconAlert className="w-3.5 h-3.5" /> Egreso informado
                  {p.motivo_egreso ? "" : ` (${MOTIVO_LABELS[p.egreso_motivo_informado ?? ""] ?? p.egreso_motivo_informado})`}
                  {" "}por {(p.profiles as unknown as { full_name: string } | null)?.full_name ?? "—"} — pendiente de que Administración confirme la baja definitiva.
                </div>
              )}

              {p.estado === "activo" && !p.egreso_informado_at && canReportEgreso && (canArrival || misPacientesIds.has(p.id)) && (
                <form action={reportarEgresoAction} className="flex flex-wrap gap-2 mt-3">
                  <input type="hidden" name="patient_id" value={p.id} />
                  <select name="motivo" required className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs">
                    <option value="">Informar egreso — motivo...</option>
                    <option value="alta">Alta médica</option>
                    <option value="fallecimiento">Fallecimiento</option>
                    <option value="fin_internacion">Fin de internación</option>
                  </select>
                  <button className="rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs font-medium px-3 py-1.5 hover:bg-red-100 transition-colors">
                    Informar egreso
                  </button>
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
                      <button className="rounded-lg bg-slate-900 text-white text-xs font-medium px-3 py-1.5 hover:bg-slate-800 transition-colors">Autorizar</button>
                    </form>

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
