import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { createProductAction, createAssetAction, addProductSupplierAction, setPreferredSupplierAction } from "./actions";
import PageHeader from "@/components/PageHeader";
import SearchableSelect from "@/components/SearchableSelect";
import ExportCsvButton from "@/components/ExportCsvButton";
import ProductFormFields from "@/components/ProductFormFields";
import StatusBadge from "@/components/StatusBadge";
import { IconBox, IconPill, IconApple, IconGrid, IconBarcode, IconStar, IconCalendar } from "@/components/icons";
import { SemanticTone } from "@/lib/semantic-status";

const TIPO_LABELS: Record<string, string> = {
  descartable: "Descartable",
  equipo: "Equipo / aparatología",
  alimento: "Alimento",
};

const TIPO_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  descartable: IconPill,
  equipo: IconBox,
  alimento: IconApple,
};

const TIPO_BADGE: Record<string, string> = {
  descartable: "bg-violet-100 text-violet-700",
  equipo: "bg-blue-100 text-blue-700",
  alimento: "bg-amber-100 text-amber-700",
};

const ESTADO_STYLES: Record<string, string> = {
  disponible: "bg-emerald-100 text-emerald-700",
  asignado: "bg-blue-100 text-blue-700",
  mantenimiento: "bg-amber-100 text-amber-700",
  baja: "bg-slate-200 text-slate-600",
};

// DF-C5 §3, feedback cliente 01/10-02/10: semáforos calculados en la vista
// v_products_status (mismo patrón que v_treatment_authorization_status de
// DF-C3 §7), mapeados al tono único de DF-C1 §10.
const STOCK_TONE: Record<string, SemanticTone> = { critico: "rojo", bajo: "amarillo", normal: "verde" };
const STOCK_LABEL: Record<string, string> = { critico: "Reponer ya", bajo: "Stock bajo", normal: "Stock OK" };
const VENCIMIENTO_TONE: Record<string, SemanticTone> = { vencida: "rojo", por_vencer: "amarillo", vigente: "verde" };
const VENCIMIENTO_LABEL: Record<string, string> = { vencida: "Vencido", por_vencer: "Por vencer", vigente: "Vigente" };

