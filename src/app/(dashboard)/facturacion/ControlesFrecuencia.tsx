import StatusBadge from "@/components/StatusBadge";
import ActionDisclosure from "@/components/ActionDisclosure";
import { SPECIALTY_LABELS } from "@/lib/roles";
import { describirDias, fechaCorta } from "@/lib/facturacion";
import type { Database } from "@/types/database";

type Diaria = Database["public"]["Views"]["v_control_frecuencia_diaria"]["Row"];
type Semanal = Database["public"]["Views"]["v_control_frecuencia_semanal"]["Row"];

// Controles de frecuencia (C4 controles 3 y 4): cada día se revisa qué práctica diaria quedó sin
// evolución ayer; cada semana, qué práctica con días fijos no llegó a lo autorizado la semana pasada.
export default function ControlesFrecuencia({ diaria, semanal }: { diaria: Diaria[]; semanal: Semanal[] }) {
  const total = diaria.length + semanal.length;
  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-5 animate-fade-slide-up">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-sm font-medium text-slate-900">Controles de frecuencia</h2>
        {total === 0 ? <StatusBadge tone="verde" label="Todo al día" /> : <StatusBadge tone="amarillo" label={`${total} para revisar`} />}
      </div>
      <p className="text-xs text-slate-500 mt-1">
        Se revisa lo de ayer para las prácticas con frecuencia diaria, y la semana pasada (de lunes a domingo) para las de días fijos.
        Las frecuencias se cargan al autorizar la práctica.
      </p>
      {total > 0 && (
        <ActionDisclosure label={`Ver el detalle (${total})`} tone={diaria.length > 0 ? "alert" : "subtle"}>
          <div className="space-y-3 text-sm">
            {diaria.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-700 mb-1.5">Ayer ({fechaCorta(diaria[0].fecha)}) sin la evolución esperada</h3>
                <ul className="space-y-1.5">
                  {diaria.map((d) => (
                    <li key={`${d.treatment_authorization_id}`} className="flex items-center gap-2 flex-wrap">
                      <StatusBadge tone="rojo" label="Falta evolución" />
                      <span className="text-slate-700">{d.nombre_completo} · {d.practica} ({SPECIALTY_LABELS[d.especialidad ?? ""] ?? d.especialidad})</span>
                      <span className="text-xs text-slate-500">{d.cargadas}/{d.esperadas} evolución(es)</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {semanal.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-700 mb-1.5">
                  Semana pasada ({fechaCorta(semanal[0].semana_desde)} al {fechaCorta(semanal[0].semana_hasta)}) por debajo de lo autorizado
                </h3>
                <ul className="space-y-1.5">
                  {semanal.map((s) => (
                    <li key={`${s.treatment_authorization_id}`} className="flex items-center gap-2 flex-wrap">
                      <StatusBadge tone="amarillo" label="Faltaron evoluciones" />
                      <span className="text-slate-700">{s.nombre_completo} · {s.practica} ({SPECIALTY_LABELS[s.especialidad ?? ""] ?? s.especialidad})</span>
                      <span className="text-xs text-slate-500">{s.cargadas}/{s.esperadas} evoluciones ({describirDias(s.dias_semana)})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </ActionDisclosure>
      )}
    </section>
  );
}
