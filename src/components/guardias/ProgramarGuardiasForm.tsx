"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { programarGuardiasAction, type GuardiaState } from "@/app/(dashboard)/guardias/actions";
import { TRAMOS } from "@/lib/guardias";

const inputCls = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/40";
const labelCls = "block text-xs font-medium text-slate-600 mb-1";

function Enviar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`rounded-xl bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800 ${pending ? "opacity-60 cursor-wait" : ""}`}>
      {pending ? "Guardando…" : "Cargar guardias"}
    </button>
  );
}

export default function ProgramarGuardiasForm({
  pacientes,
  profesionales,
  hoy,
}: {
  pacientes: { id: string; nombre: string }[];
  profesionales: { id: string; nombre: string }[];
  hoy: string;
}) {
  const [state, action] = useActionState(programarGuardiasAction, null as GuardiaState);
  const [modo, setModo] = useState<"tramo" | "cantidad">("tramo");
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <div>
        <label className={labelCls}>Paciente</label>
        <select name="patient_id" required defaultValue="" className={inputCls}>
          <option value="" disabled>Elegir…</option>
          {pacientes.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </div>
      <div>
        <label className={labelCls}>Profesional (si todavía no lo sabés, dejalo vacío)</label>
        <select name="profesional_id" defaultValue="" className={inputCls}>
          <option value="">— Sin asignar —</option>
          {profesionales.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2 flex gap-4 text-sm text-slate-700">
        <label className="flex items-center gap-2"><input type="radio" name="modo" value="tramo" checked={modo === "tramo"} onChange={() => setModo("tramo")} /> Por tramo de la semana</label>
        <label className="flex items-center gap-2"><input type="radio" name="modo" value="cantidad" checked={modo === "cantidad"} onChange={() => setModo("cantidad")} /> Por día y cantidad</label>
      </div>
      <div>
        <label className={labelCls}>Desde</label>
        <input type="date" name="desde" defaultValue={hoy} required className={inputCls} />
      </div>
      {modo === "tramo" ? (
        <>
          <div>
            <label className={labelCls}>Hasta</label>
            <input type="date" name="hasta" defaultValue={hoy} className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Tramo</label>
            <select name="tramo" defaultValue="lunes_a_viernes" className={inputCls}>
              {Object.entries(TRAMOS).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
            </select>
          </div>
        </>
      ) : (
        <div>
          <label className={labelCls}>Cantidad de días seguidos</label>
          <input type="number" name="cantidad" min={1} max={62} defaultValue={7} className={inputCls} />
        </div>
      )}
      <div>
        <label className={labelCls}>Hora de inicio</label>
        <input type="time" name="hora_desde" defaultValue="08:00" required className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Hora de fin</label>
        <input type="time" name="hora_hasta" defaultValue="20:00" required className={inputCls} />
      </div>
      <div className="sm:col-span-2">
        <label className={labelCls}>Nota (opcional)</label>
        <input name="nota" maxLength={500} className={inputCls} />
      </div>
      {state?.error && <p role="alert" className="sm:col-span-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{state.error}</p>}
      <div className="sm:col-span-2"><Enviar /></div>
    </form>
  );
}
