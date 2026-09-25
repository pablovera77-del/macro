import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import { IconChart, IconBox, IconMapPin, IconAlert, IconTruck, IconUsers, IconCalendar, IconCash, IconSignature, IconClipboardCheck } from "@/components/icons";

function formatARS(value: number | null) {
if (value == null) return "—";
return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

export default async function DashboardPage() {
await requireProfile();
const supabase = await createClient();

const [
{ data: disponibilidad },
{ data: enDomicilio },
{ data: retiradosSinConfirmar },
{ data: costosPorPaciente },
{ data: pacientes },
{ data: visitas },
{ data: evoluciones },
{ data: periodosFacturacion },
{ data: debitosPendientes },
{ data: vencimientos },
{ data: quoteRequestsAbiertas },
{ data: purchaseOrdersAbiertas },
{ data: purchaseOrderItemsAbiertos },
] = await Promise.all([
supabase.from("v_disponibilidad_deposito").select("*"),
supabase.from("v_equipos_en_domicilio").select("*"),
supabase.from("v_equipos_retirados_sin_confirmar").select("*"),
supabase.from("v_costos_por_paciente").select("*"),
supabase.from("patients").select("id, estado"),
supabase.from("visits").select("id, estado, fecha_programada"),
supabase.from("evolutions").select("id, created_at"),
supabase.from("billing_periods").select("id, estado, total_facturado"),
supabase.from("billing_debits").select("id, monto, estado"),
supabase.from("v_treatment_authorization_status").select("estado_semaforo"),
supabase.from("quote_requests").select("id").neq("estado", "cerrada"),
supabase.from("purchase_orders").select("id").not("estado", "in", "(recibida,cancelada)"),
supabase.from("purchase_order_items").select("cantidad, precio_unitario, purchase_orders!inner(estado)").not("purchase_orders.estado", "in", "(recibida,cancelada)"),
]);

const pacientesActivos = (pacientes ?? []).filter((p) => p.estado === "activo").length;
const pacientesPendientesLlegada = (pacientes ?? []).filter((p) => p.estado === "admitido_pendiente_llegada").length;

const inicioSemana = new Date();
inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay());
inicioSemana.setHours(0, 0, 0, 0);
const visitasSemana = (visitas ?? []).filter((v) => new Date(v.fecha_programada) >= inicioSemana);
const visitasRealizadasSemana = visitasSemana.filter((v) => v.estado === "realizada").length;

const hoy = new Date().toISOString().slice(0, 10);
const evolucionesHoyCount = (evoluciones ?? []).filter((e) => e.created_at.slice(0, 10) === hoy).length;

const periodosAbiertos = (periodosFacturacion ?? []).filter((p) => p.estado !== "facturado").length;
const totalDebitosPendientes = (debitosPendientes ?? [])
.filter((d) => d.estado === "pendiente" || d.estado === "en_gestion")
.reduce((acc, d) => acc + d.monto, 0);

const autorizacionesVencenPronto = (vencimientos ?? []).filter((v) => v.estado_semaforo !== "vigente").length;

const totalDescartablesEnStock = (disponibilidad ?? [])
.filter((d) => d.tipo !== "equipo")
.reduce((acc, d) => acc + (d.existencia_actual ?? 0), 0);

const totalEquiposDisponibles = (disponibilidad ?? [])
.filter((d) => d.tipo === "equipo")
.reduce((acc, d) => acc + (d.unidades_disponibles ?? 0), 0);

const costoTotalEstimado = (costosPorPaciente ?? []).reduce((acc, c) => acc + (c.costo_estimado ?? 0), 0);

const alertCount = (retiradosSinConfirmar ?? []).length;

const cotizacionesAbiertas = (quoteRequestsAbiertas ?? []).length;
const ordenesCompraAbiertas = (purchaseOrdersAbiertas ?? []).length;
const valorComprometido = (purchaseOrderItemsAbiertos ?? []).reduce(
(acc, it) => acc + it.cantidad * (it.precio_unitario ?? 0),
0
);

const stats = [
{ label: "Equipos en domicilios", value: (enDomicilio ?? []).length, icon: IconMapPin, tone: "from-blue-500 to-blue-600", href: "/seguimiento" },
{ label: "Equipos disponibles en depósito", value: totalEquiposDisponibles, icon: IconBox, tone: "from-emerald-500 to-emerald-600", href: "/catalogo" },
{ label: "Unidades de descartables/alimento", value: totalDescartablesEnStock, icon: IconTruck, tone: "from-violet-500 to-violet-600", href: "/catalogo" },
{ label: "Alertas de ubicación no confirmada", value: alertCount, icon: IconAlert, tone: "from-red-500 to-red-600", alert: alertCount > 0, href: "/seguimiento" },
];

return (
<div className="space-y-8">
<PageHeader
icon={<IconChart className="w-5 h-5" />}
title="Dashboard ejecutivo"
section="DF-C5 §6"
purpose="Foto en tiempo real de toda la operación — stock, pacientes, visitas y facturación — para que Dirección detecte un problema sin entrar módulo por módulo. Cada indicador lleva al módulo que lo explica en detalle."
description="Tráfico de insumos, disponibilidad en depósito, equipos en domicilios y costo estimado por paciente."
/>

<section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
{stats.map((s, i) => {
const Icon = s.icon;
const className = `animate-count-up stagger-${i + 1} card-hover rounded-2xl border p-5 relative overflow-hidden block ${
s.alert ? "bg-red-50 border-red-200" : "bg-white border-slate-200"
}`;
const content = (
<>
{s.alert && <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse-ring" />}
<span className={`inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${s.tone} text-white mb-3 shadow-sm`}>
<Icon className="w-5 h-5" />
</span>
<div className={`text-2xl font-semibold tabular-nums ${s.alert ? "text-red-700" : "text-slate-900"}`}>{s.value}</div>
<div className={`text-xs mt-1 leading-snug ${s.alert ? "text-red-600" : "text-slate-500"}`}>{s.label}</div>
</>
);
return s.href ? (
<Link key={s.label} href={s.href} className={className}>{content}</Link>
) : (
<div key={s.label} className={className}>{content}</div>
);
})}
</section>

<section className="bg-white rounded-2xl border border-slate-200 overflow-hidden animate-fade-slide-up card-hover">
<div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
<IconBox className="w-4 h-4 text-slate-400" />
<h2 className="text-sm font-medium text-slate-900">Disponibilidad en depósito</h2>
</div>
<div className="overflow-x-auto">
<table className="w-full text-sm">
<thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
<tr>
<th className="text-left px-5 py-2.5 font-medium">Código</th>
<th className="text-left px-5 py-2.5 font-medium">Producto</th>
<th className="text-left px-5 py-2.5 font-medium">Tipo</th>
<th className="text-right px-5 py-2.5 font-medium">Disponible</th>
</tr>
</thead>
<tbody className="divide-y divide-slate-100">
{(disponibilidad ?? []).map((d) => (
<tr key={d.product_id} className="row-hover hover:bg-slate-50">
<td className="px-5 py-2.5 font-mono text-xs text-slate-500">{d.codigo}</td>
<td className="px-5 py-2.5 text-slate-900">{d.descripcion}</td>
<td className="px-5 py-2.5 text-slate-600 capitalize">{d.tipo}</td>
<td className="px-5 py-2.5 text-right text-slate-700 font-medium tabular-nums">
{d.tipo === "equipo" ? d.unidades_disponibles : d.existencia_actual}
</td>
</tr>
))}
</tbody>
</table>
</div>
</section>

<section className="bg-white rounded-2xl border border-slate-200 overflow-hidden animate-fade-slide-up card-hover">
<div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
<div className="flex items-center gap-2">
<IconChart className="w-4 h-4 text-slate-400" />
<h2 className="text-sm font-medium text-slate-900">Costo estimado por paciente / obra social</h2>
</div>
<span className="text-xs font-medium text-slate-500 bg-slate-100 rounded-full px-3 py-1">
Total: {formatARS(costoTotalEstimado)}
</span>
</div>
<div className="overflow-x-auto">
<table className="w-full text-sm">
<thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
<tr>
<th className="text-left px-5 py-2.5 font-medium">Paciente</th>
<th className="text-left px-5 py-2.5 font-medium">Obra social</th>
<th className="text-right px-5 py-2.5 font-medium">Costo estimado</th>
</tr>
</thead>
<tbody className="divide-y divide-slate-100">
{(costosPorPaciente ?? []).map((c) => (
<tr key={c.patient_id} className="row-hover hover:bg-slate-50">
<td className="px-5 py-2.5 text-slate-900">{c.nombre_completo}</td>
<td className="px-5 py-2.5 text-slate-600">{c.obra_social ?? "—"}</td>
<td className="px-5 py-2.5 text-right text-slate-700 font-medium tabular-nums">{formatARS(c.costo_estimado)}</td>
</tr>
))}
{(costosPorPaciente ?? []).length === 0 && (
<tr><td colSpan={3} className="px-5 py-8 text-center text-slate-400 text-xs">Sin autorizaciones cargadas todavía.</td></tr>
)}
</tbody>
</table>
</div>
<p className="text-xs text-slate-400 px-5 py-3 border-t border-slate-100">
Estimado a partir del último precio de compra cargado × cantidad autorizada — no reemplaza el cálculo real de facturación (DF-C4).
</p>
</section>

{alertCount > 0 && (
<section className="bg-red-50 border border-red-200 rounded-2xl p-5 animate-fade-slide-up">
<div className="flex items-center gap-2 mb-3">
<span className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-100 text-red-600">
<IconAlert className="w-4 h-4" />
</span>
<h2 className="text-sm font-medium text-red-800">Equipos con ubicación no confirmada</h2>
</div>
<ul className="text-sm text-red-700 space-y-1.5">
{(retiradosSinConfirmar ?? []).map((r) => (
<li key={r.checklist_id} className="flex items-center gap-2">
<span className="w-1.5 h-1.5 rounded-full bg-red-400" />
<span className="font-mono text-xs">{r.numero_serie}</span> · {r.descripcion}
</li>
))}
</ul>
</section>
)}

<section className="animate-fade-slide-up">
<h2 className="text-sm font-medium text-slate-900 mb-3 flex items-center gap-2">
<span className="w-1.5 h-1.5 rounded-full bg-slate-900" /> Vista unificada de la plataforma — DF-C1 §1, indicadores cruzados C2-C4
</h2>
<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
{[
{ label: "Pacientes activos", value: pacientesActivos, icon: IconUsers, tone: "from-rose-500 to-rose-600", href: "/internacion" },
{ label: "Pendientes de llegada", value: pacientesPendientesLlegada, icon: IconUsers, tone: "from-amber-500 to-amber-600", href: "/internacion" },
{ label: "Visitas realizadas esta semana", value: `${visitasRealizadasSemana}/${visitasSemana.length}`, icon: IconCalendar, tone: "from-teal-500 to-teal-600", href: "/agenda" },
{ label: "Evoluciones cargadas hoy", value: evolucionesHoyCount, icon: IconSignature, tone: "from-indigo-500 to-indigo-600", href: "/evoluciones" },
{ label: "Autorizaciones por vencer/vencidas", value: autorizacionesVencenPronto, icon: IconAlert, tone: "from-orange-500 to-orange-600", alert: autorizacionesVencenPronto > 0, href: "/internacion" },
{ label: "Períodos de facturación abiertos", value: periodosAbiertos, icon: IconCash, tone: "from-blue-500 to-blue-600", href: "/facturacion" },
{ label: "Débitos pendientes de gestión", value: formatARS(totalDebitosPendientes), icon: IconAlert, tone: "from-red-500 to-red-600", alert: totalDebitosPendientes > 0, href: "/facturacion" },
].map((s, i) => {
const Icon = s.icon;
const className = `animate-count-up stagger-${i + 1} card-hover rounded-2xl border p-5 relative overflow-hidden block ${
s.alert ? "bg-red-50 border-red-200" : "bg-white border-slate-200"
}`;
const content = (
<>
<span className={`inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${s.tone} text-white mb-3 shadow-sm`}>
<Icon className="w-5 h-5" />
</span>
<div className={`text-2xl font-semibold tabular-nums ${s.alert ? "text-red-700" : "text-slate-900"}`}>{s.value}</div>
<div className={`text-xs mt-1 leading-snug ${s.alert ? "text-red-600" : "text-slate-500"}`}>{s.label}</div>
</>
);
return s.href ? (
<Link key={s.label} href={s.href} className={className}>{content}</Link>
) : (
<div key={s.label} className={className}>{content}</div>
);
})}
</div>
<p className="text-xs text-slate-400 mt-3">
Consolida C2 (visitas/evoluciones), C3 (pacientes/autorizaciones) y C4 (facturación) en una sola vista para Dirección — DF-C1 §1: &ldquo;vista unificada del negocio&rdquo;.
</p>
</section>

<section className="animate-fade-slide-up">
<h2 className="text-sm font-medium text-slate-900 mb-3 flex items-center gap-2">
<span className="w-1.5 h-1.5 rounded-full bg-slate-900" /> Proyección y compras — DF-C5 §6
</h2>
<div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
{[
{ label: "Cotizaciones a proveedores en curso", value: cotizacionesAbiertas, icon: IconClipboardCheck, tone: "from-[var(--brand-teal)] to-[var(--brand-green)]", href: "/compras" },
{ label: "Órdenes de compra en curso", value: ordenesCompraAbiertas, icon: IconTruck, tone: "from-violet-500 to-violet-600", href: "/compras" },
{ label: "Valor comprometido en compras abiertas", value: formatARS(valorComprometido), icon: IconCash, tone: "from-amber-500 to-amber-600", href: "/compras" },
].map((s, i) => {
const Icon = s.icon;
return (
<Link
key={s.label}
href={s.href}
className={`animate-count-up stagger-${i + 1} card-hover rounded-2xl border p-5 bg-white border-slate-200 relative overflow-hidden block`}
>
<span className={`inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${s.tone} text-white mb-3 shadow-sm`}>
<Icon className="w-5 h-5" />
</span>
<div className="text-2xl font-semibold tabular-nums text-slate-900">{s.value}</div>
<div className="text-xs mt-1 leading-snug text-slate-500">{s.label}</div>
</Link>
);
})}
</div>
<p className="text-xs text-slate-400 mt-3">
Proyección automática de compras a partir del consumo mensual autorizado por paciente, con generación de pedidos de cotización y comparativa de precios por proveedor — ver módulo{" "}
<a href="/compras" className="text-[var(--brand-teal)] underline underline-offset-2">Compras</a>.
</p>
</section>
</div>
);
}
