"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { cargarAutorizacionesAction, renovarAutorizacionesAction, type AutorizacionState } from "@/app/(dashboard)/internacion/actions";
import { PERIODOS_FRECUENCIA, PRACTICAS, UNIDADES_FRECUENCIA } from "@/lib/autorizaciones";

export type RenglonInicial = {
  renueva?: number;
  practica_tipo: string;
  aclaracion: string;
  cantidad: number;
  unidad: string;
  periodo: string;
  dias: number[];
};

const inputCls = "rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs";
const DIAS = [["1", "L"], ["2", "M"], ["3", "X"], ["4", "J"], ["5", "V"], ["6", "S"], ["7", "D"]] as const;
const vacio = (): RenglonInicial => ({ practica_tipo: "", aclaracion: "", cantidad: 1, unidad: "visita", periodo: "semana", dias: [] });

/**
 * Carga de autorizaciones (H3) y renovación (H4): un renglón por práctica, con lista, frecuencia y días.
 * En la renovación los renglones vienen precargados con lo de la autorización anterior y se pueden editar.
 */
export default function AutorizacionesForm({
  patientId,
  modo,
  inicial,
  desdeSugerido,
  conStock,
}: {
  patientId: string;
  modo: "cargar" | "renovar";
  inicial?: RenglonInicial[];
  desdeSugerido?: string;
  conStock?: boolean;
}) {
  const accion = modo === "renovar" ? renovarAutorizacionesAction : cargarAutorizacionesAction;
  const [state, formAction, pending] = useActionState<AutorizacionState, FormData>(accion, { error: null });
  const [, startSubmit] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [filas, setFilas] = useState<{ key: number; v: RenglonInicial }[]>(() =>
    (inicial && inicial.length > 0 ? inicial : [vacio()]).map((v, i) => ({ key: i, v }))
  );
  const [siguiente, setSiguiente] = useState(filas.length);
  const [tipos, setTipos] = useState<Record<number, string>>(() => Object.fromEntries(filas.map((f) => [f.key, f.v.practica_tipo])));
  const [periodos, setPeriodos] = useState<Record<number, string>>(() => Object.fromEntries(filas.map((f) => [f.key, f.v.periodo])));

  return (
    <form
      ref={formRef}
      // Se envía con onSubmit para que React no borre lo escrito si el servidor devuelve un error.
      onSubmit={(e) => {
        e.preventDefault();
        if (!formRef.current) return;
        const fd = new FormData(formRef.current);
        startSubmit(() => formAction(fd));
      }}
      className="space-y-3"
    >
      <input type="hidden" name="patient_id" value={patientId} />
      <div className="flex flex-wrap gap-3">
        <label className="text-[11px] text-slate-600">{modo === "renovar" ? "Inicio de la nueva autorización" : "Ingreso al servicio (inicio de la autorización)"}
          <input name="periodo_desde" type="date" required defaultValue={desdeSugerido} className={`${inputCls} block mt-0.5`} />
        </label>
        <label className="text-[11px] text-slate-600">Vencimiento de la autorización
          <input name="periodo_hasta" type="date" required className={`${inputCls} block mt-0.5`} />
        </label>
      </div>

      <ul className="space-y-2">
        {filas.map((f, i) => (
          <li key={f.key} className="rounded-xl border border-slate-200 bg-white p-2.5 space-y-2">
            {f.v.renueva ? <input type="hidden" name={`r${f.key}_renueva`} value={f.v.renueva} /> : null}
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-[11px] text-slate-600 flex-1 min-w-[190px]">Práctica {i + 1}
                <select name={`r${f.key}_tipo`} required defaultValue={f.v.practica_tipo} onChange={(e) => setTipos((t) => ({ ...t, [f.key]: e.target.value }))} className={`${inputCls} block mt-0.5 w-full`}>
                  <option value="" disabled>Elegí la práctica…</option>
                  {PRACTICAS.map((p) => <option key={p.codigo} value={p.codigo}>{p.label}</option>)}
                </select>
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
              <label className="text-[11px] text-slate-600">Por
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
                <span className="text-slate-400">(opcional: con los días marcados Facturación controla cada visita)</span>
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
          setFilas((x) => [...x, { key, v: vacio() }]);
          setPeriodos((p) => ({ ...p, [key]: "semana" }));
          setTipos((t) => ({ ...t, [key]: "" }));
        }}
        className="text-xs font-medium text-[var(--brand-teal)] underline underline-offset-2"
      >
        + Agregar otra práctica
      </button>

      {modo === "renovar" && conStock && (
        <label className="flex items-center gap-2 text-xs text-slate-700">
          <input type="checkbox" name="heredar_stock" defaultChecked /> Renovar también los insumos, el alimento y los equipos autorizados (con el mismo período)
        </label>
      )}

      {state.error && <p role="alert" className="text-xs rounded-lg px-3 py-2 border bg-red-50 border-red-200 text-red-700">{state.error}</p>}
      {state.ok && !state.error && <p role="status" className="text-xs rounded-lg px-3 py-2 border bg-emerald-50 border-emerald-200 text-emerald-800">Guardado.</p>}
      <button disabled={pending} className="rounded-lg bg-slate-900 text-white text-xs font-medium px-3 py-2 hover:bg-slate-800 disabled:opacity-60">
        {pending ? "Guardando…" : modo === "renovar" ? "Crear la renovación" : "Autorizar"}
      </button>
    </form>
  );
}
