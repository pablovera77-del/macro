"use client";

import { rescheduleVisitAction } from "@/app/(dashboard)/agenda/actions";
import HorarioFields from "@/components/agenda/HorarioFields";

/** «Cambiar día u horario» de una visita (Coordinación). Queda cerrado hasta que se toca. */
export type MotivoReprogramacion = { codigo: string; nombre: string };

export default function ReprogramarForm({ visitId, className = "", motivos = [] }: { visitId: string; className?: string; motivos?: MotivoReprogramacion[] }) {
  return (
    <details className={`group ${className}`}>
      <summary className="cursor-pointer select-none list-none rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-medium px-3 py-1.5 hover:bg-slate-50 w-fit">
        Reprogramar
      </summary>
      <form action={rescheduleVisitAction} className="mt-3 grid grid-cols-1 gap-3 max-w-xs rounded-xl border border-slate-200 bg-slate-50 p-3">
        <input type="hidden" name="visit_id" value={visitId} />
        <HorarioFields />
        {motivos.length > 0 && (
          <label className="block text-xs font-medium text-slate-600">
            Motivo del cambio
            <select name="motivo_reprogramacion" defaultValue="" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900">
              <option value="">— Sin indicar —</option>
              {motivos.map((m) => (
                <option key={m.codigo} value={m.codigo}>{m.nombre}</option>
              ))}
            </select>
          </label>
        )}
        <button className="rounded-xl bg-slate-900 text-white text-sm font-medium px-4 py-2.5 hover:bg-slate-800">Guardar el cambio</button>
      </form>
    </details>
  );
}
