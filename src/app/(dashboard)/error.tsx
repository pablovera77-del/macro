"use client";

import Link from "next/link";

/**
 * Pantalla de error general de la plataforma. Antes, cualquier fallo mostraba
 * la pantalla de error genérica de Next.js, sin explicar qué hacer. Los
 * errores esperados de negocio (DNI repetido, etc.) se muestran dentro de cada
 * formulario; esto cubre lo inesperado.
 */
export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="max-w-lg mx-auto mt-16 bg-white border border-red-200 rounded-2xl p-8 text-center space-y-4">
      <div className="mx-auto w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xl font-bold">!</div>
      <h1 className="text-lg font-semibold text-slate-900">No pudimos completar la acción</h1>
      <p className="text-sm text-slate-600">
        Puede ser un problema momentáneo o que falte algún dato. No se perdió nada de lo que ya estaba guardado.
      </p>
      <div className="flex items-center justify-center gap-3 flex-wrap">
        <button onClick={() => reset()} className="rounded-xl bg-slate-900 text-white text-sm font-medium px-4 py-2.5 hover:bg-slate-800">
          Reintentar
        </button>
        <Link href="/inicio" className="rounded-xl border border-slate-300 text-slate-700 text-sm font-medium px-4 py-2.5 hover:bg-slate-50">
          Volver al Inicio
        </Link>
      </div>
    </div>
  );
}