export default async function CatalogoPage() {
  const { profile } = await requireProfile();
  const supabase = await createClient();

  const [{ data: products }, { data: assets }, { data: productSuppliers }, { data: suppliers }, { data: productStatus }, { data: historialPrecios }] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, codigo, descripcion, observacion, tipo, proveedor, ean, categoria_iva, se_factura_aparte, existencia_actual, active, stock_minimo, stock_maximo, fecha_vencimiento, n_lote, precio_alquiler_mensual, frecuencia_service, fecha_ultimo_service, vida_util_estimada"
      )
      .order("tipo")
      .order("descripcion"),
    supabase
      .from("equipment_assets")
      .select("id, numero_serie, propiedad, estado, notas_condicion, product_id"),
    supabase
      .from("product_suppliers")
      .select("product_id, supplier_id, preferido, precio_referencia, suppliers(nombre, email)")
      .order("preferido", { ascending: false }),
    supabase.from("suppliers").select("id, nombre").eq("activo", true).order("nombre"),
    // DF-C5 §3: semáforos calculados server-side en la vista (ver nota más arriba) — se
    // consultan aparte para no heredar los tipos "todo nullable" que Supabase genera para
    // las vistas y así no tocar el resto de las columnas, ya tipadas desde `products`.
    supabase.from("v_products_status").select("id, estado_stock, estado_vencimiento"),
    // DF-C5 §6.1, comentario cliente: comparativa de precio por proveedor en
    // el tiempo (cotizaciones + facturas recibidas), para ver quién vendió
    // más barato — hasta ahora solo existía el proveedor preferido.
    supabase
      .from("v_historial_precios_proveedor_resumen")
      .select("product_id, supplier_id, cantidad_registros, precio_minimo, ultimo_precio, ultima_fecha"),
  ]);

  const equipoProducts = (products ?? []).filter((p) => p.tipo === "equipo");
  const isDeposito = profile.role === "deposito";

  const statusByProduct = new Map<string, { estado_stock: string | null; estado_vencimiento: string | null }>();
  (productStatus ?? []).forEach((s) => {
    if (s.id) statusByProduct.set(s.id, { estado_stock: s.estado_stock, estado_vencimiento: s.estado_vencimiento });
  });

  const suppliersByProduct = new Map<string, typeof productSuppliers>();
  (productSuppliers ?? []).forEach((ps) => {
    const list = suppliersByProduct.get(ps.product_id) ?? [];
    list.push(ps);
    suppliersByProduct.set(ps.product_id, list);
  });

  // DF-C5 §6.1: historial comparativo de precios por proveedor, agrupado por
  // producto y ordenado del más barato al más caro (último precio registrado).
  const supplierNameById = new Map((suppliers ?? []).map((s) => [s.id, s.nombre]));
  const historialByProduct = new Map<string, NonNullable<typeof historialPrecios>>();
  (historialPrecios ?? []).forEach((h) => {
    if (!h.product_id || !h.supplier_id) return;
    const list = historialByProduct.get(h.product_id) ?? [];
    list.push(h);
    historialByProduct.set(h.product_id, list);
  });
  historialByProduct.forEach((list) => list.sort((a, b) => (a.ultimo_precio ?? 0) - (b.ultimo_precio ?? 0)));

  return (
    <div className="space-y-8">
      <PageHeader
        icon={<IconBox className="w-5 h-5" />}
        title="Catálogo"
        section="DF-C5 §3"
        purpose="Acá vive todo lo que se puede pedir: insumos, equipos y alimentos. Cargá un producto nuevo, sumale proveedores alternativos y marcá cuál es el preferido — de acá sale la lista que usan Pedidos y Compras."
        description="Cada producto admite varios proveedores (uno marcado como preferido) y un código de barras EAN/UPC opcional para carga por escaneo."
      />

      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden animate-fade-slide-up card-hover">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <IconGrid className="w-4 h-4 text-slate-400" />
          <h2 className="text-sm font-medium text-slate-900">Productos del catálogo</h2>
          <span className="text-xs text-slate-400">{(products ?? []).length} ítems</span>
          <ExportCsvButton
            className="ml-auto"
            filename="catalogo-productos.csv"
            rows={(products ?? []).map((p) => ({
              codigo: p.codigo,
              ean: p.ean ?? "",
              descripcion: p.descripcion,
              tipo: p.tipo,
              existencia: p.tipo === "equipo" ? "" : p.existencia_actual,
              se_factura_aparte: p.se_factura_aparte ? "si" : "no",
            }))}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-5 py-2.5 font-medium">Código</th>
                <th className="text-left px-5 py-2.5 font-medium">EAN</th>
                <th className="text-left px-5 py-2.5 font-medium">Descripción</th>
                <th className="text-left px-5 py-2.5 font-medium">Tipo</th>
                <th className="text-left px-5 py-2.5 font-medium">Proveedores</th>
                <th className="text-right px-5 py-2.5 font-medium">Existencia</th>
                <th className="text-left px-5 py-2.5 font-medium">Stock</th>
                <th className="text-left px-5 py-2.5 font-medium">Vencimiento</th>
                <th className="text-left px-5 py-2.5 font-medium">¿Factura aparte?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(products ?? []).map((p) => {
                const Icon = TIPO_ICON[p.tipo];
                const status = statusByProduct.get(p.id);
                const psList = suppliersByProduct.get(p.id) ?? [];
                const preferido = psList.find((ps) => ps.preferido);
                const otros = psList.filter((ps) => !ps.preferido);
                const historial = historialByProduct.get(p.id) ?? [];
                return (
                  <tr key={p.id} className="row-hover hover:bg-slate-50 align-top">
                    <td className="px-5 py-2.5 font-mono text-xs text-slate-500">{p.codigo}</td>
                    <td className="px-5 py-2.5 font-mono text-xs text-slate-400">
                      {p.ean ? (
                        <span className="inline-flex items-center gap-1"><IconBarcode className="w-3 h-3" />{p.ean}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-5 py-2.5">
                      <div className="text-slate-900">{p.descripcion}</div>
                      {p.observacion && (
                        <div className="text-xs text-slate-400">a.k.a. {p.observacion}</div>
                      )}
                      {p.tipo === "equipo" && (p.precio_alquiler_mensual || p.frecuencia_service) && (
                        <div className="text-xs text-slate-400 mt-0.5">
                          {p.precio_alquiler_mensual != null && <>Alquiler ${p.precio_alquiler_mensual}/mes</>}
                          {p.precio_alquiler_mensual != null && p.frecuencia_service && " · "}
                          {p.frecuencia_service && <>Service {p.frecuencia_service}</>}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-2.5">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${TIPO_BADGE[p.tipo]}`}>
                        <Icon className="w-3.5 h-3.5" />
                        {TIPO_LABELS[p.tipo]}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-slate-600">
                      {psList.length === 0 && <span className="text-slate-400">{p.proveedor ?? "—"}</span>}
                      {preferido && (
                        <div className="flex items-center gap-1 text-slate-900 font-medium">
                          <IconStar className="w-3 h-3 text-amber-500" />
                          {(preferido.suppliers as unknown as { nombre: string } | null)?.nombre}
                        </div>
                      )}
                      {otros.length > 0 && (
                        <div className="text-xs text-slate-400 mt-0.5">
                          + {otros.map((o) => (o.suppliers as unknown as { nombre: string } | null)?.nombre).join(", ")}
                        </div>
                      )}
                      {isDeposito && (
                        <details className="mt-1">
                          <summary className="text-[11px] text-slate-400 cursor-pointer hover:text-slate-700">+ proveedor</summary>
                          <form action={addProductSupplierAction} className="flex flex-wrap items-center gap-1 mt-1">
                            <input type="hidden" name="product_id" value={p.id} />
                            <select name="supplier_id" required className="rounded-lg border border-slate-300 px-1.5 py-1 text-[11px]">
                              <option value="">Proveedor...</option>
                              {(suppliers ?? []).map((s) => (
                                <option key={s.id} value={s.id}>{s.nombre}</option>
                              ))}
                            </select>
                            <input name="precio_referencia" type="number" step="0.01" placeholder="Precio" className="w-16 rounded-lg border border-slate-300 px-1.5 py-1 text-[11px]" />
                            <label className="flex items-center gap-1 text-[10px] text-slate-500">
                              <input type="checkbox" name="preferido" className="w-3 h-3" /> preferido
                            </label>
                            <button className="rounded-lg bg-slate-900 text-white text-[11px] font-medium px-2 py-1">Agregar</button>
                          </form>
                          {otros.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {otros.map((o) => (
                                <form key={o.supplier_id} action={setPreferredSupplierAction}>
                                  <input type="hidden" name="product_id" value={p.id} />
                                  <input type="hidden" name="supplier_id" value={o.supplier_id} />
                                  <button className="text-[10px] text-slate-400 underline hover:text-slate-700">
                                    marcar {(o.suppliers as unknown as { nombre: string } | null)?.nombre} preferido
                                  </button>
                                </form>
                              ))}
                            </div>
                          )}
                        </details>
                      )}
                      {historial.length > 1 && (
                        <details className="mt-1">
                          <summary className="text-[11px] text-slate-400 cursor-pointer hover:text-slate-700">
                            comparar precios ({historial.length} proveedores)
                          </summary>
                          <ul className="mt-1 space-y-0.5">
                            {historial.map((h, idx) => (
                              <li key={h.supplier_id ?? idx} className={`text-[11px] flex items-center gap-1 ${idx === 0 ? "text-emerald-700 font-medium" : "text-slate-400"}`}>
                                {idx === 0 && <IconStar className="w-2.5 h-2.5 text-emerald-500" />}
                                {supplierNameById.get(h.supplier_id ?? "") ?? "—"}: ${h.ultimo_precio}
                                {h.precio_minimo != null && h.ultimo_precio != null && h.precio_minimo < h.ultimo_precio && (
                                  <span>(mínimo histórico ${h.precio_minimo})</span>
                                )}
                                <span>· {h.cantidad_registros} registro{h.cantidad_registros === 1 ? "" : "s"}</span>
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-right text-slate-700 font-medium tabular-nums">
                      {p.tipo === "equipo" ? "—" : p.existencia_actual}
                    </td>
                    <td className="px-5 py-2.5">
                      {p.stock_minimo == null ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          <StatusBadge
                            tone={STOCK_TONE[status?.estado_stock ?? "normal"]}
                            label={STOCK_LABEL[status?.estado_stock ?? "normal"]}
                          />
                          <span className="text-[11px] text-slate-400">
                            mín {p.stock_minimo}{p.stock_maximo != null && ` · máx ${p.stock_maximo}`}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-2.5">
                      {p.fecha_vencimiento == null ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          <StatusBadge
                            tone={VENCIMIENTO_TONE[status?.estado_vencimiento ?? "vigente"]}
                            label={VENCIMIENTO_LABEL[status?.estado_vencimiento ?? "vigente"]}
                          />
                          <span className="text-[11px] text-slate-400 inline-flex items-center gap-1">
                            <IconCalendar className="w-3 h-3" />
                            {new Date(p.fecha_vencimiento).toLocaleDateString("es-AR")}
                            {p.n_lote && ` · lote ${p.n_lote}`}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-slate-600">{p.se_factura_aparte ? "Sí" : "No"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {isDeposito && (
        <section className="bg-white rounded-2xl border border-slate-200 p-5 animate-fade-slide-up card-hover">
          <h2 className="text-sm font-medium text-slate-900 mb-4 flex items-center gap-2">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-500">+</span>
            Agregar producto al catálogo
          </h2>
          <p className="text-xs text-slate-400 -mt-2 mb-3">
            El &ldquo;Código de producto&rdquo; es el identificador interno (SKU); el EAN/UPC es el código de barras de fábrica —
            son campos distintos porque no todo proveedor trae uno (DF-C5 §3, pendiente de definir cuál usa cada uno como estándar).
          </p>
          <form action={createProductAction} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input name="codigo" placeholder="Código de producto (SKU interno)" required className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-slate-300" />
            <input name="ean" placeholder="EAN / código de barras (opcional)" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-slate-300" />
            <ProductFormFields />
            <input name="descripcion" placeholder="Descripción" required className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm sm:col-span-2 transition-shadow focus:outline-none focus:ring-2 focus:ring-slate-300" />
            <input name="observacion" placeholder="Observación / nombre de uso común" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-slate-300" />
            <select name="supplier_id" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
              <option value="">Proveedor preferido (opcional)...</option>
              {(suppliers ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
            <input name="categoria_iva" placeholder="Categoría IVA (ej. 21%)" defaultValue="21%" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
            <input name="precio_compra" type="number" step="0.01" placeholder="Precio de compra" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" name="se_factura_aparte" defaultChecked className="w-4 h-4 rounded accent-slate-900" />
              ¿Se factura aparte?
            </label>
            <button className="rounded-xl bg-slate-900 text-white text-sm font-medium px-4 py-2.5 hover:bg-slate-800 transition-colors sm:col-span-3">
              Agregar producto
            </button>
          </form>
        </section>
      )}

      <div className="animate-fade-slide-up">
        <h2 className="text-lg font-semibold text-slate-900">Unidades físicas de equipos</h2>
        <p className="text-sm text-slate-500 mt-1">
          Separación tipo / unidad (nota técnica DF-C5 §3): cada fila es un equipo real, identificado por número de serie único, con su propio estado y trazabilidad.
        </p>
      </div>

      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden animate-fade-slide-up card-hover">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-5 py-2.5 font-medium">N° de serie</th>
                <th className="text-left px-5 py-2.5 font-medium">Equipo (tipo)</th>
                <th className="text-left px-5 py-2.5 font-medium">Propiedad</th>
                <th className="text-left px-5 py-2.5 font-medium">Estado</th>
                <th className="text-left px-5 py-2.5 font-medium">Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(assets ?? []).map((a) => {
                const product = equipoProducts.find((p) => p.id === a.product_id);
                return (
                  <tr key={a.id} className="row-hover hover:bg-slate-50">
                    <td className="px-5 py-2.5 font-mono text-xs text-slate-500">{a.numero_serie}</td>
                    <td className="px-5 py-2.5 text-slate-900">{product?.descripcion ?? "—"}</td>
                    <td className="px-5 py-2.5 text-slate-600 capitalize">{a.propiedad}</td>
                    <td className="px-5 py-2.5">
                      <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${ESTADO_STYLES[a.estado]}`}>
                        {a.estado}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-slate-500 text-xs">{a.notas_condicion ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {isDeposito && (
        <section className="bg-white rounded-2xl border border-slate-200 p-5 animate-fade-slide-up card-hover">
          <h2 className="text-sm font-medium text-slate-900 mb-4 flex items-center gap-2">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-500">+</span>
            Agregar unidad física
          </h2>
          <form action={createAssetAction} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <SearchableSelect
              name="product_id"
              required
              placeholder="Equipo (tipo)..."
              className="sm:col-span-2"
              options={equipoProducts.map((p) => ({ value: p.id, label: p.descripcion }))}
            />
            <input name="numero_serie" placeholder="Número de serie" required className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
            <select name="propiedad" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
              <option value="propio">Propio</option>
              <option value="alquilado">Alquilado</option>
            </select>
            <button className="rounded-xl bg-slate-900 text-white text-sm font-medium px-4 py-2.5 hover:bg-slate-800 transition-colors sm:col-span-4">
              Agregar unidad
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
