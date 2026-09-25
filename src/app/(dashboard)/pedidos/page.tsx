import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import {
addOrderItemAction,
authorizeOrderAction,
rejectOrderAction,
dispatchOrderAction,
deliverOrderAction,
} from "./actions";
import PageHeader from "@/components/PageHeader";
import SearchableSelect from "@/components/SearchableSelect";
import ActionDisclosure from "@/components/ActionDisclosure";
import { IconTruck, IconClipboard, IconCheck, IconSignature, IconMapPin, IconRefresh } from "@/components/icons";

const ESTADO_STEPS = ["borrador", "autorizado", "despachado", "entregado"];
const STEP_ICONS = [IconClipboard, IconCheck, IconTruck, IconSignature];
const STEP_LABELS = ["Borrador", "Autorizado", "Despachado", "Entregado"];
const ESTADO_LABELS: Record<string, string> = {
borrador: "Borrador",
autorizado: "Autorizado",
despachado: "Despachado",
entregado: "Entregado",
cancelado: "Cancelado",
};
const ESTADO_STYLES: Record<string, string> = {
borrador: "bg-slate-200 text-slate-600",
autorizado: "bg-blue-100 text-blue-700",
despachado: "bg-amber-100 text-amber-700",
entregado: "bg-emerald-100 text-emerald-700",
cancelado: "bg-red-100 text-red-700",
};

