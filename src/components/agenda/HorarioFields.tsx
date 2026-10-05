"use client";

import { useState } from "react";
import { FRANJAS, type Franja, type TipoHorario } from "@/lib/horario";

const campo = "rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 w-full";

/**
 * Día y horario de una visita. El día es obligatorio; el horario puede ser una hora exacta,
 * una franja (mañana / tarde / noche), un rango («de 9 a 12») o ninguno («sin hora definida»).
 * Los campos viajan con nombres simples que lee `leerHorarioDeForm` en el servidor.
 */
export default function HorarioFields({
  prefijo = "",
  defaultFecha = "",
  defaultTipo = "exacta",
  className = "",
}: {
  prefijo?: string;
  defaultFecha?: string;
  defaultTipo?: TipoHorario;
  className?: string;
}) {
  const [tipo, setTipo] = useState<TipoHorario>(defaultTipo);
  const n = (k: string) => `${prefijo}${k}`;
  return (
    <div className={`grid grid-cols-1 gap-3 ${className}`}>
      <label className="block">
        <span className="text-xs font-medium text-slate-600">Día</span>
        <input name={n("fecha")} type="date" required defaultValue={defaultFecha} className={`${campo} mt-1`} />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-slate-600">Horario</span>
        <select name={n("horario_tipo")} value={tipo} onChange={(e) => setTipo(e.target.value as TipoHorario)} className={`${campo} mt-1`}>
          <option value="exacta">Hora exacta</option>
          <option value="franja">Mañana, tarde o noche</option>
          <option value="rango">Rango (de … a …)</option>
          <option value="sin_hora">Sin hora definida (solo el día)</option>
        </select>
      </label>
      {tipo === "exacta" && (
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Hora</span>
          <input name={n("hora")} type="time" required className={`${campo} mt-1`} />
        </label>
      )}
      {tipo === "franja" && (
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Franja</span>
          <select name={n("franja")} required defaultValue="" className={`${campo} mt-1`}>
            <option value="" disabled>Elegí la franja…</option>
            {(Object.keys(FRANJAS) as Franja[]).map((f) => (
              <option key={f} value={f}>
                {FRANJAS[f].label} ({FRANJAS[f].resumen})
              </option>
            ))}
          </select>
        </label>
      )}
      {tipo === "rango" && (
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Desde</span>
            <input name={n("hora_desde")} type="time" required className={`${campo} mt-1`} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Hasta</span>
            <input name={n("hora_hasta")} type="time" required className={`${campo} mt-1`} />
          </label>
        </div>
      )}
      {tipo === "sin_hora" && <p className="text-xs text-slate-500">La visita queda para ese día sin hora. Se la avisamos al paciente como «mañana» o «el [día]» sin horario.</p>}
    </div>
  );
}
