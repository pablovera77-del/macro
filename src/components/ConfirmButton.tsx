"use client";

import { useEffect, useState } from "react";

/**
 * Botón de envío con confirmación de un segundo toque, para acciones que no se
 * pueden deshacer (cancelar una visita, dar de baja, quitar un plan). El primer
 * toque lo «arma» y cambia el texto; el segundo envía el formulario. Si no se
 * confirma en 4 segundos vuelve a su estado normal. Sin ventanas emergentes,
 * que en el celular se pierden con facilidad.
 */
export default function ConfirmButton({
  children,
  confirmLabel = "¿Seguro? Tocá de nuevo",
  className = "",
  armedClassName = "ring-2 ring-red-500 ring-offset-1 font-semibold",
}: {
  children: React.ReactNode;
  confirmLabel?: string;
  className?: string;
  armedClassName?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="submit"
      onClick={(e) => {
        if (!armed) {
          e.preventDefault();
          setArmed(true);
        } else {
          // El segundo toque envía el formulario; el botón vuelve a su estado normal para que no quede «armado».
          setTimeout(() => setArmed(false), 0);
        }
      }}
      className={armed ? `${className} ${armedClassName}` : className}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}
