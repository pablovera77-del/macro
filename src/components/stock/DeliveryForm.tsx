"use client";

import ActionForm from "./ActionForm";
import SubmitButton from "./SubmitButton";
import SignaturePad from "./SignaturePad";
import PhotoField from "./PhotoField";
import GeoFields from "./GeoFields";
import { useGeolocation } from "./useGeolocation";
import type { ActionState } from "@/lib/stock-types";

// Entrega (o retiro en el local) con firma táctil del familiar. Para cada equipo se registra
// foto y estado de condición. La ubicación se toma cuando empieza la firma.
export default function DeliveryForm({
  action,
  orderId,
  retiroLocal,
  equipos,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  orderId: string;
  retiroLocal: boolean;
  equipos: { assetId: string; label: string }[];
}) {
  const { geo, pedir } = useGeolocation();
  return (
    <ActionForm action={action} className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 w-full">
      <input type="hidden" name="order_id" value={orderId} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input name="firmante_nombre" required placeholder="Nombre de quien firma" className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2" />
        <input name="firmante_dni" inputMode="numeric" placeholder="DNI (si lo tiene)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <select name="firmante_vinculo" defaultValue="familiar" aria-label="Vínculo con el paciente" className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white sm:col-span-3">
          <option value="familiar">Es familiar o responsable del paciente</option>
          <option value="paciente">Es el propio paciente</option>
          <option value="profesional">Es el profesional que lo recibe</option>
          <option value="otro">Otra persona</option>
        </select>
      </div>

      {equipos.map((eq) => (
        <fieldset key={eq.assetId} className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
          <legend className="px-1 text-xs font-medium text-slate-700">Equipo: {eq.label}</legend>
          <select name={`condicion_${eq.assetId}`} defaultValue="" required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white">
            <option value="" disabled>Estado del equipo al entregarlo…</option>
            <option value="Buen estado">Buen estado, funcionando</option>
            <option value="Con detalles">Con detalles (los describo abajo)</option>
          </select>
          <input name={`nota_${eq.assetId}`} placeholder="Detalle del estado (si hace falta)" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <PhotoField name={`foto_${eq.assetId}`} label="Foto del equipo" required />
        </fieldset>
      ))}

      <div className="space-y-1.5">
        <span className="text-xs font-medium text-slate-700">Firma de quien recibe</span>
        <SignaturePad onStart={pedir} />
      </div>
      <GeoFields geo={geo} onRetry={pedir} />
      <SubmitButton className="w-full sm:w-auto rounded-lg bg-emerald-600 text-white text-sm font-medium px-4 py-2.5 hover:bg-emerald-700 transition-colors" pendingLabel="Confirmando…">
        {retiroLocal ? "Confirmar retiro y firma" : "Confirmar entrega y firma"}
      </SubmitButton>
    </ActionForm>
  );
}
