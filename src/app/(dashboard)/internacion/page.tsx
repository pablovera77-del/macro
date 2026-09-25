import { createClient } from "@/lib/supabase/server";
import { requireProfile, SPECIALTY_LABELS } from "@/lib/auth";
import {
  createAdmissionAction,
  confirmArrivalAction,
  informEgresoAction,
  addTreatmentAuthorizationAction,
  assignCareTeamAction,
} from "./actions";
import PageHeader from "@/components/PageHeader";
import { IconClipboard, IconUser, IconMapPin, IconAlert, IconCheck, IconClock } from "@/components/icons";

const ESTADO_LABELS: Record<string, string> = {
  admitido_pendiente_llegada: "Admitido, pendiente de llegada",
  activo: "Activo",
  dado_de_baja: "Dado de baja",
};
const ESTADO_STYLES: Record<string, string> = {
  admitido_pendiente_llegada: "bg-amber-100 text-amber-700",
  activo: "bg-emerald-100 text-emerald-700",
  dado_de_baja: "bg-slate-200 text-slate-600",
};
const MOTIVO_LABELS: Record<string, string> = {
  alta: "Alta médica",
  fallecimiento: "Fallecimiento",
  fin_internacion: "Fin de internación",
};
const SEMAFORO_STYLES: Record<string, string> = {
  vigente: "bg-emerald-100 text-emerald-700",
  por_vencer: "bg-amber-100 text-amber-700",
  vencida: "bg-red-100 text-red-700",
};
const SEMAFORO_LABELS: Record<string, string> = {
  vigente: "Vigente",
  por_vencer: "Por vencer",
  vencida: "Vencida",
};

