import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { createBillingPeriodAction, advanceBillingPeriodAction, addBillingDebitAction, updateDebitStatusAction } from "./actions";
import PageHeader from "@/components/PageHeader";
import ActionDisclosure from "@/components/ActionDisclosure";
import { IconCash, IconAlert } from "@/components/icons";
import { SEMANTIC_TONE_BADGE_STYLES, SemanticTone } from "@/lib/semantic-status";

// Semáforo de cierre mensual (DF-C4 §9) — "abierto" y "facturado" son etapas de flujo,
// no estados de alerta, así que mantienen su propio color de workflow; "en_revision" y
// "cerrado" sí son semánticos (amarillo = requiere atención, verde = al día) y usan la
// paleta única de DF-C1 §10, igual que el resto de los semáforos de la plataforma.
const ESTADO_LABELS: Record<string, string> = { abierto: "Abierto", en_revision: "En revisión", cerrado: "Cerrado", facturado: "Facturado" };
const ESTADO_STYLES: Record<string, string> = {
  abierto: "bg-blue-100 text-blue-700",
  en_revision: SEMANTIC_TONE_BADGE_STYLES.amarillo,
  cerrado: SEMANTIC_TONE_BADGE_STYLES.verde,
  facturado: "bg-slate-800 text-white",
};
const NEXT_ESTADO: Record<string, string> = { abierto: "en_revision", en_revision: "cerrado", cerrado: "facturado" };
const NEXT_LABEL: Record<string, string> = { abierto: "Pasar a revisión", en_revision: "Cerrar período", cerrado: "Marcar facturado" };

const DEBIT_LABELS: Record<string, string> = { pendiente: "Pendiente", en_gestion: "En gestión", resuelto: "Resuelto", perdido: "Perdido" };
// Color semántico único (DF-C1 §10): mismo Verde/Amarillo/Rojo/Gris que el resto de los
// semáforos (DF-C3 §10, DF-C5 §3) — rojo = pendiente de gestionar, amarillo = en curso,
// verde = resuelto, gris = perdido (no aplica más acción).
const DEBIT_TONE: Record<string, SemanticTone> = {
  pendiente: "rojo",
  en_gestion: "amarillo",
  resuelto: "verde",
  perdido: "gris",
};
const DEBIT_STYLES: Record<string, string> = Object.fromEntries(
  Object.entries(DEBIT_TONE).map(([k, tone]) => [k, SEMANTIC_TONE_BADGE_STYLES[tone]])
);

