import ActionForm from "./ActionForm";
import SubmitButton from "./SubmitButton";
import type { ActionState } from "@/lib/stock-types";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

// Depósito revisa una línea de la solicitud: aceptarla tal cual, ajustar la cantidad o rechazarla
// (en esos dos casos con motivo, que le llega a quien la pidió).
export default function ItemReviewControls({ action, itemId, cantidad }: { action: Action; itemId: number; cantidad: number }) {
  return (
    <div className="flex flex-wrap items-start gap-1.5 mt-1.5">
      <ActionForm action={action} className="inline">
        <input type="hidden" name="item_id" value={itemId} />
        <input type="hidden" name="decision" value="aceptar" />
        <SubmitButton className="rounded-lg bg-emerald-600 text-white text-xs font-medium px-3 py-1.5 hover:bg-emerald-700">Aceptar</SubmitButton>
      </ActionForm>
      <details className="group">
        <summary className="list-none rounded-lg border border-slate-300 text-slate-700 text-xs font-medium px-3 py-1.5 cursor-pointer select-none hover:bg-slate-50">Ajustar cantidad</summary>
        <ActionForm action={action} className="mt-1.5 flex flex-wrap gap-1.5 items-center">
          <input type="hidden" name="item_id" value={itemId} />
          <input type="hidden" name="decision" value="ajustar" />
          <input name="cantidad" type="number" min="1" defaultValue={cantidad} aria-label="Cantidad que se entrega" className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
          <input name="motivo" required placeholder="Motivo del ajuste" className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm flex-1 min-w-[10rem]" />
          <SubmitButton className="rounded-lg bg-slate-900 text-white text-xs font-medium px-3 py-1.5">Guardar</SubmitButton>
        </ActionForm>
      </details>
      <details className="group">
        <summary className="list-none rounded-lg border border-red-200 text-red-700 bg-red-50 text-xs font-medium px-3 py-1.5 cursor-pointer select-none hover:bg-red-100">Rechazar</summary>
        <ActionForm action={action} className="mt-1.5 flex flex-wrap gap-1.5 items-center">
          <input type="hidden" name="item_id" value={itemId} />
          <input type="hidden" name="decision" value="rechazar" />
          <input name="motivo" required placeholder="Motivo (ej. sin stock)" className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm flex-1 min-w-[10rem]" />
          <SubmitButton className="rounded-lg bg-red-600 text-white text-xs font-medium px-3 py-1.5">Rechazar</SubmitButton>
        </ActionForm>
      </details>
    </div>
  );
}
