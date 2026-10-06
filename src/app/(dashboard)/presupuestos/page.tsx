import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import SidePanel from "@/components/SidePanel";
import StatusBadge from "@/components/StatusBadge";
import { IconCash } from "@/components/icons";
import PresupuestoForm from "@/components/presupuestos/PresupuestoForm";
import { ROLES_PRESUPUESTOS, formatARS, fechaCorta, totalPresupuesto, vencimientoPresupuesto, numeroPresupuesto } from "@/lib/facturacion";
import { hoyAR } from "@/lib/plan";

export default async function PresupuestosPage() {
  const { profile } = await requireProfile();
  if (!ROLES_PRESUPUESTOS.includes(profile.role)) redirect("/inicio");
  const canManage = profile.role === "facturacion";
  const supabase = await createClient();

  const [{ data: quotes }, { data: items }, { data: obrasSociales }] = await Promise.all([
    supabase
      .from("sales_quotes")
      .select("id, numero, obra_social_id, destinatario_particular, fecha, validez_dias, obras_sociales(nombre)")
      .order("numero", { ascending: false }),
    supabase.from("sales_quote_items").select("quote_id, cantidad, valor_unitario"),
    supabase.from("obras_sociales").select("id, nombre, valor_modulo").eq("activa", true).order("nombre"),
  ]);
  const hoy = hoyAR();

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
            : "Acá consultás los presupuestos de venta que armó Administración."
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
                  <StatusBadge tone={vigente ? "verde" : "gris"} label={vigente ? `Vigente hasta ${fechaCorta(vence)}` : `Venció el ${fechaCorta(vence)}`} />
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
          <PresupuestoForm obrasSociales={obrasSociales ?? []} />
        </SidePanel>
      )}
    </div>
  );
}
