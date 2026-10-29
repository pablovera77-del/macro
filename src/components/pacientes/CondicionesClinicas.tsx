"use client";

import { useState } from "react";

const inputCls = "rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm";

export type CondicionesValores = {
  en_tratamiento_atb: boolean;
  requiere_curaciones: boolean;
  requiere_oxigeno: boolean;
  soporte_nutricional: string | null;
  acceso_venoso: string | null;
};

/**
 * Condiciones clínicas que se marcan al cargar un paciente (Vanina, 26/10): tratamiento antibiótico, curaciones,
 * oxígeno permanente, soporte nutricional (con SNG o gastrostomía) y acceso venoso. Sirven para filtrar el listado
 * de pacientes y para el dashboard ejecutivo. Los comparten el asistente de admisión y la edición del legajo.
 */
export default function CondicionesClinicas({ valores }: { valores?: Partial<CondicionesValores> }) {
  const v = valores ?? {};
  const [soporte, setSoporte] = useState(!!v.soporte_nutricional);
  return (
    <fieldset className="sm:col-span-2 space-y-3 rounded-xl border border-slate-200 p-3">
      <legend className="px-1 text-xs font-medium text-slate-700">Condiciones clínicas</legend>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" name="en_tratamiento_atb" defaultChecked={!!v.en_tratamiento_atb} className="rounded border-slate-300" /> En tratamiento antibiótico</label>
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" name="requiere_curaciones" defaultChecked={!!v.requiere_curaciones} className="rounded border-slate-300" /> Requiere curaciones</label>
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" name="requiere_oxigeno" defaultChecked={!!v.requiere_oxigeno} className="rounded border-slate-300" /> Requiere oxígeno permanente</label>
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" name="requiere_soporte_nutricional" checked={soporte} onChange={(e) => setSoporte(e.target.checked)} className="rounded border-slate-300" /> Requiere soporte nutricional</label>
      </div>
      {soporte && (
        <label className="block text-[11px] text-slate-500 max-w-xs">Tipo de soporte nutricional
          <select name="soporte_nutricional" required defaultValue={v.soporte_nutricional ?? ""} className={`${inputCls} block mt-0.5 w-full`}>
            <option value="" disabled>Elegí una opción…</option>
            <option value="sng">Con sonda nasogástrica (SNG)</option>
            <option value="gastrostomia">Con gastrostomía</option>
          </select>
        </label>
      )}
      <label className="block text-[11px] text-slate-500 max-w-xs">Acceso venoso
        <select name="acceso_venoso" defaultValue={v.acceso_venoso ?? "sin_via"} className={`${inputCls} block mt-0.5 w-full`}>
          <option value="sin_via">Sin vía</option>
          <option value="via_periferica">Vía periférica</option>
          <option value="via_central">Vía central</option>
        </select>
      </label>
      <p className="text-[11px] text-slate-400">Sirven para filtrar el listado de pacientes y para el dashboard ejecutivo.</p>
    </fieldset>
  );
}
