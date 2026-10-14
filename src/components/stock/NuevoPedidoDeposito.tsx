"use client";

import { useState } from "react";
import ActionForm from "./ActionForm";
import SubmitButton from "./SubmitButton";
import UrgenciaFields from "./UrgenciaFields";
import SearchableSelect, { type SearchableOption } from "@/components/SearchableSelect";
import type { ActionState } from "@/lib/stock-types";

// Depósito arma un pedido: para un paciente o para un profesional asistencial (ej. una enfermera
// que necesita insumos para su recorrido). Puede llevar varias líneas y repetirse (semanal, quincenal, mensual).
export default function NuevoPedidoDeposito({
  action,
  pacientes,
  profesionales,
  productos,
  unidades,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  pacientes: SearchableOption[];
  profesionales: SearchableOption[];
  productos: SearchableOption[];
  unidades: { id: string; label: string }[];
}) {
  const [destino, setDestino] = useState<"paciente" | "profesional">("paciente");
  const [canal, setCanal] = useState("domicilio");
  const [lineas, setLineas] = useState<number[]>([1]);
  const [next, setNext] = useState(2);
  return (
    <ActionForm action={action} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
      <div className="sm:col-span-4 flex gap-2 text-sm">
        {(["paciente", "profesional"] as const).map((d) => (
          <label key={d} className={`flex-1 text-center rounded-xl border px-3 py-2.5 cursor-pointer ${destino === d ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-600"}`}>
            <input type="radio" name="destino" value={d} checked={destino === d} onChange={() => setDestino(d)} className="sr-only" />
            {d === "paciente" ? "Para un paciente" : "Para un profesional"}
          </label>
        ))}
      </div>
      {destino === "paciente" ? (
        <SearchableSelect name="patient_id" required placeholder="Paciente..." className="sm:col-span-4" options={pacientes} />
      ) : (
        <SearchableSelect name="profesional_id" required placeholder="Profesional..." className="sm:col-span-4" options={profesionales} />
      )}
      <p className="sm:col-span-4 text-xs text-slate-500 -mb-1">¿Qué lleva? Podés sumar todos los productos del pedido.</p>
      {lineas.map((k) => (
        <div key={k} className="sm:col-span-4 grid grid-cols-1 sm:grid-cols-[1fr_5rem_14rem_auto] gap-2 items-start">
          <SearchableSelect name="product_id" required placeholder="Producto..." options={productos} />
          <input name="cantidad" type="number" min="1" defaultValue="1" aria-label="Cantidad" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
          <select name="equipment_asset_id" aria-label="Unidad física" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm bg-white">
            <option value="">(sin unidad serializada)</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>{u.label}</option>
            ))}
          </select>
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
      <label className="sm:col-span-4 text-xs text-slate-600">
        ¿Se repite?
        <select name="frecuencia_renovacion" defaultValue="a_demanda" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm bg-white">
          <option value="a_demanda">No, es un pedido único</option>
          <option value="semanal">Se renueva cada semana</option>
          <option value="quincenal">Se renueva cada quincena</option>
          <option value="mensualizado">Se renueva cada mes</option>
        </select>
      </label>
      <select
        name="canal_entrega"
        value={canal}
        onChange={(e) => setCanal(e.target.value)}
        aria-label="Cómo se entrega"
        className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm bg-white sm:col-span-2"
      >
        <option value="domicilio">Entrega a domicilio</option>
        <option value="retiro_local">Retiro en el local</option>
      </select>
      <UrgenciaFields className="sm:col-span-2" />
      {destino === "profesional" && canal === "domicilio" && (
        <input name="direccion_entrega" required placeholder="Dirección donde se entrega" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm sm:col-span-4" />
      )}
      <SubmitButton className="rounded-xl bg-slate-900 text-white text-sm font-medium px-4 py-2.5 hover:bg-slate-800 transition-colors sm:col-span-4">
        Crear pedido
      </SubmitButton>
    </ActionForm>
  );
}
