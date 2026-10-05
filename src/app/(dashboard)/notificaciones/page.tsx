import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import { IconBell } from "@/components/icons";
import MarcarLeidaForm from "@/components/usuarios/MarcarLeidaForm";

function cuando(iso: string) {
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/San_Juan" }).format(new Date(iso));
}

export default async function NotificacionesPage() {
  const { profile } = await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, mensaje, href, created_at, read_at, alert_type")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(60);
  const lista = data ?? [];
  const sinLeer = lista.filter((n) => !n.read_at);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<IconBell className="w-5 h-5" />}
        title="Avisos"
        section="DF-C1 §4.2 (R50-R54)"
        purpose="Acá ves los avisos que la plataforma te genera: un egreso informado, un cambio importante, algo que espera tu acción. Cuando lo resolvés o lo leíste, lo marcás como leído."
        description="Notificaciones dentro de la app, configurables en Configuración → Alertas."
      />

      {sinLeer.length > 0 && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-sm text-slate-600">{sinLeer.length} sin leer</span>
          <MarcarLeidaForm label="Marcar todos como leídos" />
        </div>
      )}

      <section className="space-y-2">
        {lista.map((n) => (
          <div key={n.id} className={`rounded-2xl border p-4 flex items-start justify-between gap-3 flex-wrap ${n.read_at ? "bg-white border-slate-200" : "bg-teal-50/60 border-teal-200"}`}>
            <div className="min-w-0">
              <p className={`text-sm ${n.read_at ? "text-slate-600" : "text-slate-900 font-medium"}`}>{n.mensaje}</p>
              <p className="text-xs text-slate-500 mt-1">{cuando(n.created_at)}</p>
              {n.href && (
                <Link href={n.href} className="no-touch text-xs text-teal-700 font-medium hover:underline">Ir a verlo</Link>
              )}
            </div>
            {!n.read_at && <MarcarLeidaForm id={n.id} />}
          </div>
        ))}
        {lista.length === 0 && <p className="text-sm text-slate-500">No tenés avisos por ahora.</p>}
      </section>
    </div>
  );
}