export default async function PedidosPage() {
const { profile } = await requireProfile();
const supabase = await createClient();

const [{ data: orders }, { data: patients }, { data: products }, { data: assets }] = await Promise.all([
supabase
.from("orders")
.select(
"id, estado, created_at, fecha_autorizacion, autorizacion_automatica, motivo_rechazo, patient_id, patients(nombre_completo, domicilio), order_items(id, cantidad, product_id, equipment_asset_id, products(descripcion)), remitos(fecha_despacho, fecha_entrega, firma_familiar_url)"
)
.order("created_at", { ascending: false }),
supabase.from("patients").select("id, nombre_completo").in("estado", ["activo", "admitido_pendiente_llegada"]),
supabase.from("products").select("id, descripcion, tipo").eq("active", true),
supabase.from("equipment_assets").select("id, numero_serie, product_id, estado").eq("estado", "disponible"),
]);

return (
<div className="space-y-8">
<PageHeader
icon={<IconTruck className="w-5 h-5" />}
title="Pedidos — flujo de entrega"
section="DF-C5 §4"
purpose="Acá Depósito arma lo que hay que llevarle a un paciente. Si ya está cubierto por su autorización estándar se autoriza solo; si no, espera el visto bueno de Administración antes de poder despacharse."
description="Pedido → autorización (automática o manual) → despacho (remito digital) → entrega con firma del familiar."
/>

<section className="space-y-4">
{(orders ?? []).map((order, idx) => {
const patient = order.patients as unknown as { nombre_completo: string; domicilio: string } | null;
const remito = (order.remitos as unknown as { fecha_despacho: string | null; fecha_entrega: string | null; firma_familiar_url: string | null }[])?.[0];
const items = (order.order_items as unknown as { id: number; cantidad: number; equipment_asset_id: string | null; products: { descripcion: string } | null }[]) ?? [];
const stepIndex = ESTADO_STEPS.indexOf(order.estado);

return (
<div key={order.id} className={`bg-white rounded-2xl border border-slate-200 p-5 card-hover animate-fade-slide-up stagger-${Math.min(idx + 1, 8)}`}>
<div className="flex items-start justify-between gap-4 flex-wrap">
<div className="flex items-start gap-3">
<span className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-100 text-slate-500 shrink-0 mt-0.5">
<IconMapPin className="w-4 h-4" />
</span>
<div>
<div className="font-medium text-slate-900">{patient?.nombre_completo ?? "—"}</div>
<div className="text-xs text-slate-500">{patient?.domicilio}</div>
</div>
</div>
<span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${ESTADO_STYLES[order.estado]}`}>
{ESTADO_LABELS[order.estado]}
</span>
</div>

{order.autorizacion_automatica && order.estado !== "borrador" && (
<div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-600 bg-emerald-50 rounded-lg px-2.5 py-1.5 w-fit">
<IconRefresh className="w-3 h-3" />
Autorización automática — ítems ya cubiertos por la autorización estándar del paciente, sin revalidar (DF-C5 §4).
</div>
)}
{order.estado === "cancelado" && order.motivo_rechazo && (
<div className="mt-2 flex items-center gap-1.5 text-[11px] text-red-600 bg-red-50 rounded-lg px-2.5 py-1.5 w-fit">
No autorizado — {order.motivo_rechazo}
</div>
)}

{stepIndex >= 0 && order.estado !== "cancelado" && (
<div className="mt-5 mb-4 px-1">
<div className="flex items-center">
{ESTADO_STEPS.map((s, i) => {
const StepIcon = STEP_ICONS[i];
const done = i <= stepIndex;
return (
<div key={s} className="flex items-center flex-1 last:flex-none">
<div className="flex flex-col items-center gap-1.5">
<span
className={`flex items-center justify-center w-7 h-7 rounded-full border-2 transition-all duration-300 ${
done ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-200 text-slate-300"
}`}
>
<StepIcon className="w-3.5 h-3.5" />
</span>
<span className={`text-[10px] font-medium ${done ? "text-slate-700" : "text-slate-300"}`}>{STEP_LABELS[i]}</span>
</div>
{i < ESTADO_STEPS.length - 1 && (
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

<ul className="text-sm text-slate-600 space-y-0.5 mb-3">
{items.map((item) => (
<li key={item.id} className="flex items-center gap-1.5">
<span className="w-1 h-1 rounded-full bg-slate-300" />
{item.cantidad}x {item.products?.descripcion}
{item.equipment_asset_id && <span className="text-xs text-slate-400">(unidad serializada)</span>}
</li>
))}
{items.length === 0 && <li className="text-slate-400">Sin ítems cargados todavía.</li>}
</ul>

{remito?.fecha_despacho && (
<p className="text-xs text-slate-400 mb-3 bg-slate-50 rounded-lg px-3 py-2">
Despachado: {new Date(remito.fecha_despacho).toLocaleString("es-AR")}
{remito.fecha_entrega && ` · Entregado: ${new Date(remito.fecha_entrega).toLocaleString("es-AR")}`}
{remito.firma_familiar_url && ` · Firma: ${remito.firma_familiar_url}`}
</p>
)}

<div className="flex flex-wrap gap-2">
{profile.role === "deposito" && order.estado === "borrador" && (
<ActionDisclosure label="Agregar ítem a este pedido" tone="subtle" className="w-full">
<form action={addOrderItemAction} className="flex flex-wrap gap-2 items-start">
<input type="hidden" name="patient_id" value={order.patient_id} />
<SearchableSelect
name="product_id"
required
placeholder="Producto..."
className="w-56"
options={(products ?? []).map((p) => ({ value: p.id, label: p.descripcion, group: p.tipo }))}
/>
<select name="equipment_asset_id" className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs">
<option value="">(sin unidad serializada)</option>
{(assets ?? []).map((a) => (
<option key={a.id} value={a.id}>{a.numero_serie}</option>
))}
</select>
<input name="cantidad" type="number" min="1" defaultValue="1" className="w-16 rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
<button className="rounded-lg bg-slate-900 text-white text-xs font-medium px-3 py-1.5 hover:bg-slate-800 transition-colors">
Agregar
</button>
</form>
</ActionDisclosure>
)}

{profile.role === "administracion" && order.estado === "borrador" && items.length > 0 && (
<>
<form action={authorizeOrderAction}>
<input type="hidden" name="order_id" value={order.id} />
<button className="rounded-lg bg-blue-600 text-white text-xs font-medium px-3.5 py-2 hover:bg-blue-700 transition-colors flex items-center gap-1.5">
<IconCheck className="w-3.5 h-3.5" /> Autorizar pedido
</button>
</form>
<form action={rejectOrderAction} className="flex items-center gap-1.5">
<input type="hidden" name="order_id" value={order.id} />
<input
name="motivo_rechazo"
placeholder="Motivo (opcional)"
className="rounded-lg border border-slate-300 px-2.5 py-2 text-xs"
/>
<button className="rounded-lg bg-red-50 text-red-700 text-xs font-medium px-3.5 py-2 hover:bg-red-100 transition-colors">
No autorizar
</button>
</form>
</>
)}

{profile.role === "deposito" && order.estado === "autorizado" && (
<form action={dispatchOrderAction}>
<input type="hidden" name="order_id" value={order.id} />
<button className="rounded-lg bg-amber-600 text-white text-xs font-medium px-3.5 py-2 hover:bg-amber-700 transition-colors flex items-center gap-1.5">
<IconTruck className="w-3.5 h-3.5" /> Despachar (generar remito)
</button>
</form>
)}

{profile.role === "transporte" && order.estado === "despachado" && (
<form action={deliverOrderAction} className="flex flex-wrap gap-2 items-center">
<input type="hidden" name="order_id" value={order.id} />
<input
name="firma_familiar"
placeholder="Nombre de quien firma"
className="rounded-lg border border-slate-300 px-2.5 py-2 text-xs"
/>
<button className="rounded-lg bg-emerald-600 text-white text-xs font-medium px-3.5 py-2 hover:bg-emerald-700 transition-colors flex items-center gap-1.5">
<IconSignature className="w-3.5 h-3.5" /> Confirmar entrega y firma
</button>
</form>
)}
</div>
</div>
);
})}
{(orders ?? []).length === 0 && (
<p className="text-sm text-slate-400">No hay pedidos todavía.</p>
)}
</section>

{profile.role === "deposito" && (
<section className="bg-white rounded-2xl border border-slate-200 p-5 animate-fade-slide-up card-hover">
<h2 className="text-sm font-medium text-slate-900 mb-4 flex items-center gap-2">
<span className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-500">+</span>
Iniciar pedido para un paciente nuevo
</h2>
<form action={addOrderItemAction} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
<SearchableSelect
name="patient_id"
required
placeholder="Paciente..."
className="sm:col-span-2"
options={(patients ?? []).map((p) => ({ value: p.id, label: p.nombre_completo }))}
/>
<SearchableSelect
name="product_id"
required
placeholder="Producto..."
options={(products ?? []).map((p) => ({ value: p.id, label: p.descripcion, group: p.tipo }))}
/>
<input name="cantidad" type="number" min="1" defaultValue="1" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
<select name="equipment_asset_id" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm sm:col-span-2">
<option value="">(sin unidad serializada)</option>
{(assets ?? []).map((a) => (
<option key={a.id} value={a.id}>{a.numero_serie}</option>
))}
</select>
<button className="rounded-xl bg-slate-900 text-white text-sm font-medium px-4 py-2.5 hover:bg-slate-800 transition-colors sm:col-span-2">
Crear pedido
</button>
</form>
</section>
)}
</div>
);
}
