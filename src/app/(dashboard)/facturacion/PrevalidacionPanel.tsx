import ActionDisclosure from "@/components/ActionDisclosure";
import StatusBadge from "@/components/StatusBadge";
import ConfirmButton from "@/components/ConfirmButton";
import { SPECIALTY_LABELS } from "@/lib/roles";
import type { SemanticTone } from "@/lib/semantic-status";
import { describirDias, fechaCorta } from "@/lib/facturacion";
import type { Database } from "@/types/database";
import { excludePatientFromPeriodAction, includePatientInPeriodAction } from "./actions";

// Pre-validación del cierre mensual (C4 §4): para cada paciente del período controla las
// evoluciones contra lo autorizado, los días de más tras un egreso, los días no autorizados,
// la firma y la conformidad, las visitas sin evolución y los insumos entregados.

type Fila = Database["public"]["Views"]["v_prevalidacion_facturacion"]["Row"];
type Control = Database["public"]["Views"]["v_prevalidacion_controles"]["Row"];
type Insumo = Database["public"]["Views"]["v_prevalidacion_insumos"]["Row"];

function etiquetaFila(v: Fila): { tone: SemanticTone; label: string } {
  if (v.estado_control === "rojo") {
    if ((v.evoluciones_post_egreso ?? 0) > 0) return { tone: "rojo", label: "Días de más" };
    if ((v.evoluciones_dia_no_autorizado ?? 0) > 0) return { tone: "rojo", label: "Día no autorizado" };
    if ((v.evoluciones_exceso ?? 0) > 0) return { tone: "rojo", label: "Evoluciones de más" };
    return { tone: "rojo", label: "Faltan evoluciones" };
  }
  if (v.estado_control === "amarillo") return { tone: "amarillo", label: "Mes en curso" };
  if (v.motivo_faltante === "aun_no_llego") return { tone: "gris", label: "Aún no llegó" };
  return { tone: "verde", label: "Al día" };
}

/** Frases en castellano que explican por qué una fila está como está. */
function avisosDeFila(v: Fila): { tone: SemanticTone; texto: string }[] {
  const out: { tone: SemanticTone; texto: string }[] = [];
  const n = (x: number | null) => x ?? 0;
  if (n(v.evoluciones_post_egreso) > 0) {
    out.push({
      tone: "rojo",
      texto: `${v.evoluciones_post_egreso} evolución(es) cargada(s) después del egreso (${fechaCorta(v.dia_corte)}): no se pueden facturar, sería facturar días de más.`,
    });
  }
  if (n(v.evoluciones_dia_no_autorizado) > 0) {
    out.push({
      tone: "rojo",
      texto: `${v.evoluciones_dia_no_autorizado} evolución(es) en días que no están autorizados (la autorización es ${describirDias(v.dias_semana)}).`,
    });
  }
  if (n(v.evoluciones_exceso) > 0) {
    out.push({ tone: "rojo", texto: `${v.evoluciones_exceso} evolución(es) de más respecto de las ${v.cantidad_autorizada} autorizadas.` });
  }
  if (v.motivo_faltante === "aun_no_llego") {
    out.push({ tone: "gris", texto: "Todavía no llegó al domicilio: este mes no se espera ninguna evolución." });
  } else {
    if (n(v.dias_aun_no_llego) > 0) {
      out.push({ tone: "gris", texto: `Los primeros ${v.dias_aun_no_llego} día(s) del período todavía no había llegado al domicilio: no se cuentan.` });
    }
    if (v.motivo_faltante === "sin_evolucion" && n(v.dias_sin_evolucion_inicio) > 0) {
      out.push({
        tone: v.estado_control === "rojo" ? "rojo" : "amarillo",
        texto: `Ya estaba en el domicilio y los primeros ${v.dias_sin_evolucion_inicio} día(s) no tienen evolución.`,
      });
    }
  }
  return out;
}

const TEXTO_TONE: Record<SemanticTone, string> = {
  verde: "text-emerald-700",
  amarillo: "text-amber-700",
  rojo: "text-red-700",
  gris: "text-slate-500",
};

const INSUMO_BADGE: Record<string, { tone: SemanticTone; label: string }> = {
  ok: { tone: "verde", label: "Coincide" },
  excedido: { tone: "amarillo", label: "Entregó de más" },
  sin_autorizacion: { tone: "amarillo", label: "Sin autorización" },
  menor: { tone: "gris", label: "Entregó menos" },
};

function tonoPaciente(filas: Fila[]): SemanticTone {
  if (filas.some((f) => f.estado_control === "rojo")) return "rojo";
  if (filas.some((f) => f.estado_control === "amarillo")) return "amarillo";
  return "verde";
}
const LABEL_PACIENTE: Record<SemanticTone, string> = { rojo: "Hay que corregir", amarillo: "Mes en curso", verde: "Al día", gris: "—" };

