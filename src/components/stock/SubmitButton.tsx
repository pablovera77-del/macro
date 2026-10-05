"use client";

import { useFormStatus } from "react-dom";

// Botón de envío que se bloquea y avisa «Guardando…» mientras la acción se procesa
// (evita el doble toque, sobre todo con conexión lenta en el celular).
export default function SubmitButton({
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
    <button type="submit" disabled={pending} className={`${className} disabled:opacity-60`}>
      {pending ? pendingLabel : children}
    </button>
  );
}
