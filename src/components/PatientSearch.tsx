"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { searchPatientsAction, type PatientHit } from "@/app/(dashboard)/actions";
import StatusBadge from "@/components/StatusBadge";
import type { SemanticTone } from "@/lib/semantic-status";

const ESTADO: Record<string, { label: string; tone: SemanticTone }> = {
  admitido_pendiente_llegada: { label: "Admitido, pendiente de llegada", tone: "amarillo" },
  activo: { label: "Activo", tone: "verde" },
  dado_de_baja: { label: "Dado de baja", tone: "gris" },
};

export default function PatientSearch() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<PatientHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- búsqueda con debounce: el estado de carga acompaña al pedido al servidor */
  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const r = await searchPatientsAction(q);
        if (!cancelled) setHits(r);
      } catch {
        if (!cancelled) setHits([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const showPanel = open && q.trim().length >= 2;

  return (
    <div ref={box} className="relative w-full sm:max-w-sm">
      <label htmlFor="buscador-pacientes" className="sr-only">
        Buscar paciente por nombre o DNI
      </label>
      <input
        id="buscador-pacientes"
        type="search"
        autoComplete="off"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Buscar paciente por nombre o DNI"
        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
      />
      {showPanel && (
        <div className="absolute z-30 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
          {loading && hits.length === 0 ? (
            <div className="px-4 py-3 text-xs text-slate-400">Buscando…</div>
          ) : hits.length === 0 ? (
            <div className="px-4 py-3 text-xs text-slate-500">No encontramos pacientes con ese nombre o DNI.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {hits.map((h) => {
                const e = ESTADO[h.estado];
                return (
                  <li key={h.id}>
                    <Link
                      href={`/paciente/${h.id}`}
                      onClick={() => {
                        setOpen(false);
                        setQ("");
                      }}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-slate-900 truncate">{h.nombre_completo}</span>
                        <span className="block text-xs text-slate-400">{h.dni ? `DNI ${h.dni}` : "Sin DNI cargado"}</span>
                      </span>
                      {e && <StatusBadge tone={e.tone} label={e.label} className="shrink-0" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
