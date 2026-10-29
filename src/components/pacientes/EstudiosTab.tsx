import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/auth";
import { fechaCorta } from "@/lib/paciente";
import StatusBadge from "@/components/StatusBadge";
import ConfirmButton from "@/components/ConfirmButton";
import { AgregarEstudioForm, SolicitarEstudioForm } from "@/components/pacientes/EstudiosForms";
import { eliminarEstudioAction, actualizarEstudioFacturacionAction, gestionarSolicitudEstudioAction } from "@/app/(dashboard)/paciente/[id]/estudios-actions";

const card = "bg-white border border-slate-200 rounded-2xl p-5";
const btnGhost = "rounded-lg border border-slate-300 text-slate-700 text-xs font-medium px-3 py-1.5 hover:bg-slate-50";

/**
 * Pestaña «Estudios» de la ficha (Vanina, 26/10): estudios complementarios (laboratorio, radiografías, biopsias…) con
 * su archivo, si se facturan a la obra social y si ya están autorizados; y los pedidos de estudios del médico.
 */
export default async function EstudiosTab({ patientId, role, userId }: { patientId: string; role: AppRole; userId: string }) {
  const supabase = await createClient();
  const esAdmin = role === "administracion";
  const [{ data: estudios }, { data: pedidos }, { data: yo }, { data: equipo }] = await Promise.all([
    supabase.from("patient_studies").select("id, descripcion, fecha_estudio, se_factura, autorizado, archivo, nombre_original, created_at").eq("patient_id", patientId).order("created_at", { ascending: false }),
    supabase.from("study_requests").select("id, detalle, estado, created_at, profiles:solicitado_por(full_name)").eq("patient_id", patientId).order("created_at", { ascending: false }),
    supabase.from("profiles").select("especialidad").eq("id", userId).maybeSingle(),
    role === "profesional_asistencial" ? supabase.from("patient_care_team").select("id").eq("patient_id", patientId).eq("profesional_id", userId).limit(1) : Promise.resolve({ data: [] as { id: string }[] }),
  ]);
  const archivos = (estudios ?? []).map((e) => e.archivo).filter((a): a is string => !!a);
  const { data: firmadas } = archivos.length > 0 ? await supabase.storage.from("estudios").createSignedUrls(archivos, 3600) : { data: [] as { path: string | null; signedUrl: string }[] };
  const urlPorRuta = new Map((firmadas ?? []).map((f) => [f.path, f.signedUrl]));
  const puedeSolicitar = role === "profesional_asistencial" && yo?.especialidad === "medicina" && (equipo ?? []).length > 0;
  const pendientes = (pedidos ?? []).filter((p) => p.estado === "pendiente");

  return (
    <div className="space-y-6">
      <section className={card}>
        <h2 className="text-sm font-semibold text-slate-900 mb-1">Estudios complementarios ({(estudios ?? []).length})</h2>
        <p className="text-xs text-slate-500 mb-3">Resultados de laboratorio, radiografías, biopsias y otros estudios del paciente.</p>
        {(estudios ?? []).length === 0 ? <p className="text-sm text-slate-500">Todavía no hay estudios cargados.</p> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {(estudios ?? []).map((e) => (
              <li key={e.id} className="py-3 flex items-start justify-between gap-3 flex-wrap">
                <div className="space-y-1 min-w-0">
                  <div className="font-medium text-slate-900">{e.descripcion}</div>
                  <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                    <span>{e.fecha_estudio ? `Estudio del ${fechaCorta(e.fecha_estudio)}` : `Cargado el ${fechaCorta(e.created_at)}`}</span>
                    {e.se_factura ? <StatusBadge tone={e.autorizado ? "verde" : "amarillo"} label={e.autorizado ? "Se factura · autorizado" : "Se factura · pendiente de autorización"} /> : <StatusBadge tone="gris" label="No se factura a la obra social" />}
                    {e.archivo && urlPorRuta.get(e.archivo) && (
                      <a href={urlPorRuta.get(e.archivo) ?? undefined} target="_blank" rel="noreferrer" className="font-medium text-[var(--brand-teal)] underline underline-offset-2">Ver archivo{e.nombre_original ? ` (${e.nombre_original})` : ""}</a>
                    )}
                  </div>
                </div>
                {esAdmin && (
                  <div className="flex items-center gap-2">
                    {e.se_factura && (
                      <form action={actualizarEstudioFacturacionAction}>
                        <input type="hidden" name="id" value={e.id} />
                        <input type="hidden" name="patient_id" value={patientId} />
                        <input type="hidden" name="autorizado" value={e.autorizado ? "no" : "si"} />
                        <button className={btnGhost}>{e.autorizado ? "Marcar pendiente" : "Marcar autorizado"}</button>
                      </form>
                    )}
                    <form action={eliminarEstudioAction}>
                      <input type="hidden" name="id" value={e.id} />
                      <ConfirmButton className={btnGhost}>Quitar</ConfirmButton>
                    </form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {esAdmin && (
        <section className={card}>
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Agregar un estudio</h2>
          <AgregarEstudioForm patientId={patientId} solicitudes={pendientes.map((p) => ({ id: p.id, detalle: p.detalle }))} />
        </section>
      )}

      <section className={card}>
        <h2 className="text-sm font-semibold text-slate-900 mb-1">Estudios solicitados por el médico ({(pedidos ?? []).length})</h2>
        {(pedidos ?? []).length === 0 ? <p className="text-sm text-slate-500">No hay pedidos.</p> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {(pedidos ?? []).map((p) => (
              <li key={p.id} className="py-3 flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-slate-900">{p.detalle}</div>
                  <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                    <span>{p.profiles?.full_name ?? "Médico"} · {fechaCorta(p.created_at)}</span>
                    <StatusBadge tone={p.estado === "pendiente" ? "amarillo" : p.estado === "gestionado" ? "verde" : "gris"} label={p.estado === "pendiente" ? "Pendiente" : p.estado === "gestionado" ? "Gestionado" : "Cancelado"} />
                  </div>
                </div>
                {esAdmin && p.estado === "pendiente" && (
                  <div className="flex items-center gap-2">
                    <form action={gestionarSolicitudEstudioAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="patient_id" value={patientId} />
                      <input type="hidden" name="estado" value="gestionado" />
                      <button className={btnGhost}>Marcar gestionado</button>
                    </form>
                    <form action={gestionarSolicitudEstudioAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="patient_id" value={patientId} />
                      <input type="hidden" name="estado" value="cancelado" />
                      <button className={btnGhost}>Cancelar</button>
                    </form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {puedeSolicitar && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-semibold text-slate-700 mb-2">Solicitar un estudio</h3>
            <SolicitarEstudioForm patientId={patientId} />
          </div>
        )}
      </section>
    </div>
  );
}
