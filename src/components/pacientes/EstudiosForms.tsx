"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { agregarEstudioAction, solicitarEstudioAction, type EstudioState } from "@/app/(dashboard)/paciente/[id]/estudios-actions";

const inputCls = "rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm w-full";
const btnPrimary = "rounded-lg bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800 transition-colors disabled:opacity-60";

/** Administración carga un estudio: de qué se trata, archivo adjunto (PDF o imagen) y, si se factura a la obra social, si ya está autorizado. */
export function AgregarEstudioForm({ patientId, solicitudes }: { patientId: string; solicitudes: { id: string; detalle: string }[] }) {
  const [state, action, pending] = useActionState<EstudioState, FormData>(agregarEstudioAction, { error: null });
  const [, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [seFactura, setSeFactura] = useState(false);
  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        if (!formRef.current) return;
        const fd = new FormData(formRef.current);
        start(() => action(fd));
      }}
      className="space-y-3"
    >
      <input type="hidden" name="patient_id" value={patientId} />
      <label className="block text-xs text-slate-600">De qué estudio se trata
        <textarea name="descripcion" required rows={2} placeholder="Ej.: Laboratorio de rutina, radiografía de tórax, resultado de biopsia…" className={`${inputCls} mt-1`} />
      </label>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block text-xs text-slate-600">Fecha del estudio (opcional)
          <input name="fecha_estudio" type="date" className={`${inputCls} mt-1`} />
        </label>
        <label className="block text-xs text-slate-600">Archivo adjunto (PDF o imagen, hasta 10 MB)
          <input name="archivo" type="file" accept="application/pdf,image/jpeg,image/png" className={`${inputCls} mt-1`} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="se_factura" checked={seFactura} onChange={(e) => setSeFactura(e.target.checked)} className="rounded border-slate-300" /> Se factura a la obra social
      </label>
      {seFactura && (
        <label className="block text-xs text-slate-600 max-w-xs">¿Ya está autorizado?
          <select name="autorizado" defaultValue="no" className={`${inputCls} mt-1`}>
            <option value="no">Pendiente de autorización</option>
            <option value="si">Autorizado</option>
          </select>
        </label>
      )}
      <p className="text-[11px] text-slate-400">Si no se factura, es un estudio que presupuestamos nosotros o que el paciente se hace de forma particular o ambulatoria.</p>
      {solicitudes.length > 0 && (
        <label className="block text-xs text-slate-600">Responde a un pedido del médico (opcional)
          <select name="solicitud_id" defaultValue="" className={`${inputCls} mt-1`}>
            <option value="">Ninguno</option>
            {solicitudes.map((s) => <option key={s.id} value={s.id}>{s.detalle.slice(0, 90)}</option>)}
          </select>
        </label>
      )}
      {state.error && <p role="alert" className="text-xs rounded-lg px-3 py-2 border bg-red-50 border-red-200 text-red-700">{state.error}</p>}
      <button disabled={pending} className={btnPrimary}>{pending ? "Guardando…" : "Agregar estudio"}</button>
    </form>
  );
}

/** El médico pide un estudio: un cuadro de texto y aviso a Administración. */
export function SolicitarEstudioForm({ patientId }: { patientId: string }) {
  const [state, action, pending] = useActionState<EstudioState, FormData>(solicitarEstudioAction, { error: null });
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
      className="space-y-3"
    >
      <input type="hidden" name="patient_id" value={patientId} />
      <label className="block text-xs text-slate-600">Qué estudio necesitás
        <textarea name="detalle" required rows={3} placeholder="Ej.: Laboratorio completo con hepatograma; radiografía de tórax de frente y perfil." className={`${inputCls} mt-1`} />
      </label>
      {state.error && <p role="alert" className="text-xs rounded-lg px-3 py-2 border bg-red-50 border-red-200 text-red-700">{state.error}</p>}
      <button disabled={pending} className={btnPrimary}>{pending ? "Enviando…" : "Enviar pedido a Administración"}</button>
    </form>
  );
}
