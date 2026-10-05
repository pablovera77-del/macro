import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import PrintButton from "@/components/stock/PrintButton";
import { fechaHora, mapaUrl } from "@/lib/stock-ui";
import { urlsDeFotos } from "@/lib/fotos";

// Remito imprimible (DF-C5 §4.5): ítems del catálogo, nombre y DNI del paciente tal como figuran
// en el sistema, cláusula de responsabilidad y la firma de quien recibe. «Imprimir» permite
// también guardarlo como PDF.
const CLAUSULA =
  "Declaro haber recibido en conformidad los insumos y/o equipos detallados en este remito, en el estado indicado. " +
  "Me comprometo a usarlos únicamente para el paciente mencionado, a cuidarlos y a avisar a Profesionales SRL ante cualquier " +
  "desperfecto, pérdida o cambio de domicilio. Los equipos son propiedad de Profesionales SRL (o de un tercero que se los alquila) " +
  "y deben devolverse cuando finalice la internación domiciliaria o cuando la empresa lo solicite.";

const VINCULO: Record<string, string> = {
  familiar: "Familiar o responsable",
  paciente: "Paciente",
  profesional: "Profesional que recibe",
  otro: "Otra persona",
};

export default async function RemitoPage({ params }: { params: Promise<{ id: string }> }) {
  const { profile } = await requireProfile();
  if (profile.role === "profesional_asistencial") notFound();
  const { id } = await params;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, estado, creado_por, canal_entrega, direccion_entrega, patients(nombre_completo, dni, domicilio), profesional:profiles!orders_profesional_id_fkey(full_name), order_items(id, cantidad, estado_item, equipment_asset_id, products(codigo, descripcion), equipment_assets(numero_serie)), remitos(id, fecha_despacho, fecha_entrega, firma_familiar_url, firmante_nombre, firmante_dni, firmante_vinculo, entrega_lat, entrega_lng)"
    )
    .eq("id", id)
    .maybeSingle();
  if (!order) notFound();
  if (profile.role === "coordinador_internacion" && order.creado_por !== profile.id) notFound();

  const paciente = order.patients as unknown as { nombre_completo: string; dni: string; domicilio: string } | null;
  const prof = order.profesional as unknown as { full_name: string } | null;
  const remito = (order.remitos as unknown as { id: string; fecha_despacho: string | null; fecha_entrega: string | null; firma_familiar_url: string | null; firmante_nombre: string | null; firmante_dni: string | null; firmante_vinculo: string | null; entrega_lat: number | null; entrega_lng: number | null }[] | null)?.[0];
  const items = ((order.order_items as unknown as { id: number; cantidad: number; estado_item: string; equipment_asset_id: string | null; products: { codigo: string; descripcion: string } | null; equipment_assets: { numero_serie: string } | null }[]) ?? [])
    .filter((i) => i.estado_item !== "rechazado")
    .sort((a, b) => a.id - b.id);

  const assetIds = items.map((i) => i.equipment_asset_id).filter((x): x is string => !!x);
  const { data: fotos } = assetIds.length
    ? await supabase.from("equipment_asset_photos").select("asset_id, url, condicion, momento").eq("momento", "entrega").in("asset_id", assetIds).order("created_at", { ascending: false })
    : { data: [] as { asset_id: string; url: string; condicion: string | null; momento: string }[] };
  const urls = await urlsDeFotos(supabase, (fotos ?? []).map((f) => f.url));
  const fotoDe = new Map<string, { url: string; condicion: string | null }>();
  for (const f of fotos ?? []) if (!fotoDe.has(f.asset_id)) fotoDe.set(f.asset_id, { url: urls.get(f.url) ?? "", condicion: f.condicion });

  const firmaImg = remito?.firma_familiar_url?.startsWith("data:image/") ? remito.firma_familiar_url : null;
  const numero = (remito?.id ?? order.id).slice(0, 8).toUpperCase();
  const firmado = !!remito?.fecha_entrega;

  return (
    <div className="space-y-4">
      <div className="no-print flex items-center justify-between gap-3 flex-wrap">
        <Link href="/pedidos" className="text-sm text-slate-500 underline">← Volver a pedidos</Link>
        <PrintButton />
      </div>

      <article className="print-doc bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 text-slate-900 max-w-3xl mx-auto">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Profesionales SRL</h1>
            <p className="text-sm text-slate-500">Internación domiciliaria</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">Remito de entrega N° {numero}</p>
            <p className="text-slate-500">Despacho: {fechaHora(remito?.fecha_despacho)}</p>
            <p className="text-slate-500">Entrega: {firmado ? fechaHora(remito?.fecha_entrega) : "pendiente"}</p>
          </div>
        </header>

        <section className="py-4 border-b border-slate-200 text-sm grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
          {paciente ? (
            <>
              <p><span className="text-slate-500">Paciente:</span> <strong>{paciente.nombre_completo}</strong></p>
              <p><span className="text-slate-500">DNI:</span> <strong>{paciente.dni}</strong></p>
              <p className="sm:col-span-2"><span className="text-slate-500">Domicilio:</span> {paciente.domicilio}</p>
            </>
          ) : (
            <>
              <p><span className="text-slate-500">Para el profesional:</span> <strong>{prof?.full_name ?? "—"}</strong></p>
              {order.direccion_entrega && <p><span className="text-slate-500">Dirección:</span> {order.direccion_entrega}</p>}
            </>
          )}
          <p className="sm:col-span-2"><span className="text-slate-500">Modalidad:</span> {order.canal_entrega === "retiro_local" ? "Retiro en el local" : "Entrega a domicilio"}</p>
        </section>

        <section className="py-4 border-b border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
                <th className="py-2 pr-2 w-16">Cant.</th>
                <th className="py-2 pr-2 w-28">Código</th>
                <th className="py-2">Descripción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((i) => {
                const f = i.equipment_asset_id ? fotoDe.get(i.equipment_asset_id) : null;
                return (
                  <tr key={i.id} className="align-top">
                    <td className="py-2 pr-2 tabular-nums">{i.cantidad}</td>
                    <td className="py-2 pr-2 font-mono text-xs text-slate-500">{i.products?.codigo}</td>
                    <td className="py-2">
                      {i.products?.descripcion}
                      {i.equipment_assets?.numero_serie && <span className="text-slate-500"> — N° de serie {i.equipment_assets.numero_serie}</span>}
                      {f?.condicion && <div className="text-xs text-slate-500">Estado al entregar: {f.condicion}</div>}
                      {f?.url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={f.url} alt="Foto del equipo al entregarlo" className="mt-1 h-20 rounded border border-slate-200 object-cover" />
                      )}
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr><td colSpan={3} className="py-3 text-slate-400">Sin ítems.</td></tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="py-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold mb-1">Cláusula de recepción y responsabilidad</h2>
          <p className="text-xs leading-relaxed text-slate-700">{CLAUSULA}</p>
          <p className="no-print mt-2 text-[11px] text-amber-700 bg-amber-50 rounded px-2 py-1 w-fit">Texto modelo, pendiente de revisión legal antes de usarlo con pacientes.</p>
        </section>

        <section className="pt-4 text-sm">
          <h2 className="text-sm font-semibold mb-2">Recibí conforme</h2>
          {firmado ? (
            <div className="flex items-end gap-6 flex-wrap">
              <div>
                {firmaImg ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={firmaImg} alt="Firma de quien recibió" className="h-24 border-b border-slate-400" />
                ) : (
                  <p className="h-24 flex items-end border-b border-slate-400 italic text-slate-500">{remito?.firma_familiar_url ?? "Firma digital confirmada"}</p>
                )}
              </div>
              <div className="space-y-0.5">
                <p><span className="text-slate-500">Aclaración:</span> <strong>{remito?.firmante_nombre ?? remito?.firma_familiar_url ?? "—"}</strong></p>
                {remito?.firmante_dni && <p><span className="text-slate-500">DNI:</span> {remito.firmante_dni}</p>}
                {remito?.firmante_vinculo && <p><span className="text-slate-500">Vínculo:</span> {VINCULO[remito.firmante_vinculo] ?? remito.firmante_vinculo}</p>}
                <p><span className="text-slate-500">Fecha y hora:</span> {fechaHora(remito?.fecha_entrega)}</p>
                {remito?.entrega_lat != null && remito.entrega_lng != null && (
                  <p className="text-xs text-slate-500">
                    Ubicación registrada: {remito.entrega_lat.toFixed(5)}, {remito.entrega_lng.toFixed(5)}{" "}
                    <a className="no-print underline" href={mapaUrl(null, remito.entrega_lat, remito.entrega_lng)!} target="_blank" rel="noopener noreferrer">ver mapa</a>
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-end gap-6 flex-wrap">
              <div className="h-24 w-64 border-b border-slate-400" />
              <p className="text-slate-500 text-xs">Firma y aclaración — todavía sin firmar</p>
            </div>
          )}
        </section>
      </article>
    </div>
  );
}
