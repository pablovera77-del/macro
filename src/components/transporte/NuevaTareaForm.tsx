"use client";

import { useState } from "react";
import ActionForm from "@/components/stock/ActionForm";
import SubmitButton from "@/components/stock/SubmitButton";
import { crearTareaTransporteAction } from "@/app/(dashboard)/agenda-transporte/actions";
import { DIAS_CORTOS } from "@/lib/plan";

const campo = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base sm:text-sm";

export default function NuevaTareaForm({ fecha }: { fecha: string }) {
  const [permanente, setPermanente] = useState(false);
  const [rep, setRep] = useState("diaria");
  return (
    <ActionForm action={crearTareaTransporteAction} className="grid gap-3 sm:grid-cols-2">
      <label className="col-span-full text-xs text-slate-600">Qué hay que hacer
        <input name="titulo" required placeholder="Ej.: Llevar el concentrador a service" className={campo} />
      </label>
      <label className="text-xs text-slate-600">Tipo
        <select name="tipo" defaultValue="otro" className={campo}>
          <option value="otro">Otra tarea</option><option value="entrega">Entrega</option><option value="retiro">Retiro</option>
        </select>
      </label>
      <label className="text-xs text-slate-600">Prioridad
        <select name="prioridad" defaultValue="media" className={campo}>
          <option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option>
        </select>
      </label>
      <label className="text-xs text-slate-600">Día
        <input type="date" name="fecha" defaultValue={fecha} required className={campo} />
      </label>
      <label className="text-xs text-slate-600">Hora (opcional)
        <input type="time" name="hora" className={campo} />
      </label>
      <label className="text-xs text-slate-600">Dirección (opcional)
        <input name="direccion" className={campo} />
      </label>
      <label className="text-xs text-slate-600">Teléfono (opcional)
        <input name="telefono" inputMode="tel" className={campo} />
      </label>
      <label className="col-span-full text-xs text-slate-600">Detalle (opcional)
        <textarea name="descripcion" rows={2} className={campo} />
      </label>
      <label className="col-span-full flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="permanente" checked={permanente} onChange={(e) => setPermanente(e.target.checked)} />
        Es una tarea permanente (se repite)
      </label>
      {permanente && (
        <div className="col-span-full grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-slate-600">Se repite
            <select name="repeticion" value={rep} onChange={(e) => setRep(e.target.value)} className={campo}>
              <option value="diaria">Todos los días</option><option value="semanal">Algunos días de la semana</option><option value="mensual">Una vez por mes (mismo día)</option>
            </select>
          </label>
          {rep === "semanal" && (
            <fieldset className="text-xs text-slate-600">
              <legend>Días</legend>
              <div className="flex gap-2 flex-wrap mt-1">
                {DIAS_CORTOS.map((d, i) => (
                  <label key={d} className="flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-2 text-sm">
                    <input type="checkbox" name="dias_semana" value={i + 1} /> {d}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </div>
      )}
      <label className="col-span-full flex items-center gap-2 text-xs text-slate-600">
        <input type="checkbox" name="guardar_igual" /> Guardar igual aunque se superponga con otra tarea
      </label>
      <div className="col-span-full">
        <SubmitButton className="rounded-xl bg-slate-900 text-white text-sm font-semibold px-4 py-2.5">Agendar tarea</SubmitButton>
      </div>
    </ActionForm>
  );
}
