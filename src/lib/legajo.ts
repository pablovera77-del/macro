// Lectura y validación del legajo del paciente (DF-C3 §4.1 y §4.2, más el feedback de Vanina del 06/10: H1).
// Sin "use server": lo comparten el alta (internacion/actions.ts) y la edición del legajo (paciente/[id]/actions.ts).
import { hoyAR } from "@/lib/plan";
import { TIPOS_POR_UNIDAD, UNIDADES_TRABAJO, nombreCompleto } from "@/lib/paciente";

export type Legajo = {
  nombre_completo: string;
  apellido: string;
  nombre: string;
  dni: string;
  fecha_nacimiento: string;
  sexo: string;
  ocupacion: string | null;
  localidad: string;
  domicilio: string;
  telefono_contacto: string | null;
  domicilio_actual: string | null;
  telefono_actual: string | null;
  lat: number | null;
  lng: number | null;
  contacto_familiar_nombre: string;
  contacto_familiar_telefono: string;
  email_responsable: string | null;
  diagnostico_principal: string;
  obra_social_id: string | null;
  es_particular: boolean;
  numero_afiliado: string | null;
  tiene_coseguro: boolean;
  coseguro_detalle: string | null;
  medico_derivante: string | null;
  medico_matricula: string | null;
  institucion_derivante: string | null;
  unidad_trabajo: string;
  tipo_internacion: string;
  tiene_emergencias: boolean;
  emergencias_nombre: string | null;
  emergencias_telefono: string | null;
  en_tratamiento_atb: boolean;
  requiere_curaciones: boolean;
  fecha_ingreso: string;
};

export type ContactoExtra = { nombre: string; parentesco: string | null; telefono: string | null; email: string | null };

export const PARTICULAR = "__particular";

