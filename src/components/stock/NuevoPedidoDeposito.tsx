"use client";

import { useState } from "react";
import ActionForm from "./ActionForm";
import SubmitButton from "./SubmitButton";
import UrgenciaFields from "./UrgenciaFields";
import SearchableSelect, { type SearchableOption } from "@/components/SearchableSelect";
import type { ActionState } from "@/lib/stock-types";

// Depósito arma un pedido: para un paciente o para un profesional asistencial (ej. una enfermera
// que necesita insumos para su recorrido).
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
      <SearchableSelect name="product_id" required placeholder="Producto..." className="sm:col-span-3" options={productos} />
      <input name="cantidad" type="number" min="1" defaultValue="1" aria-label="Cantidad" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
      <select name="equipment_asset_id" aria-label="Unidad física" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm sm:col-span-4 bg-white">
        <option value="">(sin unidad serializada)</option>
        {unidades.map((u) => (
          <option key={u.id} value={u.id}>{u.label}</option>
        ))}
      </select>
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
