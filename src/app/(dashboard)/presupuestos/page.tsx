import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import SidePanel from "@/components/SidePanel";
import StatusBadge from "@/components/StatusBadge";
import { IconCash } from "@/components/icons";
import PresupuestoForm from "@/components/presupuestos/PresupuestoForm";
import { ROLES_PRESUPUESTOS, ESTADOS_PRESUPUESTO, formatARS, fechaCorta, totalPresupuesto, vencimientoPresupuesto, numeroPresupuesto } from "@/lib/facturacion";
import { hoyAR } from "@/lib/plan";
import { PRACTICA_POR_CODIGO } from "@/lib/autorizaciones";

export default async function PresupuestosPage() {
  const { profile } = await requireProfile();
  if (!ROLES_PRESUPUESTOS.includes(profile.role)) redirect("/inicio");
  const canManage = profile.role === "facturacion";
  const supabase = await createClient();

  const [{ data: quotes }, { data: items }, { data: obrasSociales }, { data: honorarios }, { data: ivaCfg }] = await Promise.all([
    supabase
      .from("sales_quotes")
      .select("id, numero, obra_social_id, destinatario_particular, fecha, validez_dias, estado, obras_sociales(nombre)")
      .order("numero", { ascending: false }),
    supabase.from("sales_quote_items").select("quote_id, cantidad, valor_unitario"),
    supabase.from("obras_sociales").select("id, nombre, valor_modulo").eq("activa", true).order("nombre"),
    supabase.from("honorarios_prestacion").select("practica_tipo, costo_unitario"),
    supabase.from("app_settings").select("valor").eq("clave", "iva_presupuestos").maybeSingle(),
  ]);
  const hoy = hoyAR();
  const honorariosOpts = (honorarios ?? []).map((h) => ({ label: PRACTICA_POR_CODIGO[h.practica_tipo]?.label ?? h.practica_tipo, costo: Number(h.costo_unitario) }));
  const ivaPct = Number(ivaCfg?.valor ?? 21);

  return (
    <div className="space-y-8">
      <PageHeader
        action={canManage ? { label: "+ Nuevo presupuesto", href: "#nuevo-presupuesto" } : undefined}
        icon={<IconCash className="w-5 h-5" />}
        title="Presupuestos de venta"
        section="DF-C4 §3.3"
        purpose={
          canManage
            ? "Armá un presupuesto para una obra social o para un particular, con los valores vigentes, e imprimilo o guardalo en PDF."
            : "Acá consultás los presupuestos de venta que armó Facturación."
        }
        description="Presupuestos a obra social o particular con vista imprimible."
      />

      <section className="space-y-3">
        {(quotes ?? []).map((q, i) => {
          const total = totalPresupuesto((items ?? []).filter((x) => x.quote_id === q.id));
          const os = q.obras_sociales as unknown as { nombre: string } | null;
          const vence = vencimientoPresupuesto(q.fecha, q.validez_dias);
          const vigente = vence >= hoy;
          return (
            <Link
              key={q.id}
              href={`/presupuestos/${q.id}`}
              className={`block bg-white rounded-2xl border border-slate-200 p-5 card-hover animate-fade-slide-up stagger-${Math.min(i + 1, 8)}`}
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="font-medium text-slate-900">{os?.nombre ?? q.destinatario_particular}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {numeroPresupuesto(q.numero)} · {fechaCorta(q.fecha)}{!os && " · particular"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base font-semibold text-slate-900 tabular-nums">{formatARS(total)}</div>
                  <div className="flex items-center gap-1.5 justify-end flex-wrap">
                    <StatusBadge tone={ESTADOS_PRESUPUESTO[q.estado]?.tone ?? "gris"} label={ESTADOS_PRESUPUESTO[q.estado]?.label ?? q.estado} />
                    <StatusBadge tone={vigente ? "verde" : "gris"} label={vigente ? `Vigente hasta ${fechaCorta(vence)}` : `Venció el ${fechaCorta(vence)}`} />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
        {(quotes ?? []).length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 text-sm">
            Todavía no hay presupuestos.{canManage ? " Tocá «+ Nuevo presupuesto» para armar el primero." : ""}
          </div>
        )}
      </section>

      {canManage && (
        <SidePanel id="nuevo-presupuesto" title="Nuevo presupuesto">
          <PresupuestoForm obrasSociales={obrasSociales ?? []} honorarios={honorariosOpts} ivaPct={ivaPct} />
        </SidePanel>
      )}
    </div>
  );
}
