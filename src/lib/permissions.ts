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
const F: AppRole = "facturacion";

const INTER = "src/app/(dashboard)/internacion/actions.ts";
const PAC = "src/app/(dashboard)/paciente/[id]/actions.ts";
const AG = "src/app/(dashboard)/agenda/actions.ts";
const PED = "src/app/(dashboard)/pedidos/actions.ts";
const CAT = "src/app/(dashboard)/catalogo/actions.ts";
const SEG = "src/app/(dashboard)/seguimiento/actions.ts";
const OS = "src/app/(dashboard)/obras-sociales/actions.ts";
const FAC = "src/app/(dashboard)/facturacion/actions.ts";
const PACS = "src/app/(dashboard)/pacientes/actions.ts";
const AGT = "src/app/(dashboard)/agenda-transporte/actions.ts";
const COMP = "src/app/(dashboard)/compras/actions.ts";
const EVO = "src/app/(dashboard)/evoluciones/actions.ts";
const PRES = "src/app/(dashboard)/presupuestos/actions.ts";
const USR = "src/app/(dashboard)/usuarios/actions.ts";
const CFG = "src/app/(dashboard)/configuracion/actions.ts";
const LPF = "src/app/(dashboard)/listo-para-facturar/actions.ts";
const HON = "src/app/(dashboard)/honorarios/actions.ts";

