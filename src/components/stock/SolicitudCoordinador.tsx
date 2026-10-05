"use client";

import { useState } from "react";
import ActionForm from "./ActionForm";
import SubmitButton from "./SubmitButton";
import UrgenciaFields from "./UrgenciaFields";
import SearchableSelect, { type SearchableOption } from "@/components/SearchableSelect";
import type { ActionState } from "@/lib/stock-types";

// Coordinación pide insumos para uno de sus pacientes. Puede sumar varias líneas; Depósito después
// acepta, ajusta o rechaza cada una (con motivo).
export default function SolicitudCoordinador({
  action,
  pacientes,
  productos,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  pacientes: SearchableOption[];
  productos: SearchableOption[];
}) {
  const [lineas, setLineas] = useState<number[]>([1]);
  const [next, setNext] = useState(2);
  return (
    <ActionForm action={action} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
      <SearchableSelect name="patient_id" required placeholder="¿Para qué paciente?" className="sm:col-span-4" options={pacientes} />
      <p className="sm:col-span-4 text-xs text-slate-500 -mb-1">¿Qué necesita? Podés sumar todas las líneas que hagan falta.</p>
      {lineas.map((k) => (
        <div key={k} className="sm:col-span-4 grid grid-cols-[1fr_5rem_auto] gap-2 items-start">
          <SearchableSelect name="product_id" placeholder="Producto..." options={productos} />
          <input name="cantidad" type="number" min="1" defaultValue="1" aria-label="Cantidad" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
          {lineas.length > 1 ? (
            <button type="button" onClick={() => setLineas((l) => l.filter((x) => x !== k))} aria-label="Quitar esta línea" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-500 hover:bg-slate-50">
              ×
            </button>
          ) : (
            <span />
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => {
          setLineas((l) => [...l, next]);
          setNext((n) => n + 1);
        }}
        className="sm:col-span-4 rounded-xl border border-dashed border-slate-300 text-slate-600 text-sm px-3 py-2.5 hover:bg-slate-50"
      >
        + Sumar otro producto
      </button>
      <select name="canal_entrega" defaultValue="domicilio" aria-label="Cómo se entrega" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm bg-white sm:col-span-2">
        <option value="domicilio">Entrega a domicilio</option>
        <option value="retiro_local">Retiro en el local</option>
      </select>
      <UrgenciaFields className="sm:col-span-2" />
      <SubmitButton className="rounded-xl bg-slate-900 text-white text-sm font-medium px-4 py-2.5 hover:bg-slate-800 transition-colors sm:col-span-4">
        Enviar solicitud a Depósito
      </SubmitButton>
    </ActionForm>
  );
}
