"use client";

import ActionForm, { SubmitButton } from "@/components/facturacion/ActionForm";
import { guardarParametroAction, guardarItemCatalogoAction, agregarItemCatalogoAction, guardarAlertaAction } from "@/app/(dashboard)/configuracion/actions";
import { ROLES_ASIGNABLES } from "@/lib/usuarios";
import { ROLE_LABELS } from "@/lib/roles";

const inputCls = "rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/40";
const btnCls = "rounded-xl bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800";

export function ParametroForm({ clave, valor }: { clave: string; valor: number }) {
  return (
    <ActionForm action={guardarParametroAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="clave" value={clave} />
      <input name="valor" inputMode="decimal" defaultValue={String(valor)} aria-label="Valor" className={`${inputCls} w-28`} />
      <SubmitButton className={btnCls}>Guardar</SubmitButton>
    </ActionForm>
  );
}

export function ItemCatalogoForm({ id, nombre, activo }: { id: string; nombre: string; activo: boolean }) {
  return (
    <ActionForm action={guardarItemCatalogoAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input name="nombre" defaultValue={nombre} aria-label="Nombre" className={`${inputCls} flex-1 min-w-[10rem]`} />
      <label className="flex items-center gap-1.5 text-xs text-slate-600">
        <select name="activo" defaultValue={activo ? "1" : "0"} className={inputCls}>
          <option value="1">Visible</option>
          <option value="0">Oculto</option>
        </select>
      </label>
      <SubmitButton className={btnCls}>Guardar</SubmitButton>
    </ActionForm>
  );
}

export function AgregarItemForm({ catalogo }: { catalogo: string }) {
  return (
    <ActionForm action={agregarItemCatalogoAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="catalogo" value={catalogo} />
      <input name="nombre" placeholder="Nuevo elemento" aria-label="Nuevo elemento" className={`${inputCls} flex-1 min-w-[10rem]`} />
      <SubmitButton className={btnCls} pendingLabel="Agregando…">Agregar</SubmitButton>
    </ActionForm>
  );
}

export function AlertaForm({
  a,
  rolesActuales,
}: {
  a: { codigo: string; mensaje: string; activo: boolean; canal_app: boolean; canal_email: boolean; canal_whatsapp: boolean };
  rolesActuales: string[];
}) {
  return (
    <ActionForm action={guardarAlertaAction} className="space-y-3">
      <input type="hidden" name="codigo" value={a.codigo} />
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Texto del aviso (se completan las partes entre llaves)</label>
        <textarea name="mensaje" defaultValue={a.mensaje} rows={2} className={`${inputCls} w-full`} />
      </div>
      <fieldset>
        <legend className="text-xs font-medium text-slate-600 mb-1">A quién le llega</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {ROLES_ASIGNABLES.map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="roles" value={r} defaultChecked={rolesActuales.includes(r)} />
              {ROLE_LABELS[r]}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-xs font-medium text-slate-600 mb-1">Por dónde</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-700">
          <label className="flex items-center gap-2"><input type="checkbox" name="canal_app" defaultChecked={a.canal_app} /> En la plataforma</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="canal_email" defaultChecked={a.canal_email} /> Email (todavía no se envía)</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="canal_whatsapp" defaultChecked={a.canal_whatsapp} /> WhatsApp (todavía no se envía)</label>
        </div>
      </fieldset>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="activo" defaultChecked={a.activo} /> Alerta activa
      </label>
      <SubmitButton className={btnCls}>Guardar alerta</SubmitButton>
    </ActionForm>
  );
}
