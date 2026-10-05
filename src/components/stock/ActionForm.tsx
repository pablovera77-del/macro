"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/stock-types";

// Formulario que muestra, en castellano y debajo de los botones, el motivo por el que una
// acción no se pudo hacer. Las acciones devuelven { error } en vez de lanzar el error.
export default function ActionForm({
  action,
  children,
  className = "",
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, { error: null });
  return (
    <form action={formAction} className={className}>
      {children}
      {state.error && (
        <p role="alert" className="col-span-full basis-full w-full text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}
    </form>
  );
}
