"use client";

import { useState } from "react";
import ActionForm, { SubmitButton } from "@/components/facturacion/ActionForm";
import { saveSalesQuoteAction } from "@/app/(dashboard)/presupuestos/actions";
import { formatARS } from "@/lib/facturacion";

export type HonorarioOpt = { label: string; costo: number };

export type ObraSocialOpt = { id: string; nombre: string; valor_modulo: number | null };
type Linea = { key: number; descripcion: string; cantidad: string; valor: string; costo: string };

// Formulario de presupuesto (crear o editar). Las líneas se arman en pantalla; el servidor valida todo.
export default function PresupuestoForm({
  obrasSociales,
  quoteId,
  inicial,
  honorarios = [],
  ivaPct = 21,
}: {
  obrasSociales: ObraSocialOpt[];
  quoteId?: string;
  honorarios?: HonorarioOpt[];
  ivaPct?: number;
  inicial?: {
    obra_social_id: string | null;
    destinatario_particular: string | null;
    validez_dias: number;
    notas: string | null;
    items: { descripcion: string; cantidad: number; valor_unitario: number; costo_unitario?: number | null }[];
  };
}) {
  const [destino, setDestino] = useState<"obra_social" | "particular">(inicial && !inicial.obra_social_id ? "particular" : "obra_social");
  const [osId, setOsId] = useState(inicial?.obra_social_id ?? "");
  const [seq, setSeq] = useState((inicial?.items.length ?? 0) + 1);
  const [lineas, setLineas] = useState<Linea[]>(
    inicial && inicial.items.length > 0
      ? inicial.items.map((i, n) => ({ key: n, descripcion: i.descripcion, cantidad: String(i.cantidad), valor: String(i.valor_unitario), costo: i.costo_unitario != null ? String(i.costo_unitario) : "" }))
      : [{ key: 0, descripcion: "", cantidad: "1", valor: "", costo: "" }]
  );
  const os = obrasSociales.find((o) => o.id === osId);

  function agregar(descripcion = "", valor = "", costo = "") {
    setLineas((l) => [...l, { key: seq, descripcion, cantidad: "1", valor, costo }]);
    setSeq((n) => n + 1);
  }
  function cambiar(key: number, campo: "descripcion" | "cantidad" | "valor" | "costo", v: string) {
    setLineas((l) => l.map((x) => (x.key === key ? { ...x, [campo]: v } : x)));
  }
  const total = lineas.reduce((acc, l) => acc + (Number(l.cantidad.replace(",", ".")) || 0) * (Number(l.valor.replace(",", ".")) || 0), 0);
  const num = (v: string) => Number(v.replace(",", ".")) || 0;
  const costoNeto = lineas.reduce((acc, l) => acc + num(l.cantidad) * num(l.costo), 0);
  const costoIva = costoNeto * (1 + ivaPct / 100);
  const rentab = total > 0 && costoNeto > 0 ? (total - costoIva) / total : null;
  const input = "rounded-lg border border-slate-300 px-3 py-2 text-base sm:text-sm w-full";
  const label = "block text-xs font-medium text-slate-600 mb-1";

  return (
    <ActionForm action={saveSalesQuoteAction} className="space-y-4">
      {quoteId && <input type="hidden" name="quote_id" value={quoteId} />}
      <input type="hidden" name="destino" value={destino} />

      <div className="flex gap-2" role="group" aria-label="Para quién es el presupuesto">
        {(["obra_social", "particular"] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDestino(d)}
            aria-pressed={destino === d}
            className={`rounded-full px-4 py-2 text-sm font-medium border ${destino === d ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-300"}`}
          >
            {d === "obra_social" ? "Obra social" : "Particular"}
          </button>
        ))}
      </div>

      {destino === "obra_social" ? (
        <div>
          <label className={label} htmlFor="pq-os">Obra social</label>
          <select id="pq-os" name="obra_social_id" value={osId} onChange={(e) => setOsId(e.target.value)} className={input}>
            <option value="">Elegí una obra social…</option>
            {obrasSociales.map((o) => (
              <option key={o.id} value={o.id}>{o.nombre}</option>
            ))}
          </select>
        </div>
      ) : (
        <div>
          <label className={label} htmlFor="pq-part">Nombre del particular</label>
          <input id="pq-part" name="destinatario_particular" defaultValue={inicial?.destinatario_particular ?? ""} className={input} placeholder="Nombre y apellido" />
        </div>
      )}

      <div className="space-y-2">
        <div className="text-xs font-medium text-slate-600">Líneas del presupuesto</div>
        {lineas.map((l, i) => (
          <div key={l.key} className="grid grid-cols-[1fr_5rem_7rem_7rem_auto] gap-2 items-end max-sm:grid-cols-2 border-b border-slate-100 pb-2">
            <div className="max-sm:col-span-2">
              <label className="sr-only" htmlFor={`pq-d-${l.key}`}>Descripción de la línea {i + 1}</label>
              <input id={`pq-d-${l.key}`} name="item_descripcion" value={l.descripcion} onChange={(e) => cambiar(l.key, "descripcion", e.target.value)} placeholder="Descripción (ej. Módulo mensual de internación)" className={input} />
            </div>
            <div>
              <label className="sr-only" htmlFor={`pq-c-${l.key}`}>Cantidad</label>
              <input id={`pq-c-${l.key}`} name="item_cantidad" inputMode="decimal" value={l.cantidad} onChange={(e) => cambiar(l.key, "cantidad", e.target.value)} placeholder="Cant." className={input} />
            </div>
            <div>
              <label className="sr-only" htmlFor={`pq-v-${l.key}`}>Valor unitario</label>
              <input id={`pq-v-${l.key}`} name="item_valor" inputMode="decimal" value={l.valor} onChange={(e) => cambiar(l.key, "valor", e.target.value)} placeholder="Valor $" className={input} />
            </div>
            <div>
              <label className="sr-only" htmlFor={`pq-k-${l.key}`}>Costo unitario sin IVA</label>
              <input id={`pq-k-${l.key}`} name="item_costo" inputMode="decimal" value={l.costo} onChange={(e) => cambiar(l.key, "costo", e.target.value)} placeholder="Costo $ (sin IVA)" className={input} />
            </div>
            <button
              type="button"
              onClick={() => setLineas((x) => (x.length > 1 ? x.filter((y) => y.key !== l.key) : [{ ...x[0], descripcion: "", cantidad: "1", valor: "", costo: "" }]))}
              className="text-sm text-slate-500 underline px-2 py-2"
              aria-label={`Quitar la línea ${i + 1}`}
            >
              Quitar
            </button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => agregar()} className="rounded-lg border border-slate-300 text-slate-700 text-sm font-medium px-3 py-2 hover:bg-slate-50">
            + Agregar línea
          </button>
          {destino === "obra_social" && os && os.valor_modulo != null && (
            <button
              type="button"
              onClick={() => agregar("Módulo de internación domiciliaria", String(os.valor_modulo))}
              className="rounded-lg border border-slate-300 text-slate-700 text-sm font-medium px-3 py-2 hover:bg-slate-50"
            >
              + Módulo con el valor vigente ({formatARS(os.valor_modulo)})
            </button>
          )}
          {honorarios.length > 0 && (
            <select
              aria-label="Agregar una prestación con el costo que cargó Dirección"
              defaultValue=""
              onChange={(e) => {
                const h = honorarios[Number(e.target.value)];
                if (h) agregar(h.label, "", String(h.costo));
                e.target.value = "";
              }}
              className="rounded-lg border border-slate-300 text-slate-700 text-sm px-3 py-2"
            >
              <option value="" disabled>+ Prestación con costo cargado…</option>
              {honorarios.map((h, i) => <option key={h.label} value={i}>{h.label} ({formatARS(h.costo)})</option>)}
            </select>
          )}
        </div>
        <div className="text-right text-sm font-semibold text-slate-900 tabular-nums">Total de venta: {formatARS(total)}</div>
        <div className="text-right text-xs text-slate-500 tabular-nums">
          Costo con IVA ({ivaPct}%): {formatARS(costoIva)}{rentab !== null && <> · Rentabilidad sobre el bruto: <span className={rentab < 0 ? "text-red-700 font-medium" : "text-emerald-700 font-medium"}>{(rentab * 100).toFixed(1)}%</span></>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={label} htmlFor="pq-val">Validez (días)</label>
          <input id="pq-val" name="validez_dias" type="number" min={1} max={365} defaultValue={inicial?.validez_dias ?? 15} className={input} />
        </div>
        <div className="sm:col-span-2">
          <label className={label} htmlFor="pq-notas">Notas (opcional)</label>
          <input id="pq-notas" name="notas" defaultValue={inicial?.notas ?? ""} className={input} placeholder="Condiciones, forma de pago, aclaraciones" />
        </div>
      </div>

      <SubmitButton className="w-full rounded-xl bg-slate-900 text-white text-sm font-medium px-4 py-2.5 hover:bg-slate-800 transition-colors" pendingLabel="Guardando…">
        {quoteId ? "Guardar cambios" : "Crear presupuesto"}
      </SubmitButton>
    </ActionForm>
  );
}
