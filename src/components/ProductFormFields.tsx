"use client";

import { useState } from "react";

// DF-C5 §3, feedback cliente 01/10-02/10: los campos adicionales del alta de
// producto dependen del tipo — vencimiento/lote solo aplican a descartable/
// alimento, y los de alquiler/service solo a equipo. En vez de mostrar los
// ocho campos siempre (confuso: "¿por qué me pide service a un guante?"),
// este componente los muestra/oculta según el <select> de tipo, client-side,
// pero sigue enviando inputs nativos con `name` para que createProductAction
// (que lee formData.get) no necesite cambiar.
export default function ProductFormFields() {
  const [tipo, setTipo] = useState("");

  return (
    <>
      <select
        name="tipo"
        required
        value={tipo}
        onChange={(e) => setTipo(e.target.value)}
        className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
      >
        <option value="">Tipo...</option>
        <option value="descartable">Descartable</option>
        <option value="equipo">Equipo / aparatología</option>
        <option value="alimento">Alimento</option>
      </select>

      {(tipo === "descartable" || tipo === "alimento") && (
        <div className="sm:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 rounded-xl p-3 -mt-1">
          <label className="text-xs text-slate-500 flex flex-col gap-1">
            Fecha de vencimiento {tipo === "descartable" || tipo === "alimento" ? "(obligatorio)" : ""}
            <input
              name="fecha_vencimiento"
              type="date"
              required
              className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
            />
          </label>
          {tipo === "alimento" && (
            <label className="text-xs text-slate-500 flex flex-col gap-1 sm:col-span-2">
              N° de lote (obligatorio)
              <input name="n_lote" required className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm" />
            </label>
          )}
        </div>
      )}

      {tipo === "equipo" && (
        <div className="sm:col-span-3 grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 rounded-xl p-3 -mt-1">
          <label className="text-xs text-slate-500 flex flex-col gap-1">
            Alquiler mensual
            <input name="precio_alquiler_mensual" type="number" step="0.01" placeholder="$" className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm" />
          </label>
          <label className="text-xs text-slate-500 flex flex-col gap-1">
            Frecuencia de service
            <input name="frecuencia_service" placeholder="ej. cada 6 meses" className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm" />
          </label>
          <label className="text-xs text-slate-500 flex flex-col gap-1">
            Último service
            <input name="fecha_ultimo_service" type="date" className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm" />
          </label>
          <label className="text-xs text-slate-500 flex flex-col gap-1">
            Vida útil estimada
            <input name="vida_util_estimada" placeholder="ej. 5 años" className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm" />
          </label>
        </div>
      )}

      <label className="text-xs text-slate-500 flex flex-col gap-1">
        Stock mínimo
        <input name="stock_minimo" type="number" min="0" placeholder="Alerta de reposición" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
      </label>
      <label className="text-xs text-slate-500 flex flex-col gap-1">
        Stock máximo
        <input name="stock_maximo" type="number" min="0" placeholder="Opcional" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
      </label>
    </>
  );
}
