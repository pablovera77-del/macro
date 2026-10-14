import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import PrintButton from "@/components/hc/PrintButton";
import { fechaHora } from "@/lib/stock-ui";

/**
 * Consentimientos del ingreso para imprimir o guardar como PDF (DF-C2 pregunta 11): Administración los baja y los
 * manda por WhatsApp o mail. Cada consentimiento figura con quién firmó, cuándo y desde dónde.
 */
export default async function ConsentimientosPdfPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireProfile();
  if (!["administracion", "coordinador_internacion", "direccion", "auditor_externo"].includes(profile.role)) redirect("/inicio");

  const supabase = await createClient();
  const [{ data: paciente }, { data: docs }, { data: firmas }] = await Promise.all([
    supabase.from("patients").select("nombre_completo, dni, domicilio, nro_historia_clinica").eq("id", id).maybeSingle(),
    supabase.from("legal_documents").select("id, titulo, resumen, requiere_firma_profesional").eq("activo", true).order("orden"),
    supabase.from("patient_document_signatures").select("legal_document_id, firmante_nombre, firmado_at, geolocalizacion_lat, geolocalizacion_lng, profesional_id, profesional_firmado_at").eq("patient_id", id),
  ]);
  if (!paciente) notFound();

  const profIds = [...new Set((firmas ?? []).map((f) => f.profesional_id).filter((x): x is string => !!x))];
  const { data: profs } = profIds.length ? await supabase.from("profiles").select("id, full_name, matricula").in("id", profIds) : { data: [] as { id: string; full_name: string; matricula: string | null }[] };
  const profDe = new Map((profs ?? []).map((p) => [p.id, p]));
  const firmaDe = new Map((firmas ?? []).map((f) => [f.legal_document_id, f]));
  const firmados = (docs ?? []).filter((d) => firmaDe.has(d.id));
  const pendientes = (docs ?? []).filter((d) => !firmaDe.has(d.id));

  return (
    <div className="space-y-4">
      <div className="no-print flex items-center justify-between gap-3 flex-wrap">
        <Link href={`/paciente/${id}?tab=ingreso`} className="text-sm text-slate-500 underline underline-offset-2">← Volver a la ficha</Link>
        <PrintButton label="Imprimir o guardar PDF" />
      </div>

      <article className="print-doc bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 text-black max-w-3xl mx-auto space-y-5">
        <header className="flex items-start justify-between gap-4 border-b-2 border-black pb-3">
          <div>
            <div className="text-base font-bold">Profesionales SRL</div>
            <div className="text-xs text-neutral-600">Internación domiciliaria</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold">Consentimientos del ingreso</div>
            <div className="text-xs text-neutral-600">Historia clínica N° {paciente.nro_historia_clinica ?? "—"}</div>
          </div>
        </header>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div><dt className="text-[11px] text-neutral-600">Paciente</dt><dd className="font-medium">{paciente.nombre_completo}</dd></div>
          <div><dt className="text-[11px] text-neutral-600">DNI</dt><dd>{paciente.dni}</dd></div>
          <div className="col-span-2"><dt className="text-[11px] text-neutral-600">Domicilio</dt><dd>{paciente.domicilio}</dd></div>
        </dl>

        {firmados.length === 0 && <p className="text-sm text-neutral-700">Todavía no hay consentimientos firmados para este paciente.</p>}

        {firmados.map((d, i) => {
          const f = firmaDe.get(d.id)!;
          const prof = f.profesional_id ? profDe.get(f.profesional_id) : null;
          return (
            <section key={d.id} className="border border-neutral-400 rounded-lg p-4 break-inside-avoid space-y-1.5">
              <h2 className="text-sm font-bold">{i + 1}. {d.titulo}</h2>
              {d.resumen && <p className="text-sm text-neutral-800">{d.resumen}</p>}
              <p className="text-sm pt-1">
                <strong>Firmado por:</strong> {f.firmante_nombre} <span className="text-neutral-600">· {fechaHora(f.firmado_at)}</span>
              </p>
              {f.geolocalizacion_lat != null && f.geolocalizacion_lng != null && (
                <p className="text-[11px] text-neutral-600">Ubicación al firmar: {f.geolocalizacion_lat.toFixed(5)}, {f.geolocalizacion_lng.toFixed(5)}</p>
              )}
              {d.requiere_firma_profesional && (
                <p className="text-sm">
                  <strong>Profesional actuante:</strong> {prof ? `${prof.full_name}${prof.matricula ? ` · matrícula ${prof.matricula}` : ""}` : "falta la firma del profesional"}
                  {f.profesional_firmado_at ? <span className="text-neutral-600"> · {fechaHora(f.profesional_firmado_at)}</span> : null}
                </p>
              )}
            </section>
          );
        })}

        {pendientes.length > 0 && (
          <p className="text-xs text-neutral-600">Pendientes de firma: {pendientes.map((d) => d.titulo).join(" · ")}.</p>
        )}
      </article>
    </div>
  );
}
