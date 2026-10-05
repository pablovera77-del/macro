/** Visita tal como la leen la agenda y «Mi día» (con paciente y profesional). */
export type VisitaAgenda = {
  id: string;
  patient_id: string;
  profesional_id: string;
  especialidad: string;
  fecha_programada: string;
  estado: string;
  observacion_agenda: string | null;
  sin_hora: boolean;
  franja: string | null;
  hora_desde: string | null;
  hora_hasta: string | null;
  abierta_at: string | null;
  cerrada_at: string | null;
  recordatorio_enviado_at: string | null;
  fecha_realizada: string | null;
  patients: {
    nombre_completo: string;
    domicilio: string | null;
    telefono_contacto: string | null;
    contacto_familiar_nombre: string | null;
    contacto_familiar_telefono: string | null;
  } | null;
  profiles: { full_name: string } | null;
};

export const COLUMNAS_VISITA_AGENDA =
  "id, patient_id, profesional_id, especialidad, fecha_programada, estado, observacion_agenda, sin_hora, franja, hora_desde, hora_hasta, abierta_at, cerrada_at, recordatorio_enviado_at, fecha_realizada, patients(nombre_completo, domicilio, telefono_contacto, contacto_familiar_nombre, contacto_familiar_telefono), profiles!visits_profesional_id_fkey(full_name)";
