import StatusBadge from "@/components/StatusBadge";
import { motivoEgresoLabel } from "@/lib/egreso";
import { fechaCorta } from "@/lib/paciente";

export type InternacionFila = { id: string; numero: number; estado: string; fecha_ingreso: string | null; fecha_egreso: string | null; motivo_egreso: string | null; diagnostico: string | null };
export type EventoFila = { id: string; evento: string; fecha_evento: string; motivo: string | null; informado_por: string | null; confirmado_por: string | null };

const EVENTO_LABEL: Record<string, string> = { alta: "Alta del paciente", reingreso: "Nueva internación", llegada: "Llegada al domicilio confirmada", baja: "Baja" };

const fechaHora = (iso: string) => new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/San_Juan" });

/** Historial de internaciones del legajo y línea de tiempo de altas, llegadas y bajas (DF-C3 §3.1 y §11.1). */
export default function HistorialInternaciones({ internaciones, eventos, nombres }: { internaciones: InternacionFila[]; eventos: EventoFila[]; nombres: Record<string, string> }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Internaciones</h3>
        {internaciones.length === 0 ? (
          <p className="text-sm text-slate-400">Todavía no hay internaciones registradas.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {internaciones.map((i) => (
              <li key={i.id} className="py-2 flex items-center justify-between gap-3 flex-wrap">
                <span>
                  <span className="font-medium text-slate-900">Internación N° {i.numero}</span>
                  <span className="text-slate-500"> · ingresó el {fechaCorta(i.fecha_ingreso)}{i.estado === "finalizada" ? ` · egresó el ${fechaCorta(i.fecha_egreso)} (${motivoEgresoLabel(i.motivo_egreso)})` : ""}</span>
                  {i.diagnostico && <span className="block text-xs text-slate-400">Dx: {i.diagnostico}</span>}
                </span>
                <StatusBadge tone={i.estado === "finalizada" ? "gris" : "verde"} label={i.estado === "finalizada" ? "Finalizada" : "En curso"} />
              </li>
            ))}
          </ul>
        )}
      </div>
      {eventos.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Línea de tiempo</h3>
          <ol className="text-sm space-y-2 border-l border-slate-200 pl-4">
            {eventos.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-slate-300" />
                <span className="block text-xs text-slate-400">{fechaHora(e.fecha_evento)}</span>
                {EVENTO_LABEL[e.evento] ?? e.evento}
                {e.evento === "baja" && e.motivo ? `: ${motivoEgresoLabel(e.motivo)}` : ""}
                {e.evento === "baja" && (e.informado_por || e.confirmado_por) && (
                  <span className="block text-xs text-slate-500">
                    {e.informado_por ? `Informó ${nombres[e.informado_por] ?? "—"}` : ""}
                    {e.informado_por && e.confirmado_por ? " · " : ""}
                    {e.confirmado_por ? `Confirmó ${nombres[e.confirmado_por] ?? "—"}` : ""}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
