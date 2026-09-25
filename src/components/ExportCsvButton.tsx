"use client";

// DF-C5 §3: exportación CSV del catálogo — el sistema viejo (informe-tecnico
// §1.1) no permitía exportar el listado de stock, solo verlo filtrado en
// pantalla. Genera el CSV en el cliente a partir de las filas ya cargadas
// en la página (sin ida y vuelta al servidor).
export default function ExportCsvButton({
  rows,
  filename,
  label = "Exportar CSV",
  className = "",
}: {
  rows: Record<string, string | number | null | undefined>[];
  filename: string;
  label?: string;
  className?: string;
}) {
  function handleExport() {
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const escape = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      headers.join(";"),
      ...rows.map((r) => headers.map((h) => escape(r[h])).join(";")),
    ];
    const csv = "﻿" + lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={rows.length === 0}
      className={`rounded-xl border border-slate-300 text-slate-600 text-sm font-medium px-3 py-2 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
    >
      {label}
    </button>
  );
}
