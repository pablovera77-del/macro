"use client";

import { useState } from "react";
import { PERIODOS_FRECUENCIA, PRACTICAS, UNIDADES_FRECUENCIA } from "@/lib/autorizaciones";

export type RenglonInicial = {
  renueva?: number;
  practica_tipo: string;
  aclaracion: string;
  codigo?: string;
  cantidad: number;
  unidad: string;
  periodo: string;
  dias: number[];
};

const inputCls = "rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs";
const DIAS = [["1", "L"], ["2", "M"], ["3", "X"], ["4", "J"], ["5", "V"], ["6", "S"], ["7", "D"]] as const;
export const renglonVacio = (): RenglonInicial => ({ practica_tipo: "", aclaracion: "", cantidad: 1, unidad: "visita", periodo: "semana", dias: [] });

/**
 * Renglones de prácticas autorizadas (H3): lista de prácticas, cantidad del 1 al 30, unidad (visita, sesión, horas),
 * «por» día/semana/quincena/mes, días de la semana y botón «+» para sumar otro renglón.
 * Lo comparten el asistente de admisión (paso 3) y la carga/renovación desde la ficha. Los campos son r<n>_*.
 * `obligatorio` = el primer renglón exige práctica (ficha); en el asistente es opcional y se puede completar después.
 */
export default function RenglonesEditor({ inicial, obligatorio = true }: { inicial?: RenglonInicial[]; obligatorio?: boolean }) {
  const [filas, setFilas] = useState<{ key: number; v: RenglonInicial }[]>(() =>
    (inicial && inicial.length > 0 ? inicial : [renglonVacio()]).map((v, i) => ({ key: i, v }))
  );
  const [siguiente, setSiguiente] = useState(filas.length);
  const [tipos, setTipos] = useState<Record<number, string>>(() => Object.fromEntries(filas.map((f) => [f.key, f.v.practica_tipo])));
  const [periodos, setPeriodos] = useState<Record<number, string>>(() => Object.fromEntries(filas.map((f) => [f.key, f.v.periodo])));

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {filas.map((f, i) => (
          <li key={f.key} className="rounded-xl border border-slate-200 bg-white p-2.5 space-y-2">
            {f.v.renueva ? <input type="hidden" name={`r${f.key}_renueva`} value={f.v.renueva} /> : null}
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-[11px] text-slate-600 flex-1 min-w-[190px]">Práctica {i + 1}
                <select name={`r${f.key}_tipo`} required={obligatorio} defaultValue={f.v.practica_tipo} onChange={(e) => setTipos((t) => ({ ...t, [f.key]: e.target.value }))} className={`${inputCls} block mt-0.5 w-full`}>
                  <option value="" disabled={obligatorio}>{obligatorio ? "Elegí la práctica…" : "Sin práctica (completar después)"}</option>
                  {PRACTICAS.map((p) => <option key={p.codigo} value={p.codigo}>{p.label}</option>)}
                </select>
              </label>
              <label className="text-[11px] text-slate-600">Código de la OS
                <input name={`r${f.key}_codigo`} defaultValue={f.v.codigo ?? ""} maxLength={40} placeholder="opcional" className={`${inputCls} block mt-0.5 w-24`} />
              </label>
              <label className="text-[11px] text-slate-600">Cantidad
                <select name={`r${f.key}_cantidad`} defaultValue={String(f.v.cantidad)} className={`${inputCls} block mt-0.5`}>
                  {Array.from({ length: 30 }, (_, k) => k + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label className="text-[11px] text-slate-600">Unidad
                <select name={`r${f.key}_unidad`} defaultValue={f.v.unidad} className={`${inputCls} block mt-0.5`}>
                  {Object.entries(UNIDADES_FRECUENCIA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <span className="text-[11px] text-slate-500 pb-2">por</span>
              <label className="text-[11px] text-slate-600">Período
                <select name={`r${f.key}_periodo`} defaultValue={f.v.periodo} onChange={(e) => setPeriodos((p) => ({ ...p, [f.key]: e.target.value }))} className={`${inputCls} block mt-0.5`}>
                  {Object.entries(PERIODOS_FRECUENCIA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              {filas.length > 1 && (
                <button type="button" onClick={() => setFilas((x) => x.filter((y) => y.key !== f.key))} className="text-[11px] text-red-600 underline underline-offset-2 pb-2">Quitar</button>
              )}
            </div>
            {tipos[f.key] === "otros" && (
              <input name={`r${f.key}_aclaracion`} required defaultValue={f.v.aclaracion} placeholder="Aclaración: qué práctica es" className={`${inputCls} w-full`} />
            )}
            {(periodos[f.key] === "dia" || periodos[f.key] === "semana") && (
              <fieldset className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                <legend className="sr-only">Días de la semana</legend>
                <span>Días:</span>
                {DIAS.map(([v, l]) => (
                  <label key={v} className="flex items-center gap-0.5"><input type="checkbox" name={`r${f.key}_dias`} value={v} defaultChecked={f.v.dias.includes(Number(v))} /> {l}</label>
                ))}
                <span className="text-slate-400">(opcional: si no marcás días, Facturación controla que se cumpla la cantidad en la semana)</span>
              </fieldset>
            )}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          const key = siguiente;
          setSiguiente((n) => n + 1);
          setFilas((x) => [...x, { key, v: renglonVacio() }]);
          setPeriodos((p) => ({ ...p, [key]: "semana" }));
          setTipos((t) => ({ ...t, [key]: "" }));
        }}
        className="text-xs font-medium text-[var(--brand-teal)] underline underline-offset-2"
      >
        + Agregar otra práctica
      </button>
    </div>
  );
}
