import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import {
  generateQuoteRequestAction,
  logSupplierQuoteAction,
  generatePurchaseOrdersAction,
  advancePurchaseOrderAction,
  loadPurchaseOrderInvoiceAction,
} from "./actions";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { IconClipboardCheck, IconAlert, IconStar, IconTruck, IconCheck } from "@/components/icons";

function formatARS(value: number | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

const QR_ESTADO_LABELS: Record<string, string> = { borrador: "Borrador", enviada: "Enviada a proveedores", respondida: "Con cotizaciones", cerrada: "Cerrada" };
const QR_ESTADO_STYLES: Record<string, string> = {
  borrador: "bg-slate-200 text-slate-600",
  enviada: "bg-blue-100 text-blue-700",
  respondida: "bg-amber-100 text-amber-700",
  cerrada: "bg-emerald-100 text-emerald-700",
};
const PO_ESTADO_LABELS: Record<string, string> = { borrador: "Borrador", enviada: "Enviada", confirmada: "Confirmada", recibida: "Recibida", cancelada: "Cancelada" };
const PO_NEXT: Record<string, string> = { borrador: "enviada", enviada: "confirmada", confirmada: "recibida" };
const PO_NEXT_LABEL: Record<string, string> = { borrador: "Marcar enviada", enviada: "Marcar confirmada", confirmada: "Confirmar recepción (ingresa stock)" };

export default async function ComprasPage() {
  const { profile } = await requireProfile();
  const supabase = await createClient();

  const [
    { data: products },
    { data: authorizations },
    { data: productSuppliers },
    { data: suppliers },
    { data: quoteRequests },
    { data: quoteItems },
    { data: priceQuotes },
    { data: purchaseOrders },
    { data: purchaseOrderItems },
  ] = await Promise.all([
    supabase.from("products").select("id, codigo, descripcion, tipo, existencia_actual").eq("active", true).neq("tipo", "equipo"),
    supabase
      .from("patient_authorizations")
      .select("product_id, cantidad_autorizada, patients!inner(estado)")
      .eq("patients.estado", "activo"),
    supabase.from("product_suppliers").select("product_id, supplier_id, preferido, precio_referencia, suppliers(nombre, email)").eq("preferido", true),
    supabase.from("suppliers").select("id, nombre, email").eq("activo", true).order("nombre"),
    supabase.from("quote_requests").select("id, estado, notas, created_at").neq("estado", "cerrada").order("created_at", { ascending: false }),
    supabase.from("quote_request_items").select("id, quote_request_id, product_id, cantidad, products(codigo, descripcion)"),
    supabase.from("supplier_price_quotes").select("id, quote_request_id, product_id, supplier_id, precio, suppliers(nombre)"),
    supabase.from("purchase_orders").select("id, supplier_id, estado, created_at, fecha_recepcion, suppliers(nombre)").order("created_at", { ascending: false }).limit(10),
    supabase.from("purchase_order_items").select("purchase_order_id, product_id, cantidad, precio_unitario, products(descripcion)"),
  ]);

  // DF-C5 §6.1: factura del proveedor + comparación automática contra lo
  // pedido/recibido — se consultan aparte porque solo aplican a las OC
  // "recibida" que trajo el límite de 10 más recientes de arriba.
  const purchaseOrderIds = (purchaseOrders ?? []).map((po) => po.id);
  const [{ data: invoices }, { data: invoiceItems }] =
    purchaseOrderIds.length > 0
      ? await Promise.all([
          supabase.from("purchase_order_invoices").select("id, purchase_order_id, numero_factura, fecha_factura, monto_total").in("purchase_order_id", purchaseOrderIds),
          supabase.from("purchase_order_invoice_items").select("invoice_id, product_id, cantidad_facturada, precio_unitario_facturado, purchase_order_invoices!inner(purchase_order_id)").in("purchase_order_invoices.purchase_order_id", purchaseOrderIds),
        ])
      : [{ data: [] }, { data: [] }];

  const canManage = profile.role === "deposito" || profile.role === "administracion";

  // Proyección: consumo mensual proyectado = suma de lo autorizado a pacientes
  // activos para ese producto (DF-C5 §6: "promedio de consumo mensual,
  // cantidad de pacientes y lo que cada uno tiene autorizado").
  const proyeccionByProduct = new Map<string, number>();
  (authorizations ?? []).forEach((a) => {
    proyeccionByProduct.set(a.product_id, (proyeccionByProduct.get(a.product_id) ?? 0) + a.cantidad_autorizada);
  });

  const preferredByProduct = new Map<string, { supplier_id: string; nombre: string; email: string | null }>();
  (productSuppliers ?? []).forEach((ps) => {
    const s = ps.suppliers as unknown as { nombre: string; email: string | null } | null;
    if (s) preferredByProduct.set(ps.product_id, { supplier_id: ps.supplier_id, nombre: s.nombre, email: s.email });
  });

  const sugeridos = (products ?? [])
    .map((p) => {
      const proyeccion = proyeccionByProduct.get(p.id) ?? 0;
      const faltante = Math.max(0, proyeccion - p.existencia_actual);
      return { ...p, proyeccion, faltante, preferido: preferredByProduct.get(p.id) };
    })
    .filter((p) => p.faltante > 0)
    .sort((a, b) => b.faltante - a.faltante);

  return (
    <div className="space-y-8">
      <PageHeader
        icon={<IconClipboardCheck className="w-5 h-5" />}
        title="Compras — proyección y cotizaciones"
        section="DF-C5 §6"
        purpose="Acá se completa el círculo del stock: cuando lo autorizado a pacientes activos supera la existencia, esta pantalla te lo marca y en un clic generás el pedido de cotización a los proveedores habituales, comparás precios y armás la orden de compra."
        description="Proyección automática (consumo autorizado vs. existencia) → cotización a proveedores → comparativa de precios → orden de compra."
      />

      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden animate-fade-slide-up card-hover">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <IconAlert className="w-4 h-4 text-amber-500" />
          <h2 className="text-sm font-medium text-slate-900">Proyección automática — productos por debajo del consumo proyectado</h2>
        </div>
        {sugeridos.length === 0 ? (
          <p className="px-5 py-8 text-center text-slate-400 text-xs">
            Ningún producto está por debajo de su consumo mensual proyectado en este momento.
          </p>
        ) : (
          <form action={generateQuoteRequestAction}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                  <tr>
                    {canManage && <th className="px-5 py-2.5"></th>}
                    <th className="text-left px-5 py-2.5 font-medium">Producto</th>
                    <th className="text-left px-5 py-2.5 font-medium">Proveedor preferido</th>
                    <th className="text-right px-5 py-2.5 font-medium">Consumo mensual proyectado</th>
                    <th className="text-right px-5 py-2.5 font-medium">Existencia</th>
                    <th className="text-right px-5 py-2.5 font-medium">Faltante sugerido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sugeridos.map((p) => (
                    <tr key={p.id} className="row-hover hover:bg-slate-50">
                      {canManage && (
                        <td className="px-5 py-2.5">
                          <input type="checkbox" name="product_id" value={p.id} defaultChecked className="w-4 h-4 rounded accent-slate-900" />
                          <input type="hidden" name="cantidad_sugerida" value={p.faltante} />
                        </td>
                      )}
                      <td className="px-5 py-2.5">
                        <div className="text-slate-900">{p.descripcion}</div>
                        <div className="text-xs text-slate-400 font-mono">{p.codigo}</div>
                      </td>
                      <td className="px-5 py-2.5 text-slate-600">
                        {p.preferido ? (
                          <span className="inline-flex items-center gap-1"><IconStar className="w-3 h-3 text-amber-500" />{p.preferido.nombre}</span>
                        ) : (
                          <span className="text-slate-400">sin proveedor preferido</span>
                        )}
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-slate-600">{p.proyeccion}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-slate-600">{p.existencia_actual}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums font-semibold text-red-600">{p.faltante}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {canManage && (
              <div className="px-5 py-4 border-t border-slate-100">
                <button className="rounded-xl bg-slate-900 text-white text-sm font-medium px-4 py-2.5 hover:bg-slate-800 transition-colors">
                  Generar pedido de cotización a proveedores
                </button>
                <p className="text-xs text-slate-400 mt-2">
                  Envía el pedido a los proveedores preferidos de cada producto (mail precargado desde el catálogo).
                </p>
              </div>
            )}
          </form>
        )}
      </section>

      {(quoteRequests ?? []).length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Cotizaciones en curso</h2>
          {(quoteRequests ?? []).map((qr) => {
            const items = (quoteItems ?? []).filter((qi) => qi.quote_request_id === qr.id);
            const quotesForRequest = (priceQuotes ?? []).filter((pq) => pq.quote_request_id === qr.id);
            return (
              <div key={qr.id} className="bg-white rounded-2xl border border-slate-200 p-5 card-hover animate-fade-slide-up">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                  <span className="text-xs text-slate-400">{new Date(qr.created_at).toLocaleDateString("es-AR")}</span>
                  <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${QR_ESTADO_STYLES[qr.estado]}`}>{QR_ESTADO_LABELS[qr.estado]}</span>
                </div>
                <div className="space-y-3">
                  {items.map((item) => {
                    const product = item.products as unknown as { codigo: string; descripcion: string } | null;
                    const itemQuotes = quotesForRequest.filter((q) => q.product_id === item.product_id);
                    const cheapest = itemQuotes.length > 0 ? itemQuotes.reduce((a, b) => (b.precio < a.precio ? b : a)) : null;
                    return (
                      <div key={item.id} className="border border-slate-100 rounded-xl p-3">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-sm text-slate-900">{item.cantidad}x {product?.descripcion}</span>
                          <span className="text-xs text-slate-400 font-mono">{product?.codigo}</span>
                        </div>
                        {itemQuotes.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {itemQuotes.map((q) => {
                              const s = q.suppliers as unknown as { nombre: string } | null;
                              const isCheapest = cheapest && q.id === cheapest.id;
                              return (
                                <span
                                  key={q.id}
                                  className={`text-[11px] rounded-full px-2.5 py-1 ${isCheapest ? "bg-emerald-100 text-emerald-700 font-medium" : "bg-slate-50 text-slate-500"}`}
                                >
                                  {s?.nombre}: {formatARS(q.precio)} {isCheapest && "· más bajo"}
                                </span>
                              );
                            })}
                          </div>
                        )}
                        {canManage && qr.estado !== "cerrada" && (
                          <form action={logSupplierQuoteAction} className="flex flex-wrap gap-2 mt-2">
                            <input type="hidden" name="quote_request_id" value={qr.id} />
                            <input type="hidden" name="product_id" value={item.product_id} />
                            <select name="supplier_id" required className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs">
                              <option value="">Proveedor...</option>
                              {(suppliers ?? []).map((s) => (
                                <option key={s.id} value={s.id}>{s.nombre}</option>
                              ))}
                            </select>
                            <input name="precio" type="number" step="0.01" placeholder="Precio cotizado" required className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                            <button className="rounded-lg bg-slate-900 text-white text-xs font-medium px-3 py-1.5 hover:bg-slate-800 transition-colors">
                              Cargar cotización
                            </button>
                          </form>
                        )}
                      </div>
                    );
                  })}
                </div>
                {canManage && quotesForRequest.length > 0 && (
                  <form action={generatePurchaseOrdersAction} className="mt-4">
                    <input type="hidden" name="quote_request_id" value={qr.id} />
                    <button className="rounded-xl bg-emerald-600 text-white text-sm font-medium px-4 py-2.5 hover:bg-emerald-700 transition-colors">
                      Generar orden(es) de compra con el mejor precio
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </section>
      )}

      {(purchaseOrders ?? []).length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden animate-fade-slide-up card-hover">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <IconTruck className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-medium text-slate-900">Órdenes de compra</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {(purchaseOrders ?? []).map((po) => {
              const items = (purchaseOrderItems ?? []).filter((it) => it.purchase_order_id === po.id);
              const supplier = po.suppliers as unknown as { nombre: string } | null;
              const next = PO_NEXT[po.estado];
              const invoice = (invoices ?? []).find((inv) => inv.purchase_order_id === po.id);
              const itemsFacturados = invoice ? (invoiceItems ?? []).filter((it) => it.invoice_id === invoice.id) : [];
              // DF-C5 §6.1: comparación automática — por cada ítem pedido,
              // ¿coincide lo facturado en cantidad y precio?
              const comparacion = items.map((it) => {
                const facturado = itemsFacturados.find((f) => f.product_id === it.product_id);
                const coincideCantidad = facturado ? facturado.cantidad_facturada === it.cantidad : null;
                const coincidePrecio = facturado && it.precio_unitario != null ? facturado.precio_unitario_facturado === it.precio_unitario : null;
                return { it, facturado, coincideCantidad, coincidePrecio };
              });
              const hayDiscrepancias = invoice && comparacion.some((c) => c.coincideCantidad === false || c.coincidePrecio === false);
              return (
                <div key={po.id} className="px-5 py-3.5">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <span className="text-sm font-medium text-slate-900">{supplier?.nombre}</span>
                      <span className="text-xs text-slate-400 ml-2">{new Date(po.created_at).toLocaleDateString("es-AR")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {invoice && <StatusBadge tone={hayDiscrepancias ? "rojo" : "verde"} label={hayDiscrepancias ? "Factura con diferencias" : "Factura OK"} />}
                      <span className="inline-block rounded-full px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-600">{PO_ESTADO_LABELS[po.estado]}</span>
                      {profile.role === "deposito" && next && (
                        <form action={advancePurchaseOrderAction}>
                          <input type="hidden" name="purchase_order_id" value={po.id} />
                          <input type="hidden" name="nuevo_estado" value={next} />
                          <button className="rounded-full bg-slate-900 text-white text-xs font-medium px-3 py-1 hover:bg-slate-800 transition-colors inline-flex items-center gap-1">
                            <IconCheck className="w-3 h-3" /> {PO_NEXT_LABEL[po.estado]}
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                  <ul className="text-xs text-slate-500 mt-1.5 space-y-0.5">
                    {items.map((it, i) => {
                      const product = it.products as unknown as { descripcion: string } | null;
                      return (
                        <li key={i}>
                          {it.cantidad}x {product?.descripcion} {it.precio_unitario ? `· ${formatARS(it.precio_unitario)} c/u` : ""}
                        </li>
                      );
                    })}
                  </ul>

                  {po.estado === "recibida" && !invoice && canManage && (
                    <form action={loadPurchaseOrderInvoiceAction} className="mt-3 border border-slate-100 rounded-xl p-3 bg-slate-50">
                      <input type="hidden" name="purchase_order_id" value={po.id} />
                      <p className="text-xs font-medium text-slate-600 mb-2">DF-C5 §6.1 · Cargar factura del proveedor</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
                        <input name="numero_factura" placeholder="N° de factura" required className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                        <input name="fecha_factura" type="date" required className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                        <input name="monto_total" type="number" step="0.01" placeholder="Monto total" required className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                      </div>
                      <div className="space-y-1.5 mb-2">
                        {items.map((it, i) => {
                          const product = it.products as unknown as { descripcion: string } | null;
                          return (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              <input type="hidden" name="invoice_product_id" value={it.product_id} />
                              <span className="flex-1 text-slate-600">{product?.descripcion} <span className="text-slate-400">(pedido: {it.cantidad}{it.precio_unitario ? ` · ${formatARS(it.precio_unitario)} c/u` : ""})</span></span>
                              <input name="invoice_cantidad" type="number" step="0.01" defaultValue={it.cantidad} placeholder="Cant. facturada" className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-xs" />
                              <input name="invoice_precio_unitario" type="number" step="0.01" defaultValue={it.precio_unitario ?? undefined} placeholder="Precio facturado" className="w-32 rounded-lg border border-slate-300 px-2 py-1 text-xs" />
                            </div>
                          );
                        })}
                      </div>
                      <button className="rounded-lg bg-slate-900 text-white text-xs font-medium px-3 py-1.5 hover:bg-slate-800 transition-colors">Cargar factura</button>
                    </form>
                  )}

                  {invoice && (
                    <div className="mt-3 border border-slate-100 rounded-xl p-3">
                      <p className="text-xs font-medium text-slate-600 mb-1.5">
                        Factura {invoice.numero_factura} · {new Date(invoice.fecha_factura).toLocaleDateString("es-AR")} · {formatARS(invoice.monto_total)}
                      </p>
                      <ul className="text-xs space-y-1">
                        {comparacion.map((c, i) => {
                          const product = c.it.products as unknown as { descripcion: string } | null;
                          return (
                            <li key={i} className="flex items-center gap-2 flex-wrap">
                              <span className="text-slate-600">{product?.descripcion}</span>
                              {c.facturado ? (
                                <>
                                  <StatusBadge
                                    tone={c.coincideCantidad ? "verde" : "rojo"}
                                    label={`Cant. pedida ${c.it.cantidad} / facturada ${c.facturado.cantidad_facturada}`}
                                  />
                                  {c.it.precio_unitario != null && (
                                    <StatusBadge
                                      tone={c.coincidePrecio ? "verde" : "rojo"}
                                      label={`Precio cotizado ${formatARS(c.it.precio_unitario)} / facturado ${formatARS(c.facturado.precio_unitario_facturado)}`}
                                    />
                                  )}
                                </>
                              ) : (
                                <StatusBadge tone="gris" label="No incluido en la factura" />
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
