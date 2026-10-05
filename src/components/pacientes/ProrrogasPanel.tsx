import StatusBadge from "@/components/StatusBadge";
import { SPECIALTY_LABELS } from "@/lib/roles";
import { pedirProrrogaAction, responderProrrogaAction } from "@/app/(dashboard)/internacion/actions";
import { diasRestantes, semaforoPorDias } from "@/lib/semaforo";
import { fechaCorta } from "@/lib/paciente";
import { hoyAR } from "@/lib/plan";

type Autorizacion = { id: number | null; practica: string | null; especialidad: string | null; periodo_hasta: string | null };
type Prorroga = { id: string; authorization_id: number; pedida_at: string; respondida_at: string | null; estado: string; nueva_fecha_hasta: string | null; fecha_hasta_anterior: string | null; nota: string | null };

const ESTADO_TONE = { pendiente: "amarillo", aprobada: "verde", rechazada: "rojo" } as const;
const ESTADO_LABEL = { pendiente: "Esperando respuesta", aprobada: "Aprobada", rechazada: "Rechazada" } as const;
const inputCls = "rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs";

/**
 * Prórrogas de autorizaciones de práctica (DF-C3 §9): cuándo se pidió, cuándo contestó la obra social y la nueva fecha.
 * Solo Administración registra; el resto la ve en el historial. Va dentro de «Gestionar» en la tarjeta del paciente.
 */
export default function ProrrogasPanel({ patientId, autorizaciones, prorrogas, puedeGestionar }: { patientId: string; autorizaciones: Autorizacion[]; prorrogas: Prorroga[]; puedeGestionar: boolean }) {
  const hoy = hoyAR();
  const lista = autorizaciones.filter((a) => a.id !== null);
  if (lista.length === 0) return <p className="text-xs text-slate-400">No hay autorizaciones para prorrogar: cargá una práctica autorizada primero.</p>;
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold text-slate-700">Prórrogas de autorizaciones</h4>
      <ul className="space-y-3">
        {lista.map((a) => {
          const hist = prorrogas.filter((x) => x.authorization_id === a.id).sort((x, y) => y.pedida_at.localeCompare(x.pedida_at));
          const pendiente = hist.find((x) => x.estado === "pendiente");
          const s = a.periodo_hasta ? semaforoPorDias(diasRestantes(a.periodo_hasta, hoy)) : null;
          return (
            <li key={a.id} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap text-xs text-slate-700">
                {s && <StatusBadge tone={s.tone} label={s.label} />}
                <span className="font-medium">{a.practica}</span>
                <span className="text-slate-400">({SPECIALTY_LABELS[a.especialidad ?? ""] ?? a.especialidad}) · vence el {fechaCorta(a.periodo_hasta)}</span>
              </div>
              {hist.length > 0 && (
                <ul className="text-xs text-slate-600 space-y-1">
                  {hist.map((x) => (
                    <li key={x.id} className="flex items-center gap-2 flex-wrap">
                      <StatusBadge tone={ESTADO_TONE[x.estado as keyof typeof ESTADO_TONE] ?? "gris"} label={ESTADO_LABEL[x.estado as keyof typeof ESTADO_LABEL] ?? x.estado} />
                      Pedida el {fechaCorta(x.pedida_at)}
                      {x.respondida_at && ` · respondida el ${fechaCorta(x.respondida_at)}`}
                      {x.estado === "aprobada" && x.nueva_fecha_hasta && ` · ahora vence el ${fechaCorta(x.nueva_fecha_hasta)}`}
                      {x.nota && <span className="text-slate-400">· {x.nota}</span>}
                    </li>
                  ))}
                </ul>
              )}
              {puedeGestionar && pendiente && (
                <form action={responderProrrogaAction} className="flex flex-wrap items-end gap-2 bg-amber-50 rounded-lg p-2">
                  <input type="hidden" name="id" value={pendiente.id} />
                  <input type="hidden" name="patient_id" value={patientId} />
                  <label className="text-[11px] text-slate-600">Respuesta de la obra social
                    <select name="resultado" required defaultValue="" className={`${inputCls} block mt-0.5`}>
                      <option value="" disabled>Elegí…</option>
                      <option value="aprobada">Aprobó la prórroga</option>
                      <option value="rechazada">La rechazó</option>
                    </select>
                  </label>
                  <label className="text-[11px] text-slate-600">Nueva fecha de vencimiento
                    <input name="nueva_fecha_hasta" type="date" min={a.periodo_hasta ?? undefined} className={`${inputCls} block mt-0.5`} />
                  </label>
                  <label className="text-[11px] text-slate-600">Fecha de la respuesta
                    <input name="respondida_at" type="date" defaultValue={hoy} max={hoy} className={`${inputCls} block mt-0.5`} />
                  </label>
                  <label className="text-[11px] text-slate-600 flex-1 min-w-[140px]">Nota (opcional)
                    <input name="nota" className={`${inputCls} block mt-0.5 w-full`} />
                  </label>
                  <button className="rounded-lg bg-slate-900 text-white text-xs font-medium px-3 py-2 hover:bg-slate-800">Guardar respuesta</button>
                  <p className="basis-full text-[11px] text-slate-500">Si la aprobó, la nueva fecha es obligatoria y la autorización pasa a vencer ese día.</p>
                </form>
              )}
              {puedeGestionar && !pendiente && (
                <form action={pedirProrrogaAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="authorization_id" value={a.id as number} />
                  <input type="hidden" name="patient_id" value={patientId} />
                  <label className="text-[11px] text-slate-600">Fecha en que se pidió
                    <input name="pedida_at" type="date" defaultValue={hoy} max={hoy} required className={`${inputCls} block mt-0.5`} />
                  </label>
                  <label className="text-[11px] text-slate-600 flex-1 min-w-[140px]">Nota (opcional)
                    <input name="nota" placeholder="Ej. pedido por mail a la obra social" className={`${inputCls} block mt-0.5 w-full`} />
                  </label>
                  <button className="rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-medium px-3 py-2 hover:bg-slate-50">Registrar pedido de prórroga</button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
