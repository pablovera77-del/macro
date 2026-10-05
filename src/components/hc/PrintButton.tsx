"use client";

/** Abre el diálogo de impresión del navegador (desde ahí también se guarda como PDF). */
export default function PrintButton({ label = "Imprimir o guardar PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800 transition-colors"
    >
      {label}
    </button>
  );
}
