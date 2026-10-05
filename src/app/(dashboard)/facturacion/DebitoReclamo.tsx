import ActionDisclosure from "@/components/ActionDisclosure";
import ActionForm, { SubmitButton } from "@/components/facturacion/ActionForm";
import StatusBadge from "@/components/StatusBadge";
import { fechaCorta } from "@/lib/facturacion";
import { updateDebitResubmisionAction } from "./actions";

// Seguimiento del reclamo de un débito (C4-44): si se puede reclamar, cuándo se volvió a
// presentar y notas de la gestión.
export default function DebitoReclamo({
  debitId,
  reclamable,
  fecha,
  notas,
  puedeEditar,
}: {
  debitId: number;
  reclamable: boolean;
  fecha: string | null;
  notas: string | null;
  puedeEditar: boolean;
}) {
  return (
    <div className="w-full pl-0 sm:pl-2">
      <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500">
        {reclamable && <StatusBadge tone="amarillo" label="Se puede reclamar" />}
        {fecha && <StatusBadge tone="gris" label={`Reenviado el ${fechaCorta(fecha)}`} />}
        {notas && <span>{notas}</span>}
      </div>
      {puedeEditar && (
        <ActionDisclosure label="Reclamo" tone="subtle" className="!mt-1.5">
          <ActionForm action={updateDebitResubmisionAction} className="flex flex-wrap gap-2 items-center">
            <input type="hidden" name="debit_id" value={debitId} />
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <input type="checkbox" name="reclamable" defaultChecked={reclamable} className="rounded border-slate-300" /> Se puede reclamar
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              Reenviado el
              <input type="date" name="fecha_resubmision" defaultValue={fecha ?? ""} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
            </label>
            <input name="resubmision_notas" defaultValue={notas ?? ""} placeholder="Notas del reclamo" className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs flex-1 min-w-[180px]" />
            <SubmitButton className="rounded-lg bg-slate-900 text-white text-xs font-medium px-3 py-1.5 hover:bg-slate-800 transition-colors">Guardar</SubmitButton>
          </ActionForm>
        </ActionDisclosure>
      )}
    </div>
  );
}
