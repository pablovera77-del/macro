"use client";

import ActionForm, { SubmitButton } from "@/components/facturacion/ActionForm";
import { updateObraSocialConfigAction } from "@/app/(dashboard)/obras-sociales/actions";

// C4-05/06/09/10: reglas de facturación, modalidad, plazo y contacto de auditoría de una obra social.
export default function ConfigObraSocialForm({
  obraSocialId,
  reglas,
  modalidad,
  dias,
  contactoNombre,
  contactoTelefono,
  contactoEmail,
}: {
  obraSocialId: string;
  reglas: string | null;
  modalidad: string | null;
  dias: number;
  contactoNombre: string | null;
  contactoTelefono: string | null;
  contactoEmail: string | null;
}) {
  const input = "rounded-lg border border-slate-300 px-3 py-2 text-base sm:text-sm w-full";
  const label = "block text-xs font-medium text-slate-600 mb-1";
  return (
    <ActionForm action={updateObraSocialConfigAction} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <input type="hidden" name="obra_social_id" value={obraSocialId} />
      <div>
        <label className={label} htmlFor={`mod-${obraSocialId}`}>¿Cómo factura esta obra social?</label>
        <select id={`mod-${obraSocialId}`} name="modalidad_facturacion" defaultValue={modalidad ?? ""} className={input}>
          <option value="">Sin definir</option>
          <option value="modulos">Por módulos</option>
          <option value="prestaciones">Por prestaciones</option>
        </select>
      </div>
      <div>
        <label className={label} htmlFor={`dias-${obraSocialId}`}>Días para presentar (desde fin de mes)</label>
        <input id={`dias-${obraSocialId}`} name="dias_para_facturar" type="number" min={0} max={365} defaultValue={dias} className={input} />
      </div>
      <div className="sm:col-span-2">
        <label className={label} htmlFor={`reg-${obraSocialId}`}>Reglas de facturación propias</label>
        <textarea
          id={`reg-${obraSocialId}`}
          name="reglas_facturacion"
          rows={3}
          defaultValue={reglas ?? ""}
          placeholder="Ej. presentar con orden médica sellada y planilla de visitas firmada por el familiar"
          className={input}
        />
      </div>
      <div>
        <label className={label} htmlFor={`cn-${obraSocialId}`}>Contacto de auditoría: nombre</label>
        <input id={`cn-${obraSocialId}`} name="auditoria_contacto_nombre" defaultValue={contactoNombre ?? ""} className={input} />
      </div>
      <div>
        <label className={label} htmlFor={`ct-${obraSocialId}`}>Teléfono</label>
        <input id={`ct-${obraSocialId}`} name="auditoria_contacto_telefono" type="tel" defaultValue={contactoTelefono ?? ""} className={input} />
      </div>
      <div className="sm:col-span-2">
        <label className={label} htmlFor={`ce-${obraSocialId}`}>Email</label>
        <input id={`ce-${obraSocialId}`} name="auditoria_contacto_email" type="email" defaultValue={contactoEmail ?? ""} className={input} />
      </div>
      <SubmitButton className="rounded-lg bg-slate-900 text-white text-sm font-medium px-4 py-2.5 hover:bg-slate-800 transition-colors sm:col-span-2">
        Guardar configuración
      </SubmitButton>
    </ActionForm>
  );
}
