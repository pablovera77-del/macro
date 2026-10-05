"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ActionResult } from "@/lib/facturacion";

/**
 * Formulario que muestra el error de la acción dentro de la propia pantalla, en castellano,
 * en vez de mandar a la pantalla de error general (en producción Next oculta el texto de
 * los errores lanzados). Si la acción sale bien, el aviso lo da `flash`.
 */
export default function ActionForm({
  action,
  className = "",
  children,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  className?: string;
  children: React.ReactNode;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {children}
      {state?.error && (
        <p role="alert" className="col-span-full basis-full w-full text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}
    </form>
  );
}

/** Botón de envío que se deshabilita mientras se guarda, para no mandar el formulario dos veces. */
export function SubmitButton({
  children,
  className = "",
  pendingLabel = "Guardando…",
}: {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${className} ${pending ? "opacity-60 cursor-wait" : ""}`}>
      {pending ? pendingLabel : children}
    </button>
  );
}
