import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import ActionDisclosure from "@/components/ActionDisclosure";
import ConfirmButton from "@/components/ConfirmButton";
import PresupuestoForm from "@/components/presupuestos/PresupuestoForm";
import ImprimirButton from "@/components/presupuestos/ImprimirButton";
import { ROLES_PRESUPUESTOS, formatARS, fechaCorta, totalPresupuesto, vencimientoPresupuesto, numeroPresupuesto } from "@/lib/facturacion";
import { deleteSalesQuoteAction } from "../actions";

export default async function PresupuestoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireProfile();
  if (!ROLES_PRESUPUESTOS.includes(profile.role)) redirect("/inicio");
  const canManage = profile.role === "administracion";
  const supabase = await createClient();

  const { data: quote } = await supabase
    .from("sales_quotes")
    .select("id, numero, obra_social_id, destinatario_particular, fecha, validez_dias, notas, obras_sociales(nombre, cuit)")
    .eq("id", id)
    .maybeSingle();
  if (!quote) notFound();
  const [{ data: items }, { data: obrasSociales }] = await Promise.all([
    supabase.from("sales_quote_items").select("descripcion, cantidad, valor_unitario").eq("quote_id", id).order("orden"),
    canManage ? supabase.from("obras_sociales").select("id, nombre, valor_modulo").eq("activa", true).order("nombre") : Promise.resolve({ data: [] }),
  ]);
  const lineas = (items ?? []).map((i) => ({ descripcion: i.descripcion, cantidad: Number(i.cantidad), valor_unitario: Number(i.valor_unitario) }));
  const os = quote.obras_sociales as unknown as { nombre: string; cuit: string | null } | null;
  const total = totalPresupuesto(lineas);

  return (
    <div className="space-y-6">
      {/* Al imprimir sale solo el presupuesto (sin menú ni botones). */}
      <style>{`@media print { body * { visibility: hidden; } .print-quote, .print-quote * { visibility: visible; } .print-quote { position: absolute; left: 0; top: 0; width: 100%; border: 0 !important; box-shadow: none !important; } }`}</style>

      <div className="flex items-center justify-between gap-3 flex-wrap print:hidden">
        <Link href="/presupuestos" className="text-sm text-slate-500 underline">← Volver a presupuestos</Link>
        <ImprimirButton />
      </div>

      <article className="print-quote bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 max-w-3xl">
        <header className="flex items-start justify-between gap-4 flex-wrap border-b border-slate-200 pb-4">
          <div>
            <div className="text-xl font-semibold text-slate-900">Presupuesto</div>
            <div className="text-sm text-slate-500">Profesionales SRL · Internación domiciliaria</div>
          </div>
          <div className="text-right text-sm text-slate-600">
            <div className="font-medium text-slate-900">{numeroPresupuesto(quote.numero)}</div>
            <div>Fecha: {fechaCorta(quote.fecha)}</div>
            <div>Válido hasta: {fechaCorta(vencimientoPresupuesto(quote.fecha, quote.validez_dias))}</div>
          </div>
        </header>

        <section className="py-4 text-sm">
          <div className="text-xs uppercase tracking-wide text-slate-400">Para</div>
          <div className="font-medium text-slate-900">{os?.nombre ?? quote.destinatario_particular}</div>
          {os?.cuit && <div className="text-slate-500">CUIT {os.cuit}</div>}
        </section>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                <th className="py-2 pr-3 font-medium">Descripción</th>
                <th className="py-2 px-3 font-medium text-right">Cant.</th>
                <th className="py-2 px-3 font-medium text-right">Valor unit.</th>
                <th className="py-2 pl-3 font-medium text-right">Importe</th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((l, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-2 pr-3 text-slate-800">{l.descripcion}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{l.cantidad}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{formatARS(l.valor_unitario)}</td>
                  <td className="py-2 pl-3 text-right tabular-nums">{formatARS(l.cantidad * l.valor_unitario)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="pt-3 text-right font-medium text-slate-700">Total</td>
                <td className="pt-3 pl-3 text-right text-base font-semibold text-slate-900 tabular-nums">{formatARS(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {quote.notas && <p className="mt-4 text-sm text-slate-600 whitespace-pre-line">{quote.notas}</p>}
        <p className="mt-6 text-xs text-slate-400">Los valores se expresan en pesos argentinos. Presupuesto sujeto a la validez indicada.</p>
      </article>

      {canManage && (
        <div className="print:hidden space-y-2 max-w-3xl">
          <ActionDisclosure label="Editar presupuesto" tone="subtle">
            <PresupuestoForm
              obrasSociales={obrasSociales ?? []}
              quoteId={quote.id}
              inicial={{
                obra_social_id: quote.obra_social_id,
                destinatario_particular: quote.destinatario_particular,
                validez_dias: quote.validez_dias,
                notas: quote.notas,
                items: lineas,
              }}
            />
          </ActionDisclosure>
          <form action={deleteSalesQuoteAction}>
            <input type="hidden" name="quote_id" value={quote.id} />
            <ConfirmButton className="text-sm text-red-600 underline px-1 py-2" confirmLabel="¿Seguro que lo borrás? Tocá de nuevo">
              Borrar presupuesto
            </ConfirmButton>
          </form>
        </div>
      )}
    </div>
  );
}
