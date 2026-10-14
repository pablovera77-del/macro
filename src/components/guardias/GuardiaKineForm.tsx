"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { programarGuardiaKineAction, type GuardiaState } from "@/app/(dashboard)/guardias/actions";

const inputCls = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/40";
const labelCls = "block text-xs font-medium text-slate-600 mb-1";

function Enviar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`rounded-xl bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800 ${pending ? "opacity-60 cursor-wait" : ""}`}>
      {pending ? "Guardando…" : "Cargar guardia de kinesiología"}
    </button>
  );
}

export default function GuardiaKineForm({ profesionales, hoy }: { profesionales: { id: string; nombre: string }[]; hoy: string }) {
  const [state, action] = useActionState(programarGuardiaKineAction, null as GuardiaState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <div>
        <label className={labelCls}>Kinesiólogo/a de guardia</label>
        <select name="profesional_id" required defaultValue="" className={inputCls}>
          <option value="" disabled>Elegir…</option>
          {profesionales.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </div>
      <div>
        <label className={labelCls}>Fin de semana (cualquier día del sábado o domingo)</label>
        <input type="date" name="fecha" defaultValue={hoy} required className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Cantidad de fines de semana seguidos</label>
        <input type="number" name="cantidad" min={1} max={8} defaultValue={1} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Nota (opcional)</label>
        <input name="nota" maxLength={500} className={inputCls} />
      </div>
      <p className="sm:col-span-2 text-xs text-slate-500">Quien cubre esta guardia ve a todos los pacientes de kinesiología de lunes a lunes (desde el lunes anterior hasta el lunes siguiente al fin de semana).</p>
      {state?.error && <p role="alert" className="sm:col-span-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{state.error}</p>}
      <div className="sm:col-span-2"><Enviar /></div>
    </form>
  );
}
