"use client";

import { useRef, useState, useTransition } from "react";
import { addEvolutionNoteAction } from "@/app/(dashboard)/evoluciones/actions";
import ActionDisclosure from "@/components/ActionDisclosure";
import ConfirmButton from "@/components/ConfirmButton";
import DictadoButton from "@/components/hc/DictadoButton";

/**
 * Una evolución firmada no se edita: la corrección se agrega como nota aclaratoria, que queda
 * al lado del original con autor y fecha y ya no se puede borrar ni cambiar (por eso pide confirmar).
 */
export default function NotaAclaratoria({ evolutionId }: { evolutionId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);

  return (
    <ActionDisclosure label="Agregar nota aclaratoria" tone="subtle">
      <form
        className="space-y-2"
        onSubmit={(ev) => {
          ev.preventDefault();
          setError(null);
          const form = ev.currentTarget;
          const fd = new FormData(form);
          startTransition(async () => {
            try {
              const r = await addEvolutionNoteAction(fd);
              if (r?.error) setError(r.error);
              else form.reset();
            } catch {
              setError("No se pudo enviar la nota. Revisá la conexión y probá de nuevo; el texto sigue acá.");
            }
          });
        }}
      >
        <input type="hidden" name="evolution_id" value={evolutionId} />
        <p className="text-xs text-slate-500">
          La evolución firmada no se modifica. Escribí la aclaración o corrección: queda guardada junto al original, con tu nombre y la fecha, y no se puede borrar.
        </p>
        <textarea ref={ref} name="texto" required rows={3} maxLength={4000} className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm w-full" placeholder="Ej.: donde dice FC 78 debe decir FC 87." />
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <DictadoButton target={ref} />
          <ConfirmButton
            confirmLabel="¿Seguro? No se puede borrar. Tocá de nuevo"
            className={`rounded-lg bg-slate-900 text-white text-xs font-medium px-4 py-2 hover:bg-slate-800 transition-colors ${pending ? "opacity-60 pointer-events-none" : ""}`}
          >
            {pending ? "Guardando…" : "Guardar nota"}
          </ConfirmButton>
        </div>
        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            {error}
          </div>
        )}
      </form>
    </ActionDisclosure>
  );
}