export default function PrevalidacionPanel({
  periodId,
  filas,
  controles,
  insumos,
  excluidos,
  puedeEditar,
}: {
  periodId: string;
  filas: Fila[];
  controles: Control[];
  insumos: Insumo[];
  excluidos: Set<string>;
  /** Administración y período todavía no presentado. */
  puedeEditar: boolean;
}) {
  // Agrupar por paciente, rojos primero.
  const porPaciente = new Map<string, Fila[]>();
  filas.forEach((f) => {
    if (!f.patient_id) return;
    porPaciente.set(f.patient_id, [...(porPaciente.get(f.patient_id) ?? []), f]);
  });
  const orden: Record<SemanticTone, number> = { rojo: 0, amarillo: 1, verde: 2, gris: 3 };
  const pacientes = [...porPaciente.entries()]
    .map(([id, fs]) => ({ id, nombre: fs[0].nombre_completo ?? "Paciente", filas: fs, tone: tonoPaciente(fs) }))
    .sort((a, b) => orden[a.tone] - orden[b.tone] || a.nombre.localeCompare(b.nombre));
  const conProblema = pacientes.filter((p) => p.tone !== "verde");
  const alDia = pacientes.filter((p) => p.tone === "verde");

  const bloqueantes = pacientes.filter((p) => p.tone === "rojo" && !excluidos.has(p.id)).length;
  const sinFirma = controles.filter((c) => (c.sin_firma_profesional ?? 0) > 0 || (c.sin_conformidad_familiar ?? 0) > 0);
  const conVisitasSinEvolucion = controles.filter((c) => (c.visitas_sin_evolucion ?? 0) > 0);
  const insumosParaRevisar = insumos.filter((i) => i.estado_control !== "ok");
  const avisos = sinFirma.length + conVisitasSinEvolucion.length + insumosParaRevisar.filter((i) => i.estado_control !== "menor").length;

  if (pacientes.length === 0 && controles.length === 0 && insumos.length === 0) return null;

  const renderPaciente = (p: (typeof pacientes)[number]) => {
    const fuera = excluidos.has(p.id);
    return (
      <li key={p.id} className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-slate-900 text-sm">{p.nombre}</span>
          <StatusBadge tone={p.tone} label={LABEL_PACIENTE[p.tone]} />
          {fuera && <StatusBadge tone="gris" label="Fuera de este cierre" />}
        </div>
        <ul className="mt-2 space-y-2">
          {p.filas.map((v) => {
            const et = etiquetaFila(v);
            return (
              <li key={v.treatment_authorization_id} className="text-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge tone={et.tone} label={et.label} />
                  <span className="text-slate-700">
                    {v.practica} ({SPECIALTY_LABELS[v.especialidad ?? ""] ?? v.especialidad})
                  </span>
                  <span className="text-xs text-slate-400">
                    — {v.evoluciones_cargadas_ventana}/{v.evoluciones_esperadas_ajustadas} evoluciones este mes
                  </span>
                </div>
                {v.frecuencia_tipo && (
                  <div className="text-xs text-slate-400 mt-0.5">
                    Frecuencia {v.frecuencia_tipo === "diaria" ? "diaria" : "semanal"}: {describirDias(v.dias_semana)}
                    {(v.veces_por_dia ?? 1) > 1 ? `, ${v.veces_por_dia} veces por día` : ""}
                  </div>
                )}
                {avisosDeFila(v).map((a, i) => (
                  <div key={i} className={`text-xs mt-0.5 ${TEXTO_TONE[a.tone]}`}>{a.texto}</div>
                ))}
              </li>
            );
          })}
        </ul>
        {puedeEditar && p.tone === "rojo" && !fuera && (
          <form action={excludePatientFromPeriodAction} className="flex flex-wrap gap-2 mt-3 items-center">
            <input type="hidden" name="billing_period_id" value={periodId} />
            <input type="hidden" name="patient_id" value={p.id} />
            <input name="motivo" placeholder="Motivo (opcional)" className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs flex-1 min-w-[160px]" />
            <ConfirmButton
              className="rounded-lg bg-white text-slate-700 border border-slate-300 text-xs font-medium px-3 py-1.5 hover:bg-slate-50 transition-colors"
              confirmLabel="¿Dejarlo fuera? Tocá de nuevo"
            >
              Dejar fuera de este cierre
            </ConfirmButton>
          </form>
        )}
        {puedeEditar && fuera && (
          <form action={includePatientInPeriodAction} className="mt-3">
            <input type="hidden" name="billing_period_id" value={periodId} />
            <input type="hidden" name="patient_id" value={p.id} />
            <button className="rounded-lg bg-white text-slate-700 border border-slate-300 text-xs font-medium px-3 py-1.5 hover:bg-slate-50 transition-colors">
              Volver a incluir
            </button>
          </form>
        )}
      </li>
    );
  };

  return (
    <ActionDisclosure
      label={`Pre-validación${bloqueantes > 0 ? ` (${bloqueantes} bloqueante${bloqueantes > 1 ? "s" : ""})` : avisos > 0 ? ` (${avisos} para revisar)` : ""}`}
      tone={bloqueantes > 0 ? "alert" : "subtle"}
    >
      <div className="space-y-4">
        <div className="text-xs text-slate-500">
          {pacientes.length} paciente(s) con prácticas autorizadas este mes: {pacientes.filter((p) => p.tone === "rojo").length} en rojo
          {" · "}{pacientes.filter((p) => p.tone === "amarillo").length} con el mes en curso{" · "}{alDia.length} al día.
          Los pacientes en rojo bloquean el cierre, salvo que los dejes fuera de este mes.
        </div>

        {conProblema.length > 0 && <ul className="space-y-2">{conProblema.map(renderPaciente)}</ul>}
        {alDia.length > 0 && (
          <details className="group">
            <summary className="list-none cursor-pointer text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 w-fit select-none">
              Ver los {alDia.length} paciente(s) al día
            </summary>
            <ul className="space-y-2 mt-2">{alDia.map(renderPaciente)}</ul>
          </details>
        )}

        <div>
          <h4 className="text-xs font-semibold text-slate-700 mb-1.5">Firma del profesional y conformidad del familiar</h4>
          {sinFirma.length === 0 ? (
            <p className="text-xs text-slate-500">
              {controles.some((c) => (c.evoluciones_mes ?? 0) > 0)
                ? "Todas las evoluciones del mes tienen firma del profesional y conformidad del familiar."
                : "Este mes todavía no hay evoluciones cargadas."}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {sinFirma.map((c) => (
                <li key={c.patient_id} className="text-sm flex items-center gap-2 flex-wrap">
                  <StatusBadge tone="amarillo" label="Revisar" />
                  <span className="text-slate-700">{c.nombre_completo}</span>
                  <span className="text-xs text-slate-500">
                    {(c.sin_firma_profesional ?? 0) > 0 && <>{c.sin_firma_profesional} sin firma del profesional</>}
                    {(c.sin_firma_profesional ?? 0) > 0 && (c.sin_conformidad_familiar ?? 0) > 0 && " · "}
                    {(c.sin_conformidad_familiar ?? 0) > 0 && <>{c.sin_conformidad_familiar} sin conformidad del familiar</>}
                    {` (de ${c.evoluciones_mes} evoluciones)`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {conVisitasSinEvolucion.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-slate-700 mb-1.5">Visitas realizadas sin evolución cargada</h4>
            <ul className="space-y-1.5">
              {conVisitasSinEvolucion.map((c) => (
                <li key={c.patient_id} className="text-sm flex items-center gap-2 flex-wrap">
                  <StatusBadge tone="amarillo" label="Revisar" />
                  <span className="text-slate-700">{c.nombre_completo}</span>
                  <span className="text-xs text-slate-500">{c.visitas_sin_evolucion} visita(s) sin historia clínica</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {insumos.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-slate-700 mb-1.5">Insumos y equipos entregados contra lo autorizado</h4>
            {insumosParaRevisar.length === 0 ? (
              <p className="text-xs text-slate-500">Todo lo entregado coincide con lo autorizado.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="text-left font-medium py-1 pr-3">Paciente</th>
                      <th className="text-left font-medium py-1 pr-3">Producto</th>
                      <th className="text-right font-medium py-1 pr-3">Autorizado</th>
                      <th className="text-right font-medium py-1 pr-3">Entregado</th>
                      <th className="text-left font-medium py-1">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {insumosParaRevisar.map((i) => {
                      const b = INSUMO_BADGE[i.estado_control ?? "ok"];
                      return (
                        <tr key={`${i.patient_id}-${i.product_id}`}>
                          <td className="py-1.5 pr-3 text-slate-700 whitespace-nowrap">{i.nombre_completo}</td>
                          <td className="py-1.5 pr-3 text-slate-700">{i.descripcion}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">{i.cantidad_autorizada}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">{i.cantidad_entregada}</td>
                          <td className="py-1.5 whitespace-nowrap"><StatusBadge tone={b.tone} label={b.label} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-[11px] text-slate-400 mt-1.5">Se compara lo autorizado para el mes con los pedidos despachados o entregados ese mes. Es un aviso: no bloquea el cierre.</p>
          </div>
        )}

        <p className="text-xs text-slate-400">
          Las evoluciones esperadas se calculan repartiendo lo autorizado entre los días de la autorización, contando solo los días en que
          el paciente ya estaba en el domicilio y todavía no se había informado su egreso.
        </p>
      </div>
    </ActionDisclosure>
  );
}