export const txt = (fd: FormData, k: string) => String(fd.get(k) || "").trim();
const num = (fd: FormData, k: string) => {
  const v = txt(fd, k);
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const tilde = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Hasta 4 familiares de contacto adicionales (campos contacto_extra_<n>_nombre, _parentesco, _telefono, _email). */
export function leerContactosExtra(fd: FormData): ContactoExtra[] | { error: string } {
  const out: ContactoExtra[] = [];
  for (let i = 1; i <= 4; i++) {
    const nombre = txt(fd, `contacto_extra_${i}_nombre`);
    const telefono = txt(fd, `contacto_extra_${i}_telefono`) || null;
    const email = txt(fd, `contacto_extra_${i}_email`) || null;
    const parentesco = txt(fd, `contacto_extra_${i}_parentesco`) || null;
    if (!nombre && !telefono && !email) continue;
    if (!nombre) return { error: `Al familiar de contacto adicional ${i} le falta el nombre.` };
    if (email && !EMAIL.test(email)) return { error: `El mail del familiar de contacto adicional ${i} no es válido.` };
    out.push({ nombre, parentesco, telefono, email });
  }
  return out;
}

// Lee y valida los datos del paso 1 a 3 del alta (o de la edición del legajo). Devuelve el error en castellano si falta algo.
export function leerLegajo(fd: FormData): { error: string } | { datos: Legajo } {
  const apellido = txt(fd, "apellido");
  const nombre = txt(fd, "nombre");
  // El DNI es el identificador único del paciente en toda la plataforma
  // (pedido de Pablo, 25/09) — se normaliza a solo dígitos acá para que
  // "30.998.221" y "30998221" cuenten como el mismo DNI.
  const dni = String(fd.get("dni") || "").replace(/\D/g, "");
  const fecha_nacimiento = txt(fd, "fecha_nacimiento");
  const sexo = txt(fd, "sexo");
  const localidad = txt(fd, "localidad");
  const domicilio = txt(fd, "domicilio");
  const contacto_familiar_nombre = txt(fd, "contacto_familiar_nombre");
  const contacto_familiar_telefono = txt(fd, "contacto_familiar_telefono");
  const email_responsable = txt(fd, "email_responsable") || null;
  const diagnostico_principal = txt(fd, "diagnostico_principal");
  const osForm = txt(fd, "obra_social_id");
  const es_particular = osForm === PARTICULAR;
  const obra_social_id = osForm && !es_particular ? osForm : null;
  const numero_afiliado = txt(fd, "numero_afiliado") || null;
  const tiene_coseguro = tilde(fd, "tiene_coseguro");
  const coseguro_detalle = tiene_coseguro ? txt(fd, "coseguro_detalle") || null : null;
  const unidad_trabajo = txt(fd, "unidad_trabajo");
  const tipo_internacion = txt(fd, "tipo_internacion");
  const tiene_emergencias = tilde(fd, "tiene_emergencias");
  const emergencias_nombre = tiene_emergencias ? txt(fd, "emergencias_nombre") : "";
  const emergencias_telefono = tiene_emergencias ? txt(fd, "emergencias_telefono") : "";
  const fecha_ingreso = txt(fd, "fecha_ingreso") || hoyAR();
  const lat = num(fd, "lat");
  const lng = num(fd, "lng");

  if (!dni) return { error: "Falta el DNI: es obligatorio y es el identificador único del paciente en todo el sistema." };
  if (dni.length < 6 || dni.length > 9) return { error: "El DNI no parece válido (debe tener entre 6 y 9 dígitos)." };
  if (!apellido) return { error: "Falta el apellido del paciente." };
  if (!nombre) return { error: "Falta el nombre del paciente." };
  if (!fecha_nacimiento) return { error: "Falta la fecha de nacimiento del paciente." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha_nacimiento) || fecha_nacimiento > hoyAR()) return { error: "La fecha de nacimiento no es válida: no puede ser posterior a hoy." };
  if (!["femenino", "masculino", "otro"].includes(sexo)) return { error: "Elegí el sexo del paciente." };
  if (!localidad) return { error: "Falta la localidad del domicilio del paciente." };
  if (!domicilio) return { error: "Falta el domicilio del paciente: es donde se agendan las visitas." };
  if (!contacto_familiar_nombre) return { error: "Falta el nombre de la persona responsable (familiar o referente)." };
  if (contacto_familiar_telefono.replace(/\D/g, "").length < 8) return { error: "Falta el teléfono de la persona responsable, o no parece válido (con código de área, mínimo 8 números): se usa para avisarle por WhatsApp." };
  if (email_responsable && !EMAIL.test(email_responsable)) return { error: "El mail de la persona responsable no parece válido." };
  if (obra_social_id && !numero_afiliado) return { error: "Falta el N° de afiliado: es obligatorio cuando el paciente tiene obra social." };
  if (!UNIDADES_TRABAJO[unidad_trabajo]) return { error: "Elegí la unidad de trabajo (Profesionales, Expertos, Malleo Lodge I o II, San Juan Salud)." };
  if (!(TIPOS_POR_UNIDAD[unidad_trabajo] ?? []).includes(tipo_internacion)) return { error: "Elegí el tipo de internación que corresponde a la unidad de trabajo." };
  if (tiene_emergencias && !emergencias_nombre) return { error: "Si el paciente tiene servicio de emergencias, escribí cuál es." };
  if (tiene_emergencias && emergencias_telefono.replace(/\D/g, "").length < 6) return { error: "Falta el teléfono del servicio de emergencias, o no parece válido." };
  if (!diagnostico_principal) return { error: "Falta el diagnóstico principal (motivo de la internación domiciliaria)." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha_ingreso)) return { error: "La fecha de ingreso no es válida." };
  if ((lat !== null && (lat < -90 || lat > 90)) || (lng !== null && (lng < -180 || lng > 180))) return { error: "La ubicación capturada no es válida: volvé a capturarla o dejala vacía." };

  return {
    datos: {
      nombre_completo: nombreCompleto(nombre, apellido),
      apellido,
      nombre,
      dni,
      fecha_nacimiento,
      sexo,
      ocupacion: txt(fd, "ocupacion") || null,
      localidad,
      domicilio,
      telefono_contacto: txt(fd, "telefono_contacto") || null,
      domicilio_actual: txt(fd, "domicilio_actual") || null,
      telefono_actual: txt(fd, "telefono_actual") || null,
      lat,
      lng,
      contacto_familiar_nombre,
      contacto_familiar_telefono,
      email_responsable,
      diagnostico_principal,
      obra_social_id,
      es_particular,
      numero_afiliado,
      tiene_coseguro,
      coseguro_detalle,
      medico_derivante: txt(fd, "medico_derivante") || null,
      medico_matricula: txt(fd, "medico_matricula") || null,
      institucion_derivante: txt(fd, "institucion_derivante") || null,
      unidad_trabajo,
      tipo_internacion,
      tiene_emergencias,
      emergencias_nombre: emergencias_nombre || null,
      emergencias_telefono: emergencias_telefono || null,
      en_tratamiento_atb: tilde(fd, "en_tratamiento_atb"),
      requiere_curaciones: tilde(fd, "requiere_curaciones"),
      fecha_ingreso,
    },
  };
}
