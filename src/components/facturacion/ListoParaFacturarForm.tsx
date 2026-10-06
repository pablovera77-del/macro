"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { marcarListoParaFacturarAction } from "@/app/(dashboard)/listo-para-facturar/actions";
import type { ActionState } from "@/lib/stock-types";

export type FilaListo = { patientId: string; nombre: string; dni: string | null; obraSocial: string | null; visitas: number; pendientes: number };

/** Lista de pacientes del mes con casilla: Administración marca de una vez los que están listos para facturar. */
export default function ListoParaFacturarForm({ mes, filas }: { mes: string; filas: FilaListo[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(marcarListoParaFacturarAction, { error: null });
  const [, startSubmit] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [sel, setSel] = useState<Set<string>>(new Set(filas.filter((f) => f.pendientes === 0).map((f) => f.patientId)));
  const hayPendSel = filas.some((f) => sel.has(f.patientId) && f.pendientes > 0);

  if (filas.length === 0) return <p className="text-sm text-slate-500">No quedan pacientes por marcar en este mes.</p>;
  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        if (!formRef.current) return;
        startSubmit(() => formAction(new FormData(formRef.current!)));
      }}
      className="space-y-3"
    >
      <input type="hidden" name="mes" value={mes} />
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {filas.map((f) => (
          <li key={f.patientId} className="flex items-center gap-3 px-3 py-2.5 text-sm">
            <input
              type="checkbox"
              name="patient_id"
              value={f.patientId}
              checked={sel.has(f.patientId)}
              onChange={(e) => setSel((s) => { const n = new Set(s); if (e.target.checked) n.add(f.patientId); else n.delete(f.patientId); return n; })}
              className="rounded border-slate-300"
              aria-label={`Marcar a ${f.nombre}`}
            />
            <div className="min-w-0 flex-1">
              <div className="font-medium text-slate-900">{f.nombre}</div>
              <div className="text-xs text-slate-500">{f.obraSocial ?? "Sin obra social"}{f.dni ? ` · DNI ${f.dni}` : ""} · {f.visitas} visita(s) en el mes</div>
            </div>
            {f.pendientes > 0 ? (
              <span className="rounded-full bg-amber-50 text-amber-700 text-[11px] font-medium px-2 py-0.5">{f.pendientes} sin evolución</span>
            ) : (
              <span className="rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-medium px-2 py-0.5">Historias completas</span>
            )}
          </li>
        ))}
      </ul>
      {hayPendSel && (
        <label className="block text-xs text-slate-600">Observación (obligatoria si marcás pacientes con visitas sin evolución)
          <input name="nota" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm" placeholder="Ej. el profesional carga las evoluciones el lunes" />
        </label>
      )}
      {state.error && <p role="alert" className="text-sm rounded-lg px-3 py-2 border bg-red-50 border-red-200 text-red-700">{state.error}</p>}
      <button disabled={pending || sel.size === 0} className="rounded-lg bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800 disabled:opacity-60">
        {pending ? "Guardando…" : `Marcar ${sel.size} como listo${sel.size === 1 ? "" : "s"} para facturar`}
      </button>
      <p className="text-[11px] text-slate-500">Es un corte administrativo: el paciente sigue activo y no se da de baja.</p>
    </form>
  );
}
