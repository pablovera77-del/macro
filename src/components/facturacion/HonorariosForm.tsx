"use client";

import { useActionState, useRef, useTransition } from "react";
import { guardarHonorariosAction } from "@/app/(dashboard)/honorarios/actions";
import { PRACTICAS } from "@/lib/autorizaciones";
import type { ActionState } from "@/lib/stock-types";

export default function HonorariosForm({ valores }: { valores: Record<string, number> }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(guardarHonorariosAction, { error: null });
  const [, startSubmit] = useTransition();
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      onSubmit={(e) => {
        e.preventDefault();
        if (ref.current) startSubmit(() => formAction(new FormData(ref.current!)));
      }}
      className="space-y-3"
    >
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {PRACTICAS.map((p) => (
          <li key={p.codigo} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
            <label htmlFor={`h-${p.codigo}`} className="text-sm text-slate-700">{p.label}</label>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-400">$</span>
              <input id={`h-${p.codigo}`} name={`costo_${p.codigo}`} inputMode="decimal" defaultValue={valores[p.codigo] ?? ""} placeholder="sin cargar" className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-right tabular-nums" />
            </div>
          </li>
        ))}
      </ul>
      {state.error && <p role="alert" className="text-sm rounded-lg px-3 py-2 border bg-red-50 border-red-200 text-red-700">{state.error}</p>}
      <button disabled={pending} className="rounded-lg bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800 disabled:opacity-60">{pending ? "Guardando…" : "Guardar honorarios"}</button>
    </form>
  );
}
