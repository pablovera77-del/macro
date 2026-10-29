"use client";

import { useActionState, useRef, useTransition } from "react";
import { cargarAutorizacionesAction, renovarAutorizacionesAction, type AutorizacionState } from "@/app/(dashboard)/internacion/actions";
import RenglonesEditor, { type RenglonInicial } from "@/components/pacientes/RenglonesEditor";

export type { RenglonInicial };

const inputCls = "rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs";

/**
 * Carga de autorizaciones (H3) y renovación (H4): un renglón por práctica, con lista, frecuencia y días.
 * En la renovación los renglones vienen precargados con lo de la autorización anterior y se pueden editar.
 */
export default function AutorizacionesForm({
  patientId,
  modo,
  inicial,
  desdeSugerido,
  conStock,
}: {
  patientId: string;
  modo: "cargar" | "renovar";
  inicial?: RenglonInicial[];
  desdeSugerido?: string;
  conStock?: boolean;
}) {
  const accion = modo === "renovar" ? renovarAutorizacionesAction : cargarAutorizacionesAction;
  const [state, formAction, pending] = useActionState<AutorizacionState, FormData>(accion, { error: null });
  const [, startSubmit] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      // Se envía con onSubmit para que React no borre lo escrito si el servidor devuelve un error.
      onSubmit={(e) => {
        e.preventDefault();
        if (!formRef.current) return;
        const fd = new FormData(formRef.current);
        startSubmit(() => formAction(fd));
      }}
      className="space-y-3"
    >
      <input type="hidden" name="patient_id" value={patientId} />
      <div className="flex flex-wrap gap-3">
        <label className="text-[11px] text-slate-600">{modo === "renovar" ? "Inicio de la nueva autorización" : "Ingreso al servicio (inicio de la autorización)"}
          <input name="periodo_desde" type="date" required defaultValue={desdeSugerido} className={`${inputCls} block mt-0.5`} />
        </label>
        <label className="text-[11px] text-slate-600">Vencimiento de la autorización
          <input name="periodo_hasta" type="date" required className={`${inputCls} block mt-0.5`} />
        </label>
      </div>

      <RenglonesEditor inicial={inicial} />

      {modo === "renovar" && conStock && (
        <label className="flex items-center gap-2 text-xs text-slate-700">
          <input type="checkbox" name="heredar_stock" defaultChecked /> Renovar también los insumos, el alimento y los equipos autorizados (con el mismo período)
        </label>
      )}

      {state.error && <p role="alert" className="text-xs rounded-lg px-3 py-2 border bg-red-50 border-red-200 text-red-700">{state.error}</p>}
      {state.ok && !state.error && <p role="status" className="text-xs rounded-lg px-3 py-2 border bg-emerald-50 border-emerald-200 text-emerald-800">Guardado.</p>}
      <button disabled={pending} className="rounded-lg bg-slate-900 text-white text-xs font-medium px-3 py-2 hover:bg-slate-800 disabled:opacity-60">
        {pending ? "Guardando…" : modo === "renovar" ? "Crear la renovación" : "Autorizar"}
      </button>
    </form>
  );
}
