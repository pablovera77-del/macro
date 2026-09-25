"use client";

import { useMemo, useRef, useState, useEffect } from "react";

export type SearchableOption = {
  value: string;
  label: string;
  group?: string;
};

// DF-C5 §3/§4/§6: reemplaza los `<select>` planos de cientos de opciones que
// el informe técnico del sistema viejo señala como el problema de UX más
// grave (§6.1) — combobox con autocompletado "escribir para buscar",
// agrupado por categoría cuando corresponde. Sigue enviando un <select>
// nativo oculto con el mismo `name`, para que las server actions existentes
// (que leen formData.get(name)) no necesiten cambiar.
export default function SearchableSelect({
  name,
  options,
  placeholder = "Buscar...",
  required = false,
  defaultValue = "",
  className = "",
}: {
  name: string;
  options: SearchableOption[];
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [query, options]);

  const groups = useMemo(() => {
    const map = new Map<string, SearchableOption[]>();
    for (const opt of filtered) {
      const key = opt.group ?? "";
      const list = map.get(key) ?? [];
      list.push(opt);
      map.set(key, list);
    }
    return map;
  }, [filtered]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <input type="hidden" name={name} value={value} required={required} />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left rounded-xl border border-slate-300 px-3 py-2.5 text-sm bg-white transition-shadow focus:outline-none focus:ring-2 focus:ring-slate-300 flex items-center justify-between gap-2"
      >
        <span className={selected ? "text-slate-900" : "text-slate-400"}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="text-slate-400 text-xs">▾</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg max-h-72 overflow-hidden flex flex-col">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Escribí para buscar..."
            className="border-b border-slate-100 px-3 py-2 text-sm focus:outline-none"
          />
          <div className="overflow-y-auto">
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-xs text-slate-400 text-center">Sin resultados.</div>
            )}
            {Array.from(groups.entries()).map(([group, opts]) => (
              <div key={group || "_"}>
                {group && (
                  <div className="px-3 py-1 text-[11px] uppercase tracking-wide text-slate-400 bg-slate-50 sticky top-0">
                    {group}
                  </div>
                )}
                {opts.map((o) => (
                  <button
                    type="button"
                    key={o.value}
                    onClick={() => {
                      setValue(o.value);
                      setQuery("");
                      setOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${o.value === value ? "bg-slate-100 font-medium text-slate-900" : "text-slate-700"}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
