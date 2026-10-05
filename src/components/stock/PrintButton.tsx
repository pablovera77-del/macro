"use client";

// Abre el cuadro de impresión del navegador: ahí también se puede «Guardar como PDF».
export default function PrintButton({ label = "Imprimir o guardar como PDF", className = "" }: { label?: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={`rounded-xl bg-slate-900 text-white text-sm font-medium px-4 py-2.5 hover:bg-slate-800 transition-colors ${className}`}
    >
      {label}
    </button>
  );
}
