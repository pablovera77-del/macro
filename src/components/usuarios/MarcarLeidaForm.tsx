"use client";

import ActionForm, { SubmitButton } from "@/components/facturacion/ActionForm";
import { marcarLeidaAction } from "@/app/(dashboard)/notificaciones/actions";

export default function MarcarLeidaForm({ id, label = "Marcar como leído", className = "" }: { id?: string; label?: string; className?: string }) {
  return (
    <ActionForm action={marcarLeidaAction}>
      {id && <input type="hidden" name="id" value={id} />}
      <SubmitButton className={`rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-medium px-3 py-1.5 hover:bg-slate-50 ${className}`} pendingLabel="…">
        {label}
      </SubmitButton>
    </ActionForm>
  );
}
