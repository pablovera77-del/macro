import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import {
  addOrderItemAction,
  authorizeOrderAction,
  rejectOrderAction,
  markPreparedAction,
  dispatchOrderAction,
  deliverOrderAction,
  solicitarInsumosAction,
  cancelSolicitudAction,
  reviewItemAction,
  acceptAllItemsAction,
  markNoticesReadAction,
} from "./actions";
import PageHeader from "@/components/PageHeader";
import SidePanel from "@/components/SidePanel";
import SearchableSelect from "@/components/SearchableSelect";
import ActionDisclosure from "@/components/ActionDisclosure";
import ConfirmButton from "@/components/ConfirmButton";
import StatusBadge from "@/components/StatusBadge";
import ActionForm from "@/components/stock/ActionForm";
import SubmitButton from "@/components/stock/SubmitButton";
import DeliveryForm from "@/components/stock/DeliveryForm";
import NuevoPedidoDeposito from "@/components/stock/NuevoPedidoDeposito";
import SolicitudCoordinador from "@/components/stock/SolicitudCoordinador";
import ItemReviewControls from "@/components/stock/ItemReviewControls";
import NoticesPanel, { type Notice } from "@/components/stock/NoticesPanel";
import ExportCsvButton from "@/components/ExportCsvButton";
import type { SemanticTone } from "@/lib/semantic-status";
import { fechaHora, mapaUrl, telUrl, pesos } from "@/lib/stock-ui";
import { hoyAR } from "@/lib/plan";
import { IconTruck, IconClipboard, IconCheck, IconSignature, IconMapPin, IconRefresh, IconAlert, IconBox } from "@/components/icons";

const ESTADO_LABELS: Record<string, string> = {
  borrador: "Borrador",
  autorizado: "Autorizado",
  preparado: "Preparado",
  despachado: "En camino",
  entregado: "Entregado",
  cancelado: "Cancelado",
};
const ESTADO_TONE: Record<string, SemanticTone> = {
  borrador: "gris",
  autorizado: "amarillo",
  preparado: "amarillo",
  despachado: "amarillo",
  entregado: "verde",
  cancelado: "rojo",
};
const ITEM_TONE: Record<string, SemanticTone> = { pendiente: "amarillo", aceptado: "verde", ajustado: "amarillo", rechazado: "rojo" };
const ITEM_LABEL: Record<string, string> = { pendiente: "Por revisar", aceptado: "Aceptado", ajustado: "Ajustado", rechazado: "Rechazado" };
const CANAL_LABELS: Record<string, string> = { domicilio: "Entrega a domicilio", retiro_local: "Retiro en el local" };

