"use client";

import { useActionState, useRef, useTransition } from "react";
import { registrarSuspensionAction, type SuspensionState } from "@/app/(dashboard)/paciente/[id]/suspensiones-actions";

const inputCls = "rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm w-full";
const btnPrimary = "rounded-lg bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800 transition-colors disabled:opacity-60";

/** Administración registra un período sin servicio (internación transitoria) dentro de la misma autorización. */
export function SuspensionServicioForm({ patientId }: { patientId: string }) {
  const [state, action, pending] = useActionState<SuspensionState, FormData>(registrarSuspensionAction, { error: null });
  const [, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        if (!formRef.current) return;
        const fd = new FormData(formRef.current);
        start(() => action(fd));
      }}
      className="grid gap-3 sm:grid-cols-4 items-end"
    >
      <input type="hidden" name="patient_id" value={patientId} />
      <label className="text-xs text-slate-600">Suspendido desde
        <input type="date" name="desde" required className={`${inputCls} mt-1`} />
      </label>
      <label className="text-xs text-slate-600">Retoma el (si ya se sabe)
        <input type="date" name="hasta" className={`${inputCls} mt-1`} />
      </label>
      <label className="text-xs text-slate-600 sm:col-span-2">Motivo
        <input name="motivo" placeholder="Ej.: internación en sanatorio, viaje" className={`${inputCls} mt-1`} />
      </label>
      <div className="sm:col-span-4 flex items-center gap-3">
        <button type="submit" disabled={pending} className={btnPrimary}>{pending ? "Guardando…" : "Registrar suspensión"}</button>
        {state.error && <span role="alert" className="text-sm text-red-700">{state.error}</span>}
        {state.ok && !pending && <span className="text-sm text-emerald-700">Guardado.</span>}
      </div>
    </form>
  );
}