export default async function InternacionPage() {
  const { profile } = await requireProfile();
  const supabase = await createClient();

  const canManage = profile.role === "coordinador_internacion" || profile.role === "medico_coordinador";

  const [
    { data: patients },
    { data: obrasSociales },
    { data: authorizations },
    { data: careTeam },
    { data: profesionales },
    { data: orderNews },
  ] = await Promise.all([
    supabase
      .from("patients")
      .select(
        "id, nombre_completo, dni, domicilio, obra_social, estado, fecha_ingreso, fecha_egreso, motivo_egreso, diagnostico_principal, llegada_confirmada_at, obras_sociales(nombre)"
      )
      .order("fecha_ingreso", { ascending: false }),
    supabase.from("obras_sociales").select("id, nombre").eq("activa", true).order("nombre"),
    supabase.from("v_treatment_authorization_status").select("*").order("periodo_hasta"),
    supabase.from("patient_care_team").select("id, patient_id, especialidad, profiles(full_name)"),
    supabase.from("profiles").select("id, full_name, role").in("role", ["profesional_asistencial", "medico_coordinador"]).eq("active", true),
    canManage
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
  ]);

  const vencenPronto = (authorizations ?? []).filter((a) => a.estado_semaforo !== "vigente");
  // Notificación de vuelta al coordinador (autorizado / no autorizado) tras la
  // validación manual de Administración — DF-C5 §4, comentario cliente 25/09.
  const misNovedades = (orderNews ?? []).filter((o) => {
    const patient = o.patients as unknown as { coordinador_id: string | null } | null;
    return profile.role === "medico_coordinador" || patient?.coordinador_id === profile.id;
  });

  return (
    <div className="space-y-8">
      <PageHeader
        icon={<IconClipboard className="w-5 h-5" />}
        title="Pacientes e internaciones"
        section="DF-C3"
        description="Legajo completo, admisión, confirmación de llegada y egreso. Contrasta con informe-tecnico §4 (el sistema viejo solo tenía nombre/domicilio/obra social en texto libre)."
      />

      {canManage && misNovedades.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-2xl p-5 animate-fade-slide-up card-hover">
          <div className="flex items-center gap-2 mb-3">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-500">
              <IconCheck className="w-4 h-4" />
            </span>
            <h2 className="text-sm font-medium text-slate-900">Novedades de pedidos — validación de Administración (DF-C5 §4)</h2>
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
            <h2 className="text-sm font-medium text-amber-800">Semáforo de vencimientos de autorizaciones — DF-C3 §7 / DF-C4 §3</h2>
          </div>
          <ul className="text-sm text-amber-800 space-y-1.5">
            {vencenPronto.map((a) => {
              const patient = (patients ?? []).find((p) => p.id === a.patient_id);
              return (
                <li key={a.id} className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${SEMAFORO_STYLES[a.estado_semaforo ?? "vigente"]}`}>
                    {SEMAFORO_LABELS[a.estado_semaforo ?? "vigente"]}
                  </span>
                  {patient?.nombre_completo ?? "—"} · {a.practica} ({SPECIALTY_LABELS[a.especialidad ?? ""] ?? a.especialidad}) · vence {a.periodo_hasta}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        {(patients ?? []).map((p, i) => {
          const auths = (authorizations ?? []).filter((a) => a.patient_id === p.id);
          const team = (careTeam ?? []).filter((t) => t.patient_id === p.id);
          const initials = p.nombre_completo.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase()).join("");
          const obraSocial = (p.obras_sociales as unknown as { nombre: string } | null)?.nombre ?? p.obra_social;

          return (
            <div key={p.id} className={`bg-white rounded-2xl border border-slate-200 p-5 card-hover animate-fade-slide-up stagger-${Math.min(i + 1, 8)}`}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-900 text-white text-xs font-semibold shrink-0">
                    {initials || <IconUser className="w-4 h-4" />}
                  </span>
                  <div>
                    <div className="font-medium text-slate-900">{p.nombre_completo}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <IconMapPin className="w-3 h-3" /> {p.domicilio} · {obraSocial ?? "sin obra social"}
                      {p.dni && <span className="text-slate-400">· DNI {p.dni}</span>}
                    </div>
                    {p.diagnostico_principal && <div className="text-xs text-slate-400 mt-0.5">Dx: {p.diagnostico_principal}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${ESTADO_STYLES[p.estado]}`}>{ESTADO_LABELS[p.estado]}</span>
                  {p.estado === "admitido_pendiente_llegada" && !p.llegada_confirmada_at && canManage && (
                    <form action={confirmArrivalAction}>
                      <input type="hidden" name="patient_id" value={p.id} />
                      <button className="inline-flex items-center gap-1 rounded-full bg-emerald-600 text-white text-xs font-medium px-3 py-1 hover:bg-emerald-700 transition-colors">
                        <IconCheck className="w-3 h-3" /> Confirmar llegada
                      </button>
                    </form>
                  )}
                </div>
              </div>

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

              {p.estado === "dado_de_baja" && p.motivo_egreso && (
                <div className="text-xs text-slate-500 mt-3 flex items-center gap-1">
                  <IconClock className="w-3 h-3" /> Egreso: {MOTIVO_LABELS[p.motivo_egreso]} el {p.fecha_egreso}
                </div>
              )}

              {canManage && p.estado !== "dado_de_baja" && (
                <details className="mt-3">
                  <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-800">+ Gestionar</summary>
                  <div className="mt-2 space-y-3">
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

                    <form action={informEgresoAction} className="flex flex-wrap gap-2">
                      <input type="hidden" name="patient_id" value={p.id} />
                      <select name="motivo" required className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs">
                        <option value="">Motivo de egreso...</option>
                        <option value="alta">Alta médica</option>
                        <option value="fallecimiento">Fallecimiento</option>
                        <option value="fin_internacion">Fin de internación</option>
                      </select>
                      <button className="rounded-lg bg-red-600 text-white text-xs font-medium px-3 py-1.5 hover:bg-red-700 transition-colors">Informar egreso</button>
                    </form>
                  </div>
                </details>
              )}
            </div>
          );
        })}
      </section>

      {canManage && (
        <section className="bg-white rounded-2xl border border-slate-200 p-5 animate-fade-slide-up card-hover">
          <h2 className="text-sm font-medium text-slate-900 mb-4 flex items-center gap-2">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-500">+</span>
            Nueva admisión — legajo completo
          </h2>
          <form action={createAdmissionAction} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input name="nombre_completo" placeholder="Nombre completo" required className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm sm:col-span-2" />
            <input name="dni" placeholder="DNI" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
            <input name="fecha_nacimiento" type="date" placeholder="Fecha de nacimiento" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
            <input name="domicilio" placeholder="Domicilio" required className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm sm:col-span-2" />
            <input name="telefono_contacto" placeholder="Teléfono de contacto" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
            <input name="fecha_ingreso" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
            <input name="contacto_familiar_nombre" placeholder="Contacto familiar — nombre" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm sm:col-span-2" />
            <input name="contacto_familiar_telefono" placeholder="Contacto familiar — teléfono" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm sm:col-span-2" />
            <select name="obra_social_id" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
              <option value="">Obra social...</option>
              {(obrasSociales ?? []).map((os) => (
                <option key={os.id} value={os.id}>{os.nombre}</option>
              ))}
            </select>
            <input name="numero_afiliado" placeholder="N° de afiliado" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
            <input name="medico_derivante" placeholder="Médico derivante" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
            <input name="diagnostico_principal" placeholder="Diagnóstico principal" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm sm:col-span-4" />
            <button className="rounded-xl bg-slate-900 text-white text-sm font-medium px-4 py-2.5 hover:bg-slate-800 transition-colors sm:col-span-4">
              Admitir paciente
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
