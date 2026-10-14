"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import ConfirmButton from "@/components/ConfirmButton";
import { crearUsuarioAction, cambiarRolAction, activarUsuarioAction, guardarLegajoAction, guardarCupoAction, subirDocumentoLegajoAction, guardarFirmaSelloAction, type UsuarioResult } from "@/app/(dashboard)/usuarios/actions";
import { TIPOS_PROFESIONAL, TIPOS_DOCUMENTO_LEGAJO } from "@/lib/legajo-personal";
import { ROLES_ASIGNABLES, ROL_DESCRIPCION } from "@/lib/usuarios";
import { ROLE_LABELS, SPECIALTY_LABELS } from "@/lib/roles";
import { CUPOS, CUPO_CODIGOS } from "@/lib/cupos";

const inputCls = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/40";
const labelCls = "block text-xs font-medium text-slate-600 mb-1";
const btnCls = "rounded-xl bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800";

function Enviar({ children, pending: texto = "Guardando…" }: { children: React.ReactNode; pending?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${btnCls} ${pending ? "opacity-60 cursor-wait" : ""}`}>
      {pending ? texto : children}
    </button>
  );
}

function ErrorBox({ state }: { state: UsuarioResult }) {
  if (!state?.error) return null;
  return (
    <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
      {state.error}
    </p>
  );
}

const Opciones = () => (
  <>
    <option value="">— Sin disciplina —</option>
    {Object.entries(SPECIALTY_LABELS).map(([k, v]) => (
      <option key={k} value={k}>{v}</option>
    ))}
  </>
);

export function CrearUsuarioForm({ habilitado }: { habilitado: boolean }) {
  const [state, action] = useActionState(crearUsuarioAction, null as UsuarioResult);
  const [rol, setRol] = useState("profesional_asistencial");
  const [copiado, setCopiado] = useState(false);

  if (state?.creado) {
    const c = state.creado;
    const texto = `Hola ${c.nombre.split(" ")[0]}, ya tenés acceso a la plataforma.\nUsuario: ${c.email}\nContraseña provisoria: ${c.password}\nCuando ingreses, cambiala desde «Olvidé mi contraseña».`;
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 space-y-2">
          <p className="font-medium">Usuario creado: {c.nombre}</p>
          <p>Esta contraseña se muestra solo ahora. Copiala y mandásela por un medio seguro.</p>
          <pre className="whitespace-pre-wrap rounded-lg bg-white border border-emerald-200 p-3 text-xs text-slate-800">{texto}</pre>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(texto).then(() => setCopiado(true)).catch(() => setCopiado(false));
            }}
            className={btnCls}
          >
            {copiado ? "Copiado" : "Copiar mensaje"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      {!habilitado && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          La creación de usuarios desde esta pantalla todavía no está activada (falta cargar la clave de servicio en Vercel). Mientras tanto, las altas se hacen en Supabase.
        </p>
      )}
      <div>
        <label className={labelCls}>Nombre y apellido</label>
        <input name="full_name" required className={inputCls} autoComplete="off" />
      </div>
      <div>
        <label className={labelCls}>Email (es el usuario con el que ingresa)</label>
        <input name="email" type="email" required className={inputCls} autoComplete="off" />
      </div>
      <div>
        <label className={labelCls}>Rol</label>
        <select name="role" value={rol} onChange={(e) => setRol(e.target.value)} className={inputCls}>
          {ROLES_ASIGNABLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
        <p className="text-xs text-slate-500 mt-1">{ROL_DESCRIPCION[rol as keyof typeof ROL_DESCRIPCION]}</p>
      </div>
      {rol === "profesional_asistencial" && (
        <div>
          <label className={labelCls}>Disciplina</label>
          <select name="especialidad" className={inputCls} defaultValue="enfermeria">
            <Opciones />
          </select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>DNI</label>
          <input name="dni" inputMode="numeric" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Matrícula</label>
          <input name="matricula" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Teléfono</label>
          <input name="telefono" inputMode="tel" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Fecha de ingreso</label>
          <input name="fecha_ingreso" type="date" className={inputCls} />
        </div>
      </div>
      <ErrorBox state={state} />
      <Enviar pending="Creando…">Crear usuario</Enviar>
    </form>
  );
}

export function CambiarRolForm({ id, rol, esYo }: { id: string; rol: string; esYo: boolean }) {
  const [state, action] = useActionState(cambiarRolAction, null as UsuarioResult);
  if (esYo) return <p className="text-xs text-slate-500">No podés cambiar tu propio rol: pedile a otra persona de Administración.</p>;
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <div className="min-w-0 flex-1">
        <label className={labelCls}>Rol</label>
        <select name="role" defaultValue={rol} className={inputCls}>
          {ROLES_ASIGNABLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
      </div>
      <Enviar>Cambiar rol</Enviar>
      <div className="basis-full"><ErrorBox state={state} /></div>
    </form>
  );
}

export function ActivarForm({ id, activo, esYo }: { id: string; activo: boolean; esYo: boolean }) {
  const [state, action] = useActionState(activarUsuarioAction, null as UsuarioResult);
  if (esYo && activo) return null;
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="activo" value={activo ? "0" : "1"} />
      {activo ? (
        <ConfirmButton className="rounded-xl border border-red-300 text-red-700 bg-red-50 text-sm font-medium px-4 py-2 hover:bg-red-100" confirmLabel="¿Seguro? Tocá de nuevo para desactivar">
          Desactivar cuenta
        </ConfirmButton>
      ) : (
        <button type="submit" className={btnCls}>Reactivar cuenta</button>
      )}
      <ErrorBox state={state} />
    </form>
  );
}

export type LegajoDatos = {
  id: string;
  full_name: string;
  especialidad: string | null;
  dni: string | null;
  matricula: string | null;
  telefono: string | null;
  email_contacto: string | null;
  fecha_ingreso: string | null;
  fecha_baja: string | null;
  fecha_nacimiento: string | null;
  domicilio: string | null;
  cuil: string | null;
  tipo_profesional: string | null;
  tipo_profesional_otro: string | null;
};

export function LegajoForm({ p }: { p: LegajoDatos }) {
  const [state, action] = useActionState(guardarLegajoAction, null as UsuarioResult);
  const [tipo, setTipo] = useState(p.tipo_profesional ?? "");
  return (
    <form action={action} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <input type="hidden" name="id" value={p.id} />
      <div className="sm:col-span-2">
        <label className={labelCls}>Nombre y apellido</label>
        <input name="full_name" required defaultValue={p.full_name} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Tipo de profesional</label>
        <select name="tipo_profesional" value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputCls}>
          <option value="">— Sin definir —</option>
          {TIPOS_PROFESIONAL.map((t) => <option key={t.codigo} value={t.codigo}>{t.label}</option>)}
        </select>
      </div>
      {tipo === "otros" ? (
        <div>
          <label className={labelCls}>¿Qué práctica realiza?</label>
          <input name="tipo_profesional_otro" required defaultValue={p.tipo_profesional_otro ?? ""} className={inputCls} />
        </div>
      ) : (
        <div>
          <label className={labelCls}>Disciplina clínica</label>
          <select name="especialidad" defaultValue={p.especialidad ?? ""} className={inputCls}>
            <Opciones />
          </select>
        </div>
      )}
      <div>
        <label className={labelCls}>Matrícula</label>
        <input name="matricula" defaultValue={p.matricula ?? ""} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>DNI</label>
        <input name="dni" inputMode="numeric" defaultValue={p.dni ?? ""} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>CUIL</label>
        <input name="cuil" inputMode="numeric" placeholder="20-12345678-9" defaultValue={p.cuil ?? ""} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Fecha de nacimiento</label>
        <input name="fecha_nacimiento" type="date" defaultValue={p.fecha_nacimiento ?? ""} className={inputCls} />
      </div>
      <div className="sm:col-span-2">
        <label className={labelCls}>Domicilio</label>
        <input name="domicilio" defaultValue={p.domicilio ?? ""} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Teléfono</label>
        <input name="telefono" inputMode="tel" defaultValue={p.telefono ?? ""} className={inputCls} />
      </div>
      <div className="sm:col-span-2">
        <label className={labelCls}>Email de contacto</label>
        <input name="email_contacto" type="email" defaultValue={p.email_contacto ?? ""} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Fecha de ingreso</label>
        <input name="fecha_ingreso" type="date" defaultValue={p.fecha_ingreso ?? ""} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Fecha de baja</label>
        <input name="fecha_baja" type="date" defaultValue={p.fecha_baja ?? ""} className={inputCls} />
      </div>
      <div className="sm:col-span-2 space-y-2">
        <ErrorBox state={state} />
        <Enviar>Guardar legajo</Enviar>
      </div>
    </form>
  );
}

export function CupoForm({ id, cupo }: { id: string; cupo: string | null }) {
  const [state, action] = useActionState(guardarCupoAction, null as UsuarioResult);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <div className="min-w-0 flex-1">
        <label className={labelCls}>Cupo contratado (guía para Coordinación)</label>
        <select name="cupo" defaultValue={cupo ?? ""} className={inputCls}>
          <option value="">— Sin cupo definido —</option>
          {CUPO_CODIGOS.map((c) => (
            <option key={c} value={c}>{CUPOS[c].nombre} ({CUPOS[c].detalle})</option>
          ))}
        </select>
      </div>
      <Enviar>Guardar cupo</Enviar>
      <div className="basis-full"><ErrorBox state={state} /></div>
    </form>
  );
}

/** Subida de un documento al legajo (DNI, título, matrícula, vacunación, mala praxis). */
export function DocumentoLegajoForm({ id }: { id: string }) {
  const [state, action] = useActionState(subirDocumentoLegajoAction, null as UsuarioResult);
  return (
    <form action={action} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
      <input type="hidden" name="id" value={id} />
      <div>
        <label className={labelCls}>Documento</label>
        <select name="tipo" required defaultValue="" className={inputCls}>
          <option value="" disabled>Elegir…</option>
          {Object.entries(TIPOS_DOCUMENTO_LEGAJO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div>
        <label className={labelCls}>Vence (opcional)</label>
        <input name="vence" type="date" className={inputCls} />
      </div>
      <div className="sm:col-span-2">
        <label className={labelCls}>Archivo (PDF o foto, hasta 5 MB)</label>
        <input name="archivo" type="file" required accept="application/pdf,image/jpeg,image/png,image/webp" className="block w-full text-xs text-slate-600" />
      </div>
      <div className="sm:col-span-4 space-y-2">
        <ErrorBox state={state} />
        <Enviar pending="Subiendo…">Agregar al legajo</Enviar>
      </div>
    </form>
  );
}

/** Firma y sello digital del coordinador: se imprime en el pie de los PDF. */
export function FirmaSelloForm({ id, tiene }: { id: string; tiene: boolean }) {
  const [state, action] = useActionState(guardarFirmaSelloAction, null as UsuarioResult);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <div className="min-w-0 flex-1">
        <label className={labelCls}>Firma y sello digital {tiene ? "(ya cargados: subí otra imagen para reemplazarlos)" : "(imagen PNG o JPG, hasta 200 KB)"}</label>
        <input name="archivo" type="file" accept="image/png,image/jpeg,image/webp" className="block w-full text-xs text-slate-600" />
      </div>
      <Enviar pending="Guardando…">Guardar firma y sello</Enviar>
      {tiene && (
        <label className="flex items-center gap-1.5 text-xs text-slate-600"><input type="checkbox" name="quitar" value="1" /> Quitar los actuales</label>
      )}
      <div className="basis-full"><ErrorBox state={state} /></div>
    </form>
  );
}