export const PERMISOS: Permiso[] = [
  // Pacientes e ingreso
  { modulo: "Pacientes", accion: "Dar de alta un paciente", roles: [A], guard: { file: INTER, message: "Solo Administración da de alta pacientes." } },
  { modulo: "Pacientes", accion: "Cargar autorizaciones de práctica", roles: [A], guard: { file: INTER, message: "Solo Administración carga las autorizaciones de práctica." } },
  { modulo: "Pacientes", accion: "Renovar una autorización (nuevo período con historial)", roles: [A], guard: { file: INTER, message: "Solo Administración carga las autorizaciones de práctica." } },
  { modulo: "Pacientes", accion: "Registrar consentimientos firmados", roles: [A], guard: { file: INTER, message: "Solo Administración registra las firmas de ingreso." } },
  { modulo: "Pacientes", accion: "Armar el equipo asistencial", roles: [A, C], guard: { file: INTER, message: "Solo Administración o Coordinación arman el equipo asistencial." } },
  { modulo: "Pacientes", accion: "Quitar a un profesional del equipo asistencial", roles: [A, C], guard: { file: INTER, message: "Solo Administración o Coordinación arman el equipo asistencial." } },
  { modulo: "Pacientes", accion: "Pedir y registrar la respuesta de una prórroga de autorización", roles: [A], guard: { file: INTER, message: "Solo Administración gestiona las prórrogas de autorizaciones." } },
  { modulo: "Pacientes", accion: "Generar el link de llegada para la familia", roles: [A, C], guard: { file: INTER, message: "Solo Administración o Coordinación generan el link de llegada." } },
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
  { modulo: "Ficha", accion: "Editar los datos del paciente (legajo, contactos y aclaraciones)", roles: [A], guard: { file: PAC, message: "Solo Administración edita los datos del paciente." } },
  { modulo: "Ficha", accion: "Generar o dar de baja el acceso de la familia", roles: [A, C], guard: { file: PAC, message: "Solo Administración o Coordinación generan el acceso de la familia." } },
  // Agenda y evoluciones
  { modulo: "Agenda", accion: "Programar visitas", roles: [C], guard: { file: AG, message: "Solo Coordinación programa visitas." } },
  { modulo: "Agenda", accion: "Reprogramar visitas", roles: [C], guard: { file: AG, message: "Solo Coordinación reprograma visitas." } },
  { modulo: "Agenda", accion: "Marcar el resultado de una visita (confirmada, realizada, no realizada)", roles: [P, C], guard: { file: AG, message: "Solo el profesional asistencial de la visita o Coordinación cambian su estado." } },
  { modulo: "Agenda", accion: "Cancelar visitas", roles: [C], guard: { file: AG, message: "Solo Coordinación cancela visitas." } },
  { modulo: "Agenda", accion: "Iniciar una visita al llegar al domicilio", roles: [P], guard: { file: AG, message: "Solo el profesional asistencial de la visita inicia la visita." } },
  { modulo: "Agenda", accion: "Marcar un recordatorio de WhatsApp como enviado", roles: [C], guard: { file: AG, message: "Solo Coordinación marca los recordatorios como enviados." } },
  { modulo: "Agenda", accion: "Generar las visitas de la semana desde el plan", roles: [C], guard: { file: AG, message: "Solo Coordinación genera las visitas de la semana." } },
  { modulo: "Agenda", accion: "Ver productividad y cupos (solo lectura)", roles: [C, A, DIR], guard: { file: "src/app/(dashboard)/productividad/page.tsx", message: "ROLES_PRODUCTIVIDAD.includes(profile.role)" } },
  { modulo: "Historia clínica", accion: "Cargar evoluciones", roles: [P], guard: { file: EVO, message: "Solo el profesional asistencial carga evoluciones." } },
  { modulo: "Historia clínica", accion: "Agregar una nota aclaratoria a una evolución firmada", roles: [P, C], guard: { file: EVO, message: "Solo el profesional asistencial de la evolución o Coordinación agregan notas aclaratorias." } },
  // Insumos
  { modulo: "Catálogo", accion: "Cargar productos y unidades físicas", roles: [D], guard: { file: CAT, message: "Solo Depósito carga el catálogo." } },
  { modulo: "Catálogo", accion: "Gestionar proveedores del catálogo", roles: [D], guard: { file: CAT, message: "Solo Depósito gestiona proveedores del catálogo." } },
  { modulo: "Pedidos", accion: "Armar pedidos", roles: [D], guard: { file: PED, message: "Solo Depósito arma pedidos." } },
  { modulo: "Pedidos", accion: "Autorizar pedidos", roles: [A], guard: { file: PED, message: "Solo Administración autoriza pedidos." } },
  { modulo: "Pedidos", accion: "Rechazar pedidos", roles: [A], guard: { file: PED, message: "Solo Administración rechaza pedidos." } },
  { modulo: "Pedidos", accion: "Despachar pedidos", roles: [D], guard: { file: PED, message: "Solo Depósito despacha pedidos." } },
  { modulo: "Pedidos", accion: "Pedir insumos para un paciente (solicitud)", roles: [C], guard: { file: PED, message: "Solo Coordinación solicita insumos." } },
  { modulo: "Pedidos", accion: "Cancelar una solicitud propia", roles: [C], guard: { file: PED, message: "Solo Coordinación cancela sus solicitudes." } },
  { modulo: "Pedidos", accion: "Revisar la solicitud ítem por ítem (aceptar, ajustar, rechazar)", roles: [D], guard: { file: PED, message: "Solo Depósito revisa las solicitudes." } },
  { modulo: "Pedidos", accion: "Marcar un pedido como preparado", roles: [D], guard: { file: PED, message: "Solo Depósito prepara pedidos." } },
  { modulo: "Pedidos", accion: "Confirmar la entrega o el retiro con firma", roles: [D, T], guard: { file: PED, message: "Solo Depósito o Transporte confirman la entrega." } },
  { modulo: "Pedidos", accion: "Marcar avisos como leídos", roles: [A, C, D, T], guard: { file: PED, message: "Solo Administración, Coordinación, Depósito o Transporte marcan los avisos como leídos." } },
  { modulo: "Agenda de Transporte", accion: "Crear una tarea en la agenda", roles: [D, T, A], guard: { file: AGT, message: "Solo Transporte, Depósito o Administración crean tareas en la agenda de Transporte." } },
  { modulo: "Agenda de Transporte", accion: "Iniciar y completar tareas", roles: [T], guard: { file: AGT, message: "Solo Transporte inicia y completa las tareas de la agenda." } },
  { modulo: "Agenda de Transporte", accion: "Cambiar día y hora, reprogramar o cancelar tareas", roles: [D, T, A], guard: { file: AGT, message: "Solo Transporte, Depósito o Administración editan y reprograman las tareas." } },
  { modulo: "Seguimiento", accion: "Generar el egreso de equipos", roles: [A], guard: { file: SEG, message: "Solo Administración genera el egreso." } },
  { modulo: "Seguimiento", accion: "Marcar el retiro de equipos", roles: [T], guard: { file: SEG, message: "Solo Transporte marca el retiro." } },
  { modulo: "Seguimiento", accion: "Reportar devoluciones de descartables", roles: [T], guard: { file: SEG, message: "Solo Transporte reporta devoluciones de descartables/alimentos." } },
  { modulo: "Seguimiento", accion: "Confirmar la llegada a depósito", roles: [T], guard: { file: SEG, message: "Solo Transporte confirma la llegada." } },
  { modulo: "Compras", accion: "Recibir órdenes de compra", roles: [D], guard: { file: COMP, message: "Solo Depósito gestiona la recepción de órdenes de compra." } },
  // Obras sociales y facturación
  { modulo: "Obras sociales", accion: "Dar de alta obras sociales y asignar su responsable", roles: [A], guard: { file: OS, message: "Solo Administración gestiona obras sociales." } },
  { modulo: "Obras sociales", accion: "Cargar el valor del módulo de cada obra social", roles: [F], guard: { file: OS, message: "Solo Facturación carga valores." } },
  { modulo: "Obras sociales", accion: "Definir la documentación requerida al ingreso", roles: [A], guard: { file: OS, message: "Solo Administración configura la documentación requerida." } },
  { modulo: "Facturación", accion: "Marcar pacientes como listos para facturar (corte administrativo)", roles: [A], guard: { file: LPF, message: "Solo Administración marca a los pacientes como listos para facturar." } },
  { modulo: "Facturación", accion: "Registrar la revisión de lo que Administración dejó listo", roles: [F], guard: { file: LPF, message: "Solo Facturación revisa lo que Administración dejó listo para facturar." } },
  { modulo: "Facturación", accion: "Gestionar períodos y débitos", roles: [F], guard: { file: FAC, message: "Solo Facturación gestiona la facturación." } },
  { modulo: "Obras sociales", accion: "Configurar reglas, modalidad, plazo y contacto de auditoría", roles: [F], guard: { file: OS, message: "Solo Facturación configura las reglas de facturación de cada obra social." } },
  { modulo: "Facturación", accion: "Corregir el total de un período", roles: [F], guard: { file: FAC, message: "Solo Facturación corrige el total de un período." } },
  { modulo: "Facturación", accion: "Dejar pacientes fuera del cierre mensual", roles: [F], guard: { file: FAC, message: "Solo Facturación deja pacientes fuera del cierre mensual." } },
  { modulo: "Facturación", accion: "Registrar el reclamo de un débito", roles: [F], guard: { file: FAC, message: "Solo Facturación registra el reclamo de un débito." } },
  { modulo: "Presupuestos", accion: "Armar y editar presupuestos de venta", roles: [F], guard: { file: PRES, message: "Solo Facturación arma presupuestos de venta." } },
  { modulo: "Presupuestos", accion: "Cargar los honorarios por prestación (base del costo)", roles: [DIR], guard: { file: HON, message: "Solo Dirección carga los honorarios." } },
  { modulo: "Presupuestos", accion: "Ver presupuestos de venta (solo lectura)", roles: [F, DIR], guard: { file: "src/app/(dashboard)/presupuestos/page.tsx", message: "ROLES_PRESUPUESTOS.includes(profile.role)" } },
  // Dirección (solo lectura)
  { modulo: "Auditoría", accion: "Ver el registro de auditoría", roles: [DIR], guard: { file: "src/app/(dashboard)/auditoria/page.tsx", message: 'profile.role !== "direccion"' } },
  // Usuarios y configuración
  { modulo: "Usuarios", accion: "Crear usuarios, asignar roles, editar el legajo y desactivar cuentas", roles: [A], guard: { file: USR, message: "Solo Administración gestiona los usuarios." } },
  { modulo: "Configuración", accion: "Editar parámetros, catálogos y alertas", roles: [A], guard: { file: CFG, message: "Solo Administración configura la plataforma." } },
];

/** Lo que cada rol puede VER (sin modificar), para completar la matriz en pantalla. */
export const SOLO_LECTURA: Record<AppRole, string> = {
  administracion: "Todo lo de pacientes, pedidos, compras, seguimiento, obras sociales, usuarios y configuración. No ve períodos abiertos ni débitos.",
  coordinador_internacion: "Pacientes (ficha completa), agenda de todos los profesionales y control de evoluciones.",
  profesional_asistencial: "Su agenda, sus pacientes y su historia clínica.",
  deposito: "Catálogo, pedidos, seguimiento de equipos y compras.",
  transporte: "Pedidos y seguimiento de equipos.",
  direccion: "Dashboard ejecutivo y auditoría. No modifica datos.",
  facturacion: "Pacientes, historias clínicas (para controlar), autorizaciones, agenda de Transporte y valores de obras sociales.",
};
