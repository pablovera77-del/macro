import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, SPECIALTY_LABELS } from "@/lib/auth";
import EvolucionDetalle from "@/components/hc/EvolucionDetalle";
import PrintButton from "@/components/hc/PrintButton";
import { EVOLUCION_COLS, fechaCortaAR, parseCampos } from "@/lib/hc";

// Disciplinas cuya planilla lleva al pie la firma y el sello de la coordinación (R79).
const CON_PIE_COORDINACION = ["enfermeria", "kinesiologia"];

/**
 * Vista de impresión / PDF de una evolución (R78-R81).
 * - ?modo=completo (por defecto): todo el formulario.
 * - ?modo=os: para obra social, sin la narrativa extendida.
 * No se imprimen las horas internas de apertura y cierre de la visita; solo la fecha de la visita
 * y la fecha y hora de las firmas.
 */
export default async function ImprimirEvolucionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ modo?: string }>;
}) {
  const { id } = await params;
  const { modo: modoParam } = await searchParams;
  const modo = modoParam === "os" ? "os" : "completo";
  const { profile } = await requireProfile();
  if (!["administracion", "coordinador_internacion", "profesional_asistencial", "direccion"].includes(profile.role)) redirect("/inicio");

  const supabase = await createClient();
  const cols = `${EVOLUCION_COLS}, patients(nombre_completo, dni, obra_social, numero_afiliado, obras_sociales(nombre)), profiles(full_name), visits(fecha_realizada, fecha_programada)` as const;
  const { data: e } = await supabase.from("evolutions").select(cols).eq("id", id).maybeSingle();
  if (!e) notFound();

  const { data: templates } = await supabase.from("discipline_form_templates").select("id, titulo, especialidad, campos");
  const template = (templates ?? []).find((t) => t.id === e.template_id) ?? (templates ?? []).find((t) => t.especialidad === e.especialidad);
  const campos = parseCampos(template?.campos);

  const paciente = e.patients as unknown as { nombre_completo: string; dni: string | null; obra_social: string | null; numero_afiliado: string | null; obras_sociales: { nombre: string } | null } | null;
  const visita = e.visits as unknown as { fecha_realizada: string | null; fecha_programada: string } | null;
  const autor = (e.profiles as unknown as { full_name: string } | null)?.full_name;
  const fechaVisita = visita?.fecha_realizada ?? visita?.fecha_programada ?? e.created_at;
  const obraSocial = paciente?.obras_sociales?.nombre ?? paciente?.obra_social ?? "—";
  const disciplina = SPECIALTY_LABELS[e.especialidad] ?? e.especialidad;
  const ubicaciones = [
    e.firma_lat != null && e.firma_lng != null ? `Firma del profesional: ${e.firma_lat.toFixed(5)}, ${e.firma_lng.toFixed(5)}` : null,
    e.conformidad_lat != null && e.conformidad_lng != null ? `Conformidad: ${e.conformidad_lat.toFixed(5)}, ${e.conformidad_lng.toFixed(5)}` : null,
  ].filter(Boolean);

  const tab = "text-sm px-3 py-1.5 rounded-lg border";
  return (
    <div className="space-y-4">
      <div className="no-print flex items-center gap-2 flex-wrap">
        <Link href="/evoluciones#historial" className="text-sm text-slate-600 underline underline-offset-2 mr-2">
          ← Volver al historial
        </Link>
        <Link href={`/evoluciones/${id}/imprimir`} className={`${tab} ${modo === "completo" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-300"}`}>
          Completa
        </Link>
        <Link href={`/evoluciones/${id}/imprimir?modo=os`} className={`${tab} ${modo === "os" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-300"}`}>
          Para obra social
        </Link>
        <span className="flex-1" />
        <PrintButton />
      </div>

      <article className="print-doc bg-white rounded-2xl border border-slate-200 p-5 sm:p-8 text-black max-w-3xl mx-auto space-y-5">
        <div className="flex items-start justify-between gap-4 border-b-2 border-black pb-3">
          <div>
            <div className="text-base font-bold">Profesionales SRL</div>
            <div className="text-xs text-neutral-600">Internación domiciliaria</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold">Historia clínica · {disciplina}</div>
            <div className="text-xs text-neutral-600">{modo === "os" ? "Copia para obra social" : "Copia completa"}</div>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-[11px] text-neutral-600">Paciente</dt>
            <dd className="font-medium">{paciente?.nombre_completo}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-neutral-600">DNI</dt>
            <dd>{paciente?.dni ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-neutral-600">Obra social</dt>
            <dd>
              {obraSocial}
              {paciente?.numero_afiliado ? ` · afiliado ${paciente.numero_afiliado}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-neutral-600">Fecha de la visita</dt>
            <dd>{fechaCortaAR(fechaVisita)}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-neutral-600">Profesional</dt>
            <dd>
              {e.firma_profesional_nombre ?? autor}
              {e.firma_profesional_matricula ? ` · matrícula ${e.firma_profesional_matricula}` : ""}
            </dd>
          </div>
        </dl>

        <EvolucionDetalle e={e} campos={campos} modo={modo} profesionalNombre={autor} imprimible />

        {modo === "completo" && ubicaciones.length > 0 && <p className="text-[11px] text-neutral-600">Ubicación registrada al firmar. {ubicaciones.join(" · ")}</p>}

        {CON_PIE_COORDINACION.includes(e.especialidad) && (
          <div className="flex justify-end pt-6 break-inside-avoid">
            <div className="w-64 text-center">
              <div className="h-20 border-b border-black" />
              <div className="text-[11px] text-neutral-700 mt-1">Firma y sello de la coordinación</div>
            </div>
          </div>
        )}
      </article>
    </div>
  );
}
