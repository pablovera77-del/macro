import type { AppRole } from "@/lib/roles";

/**
 * Matriz de permisos: quién puede hacer cada acción (F2).
 *
 * Es la tabla que se muestra en la Guía de uso y la que revisa el chequeo
 * automático `npm run check:permissions`: para cada fila verifica que el código
 * que ejecuta la acción siga rechazando a quien no figura acá. Si alguien cambia
 * un permiso en el código sin actualizar esta tabla (o al revés), el chequeo falla.
 */
export type Permiso = {
  modulo: string;
  accion: string;
  roles: AppRole[];
  /** Archivo y mensaje de rechazo que usa el servidor para esa acción. */
  guard: { file: string; message: string };
};

const A: AppRole = "administracion";
const C: AppRole = "coordinador_internacion";
const P: AppRole = "profesional_asistencial";
const D: AppRole = "deposito";
const T: AppRole = "transporte";
const DIR: AppRole = "direccion";

const INTER = "src/app/(dashboard)/internacion/actions.ts";
const PAC = "src/app/(dashboard)/paciente/[id]/actions.ts";
const AG = "src/app/(dashboard)/agenda/actions.ts";
const PED = "src/app/(dashboard)/pedidos/actions.ts";
const CAT = "src/app/(dashboard)/catalogo/actions.ts";
const SEG = "src/app/(dashboard)/seguimiento/actions.ts";
const OS = "src/app/(dashboard)/obras-sociales/actions.ts";
const FAC = "src/app/(dashboard)/facturacion/actions.ts";
const PACS = "src/app/(dashboard)/pacientes/actions.ts";
const COMP = "src/app/(dashboard)/compras/actions.ts";
const EVO = "src/app/(dashboard)/evoluciones/actions.ts";

