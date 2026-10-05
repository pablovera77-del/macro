import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SEMANTIC_TONE_PANEL_STYLES, type SemanticTone } from "@/lib/semantic-status";
import StatusBadge from "@/components/StatusBadge";
import { formatARS } from "@/lib/facturacion";

// Tablero de cobros por estado (C4-41 / C4-02): cuántos períodos hay en cada etapa de cobro
// y por cuánta plata. "Presentada" es el estado interno `facturado`.
const ESTADOS: { estado: string; label: string; tone: SemanticTone; ayuda: string }[] = [
  { estado: "facturado", label: "Presentada", tone: "gris", ayuda: "Ya se la mandamos a la obra social y esperamos el pago." },
  { estado: "cobrada", label: "Cobrada", tone: "verde", ayuda: "La obra social pagó." },
  { estado: "debitada", label: "Debitada", tone: "rojo", ayuda: "La obra social rechazó parte o todo; hay que gestionarlo." },
  { estado: "en_gestion", label: "En gestión", tone: "amarillo", ayuda: "Estamos reclamando el débito." },
];

export default async function CobrosPorEstado({ href }: { href?: string }) {
  const supabase = await createClient();
  const { data: periodos } = await supabase.from("billing_periods").select("estado, total_facturado, monto_cobrado");

  const filas = ESTADOS.map((e) => {
    const del = (periodos ?? []).filter((p) => p.estado === e.estado);
    const monto = del.reduce((acc, p) => acc + (e.estado === "cobrada" ? (p.monto_cobrado ?? p.total_facturado ?? 0) : (p.total_facturado ?? 0)), 0);
    return { ...e, cantidad: del.length, monto };
  });
  const sinNada = filas.every((f) => f.cantidad === 0);

  return (
    <section className="animate-fade-slide-up" aria-label="Cobros por estado">
      <h2 className="text-sm font-medium text-slate-900 mb-3 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-900" /> Cobros por estado
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {filas.map((f) => {
          const panel = SEMANTIC_TONE_PANEL_STYLES[f.tone];
          const contenido = (
            <>
              <StatusBadge tone={f.tone} label={f.label} />
              <div className="text-2xl font-semibold tabular-nums text-slate-900 mt-2">{f.cantidad}</div>
              <div className="text-xs text-slate-500">{f.cantidad === 1 ? "período" : "períodos"}</div>
              <div className={`text-sm font-semibold tabular-nums mt-1 ${panel.title}`}>{formatARS(f.monto)}</div>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">{f.ayuda}</p>
            </>
          );
          const clase = `rounded-2xl border p-4 block ${panel.bg} ${panel.border}`;
          return href ? (
            <Link key={f.estado} href={href} className={`${clase} card-hover`}>{contenido}</Link>
          ) : (
            <div key={f.estado} className={clase}>{contenido}</div>
          );
        })}
      </div>
      {sinNada && <p className="text-xs text-slate-400 mt-3">Todavía no hay períodos presentados. Cuando se presente el primero, aparece acá.</p>}
    </section>
  );
}
