import ActionDisclosure from "@/components/ActionDisclosure";
import ActionForm, { SubmitButton } from "@/components/facturacion/ActionForm";
import { formatARS, MODALIDAD_LABELS } from "@/lib/facturacion";
import type { Database } from "@/types/database";
import { updateBillingTotalAction } from "./actions";

type Cierre = Database["public"]["Views"]["v_cierre_sugerido"]["Row"];

// Total del cierre (C4-18): el sistema sugiere valor vigente x módulos de pacientes al día;
// Administración lo puede corregir mientras el período no se haya presentado.
export default function TotalDelCierre({
  periodId,
  totalActual,
  cierre,
  puedeEditar,
}: {
  periodId: string;
  totalActual: number | null;
  cierre: Cierre | undefined;
  puedeEditar: boolean;
}) {
  if (!cierre) return null;
  const porPrestaciones = cierre.modalidad_facturacion === "prestaciones";
  const verdes = cierre.modulos_verdes ?? 0;
  const enCurso = cierre.modulos_en_curso ?? 0;
  const sugerido = cierre.total_sugerido;
  const proyectado = cierre.total_proyectado;

  return (
    <div className="mt-3 text-xs text-slate-500 space-y-1">
      {porPrestaciones ? (
        <p>Esta obra social factura {MODALIDAD_LABELS.prestaciones.toLowerCase()}: el total se carga a mano.</p>
      ) : cierre.valor_vigente == null ? (
        <p>No hay un valor de módulo cargado para esta obra social, así que no se puede sugerir el total. Cargalo en Obras sociales.</p>
      ) : (
        <>
          <p>
            <span className="font-medium text-slate-700">Total sugerido: {formatARS(sugerido)}</span>{" "}
            ({verdes} módulo{verdes === 1 ? "" : "s"} al día × {formatARS(cierre.valor_vigente)})
            {(cierre.pacientes_excluidos ?? 0) > 0 && <> · {cierre.pacientes_excluidos} paciente(s) dejado(s) fuera</>}
          </p>
          {enCurso > 0 && (
            <p>
              Hay {enCurso} módulo{enCurso === 1 ? "" : "s"} con el mes en curso: si se completan, el total sería {formatARS(proyectado)}.
            </p>
          )}
          {(cierre.pacientes_rojos ?? 0) > 0 && <p>{cierre.pacientes_rojos} paciente(s) en rojo no suman hasta que se corrijan.</p>}
        </>
      )}
      {puedeEditar && (
        <ActionDisclosure label="Corregir el total" tone="subtle">
          <ActionForm action={updateBillingTotalAction} className="flex flex-wrap gap-2 items-center">
            <input type="hidden" name="billing_period_id" value={periodId} />
            <input
              name="total_facturado"
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={totalActual ?? sugerido ?? ""}
              aria-label="Total a facturar"
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs w-44"
            />
            <SubmitButton className="rounded-lg bg-slate-900 text-white text-xs font-medium px-3 py-1.5 hover:bg-slate-800 transition-colors">Guardar total</SubmitButton>
          </ActionForm>
          {sugerido != null && sugerido > 0 && sugerido !== totalActual && (
            <ActionForm action={updateBillingTotalAction} className="mt-2">
              <input type="hidden" name="billing_period_id" value={periodId} />
              <input type="hidden" name="total_facturado" value={sugerido} />
              <SubmitButton className="rounded-lg bg-white text-slate-700 border border-slate-300 text-xs font-medium px-3 py-1.5 hover:bg-slate-50 transition-colors">
                Usar el sugerido ({formatARS(sugerido)})
              </SubmitButton>
            </ActionForm>
          )}
        </ActionDisclosure>
      )}
    </div>
  );
}
