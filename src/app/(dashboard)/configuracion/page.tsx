import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import ActionDisclosure from "@/components/ActionDisclosure";
import { IconGrid } from "@/components/icons";
import { ParametroForm, ItemCatalogoForm, AgregarItemForm, AlertaForm } from "@/components/usuarios/ConfigForms";

const SECCIONES = [
  { id: "parametros", label: "Parámetros" },
  { id: "catalogos", label: "Catálogos" },
  { id: "alertas", label: "Alertas" },
] as const;

const NOMBRE_CATALOGO: Record<string, { titulo: string; ayuda: string }> = {
  motivos_reprogramacion: { titulo: "Motivos para reprogramar una visita", ayuda: "Aparecen al cambiar el día u horario de una visita en la Agenda." },
  motivos_baja: { titulo: "Motivos de baja del paciente", ayuda: "Referencia para el egreso." },
  especialidades: { titulo: "Disciplinas", ayuda: "Referencia de las disciplinas del equipo." },
  categorias_iva: { titulo: "Categorías de IVA", ayuda: "Referencia para el catálogo de insumos." },
  tipos_insumo: { titulo: "Tipos de insumo", ayuda: "Referencia para el catálogo de insumos." },
  coseguros: { titulo: "Coseguros", ayuda: "Referencia para las obras sociales." },
};

export default async function ConfiguracionPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { profile } = await requireProfile();
  // DF-C1 §4.2: la configuración la edita Administración.
  if (profile.role !== "administracion") redirect("/inicio");

  const { s } = await searchParams;
  const seccion = SECCIONES.find((x) => x.id === s)?.id ?? "parametros";
  const supabase = await createClient();

  const [{ data: params }, { data: items }, { data: alertas }, { data: destinatarios }] = await Promise.all([
    seccion === "parametros" ? supabase.from("app_settings").select("clave, valor, descripcion, updated_at").order("clave") : Promise.resolve({ data: [] }),
    seccion === "catalogos" ? supabase.from("catalog_items").select("id, catalogo, nombre, activo, orden").order("orden") : Promise.resolve({ data: [] }),
    seccion === "alertas" ? supabase.from("alert_types").select("codigo, nombre, descripcion, urgencia, mensaje, canal_app, canal_email, canal_whatsapp, activo").order("urgencia").order("nombre") : Promise.resolve({ data: [] }),
    seccion === "alertas" ? supabase.from("alert_type_recipients").select("alert_type, role").not("role", "is", null) : Promise.resolve({ data: [] }),
  ]);

  const porCatalogo = new Map<string, NonNullable<typeof items>>();
  (items ?? []).forEach((i) => porCatalogo.set(i.catalogo, [...(porCatalogo.get(i.catalogo) ?? []), i]));
  const rolesDe = (codigo: string) => (destinatarios ?? []).filter((d) => d.alert_type === codigo).map((d) => String(d.role));

  const NOMBRE_PARAM: Record<string, string> = {
    dias_aviso_autorizacion: "Días de aviso antes de que venza una autorización",
    horas_ubicacion_no_confirmada: "Horas para marcar en rojo un equipo que no llegó a depósito",
    umbral_visitas_dia: "Visitas por día esperadas de cada profesional",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<IconGrid className="w-5 h-5" />}
        title="Configuración"
        section="DF-C1 §4.2 (R42-R54, R78)"
        purpose="Acá ajustás las reglas de la plataforma sin pedirle nada a Sistemas: los plazos de aviso, las listas de opciones y qué alertas se generan, a quién le llegan y con qué texto."
        description="Parámetros, catálogos y catálogo de alertas editables por Administración."
      />

      <nav className="flex gap-2 overflow-x-auto" aria-label="Secciones">
        {SECCIONES.map((x) => (
          <Link
            key={x.id}
            href={`/configuracion?s=${x.id}`}
            className={`shrink-0 inline-flex items-center min-h-[44px] rounded-xl px-4 py-2 text-sm font-medium border ${x.id === seccion ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"}`}
          >
            {x.label}
          </Link>
        ))}
      </nav>

      {seccion === "parametros" && (
        <section className="space-y-3">
          {(params ?? []).map((p) => (
            <div key={p.clave} className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-2">
              <div className="font-medium text-slate-900">{NOMBRE_PARAM[p.clave] ?? p.clave}</div>
              {p.descripcion && <p className="text-xs text-slate-500">{p.descripcion}</p>}
              <ParametroForm clave={p.clave} valor={Number(p.valor)} />
            </div>
          ))}
          {(params ?? []).length === 0 && <p className="text-sm text-slate-500">No hay parámetros cargados.</p>}
        </section>
      )}

      {seccion === "catalogos" && (
        <section className="space-y-3">
          {Array.from(porCatalogo.entries()).map(([catalogo, lista]) => {
            const info = NOMBRE_CATALOGO[catalogo] ?? { titulo: catalogo, ayuda: "" };
            return (
              <div key={catalogo} className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
                <div className="font-medium text-slate-900">{info.titulo}</div>
                {info.ayuda && <p className="text-xs text-slate-500 mt-0.5">{info.ayuda}</p>}
                <p className="text-xs text-slate-500 mt-1">{lista.filter((i) => i.activo).length} visibles · {lista.filter((i) => !i.activo).length} ocultos</p>
                <ActionDisclosure label="Editar lista" tone="subtle">
                  <div className="space-y-2 rounded-xl bg-slate-50 border border-slate-200 p-3">
                    {lista.map((i) => (
                      <ItemCatalogoForm key={i.id} id={i.id} nombre={i.nombre} activo={i.activo} />
                    ))}
                    <hr className="border-slate-200" />
                    <AgregarItemForm catalogo={catalogo} />
                  </div>
                </ActionDisclosure>
              </div>
            );
          })}
        </section>
      )}

      {seccion === "alertas" && (
        <section className="space-y-3">
          <p className="text-xs text-slate-500">
            Los avisos llegan hoy dentro de la plataforma (campana arriba). El envío por email y WhatsApp todavía no está conectado: esas opciones quedan guardadas para cuando se active.
          </p>
          {(alertas ?? []).map((a) => (
            <div key={a.codigo} className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="font-medium text-slate-900">{a.nombre}</div>
                  {a.descripcion && <p className="text-xs text-slate-500 mt-0.5">{a.descripcion}</p>}
                </div>
                <span className={`text-[11px] rounded-full px-2 py-0.5 border ${a.activo ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
                  {a.activo ? "Activa" : "Desactivada"} · {a.urgencia === "inmediata" ? "Inmediata" : "Resumen"}
                </span>
              </div>
              <ActionDisclosure label="Editar alerta" tone="subtle">
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                  <AlertaForm a={a} rolesActuales={rolesDe(a.codigo)} />
                </div>
              </ActionDisclosure>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