function formatARS(value: number | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

export default async function FacturacionPage() {
  const { profile } = await requireProfile();
  // TODO(DF-C1 §4.3): ver la misma nota en facturacion/actions.ts — pendiente
  // de confirmar con Vanina si Facturación es un rol de sistema propio.
  const canManage = profile.role === "administracion";
  const supabase = await createClient();

  const [{ data: periods }, { data: debits }, { data: obrasSociales }, { data: patients }] = await Promise.all([
    supabase.from("billing_periods").select("id, obra_social_id, periodo, estado, total_facturado, fecha_cierre, obras_sociales(nombre)").order("periodo", { ascending: false }),
    supabase.from("billing_debits").select("id, billing_period_id, patient_id, motivo, monto, estado, patients(nombre_completo)").order("created_at", { ascending: false }),
    supabase.from("obras_sociales").select("id, nombre").eq("activa", true).order("nombre"),
    supabase.from("patients").select("id, nombre_completo").order("nombre_completo"),
  ]);

  const abiertos = (periods ?? []).filter((p) => p.estado !== "facturado");
  const pendingDebits = (debits ?? []).filter((d) => d.estado === "pendiente" || d.estado === "en_gestion");

  return (
    <div className="space-y-8">
      <PageHeader
        icon={<IconCash className="w-5 h-5" />}
        title="Facturación inteligente a obras sociales"
        section="DF-C4"
        purpose="Acá abrís el mes de cada obra social, cargás un débito cuando te rechazan algo, y vas avanzando el período (en revisión → cerrado → facturado) hasta cerrarlo. Administración es quien factura — DF-C4 §2 corrige a DF-C1, que hablaba de un rol 'Facturación' aparte."
        description="Semáforo de cierre mensual por obra social y gestión de débitos."
      />

      {pendingDebits.length > 0 && (
        <section className="bg-red-50 border border-red-200 rounded-2xl p-5 animate-fade-slide-up">
          <div className="flex items-center gap-2 mb-3">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-100 text-red-600">
              <IconAlert className="w-4 h-4" />
            </span>
            <h2 className="text-sm font-medium text-red-800">Débitos pendientes de gestión — DF-C4 §6</h2>
          </div>
          <div className="text-sm text-red-700">
            {pendingDebits.length} débito(s) por un total de {formatARS(pendingDebits.reduce((acc, d) => acc + d.monto, 0))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        {(periods ?? []).map((p, i) => {
          const periodDebits = (debits ?? []).filter((d) => d.billing_period_id === p.id);
          const next = NEXT_ESTADO[p.estado];
          return (
            <div key={p.id} className={`bg-white rounded-2xl border border-slate-200 p-5 card-hover animate-fade-slide-up stagger-${Math.min(i + 1, 8)}`}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="font-medium text-slate-900">{(p.obras_sociales as unknown as { nombre: string } | null)?.nombre}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Período {new Date(p.periodo).toLocaleDateString("es-AR", { month: "long", year: "numeric" })}
                    {p.fecha_cierre && <> · cerrado el {new Date(p.fecha_cierre).toLocaleDateString("es-AR")}</>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <span className="text-sm font-semibold text-slate-900 tabular-nums">{formatARS(p.total_facturado)}</span>
                  <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${ESTADO_STYLES[p.estado]}`}>{ESTADO_LABELS[p.estado]}</span>
                  {next && canManage && (
                    <form action={advanceBillingPeriodAction}>
                      <input type="hidden" name="billing_period_id" value={p.id} />
                      <input type="hidden" name="nuevo_estado" value={next} />
                      <button className="rounded-full bg-slate-900 text-white text-xs font-medium px-3 py-1 hover:bg-slate-800 transition-colors">{NEXT_LABEL[p.estado]}</button>
                    </form>
                  )}
                </div>
              </div>

              {periodDebits.length > 0 && (
                <ul className="text-sm text-slate-600 mt-3 space-y-1.5">
                  {periodDebits.map((d) => (
                    <li key={d.id} className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${DEBIT_STYLES[d.estado]}`}>{DEBIT_LABELS[d.estado]}</span>
                      {d.motivo} · {formatARS(d.monto)}
                      {d.patients && <span className="text-xs text-slate-400">({(d.patients as unknown as { nombre_completo: string }).nombre_completo})</span>}
                      {canManage && (d.estado === "pendiente" || d.estado === "en_gestion") && (
                        <form action={updateDebitStatusAction} className="inline-flex gap-1">
                          <input type="hidden" name="debit_id" value={d.id} />
                          <input type="hidden" name="estado" value={d.estado === "pendiente" ? "en_gestion" : "resuelto"} />
                          <button className="text-xs text-slate-500 underline hover:text-slate-800">
                            {d.estado === "pendiente" ? "Poner en gestión" : "Marcar resuelto"}
                          </button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {canManage && (
                <ActionDisclosure label="Cargar débito" tone="subtle">
                  <form action={addBillingDebitAction} className="flex flex-wrap gap-2">
                    <input type="hidden" name="billing_period_id" value={p.id} />
                    <select name="patient_id" className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs">
                      <option value="">Paciente (opcional)...</option>
                      {(patients ?? []).map((pt) => (
                        <option key={pt.id} value={pt.id}>{pt.nombre_completo}</option>
                      ))}
                    </select>
                    <input name="motivo" placeholder="Motivo del débito" required className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs flex-1 min-w-[160px]" />
                    <input name="monto" type="number" step="0.01" placeholder="Monto" required className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs w-28" />
                    <button className="rounded-lg bg-slate-900 text-white text-xs font-medium px-3 py-1.5 hover:bg-slate-800 transition-colors">Cargar</button>
                  </form>
                </ActionDisclosure>
              )}
            </div>
          );
        })}
        {abiertos.length === 0 && (periods ?? []).length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-sm animate-fade-slide-up">
            No hay períodos de facturación cargados todavía.
          </div>
        )}
      </section>

      {canManage && (
        <section className="bg-white rounded-2xl border border-slate-200 p-5 animate-fade-slide-up card-hover">
          <h2 className="text-sm font-medium text-slate-900 mb-4 flex items-center gap-2">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-500">+</span>
            Abrir período de facturación
          </h2>
          <form action={createBillingPeriodAction} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <select name="obra_social_id" required className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm sm:col-span-2">
              <option value="">Obra social...</option>
              {(obrasSociales ?? []).map((os) => (
                <option key={os.id} value={os.id}>{os.nombre}</option>
              ))}
            </select>
            <input name="periodo" type="month" required defaultValue={new Date().toISOString().slice(0, 7)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
            <input name="total_facturado" type="number" step="0.01" placeholder="Total estimado (opcional)" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
            <button className="rounded-xl bg-slate-900 text-white text-sm font-medium px-4 py-2.5 hover:bg-slate-800 transition-colors sm:col-span-4">
              Abrir período
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
