"use client";

import { useActionState, useRef, useTransition } from "react";
import FirmaCanvas from "@/components/hc/FirmaCanvas";
import { abrirTurnoAction, agregarControlAction, cerrarTurnoAction, type TurnoState } from "@/app/(dashboard)/guardias/turno/actions";

const inputCls = "w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900";
const labelCls = "block text-[11px] font-medium text-slate-600 mb-0.5";
const ini: TurnoState = { error: null };

function Error({ msg }: { msg: string | null }) {
  return msg ? <p role="alert" className="text-xs rounded-lg px-3 py-2 border bg-red-50 border-red-200 text-red-700">{msg}</p> : null;
}

export function AbrirTurnoForm({ patientId }: { patientId: string }) {
  const [state, action, pending] = useActionState(abrirTurnoAction, ini);
  return (
    <form action={action} className="flex items-center gap-2 flex-wrap">
      <input type="hidden" name="patient_id" value={patientId} />
      <button disabled={pending} className="rounded-lg bg-slate-900 text-white text-xs font-medium px-3.5 py-2 hover:bg-slate-800 disabled:opacity-60">
        {pending ? "Abriendo…" : "Iniciar turno"}
      </button>
      <Error msg={state.error} />
    </form>
  );
}

const SiNo = ({ name, label }: { name: string; label: string }) => (
  <label className={labelCls}>
    {label}
    <select name={name} defaultValue="" className={`${inputCls} mt-0.5`}>
      <option value="">—</option>
      <option value="Sí">Sí</option>
      <option value="No">No</option>
    </select>
  </label>
);

export function ControlForm({ turnoId }: { turnoId: string }) {
  const [state, action, pending] = useActionState(agregarControlAction, ini);
  const ref = useRef<HTMLFormElement>(null);
  const [, start] = useTransition();
  return (
    <form
      ref={ref}
      onSubmit={(e) => {
        e.preventDefault();
        if (!ref.current) return;
        const fd = new FormData(ref.current);
        start(async () => {
          await action(fd);
        });
      }}
      className="space-y-2"
    >
      <input type="hidden" name="turno_id" value={turnoId} />
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
        <label className={labelCls}>P/A<input name="pa" placeholder="120/80" inputMode="text" className={`${inputCls} mt-0.5`} /></label>
        <label className={labelCls}>FC<input name="fc" inputMode="numeric" className={`${inputCls} mt-0.5`} /></label>
        <label className={labelCls}>FR<input name="fr" inputMode="numeric" className={`${inputCls} mt-0.5`} /></label>
        <label className={labelCls}>AX (°C)<input name="ax" inputMode="decimal" className={`${inputCls} mt-0.5`} /></label>
        <SiNo name="diuresis" label="Diuresis" />
        <SiNo name="catarsis" label="Catarsis" />
      </div>
      <Error msg={state.error} />
      <button disabled={pending} className="rounded-lg border border-slate-300 text-slate-800 text-xs font-medium px-3.5 py-2 hover:bg-slate-50 disabled:opacity-60">
        {pending ? "Guardando…" : "+ Anotar control"}
      </button>
    </form>
  );
}

export function CerrarTurnoForm({ turnoId, matriculaInicial, profesionalNombre }: { turnoId: string; matriculaInicial: string | null; profesionalNombre: string }) {
  const [state, action, pending] = useActionState(cerrarTurnoAction, ini);
  const ref = useRef<HTMLFormElement>(null);
  const [, start] = useTransition();
  return (
    <form
      ref={ref}
      // Se envía con onSubmit para que React no borre lo escrito ni las firmas si el servidor devuelve un error.
      onSubmit={(e) => {
        e.preventDefault();
        if (!ref.current) return;
        const fd = new FormData(ref.current);
        start(async () => {
          await action(fd);
        });
      }}
      className="space-y-3 border-t border-slate-100 pt-3"
    >
      <input type="hidden" name="turno_id" value={turnoId} />
      <label className={labelCls}>
        Observaciones (opcional)
        <textarea name="narrativa" rows={4} className={`${inputCls} mt-0.5`} placeholder="Qué pasó durante la guardia, cambios que notaste, qué le dijiste a la familia…" />
      </label>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span className={labelCls}>Profesional</span>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm text-slate-700">{profesionalNombre}</div>
            </div>
            <label className={labelCls}>
              Matrícula <span className="text-red-500">*</span>
              <input name="matricula" required defaultValue={matriculaInicial ?? ""} placeholder="Ej.: MP 1234" className={`${inputCls} mt-0.5`} />
            </label>
          </div>
          <FirmaCanvas name="firma_profesional" titulo="Firma del profesional" />
        </div>
        <div className="space-y-3">
          <label className={labelCls}>
            Nombre de quien firma por el paciente o la familia <span className="text-red-500">*</span>
            <input name="conformidad_nombre" required placeholder="Nombre y apellido" className={`${inputCls} mt-0.5`} />
          </label>
          <FirmaCanvas name="conformidad" titulo="Conformidad del paciente o familiar" ayuda="Pasale el celular a quien firma para que dibuje la firma." />
        </div>
      </div>
      <Error msg={state.error} />
      <button disabled={pending} className="rounded-xl bg-slate-900 text-white text-sm font-medium px-5 py-2.5 hover:bg-slate-800 disabled:opacity-60">
        {pending ? "Cerrando…" : "Cerrar turno y firmar"}
      </button>
    </form>
  );
}
