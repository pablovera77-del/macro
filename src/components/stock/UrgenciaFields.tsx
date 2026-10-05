"use client";

import { useState } from "react";

// Prioridad del pedido: si es urgente hay que decir por qué (queda visible para Depósito y Transporte).
export default function UrgenciaFields({ className = "" }: { className?: string }) {
  const [prioridad, setPrioridad] = useState("normal");
  return (
    <>
      <select
        name="prioridad"
        value={prioridad}
        onChange={(e) => setPrioridad(e.target.value)}
        aria-label="Prioridad"
        className={`rounded-xl border border-slate-300 px-3 py-2.5 text-sm bg-white ${className}`}
      >
        <option value="normal">Prioridad normal</option>
        <option value="urgente">Urgente</option>
      </select>
      {prioridad === "urgente" && (
        <input
          name="motivo_urgencia"
          required
          placeholder="¿Por qué es urgente? (obligatorio)"
          className="rounded-xl border border-red-300 bg-red-50 px-3 py-2.5 text-sm sm:col-span-2"
        />
      )}
    </>
  );
}
