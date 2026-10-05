// Datos fijos de la empresa que se muestran en la ficha del paciente (DF-C3 §4.2).
// El teléfono se define con NEXT_PUBLIC_EMPRESA_TELEFONO (no inventamos uno): si no está, solo se muestra el nombre.
export const EMPRESA_NOMBRE = "Profesionales SRL";
export const EMPRESA_TELEFONO = (process.env.NEXT_PUBLIC_EMPRESA_TELEFONO ?? "").trim() || null;