type Item = {
  id: number;
  cantidad: number;
  cantidad_solicitada: number | null;
  estado_item: string;
  motivo: string | null;
  product_id: string;
  equipment_asset_id: string | null;
  products: { descripcion: string; tipo: string; existencia_actual: number } | null;
  equipment_assets: { numero_serie: string } | null;
};
type Remito = {
  fecha_despacho: string | null;
  fecha_entrega: string | null;
  firma_familiar_url: string | null;
  firmante_nombre: string | null;
  firmante_dni: string | null;
  notificacion_enviada_at: string | null;
  notificacion_canal: string | null;
  entrega_lat: number | null;
  entrega_lng: number | null;
};
type Paciente = {
  nombre_completo: string;
  dni: string;
  domicilio: string;
  telefono_contacto: string | null;
  contacto_familiar_nombre: string | null;
  contacto_familiar_telefono: string | null;
};

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; mes?: string; paciente?: string; profesional?: string }>;
}) {
  const { profile } = await requireProfile();
  const supabase = await createClient();
  const sp = await searchParams;
  const role = profile.role;
  const esDeposito = role === "deposito";
  const esCoord = role === "coordinador_internacion";

  const mes = /^\d{4}-\d{2}$/.test(sp.mes ?? "") ? sp.mes! : "";
  const filtroPaciente = sp.paciente ?? "";
  const filtroProf = sp.profesional ?? "";
  const filtroEstado = sp.estado ?? "todos";

  let ordersQuery = supabase
    .from("orders")
    .select(
      "id, estado, created_at, fecha_autorizacion, autorizacion_automatica, motivo_rechazo, motivo_urgencia, origen, patient_id, profesional_id, direccion_entrega, canal_entrega, prioridad, creado_por, patients(nombre_completo, dni, domicilio, telefono_contacto, contacto_familiar_nombre, contacto_familiar_telefono), profesional:profiles!orders_profesional_id_fkey(full_name), creador:profiles!orders_creado_por_fkey(full_name), order_items(id, cantidad, cantidad_solicitada, estado_item, motivo, product_id, equipment_asset_id, products(descripcion, tipo, existencia_actual), equipment_assets(numero_serie)), remitos(fecha_despacho, fecha_entrega, firma_familiar_url, firmante_nombre, firmante_dni, notificacion_enviada_at, notificacion_canal, entrega_lat, entrega_lng)"
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (esCoord) ordersQuery = ordersQuery.eq("creado_por", profile.id);
  if (mes) {
    const [y, m] = mes.split("-").map(Number);
    const sig = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
    ordersQuery = ordersQuery.gte("created_at", `${mes}-01T00:00:00-03:00`).lt("created_at", `${sig}-01T00:00:00-03:00`);
  }
  if (filtroPaciente) ordersQuery = ordersQuery.eq("patient_id", filtroPaciente);
  if (filtroProf) ordersQuery = ordersQuery.eq("profesional_id", filtroProf);
  if (filtroEstado !== "todos") ordersQuery = ordersQuery.eq("estado", filtroEstado as "borrador");

  const pacientesQuery = supabase
    .from("patients")
    .select("id, nombre_completo, dni, coordinador_id, estado")
    .order("nombre_completo");

  const [
    { data: ordersRaw },
    { data: patients },
    { data: profesionales },
    { data: products },
    { data: assets },
    { data: authorizations },
    { data: precios },
    { data: noticesRaw },
  ] = await Promise.all([
    ordersQuery,
    pacientesQuery,
    supabase.from("profiles").select("id, full_name").eq("role", "profesional_asistencial").eq("active", true).order("full_name"),
    supabase.from("products").select("id, codigo, descripcion, observacion, ean, tipo").eq("active", true).order("descripcion"),
    supabase.from("equipment_assets").select("id, numero_serie, product_id, estado").eq("estado", "disponible"),
    supabase.from("patient_authorizations").select("patient_id, product_id, cantidad_autorizada, vigente_desde, vigente_hasta"),
    supabase.from("product_price_history").select("product_id, precio_compra, vigente_desde").order("vigente_desde", { ascending: false }),
    supabase.from("order_notices").select("id, tipo, titulo, detalle, href, created_at").is("leido_at", null).order("created_at", { ascending: false }).limit(15),
  ]);

  const precioDe = new Map<string, number>();
  for (const p of precios ?? []) if (!precioDe.has(p.product_id)) precioDe.set(p.product_id, Number(p.precio_compra));

  const pacientesActivos = (patients ?? []).filter((p) => p.estado !== "dado_de_baja");
  // Coordinación pide para sus pacientes; si todavía no tiene ninguno asignado, ve a todos los activos.
  const propios = pacientesActivos.filter((p) => p.coordinador_id === profile.id);
  const pacientesParaPedir = esCoord && propios.length > 0 ? propios : pacientesActivos;

  const optProductos = (products ?? []).map((p) => ({
    value: p.id,
    label: p.observacion ? `${p.descripcion} (${p.observacion})` : p.descripcion,
    group: p.tipo,
    keywords: `${p.codigo} ${p.ean ?? ""}`,
  }));
  const optPacientes = pacientesParaPedir.map((p) => ({ value: p.id, label: `${p.nombre_completo} · DNI ${p.dni}` }));
  const optProf = (profesionales ?? []).map((p) => ({ value: p.id, label: p.full_name }));
  const unidades = (assets ?? []).map((a) => {
    const prod = (products ?? []).find((p) => p.id === a.product_id);
    return { id: a.id, label: `${a.numero_serie}${prod ? ` — ${prod.descripcion}` : ""}` };
  });
  const disponiblesPorProducto = new Map<string, number>();
  for (const a of assets ?? []) disponiblesPorProducto.set(a.product_id, (disponiblesPorProducto.get(a.product_id) ?? 0) + 1);

  // Pedidos abiertos primero (urgentes arriba); los cerrados quedan abajo, del más nuevo al más viejo.
  const cerrado = (e: string) => e === "entregado" || e === "cancelado";
  const orders = [...(ordersRaw ?? [])].sort((a, b) => {
    if (cerrado(a.estado) !== cerrado(b.estado)) return cerrado(a.estado) ? 1 : -1;
    if (!cerrado(a.estado) && a.prioridad !== b.prioridad) return a.prioridad === "urgente" ? -1 : 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const costoDe = (items: Item[]) =>
    items.filter((i) => i.estado_item !== "rechazado").reduce((acc, i) => acc + (precioDe.get(i.product_id) ?? 0) * i.cantidad, 0);
  const costoTotal = orders.filter((o) => o.estado !== "cancelado").reduce((acc, o) => acc + costoDe((o.order_items as unknown as Item[]) ?? []), 0);
  const verCostos = role === "administracion" || role === "direccion" || role === "deposito";

  const hoy = hoyAR();
  const vigenteHoy = (a: { vigente_desde: string | null; vigente_hasta: string | null }) =>
    (!a.vigente_desde || a.vigente_desde <= hoy) && (!a.vigente_hasta || a.vigente_hasta >= hoy);

  const notices = (noticesRaw ?? []) as Notice[];
  const hayFiltros = !!(mes || filtroPaciente || filtroProf || filtroEstado !== "todos");

  return (
    <div className="space-y-6">
      <PageHeader
        action={
          esDeposito
            ? { label: "+ Iniciar pedido", href: "#nuevo-pedido" }
            : esCoord
            ? { label: "+ Pedir insumos", href: "#solicitar-insumos" }
            : undefined
        }
        icon={<IconTruck className="w-5 h-5" />}
        title={esCoord ? "Pedir insumos" : "Pedidos — flujo de entrega"}
        section="DF-C5 §4"
        purpose={
          esCoord
            ? "Pedí los insumos y equipos que necesita uno de tus pacientes. Depósito revisa cada línea y te avisa qué aceptó, qué ajustó y qué no pudo cubrir."
            : "Acá Depósito arma o revisa lo que hay que llevarle a un paciente. Si está cubierto por su autorización estándar se autoriza solo; si no, espera el visto bueno de Administración. Después se prepara, se entrega con firma y queda el remito."
        }
        description="Solicitud (Coordinación) → revisión ítem por ítem (Depósito) → autorización → preparado → despacho (remito) → entrega con firma."
      />

      <NoticesPanel notices={notices} action={markNoticesReadAction} title={esDeposito ? "Avisos nuevos" : "Avisos para vos"} />

      <form method="get" className="bg-white rounded-2xl border border-slate-200 p-4 grid grid-cols-1 sm:grid-cols-5 gap-2 items-end">
        <label className="text-xs text-slate-500 flex flex-col gap-1">
          Estado
          <select name="estado" defaultValue={filtroEstado} className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm bg-white">
            <option value="todos">Todos</option>
            {Object.entries(ESTADO_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-500 flex flex-col gap-1">
          Mes
          <input type="month" name="mes" defaultValue={mes} className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm" />
        </label>
        {!esCoord && (
          <label className="text-xs text-slate-500 flex flex-col gap-1">
            Paciente
            <select name="paciente" defaultValue={filtroPaciente} className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm bg-white">
              <option value="">Todos</option>
              {(patients ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.nombre_completo}</option>
              ))}
            </select>
          </label>
        )}
        {!esCoord && (
          <label className="text-xs text-slate-500 flex flex-col gap-1">
            Profesional
            <select name="profesional" defaultValue={filtroProf} className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm bg-white">
              <option value="">Todos</option>
              {(profesionales ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </label>
        )}
        <div className="flex gap-2">
          <button className="rounded-lg bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800">Filtrar</button>
          {hayFiltros && (
            <Link href="/pedidos" className="rounded-lg border border-slate-300 text-slate-600 text-sm px-3 py-2 hover:bg-slate-50 inline-flex items-center">
              Limpiar
            </Link>
          )}
        </div>
      </form>

      <div className="flex items-center gap-3 flex-wrap text-xs text-slate-500 -mt-2">
        <span>
          {orders.length} pedido{orders.length === 1 ? "" : "s"}
          {verCostos && orders.length > 0 && <> · costo estimado {pesos(costoTotal)} (a precio de compra vigente)</>}
        </span>
        {orders.length > 0 && (
          <ExportCsvButton
            className="ml-auto !px-3 !py-1.5 !text-xs"
            filename="pedidos.csv"
            rows={orders.map((o) => {
              const items = (o.order_items as unknown as Item[]) ?? [];
              const pac = o.patients as unknown as Paciente | null;
              const prof = o.profesional as unknown as { full_name: string } | null;
              return {
                fecha: fechaHora(o.created_at),
                para: pac?.nombre_completo ?? prof?.full_name ?? "",
                estado: ESTADO_LABELS[o.estado] ?? o.estado,
                prioridad: o.prioridad,
                entrega: CANAL_LABELS[o.canal_entrega] ?? o.canal_entrega,
                items: items.filter((i) => i.estado_item !== "rechazado").map((i) => `${i.cantidad}x ${i.products?.descripcion ?? ""}`).join(" | "),
                costo_estimado: verCostos ? Math.round(costoDe(items)) : "",
              };
            })}
          />
        )}
      </div>

      <section className="space-y-4">
        {orders.map((order, idx) => {
          const patient = order.patients as unknown as Paciente | null;
          const prof = order.profesional as unknown as { full_name: string } | null;
          const creador = order.creador as unknown as { full_name: string } | null;
          const remito = (order.remitos as unknown as Remito[] | null)?.[0];
          const items = ((order.order_items as unknown as Item[]) ?? []).slice().sort((a, b) => a.id - b.id);
          const retiroLocal = order.canal_entrega === "retiro_local";
          const steps = retiroLocal ? ["borrador", "autorizado", "preparado", "entregado"] : ["borrador", "autorizado", "preparado", "despachado", "entregado"];
          const stepIndex = steps.indexOf(order.estado);
          const pendientes = items.filter((i) => i.estado_item === "pendiente");
          const esSolicitud = order.origen === "solicitud";
          const direccion = patient?.domicilio ?? order.direccion_entrega;
          const telefono = patient?.contacto_familiar_telefono ?? patient?.telefono_contacto ?? null;
          const mapa = mapaUrl(direccion, null, null);
          const tel = telUrl(telefono);
          const verContacto = (role === "transporte" || role === "deposito" || role === "administracion") && !cerrado(order.estado);
          const autsPaciente = (authorizations ?? []).filter((a) => a.patient_id === order.patient_id && vigenteHoy(a));
          const costo = costoDe(items);
          const esFirmaImagen = !!remito?.firma_familiar_url?.startsWith("data:image/");
          const equiposEntrega = items
            .filter((i) => i.equipment_asset_id && i.estado_item !== "rechazado")
            .map((i) => ({ assetId: i.equipment_asset_id as string, label: `${i.equipment_assets?.numero_serie ?? ""} — ${i.products?.descripcion ?? ""}` }));
          const puedeConfirmar =
            (retiroLocal && role === "deposito" && (order.estado === "preparado" || order.estado === "despachado")) ||
            (!retiroLocal && role === "transporte" && order.estado === "despachado");

          return (
            <div key={order.id} id={`pedido-${order.id}`} className={`bg-white rounded-2xl border p-4 sm:p-5 scroll-mt-4 card-hover animate-fade-slide-up stagger-${Math.min(idx + 1, 8)} ${order.prioridad === "urgente" && !cerrado(order.estado) ? "border-red-300" : "border-slate-200"}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-100 text-slate-500 shrink-0 mt-0.5">
                    <IconMapPin className="w-4 h-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900">
                      {patient ? patient.nombre_completo : prof ? `Para ${prof.full_name} (profesional)` : "—"}
                      {patient && <span className="text-xs font-normal text-slate-400"> · DNI {patient.dni}</span>}
                    </div>
                    <div className="text-xs text-slate-500">{direccion ?? (retiroLocal ? "Retira en el local" : "")}</div>
                    {esSolicitud && (
                      <div className="text-[11px] text-slate-400 mt-0.5">Solicitud de Coordinación{creador ? ` · ${creador.full_name}` : ""} · {fechaHora(order.created_at)}</div>
                    )}
                    {!esSolicitud && <div className="text-[11px] text-slate-400 mt-0.5">Creado {fechaHora(order.created_at)}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {order.prioridad === "urgente" && !cerrado(order.estado) && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-red-100 text-red-700">
                      <IconAlert className="w-3 h-3" /> Urgente
                    </span>
                  )}
                  <span className="text-[11px] text-slate-500 bg-slate-50 rounded-full px-2.5 py-1">{CANAL_LABELS[order.canal_entrega]}</span>
                  <StatusBadge tone={ESTADO_TONE[order.estado]} label={ESTADO_LABELS[order.estado]} className="!text-xs !px-2.5 !py-1" />
                </div>
              </div>

              {order.prioridad === "urgente" && order.motivo_urgencia && !cerrado(order.estado) && (
                <div className="mt-2 text-xs text-red-700 bg-red-50 rounded-lg px-2.5 py-1.5 w-fit max-w-full">Motivo de la urgencia: {order.motivo_urgencia}</div>
              )}

              {verContacto && (tel || mapa) && (
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {patient?.contacto_familiar_nombre && <span className="text-slate-500 self-center">Contacto: {patient.contacto_familiar_nombre}</span>}
                  {tel && (
                    <a href={tel} className="inline-flex items-center rounded-lg border border-slate-300 text-slate-700 px-3 py-1.5 hover:bg-slate-50">Llamar {telefono}</a>
                  )}
                  {mapa && !retiroLocal && (
                    <a href={mapa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-lg border border-slate-300 text-slate-700 px-3 py-1.5 hover:bg-slate-50">Cómo llegar (mapa)</a>
                  )}
                </div>
              )}

              {order.autorizacion_automatica && order.estado !== "borrador" && (
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 rounded-lg px-2.5 py-1.5 w-fit max-w-full">
                  <IconRefresh className="w-3 h-3 shrink-0" />
                  Autorización automática: ítems ya cubiertos por la autorización estándar del paciente, sin revalidar.
                </div>
              )}
              {order.estado === "cancelado" && order.motivo_rechazo && (
                <div className="mt-2 text-[11px] text-red-700 bg-red-50 rounded-lg px-2.5 py-1.5 w-fit max-w-full">No autorizado — {order.motivo_rechazo}</div>
              )}

              {stepIndex >= 0 && order.estado !== "cancelado" && (
                <div className="mt-4 mb-3 px-1">
                  <div className="flex items-center">
                    {steps.map((s, i) => {
                      const done = i <= stepIndex;
                      const Icon = s === "borrador" ? IconClipboard : s === "autorizado" ? IconCheck : s === "preparado" ? IconBox : s === "despachado" ? IconTruck : IconSignature;
                      return (
                        <div key={s} className="flex items-center flex-1 last:flex-none">
                          <div className="flex flex-col items-center gap-1.5">
                            <span className={`flex items-center justify-center w-7 h-7 rounded-full border-2 transition-all duration-300 ${done ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-200 text-slate-300"}`}>
                              <Icon className="w-3.5 h-3.5" />
                            </span>
                            <span className={`text-[10px] font-medium ${done ? "text-slate-700" : "text-slate-400"}`}>{s === "despachado" ? "En camino" : ESTADO_LABELS[s]}</span>
                          </div>
                          {i < steps.length - 1 && (
                            <div className="flex-1 h-0.5 bg-slate-100 mx-1 -mt-4 rounded-full overflow-hidden">
                              <div className={`h-full bg-slate-900 progress-fill ${i < stepIndex ? "w-full" : "w-0"}`} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <ul className="text-sm text-slate-700 space-y-2 mb-3 mt-3">
                {items.map((item) => {
                  const esEquipo = item.products?.tipo === "equipo";
                  const hay = esEquipo ? disponiblesPorProducto.get(item.product_id) ?? 0 : item.products?.existencia_actual ?? 0;
                  const aut = autsPaciente.find((a) => a.product_id === item.product_id);
                  const cubierto = !!aut && item.cantidad <= aut.cantidad_autorizada;
                  const revisando = order.estado === "borrador" && esSolicitud;
                  return (
                    <li key={item.id} className="border border-slate-100 rounded-xl px-3 py-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-slate-900">
                          {item.cantidad}x {item.products?.descripcion}
                        </span>
                        {item.estado_item === "ajustado" && item.cantidad_solicitada != null && (
                          <span className="text-xs text-slate-400">(pidieron {item.cantidad_solicitada})</span>
                        )}
                        {item.equipment_assets?.numero_serie && <span className="text-xs text-slate-400">· serie {item.equipment_assets.numero_serie}</span>}
                        {esSolicitud && <StatusBadge tone={ITEM_TONE[item.estado_item]} label={ITEM_LABEL[item.estado_item]} />}
                      </div>
                      {item.motivo && item.estado_item !== "aceptado" && <div className="text-xs text-slate-500 mt-0.5">Motivo: {item.motivo}</div>}
                      {esDeposito && revisando && item.estado_item === "pendiente" && (
                        <div className="text-xs mt-1 flex flex-wrap gap-1.5">
                          <StatusBadge tone={hay >= item.cantidad ? "verde" : "rojo"} label={esEquipo ? `${hay} unidad${hay === 1 ? "" : "es"} disponible${hay === 1 ? "" : "s"}` : `Hay ${hay} en depósito${hay < item.cantidad ? ": no alcanza" : ""}`} />
                          <StatusBadge tone={cubierto ? "verde" : "amarillo"} label={cubierto ? `Cubierto por la autorización (hasta ${aut!.cantidad_autorizada})` : aut ? `Autorizado hasta ${aut.cantidad_autorizada}: se pasa` : "Sin autorización vigente"} />
                        </div>
                      )}
                      {esDeposito && revisando && item.estado_item === "pendiente" && (
                        <ItemReviewControls action={reviewItemAction} itemId={item.id} cantidad={item.cantidad} />
                      )}
                    </li>
                  );
                })}
                {items.length === 0 && <li className="text-slate-400 text-sm">Sin ítems cargados todavía.</li>}
              </ul>

              {esDeposito && order.estado === "borrador" && esSolicitud && pendientes.length > 1 && (
                <ActionForm action={acceptAllItemsAction} className="mb-3">
                  <input type="hidden" name="order_id" value={order.id} />
                  <SubmitButton className="rounded-lg border border-emerald-300 text-emerald-800 bg-emerald-50 text-xs font-medium px-3 py-1.5 hover:bg-emerald-100">
                    Aceptar los {pendientes.length} ítems pendientes
                  </SubmitButton>
                </ActionForm>
              )}

              {verCostos && costo > 0 && <p className="text-[11px] text-slate-400 mb-2">Costo estimado: {pesos(costo)}</p>}

              {remito?.fecha_despacho && (
                <div className="text-xs text-slate-500 mb-3 bg-slate-50 rounded-lg px-3 py-2 space-y-1">
                  <p>
                    Despachado: {fechaHora(remito.fecha_despacho)}
                    {remito.fecha_entrega && ` · Entregado: ${fechaHora(remito.fecha_entrega)}`}
                    {remito.firmante_nombre && ` · Firmó: ${remito.firmante_nombre}`}
                    {!esFirmaImagen && remito.firma_familiar_url && !remito.firmante_nombre && ` · Firma: ${remito.firma_familiar_url}`}
                    {remito.notificacion_enviada_at && <span className="text-emerald-700"> · Notificado al familiar ({remito.notificacion_canal})</span>}
                  </p>
                  {esFirmaImagen && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={remito.firma_familiar_url!} alt="Firma de quien recibió" className="h-14 rounded border border-slate-200 bg-white" />
                  )}
                  {remito.entrega_lat != null && remito.entrega_lng != null && (
                    <a href={mapaUrl(null, remito.entrega_lat, remito.entrega_lng)!} target="_blank" rel="noopener noreferrer" className="underline text-slate-600">
                      Ver dónde se entregó
                    </a>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2 items-start">
                {(order.estado === "despachado" || order.estado === "entregado") && (
                  <Link
                    href={`/pedidos/${order.id}/remito`}
                    className="rounded-lg border border-slate-300 text-slate-700 text-xs font-medium px-3.5 py-2 hover:bg-slate-50 inline-flex items-center gap-1.5"
                  >
                    <IconClipboard className="w-3.5 h-3.5" /> Ver e imprimir remito
                  </Link>
                )}

                {esDeposito && order.estado === "borrador" && !esSolicitud && (
                  <ActionDisclosure label="Agregar ítem a este pedido" tone="subtle" className="w-full !mt-0">
                    <ActionForm action={addOrderItemAction} className="flex flex-wrap gap-2 items-start">
                      <input type="hidden" name="destino" value={order.profesional_id ? "profesional" : "paciente"} />
                      <input type="hidden" name="patient_id" value={order.patient_id ?? ""} />
                      <input type="hidden" name="profesional_id" value={order.profesional_id ?? ""} />
                      <SearchableSelect name="product_id" required placeholder="Producto..." className="w-64" options={optProductos} />
                      <select name="equipment_asset_id" aria-label="Unidad física" className="rounded-lg border border-slate-300 px-2 py-2 text-sm bg-white max-w-full">
                        <option value="">(sin unidad serializada)</option>
                        {unidades.map((u) => (
                          <option key={u.id} value={u.id}>{u.label}</option>
                        ))}
                      </select>
                      <input name="cantidad" type="number" min="1" defaultValue="1" aria-label="Cantidad" className="w-20 rounded-lg border border-slate-300 px-2 py-2 text-sm" />
                      <SubmitButton className="rounded-lg bg-slate-900 text-white text-xs font-medium px-3 py-2 hover:bg-slate-800 transition-colors">Agregar</SubmitButton>
                    </ActionForm>
                  </ActionDisclosure>
                )}

                {role === "administracion" && order.estado === "borrador" && items.length > 0 && pendientes.length === 0 && (
                  <>
                    <ActionForm action={authorizeOrderAction}>
                      <input type="hidden" name="order_id" value={order.id} />
                      <SubmitButton className="rounded-lg bg-blue-600 text-white text-xs font-medium px-3.5 py-2 hover:bg-blue-700 transition-colors">
                        <span className="inline-flex items-center gap-1.5"><IconCheck className="w-3.5 h-3.5" /> Autorizar pedido</span>
                      </SubmitButton>
                    </ActionForm>
                    <ActionForm action={rejectOrderAction} className="flex items-center gap-1.5 flex-wrap">
                      <input type="hidden" name="order_id" value={order.id} />
                      <input name="motivo_rechazo" placeholder="Motivo (opcional)" className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm" />
                      <ConfirmButton className="rounded-lg bg-red-50 text-red-700 text-xs font-medium px-3.5 py-2 hover:bg-red-100 transition-colors" confirmLabel="¿Seguro? Tocá de nuevo">
                        No autorizar
                      </ConfirmButton>
                    </ActionForm>
                  </>
                )}
                {role === "administracion" && order.estado === "borrador" && pendientes.length > 0 && (
                  <span className="text-xs text-slate-500 self-center">Depósito todavía está revisando los ítems de esta solicitud.</span>
                )}
                {esDeposito && order.estado === "borrador" && !esSolicitud && items.length > 0 && (
                  <span className="text-xs text-slate-500 self-center">Espera la autorización de Administración (algún ítem no está cubierto por la autorización estándar).</span>
                )}
                {esDeposito && order.estado === "borrador" && esSolicitud && pendientes.length === 0 && items.some((i) => i.estado_item !== "rechazado") && (
                  <span className="text-xs text-slate-500 self-center">Revisada. Espera la autorización de Administración.</span>
                )}

                {esCoord && order.estado === "borrador" && esSolicitud && order.creado_por === profile.id && (
                  <ActionForm action={cancelSolicitudAction}>
                    <input type="hidden" name="order_id" value={order.id} />
                    <ConfirmButton className="rounded-lg border border-slate-300 text-slate-600 text-xs font-medium px-3.5 py-2 hover:bg-slate-50" confirmLabel="¿Cancelar la solicitud? Tocá de nuevo">
                      Cancelar solicitud
                    </ConfirmButton>
                  </ActionForm>
                )}

                {esDeposito && order.estado === "autorizado" && (
                  <ActionForm action={markPreparedAction}>
                    <input type="hidden" name="order_id" value={order.id} />
                    <SubmitButton className="rounded-lg bg-amber-600 text-white text-xs font-medium px-3.5 py-2 hover:bg-amber-700 transition-colors">
                      <span className="inline-flex items-center gap-1.5"><IconBox className="w-3.5 h-3.5" /> Marcar como preparado</span>
                    </SubmitButton>
                  </ActionForm>
                )}

                {esDeposito && order.estado === "preparado" && !retiroLocal && (
                  <ActionForm action={dispatchOrderAction} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="order_id" value={order.id} />
                    <label className="text-[11px] text-slate-500 flex flex-col gap-0.5">
                      Entregar el día
                      <input type="date" name="fecha" defaultValue={hoy} min={hoy} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                    </label>
                    <label className="text-[11px] text-slate-500 flex flex-col gap-0.5">
                      Hora (opcional)
                      <input type="time" name="hora" className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                    </label>
                    <SubmitButton className="rounded-lg bg-amber-600 text-white text-xs font-medium px-3.5 py-2 hover:bg-amber-700 transition-colors" pendingLabel="Despachando…">
                      <span className="inline-flex items-center gap-1.5"><IconTruck className="w-3.5 h-3.5" /> Despachar (generar remito)</span>
                    </SubmitButton>
                  </ActionForm>
                )}
                {esDeposito && order.estado === "preparado" && retiroLocal && (
                  <span className="text-xs text-slate-500 self-center">Listo para que lo retiren. Cuando vengan, confirmá el retiro con su firma (abajo).</span>
                )}

                {puedeConfirmar && (
                  <ActionDisclosure
                    label={retiroLocal ? "Confirmar retiro y firma" : "Confirmar entrega y firma"}
                    tone="default"
                    className="w-full !mt-0"
                  >
                    <DeliveryForm action={deliverOrderAction} orderId={order.id} retiroLocal={retiroLocal} equipos={equiposEntrega} />
                  </ActionDisclosure>
                )}
              </div>
            </div>
          );
        })}
        {orders.length === 0 && (
          <p className="text-sm text-slate-500 bg-white rounded-2xl border border-slate-200 p-5">
            {hayFiltros ? "No hay pedidos con esos filtros." : esCoord ? "Todavía no pediste insumos. Tocá «+ Pedir insumos» para armar la primera solicitud." : "No hay pedidos todavía."}
          </p>
        )}
      </section>

      {esDeposito && (
        <SidePanel id="nuevo-pedido" title="Nuevo pedido">
          <NuevoPedidoDeposito action={addOrderItemAction} pacientes={optPacientes} profesionales={optProf} productos={optProductos} unidades={unidades} />
        </SidePanel>
      )}
      {esCoord && (
        <SidePanel id="solicitar-insumos" title="Pedir insumos">
          <SolicitudCoordinador action={solicitarInsumosAction} pacientes={optPacientes} productos={optProductos} />
        </SidePanel>
      )}
    </div>
  );
}