export const PERMISOS: Permiso[] = [
  // Pacientes e ingreso
  { modulo: "Pacientes", accion: "Dar de alta un paciente", roles: [A], guard: { file: INTER, message: "Solo Administración da de alta pacientes." } },
  { modulo: "Pacientes", accion: "Cargar autorizaciones de práctica", roles: [A], guard: { file: INTER, message: "Solo Administración carga las autorizaciones de práctica." } },
  { modulo: "Pacientes", accion: "Registrar consentimientos firmados", roles: [A], guard: { file: INTER, message: "Solo Administración registra las firmas de ingreso." } },
  { modulo: "Pacientes", accion: "Armar el equipo asistencial", roles: [A, C], guard: { file: INTER, message: "Solo Administración o Coordinación arman el equipo asistencial." } },
  { modulo: "Pacientes", accion: "Confirmar la llegada al domicilio", roles: [A, C], guard: { file: INTER, message: "Solo Administración o Coordinación confirman la llegada." } },
  { modulo: "Pacientes", accion: "Informar un egreso", roles: [A, C, P], guard: { file: INTER, message: "Solo un profesional asistencial, Coordinación o Administración pueden informar un egreso." } },
  { modulo: "Pacientes", accion: "Confirmar la baja definitiva", roles: [A], guard: { file: PACS, message: "Solo Administración confirma la baja definitiva de un paciente." } },
  { modulo: "Pacientes", accion: "Cargar autorizaciones de stock", roles: [A], guard: { file: PACS, message: "Solo Administración carga autorizaciones." } },
  // Ficha del paciente
  { modulo: "Ficha", accion: "Cambiar el plan de tratamiento", roles: [A, C], guard: { file: PAC, message: "Solo Administración o Coordinación modifican el plan de tratamiento." } },
  { modulo: "Ficha", accion: "Cargar la medicación vigente", roles: [A, C], guard: { file: PAC, message: "Solo Administración o Coordinación cargan la medicación vigente." } },
  { modulo: "Ficha", accion: "Confirmar «sin medicación»", roles: [A], guard: { file: PAC, message: "Solo Administración confirma el paso de medicación." } },
  { modulo: "Ficha", accion: "Tildar el checklist de información al paciente", roles: [A], guard: { file: PAC, message: "Solo Administración completa el checklist de información al paciente." } },
  { modulo: "Ficha", accion: "Registrar documentación de la obra social recibida", roles: [A], guard: { file: PAC, message: "Solo Administración registra la documentación recibida." } },
  { modulo: "Ficha", accion: "Generar o dar de baja el acceso de la familia", roles: [A, C], guard: { file: PAC, message: "Solo Administración o Coordinación generan el acceso de la familia." } },
  // Agenda y evoluciones
  { modulo: "Agenda", accion: "Programar visitas", roles: [C], guard: { file: AG, message: "Solo Coordinación programa visitas." } },
  { modulo: "Agenda", accion: "Reprogramar visitas", roles: [C], guard: { file: AG, message: "Solo Coordinación reprograma visitas." } },
  { modulo: "Agenda", accion: "Marcar el resultado de una visita (confirmada, realizada, no realizada)", roles: [P, C], guard: { file: AG, message: "Solo el profesional asistencial de la visita o Coordinación cambian su estado." } },
  { modulo: "Agenda", accion: "Cancelar visitas", roles: [C], guard: { file: AG, message: "Solo Coordinación cancela visitas." } },
  { modulo: "Historia clínica", accion: "Cargar evoluciones", roles: [P], guard: { file: EVO, message: "Solo el profesional asistencial carga evoluciones." } },
  { modulo: "Historia clínica", accion: "Agregar una nota aclaratoria a una evolución firmada", roles: [P, C], guard: { file: EVO, message: "Solo el profesional asistencial de la evolución o Coordinación agregan notas aclaratorias." } },
  // Insumos
  { modulo: "Catálogo", accion: "Cargar productos y unidades físicas", roles: [D], guard: { file: CAT, message: "Solo Depósito carga el catálogo." } },
  { modulo: "Catálogo", accion: "Gestionar proveedores del catálogo", roles: [D], guard: { file: CAT, message: "Solo Depósito gestiona proveedores del catálogo." } },
  { modulo: "Pedidos", accion: "Armar pedidos", roles: [D], guard: { file: PED, message: "Solo Depósito arma pedidos." } },
  { modulo: "Pedidos", accion: "Autorizar pedidos", roles: [A], guard: { file: PED, message: "Solo Administración autoriza pedidos." } },
  { modulo: "Pedidos", accion: "Rechazar pedidos", roles: [A], guard: { file: PED, message: "Solo Administración rechaza pedidos." } },
  { modulo: "Pedidos", accion: "Despachar pedidos", roles: [D], guard: { file: PED, message: "Solo Depósito despacha pedidos." } },
  { modulo: "Seguimiento", accion: "Generar el egreso de equipos", roles: [A], guard: { file: SEG, message: "Solo Administración genera el egreso." } },
  { modulo: "Seguimiento", accion: "Marcar el retiro de equipos", roles: [T], guard: { file: SEG, message: "Solo Transporte marca el retiro." } },
  { modulo: "Seguimiento", accion: "Reportar devoluciones de descartables", roles: [T], guard: { file: SEG, message: "Solo Transporte reporta devoluciones de descartables/alimentos." } },
  { modulo: "Seguimiento", accion: "Confirmar la llegada a depósito", roles: [T], guard: { file: SEG, message: "Solo Transporte confirma la llegada." } },
  { modulo: "Compras", accion: "Recibir órdenes de compra", roles: [D], guard: { file: COMP, message: "Solo Depósito gestiona la recepción de órdenes de compra." } },
  // Obras sociales y facturación
  { modulo: "Obras sociales", accion: "Gestionar obras sociales y valores", roles: [A], guard: { file: OS, message: "Solo Administración gestiona obras sociales." } },
  { modulo: "Obras sociales", accion: "Definir la documentación requerida al ingreso", roles: [A], guard: { file: OS, message: "Solo Administración configura la documentación requerida." } },
  { modulo: "Facturación", accion: "Gestionar períodos y débitos", roles: [A], guard: { file: FAC, message: "Solo Administración gestiona la facturación." } },
  // Dirección (solo lectura)
  { modulo: "Auditoría", accion: "Ver el registro de auditoría", roles: [DIR], guard: { file: "src/app/(dashboard)/auditoria/page.tsx", message: 'profile.role !== "direccion"' } },
];

/** Lo que cada rol puede VER (sin modificar), para completar la matriz en pantalla. */
export const SOLO_LECTURA: Record<AppRole, string> = {
  administracion: "Todo lo de pacientes, pedidos, compras, seguimiento, obras sociales y facturación.",
  coordinador_internacion: "Pacientes (ficha completa), agenda de todos los profesionales y control de evoluciones.",
  profesional_asistencial: "Su agenda, sus pacientes y su historia clínica.",
  deposito: "Catálogo, pedidos, seguimiento de equipos y compras.",
  transporte: "Pedidos y seguimiento de equipos.",
  direccion: "Dashboard ejecutivo y auditoría. No modifica datos.",
};
