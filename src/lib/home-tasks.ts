import type { AppRole } from "@/lib/auth";

/**
 * Tareas clave por rol — alimentan la pantalla de Inicio ("¿Qué querés hacer?")
 * y la Guía de uso. Cada tarea es una funcionalidad relevada en los DF-Cx,
 * escrita en lenguaje de usuario final: qué es, dónde se hace y cómo.
 *
 * Origen del problema que resuelve: en la demo con el cliente nadie sabía
 * "dónde hacer clic" para ejecutar lo que el documento funcional promete.
 */
export type HomeTask = {
  id: string;
  title: string;
  /** Una frase: para qué sirve. */
  summary: string;
  /** Pasos concretos, en el orden en que se hacen. */
  steps: string[];
  href: string;
  cta: string;
  /** Sección del documento funcional de donde sale. */
  doc: string;
};

const ALTA_PACIENTE: HomeTask = {
  id: "alta-paciente",
  title: "Dar de alta un paciente nuevo",
  summary: "Abrir el legajo de un paciente que ingresa a internación domiciliaria.",
  steps: [
    "Entrá a Pacientes y tocá el botón verde «+ Nuevo paciente» (arriba a la derecha).",
    "Paso 1: poné el DNI. El sistema avisa si el paciente ya existe.",
    "Paso 2: completá datos personales, domicilio y contacto del familiar.",
    "Paso 3: elegí obra social, N° de afiliado, médico derivante y diagnóstico.",
    "Tocá «Admitir paciente». Te mostramos los próximos pasos: consentimientos, autorizaciones, equipo y llegada.",
  ],
  href: "/internacion?nuevo=1",
  cta: "Dar de alta",
  doc: "DF-C3 §3",
};

const CONSENTIMIENTOS: HomeTask = {
  id: "consentimientos",
  title: "Firmar los consentimientos de ingreso",
  summary: "Registrar, documento por documento, la firma del familiar y del profesional.",
  steps: [
    "En Pacientes, buscá la tarjeta del paciente recién admitido.",
    "En el recuadro «Consentimientos de ingreso» hay una fila por documento.",
    "En cada fila completá quién firma, tocá «Capturar ubicación» y después «Acepto».",
  ],
  href: "/internacion",
  cta: "Ir a Pacientes",
  doc: "DF-C2 §6",
};

const AUTORIZAR_PRACTICAS: HomeTask = {
  id: "autorizar-practicas",
  title: "Autorizar prácticas y armar el equipo tratante",
  summary: "Cargar lo que la obra social autorizó y asignar quién atiende al paciente.",
  steps: [
    "En Pacientes, abrí la tarjeta del paciente y tocá «Gestionar».",
    "Para autorizar: escribí la práctica, elegí la especialidad, la cantidad y hasta cuándo vale, y tocá «Autorizar».",
    "Para el equipo: elegí el profesional y su especialidad, y tocá «Asignar al equipo».",
    "El semáforo de vencimientos arriba te avisa cuándo una autorización está por vencer.",
  ],
  href: "/internacion",
  cta: "Ir a Pacientes",
  doc: "DF-C3 §7 y §10",
};

const CONFIRMAR_LLEGADA: HomeTask = {
  id: "confirmar-llegada",
  title: "Confirmar que el paciente llegó al domicilio",
  summary: "Marcar el día real de inicio, para no facturar días de más.",
  steps: [
    "En Pacientes, buscá los pacientes con estado «Admitido, pendiente de llegada».",
    "Tocá el botón verde «Confirmar llegada» de la tarjeta.",
    "El paciente pasa a «Activo» y recién ahí corre la facturación.",
  ],
  href: "/internacion",
  cta: "Ir a Pacientes",
  doc: "DF-C3 §12",
};

const INFORMAR_EGRESO: HomeTask = {
  id: "informar-egreso",
  title: "Informar un egreso (alta, traslado o fallecimiento)",
  summary: "Avisar a Administración que un paciente deja la internación.",
  steps: [
    "En Pacientes, buscá a un paciente «Activo».",
    "Elegí el motivo en «Informar egreso — motivo…» y tocá «Informar egreso».",
    "Administración recibe el aviso y confirma la baja definitiva.",
  ],
  href: "/internacion",
  cta: "Ir a Pacientes",
  doc: "DF-C3 §11",
};

const ARMAR_AGENDA: HomeTask = {
  id: "armar-agenda",
  title: "Armar la agenda de visitas",
  summary: "Programar qué profesional visita a qué paciente, y cuándo.",
  steps: [
    "Entrá a Agenda y tocá el botón verde «+ Programar visita» (arriba a la derecha).",
    "Elegí paciente, profesional, fecha y hora, y tocá «Programar».",
    "Cuando el profesional marca la visita como «realizada», queda lista para cargar la evolución.",
  ],
  href: "/agenda",
  cta: "Ir a Agenda",
  doc: "DF-C2 §4",
};

const MI_AGENDA: HomeTask = {
  id: "mi-agenda",
  title: "Ver mi agenda del día",
  summary: "Saber a qué domicilios tengo que ir hoy.",
  steps: [
    "Entrá a Mi agenda.",
    "Tocá «Confirmar» cuando salís hacia el domicilio.",
    "Al terminar la visita, tocá «Realizada» (o «No realizada» si no se pudo).",
  ],
  href: "/agenda",
  cta: "Ir a Mi agenda",
  doc: "DF-C2 §4",
};

const CARGAR_EVOLUCION: HomeTask = {
  id: "cargar-evolucion",
  title: "Cargar la evolución de una visita",
  summary: "Registrar la historia clínica de la visita con el formulario de mi disciplina.",
  steps: [
    "Entrá a Historia clínica.",
    "Elegí la visita que marcaste como realizada.",
    "Completá el formulario de tu disciplina y firmá.",
    "Una visita realizada sin evolución queda marcada en la auditoría hasta que se cargue.",
  ],
  href: "/evoluciones",
  cta: "Ir a Historia clínica",
  doc: "DF-C2 §5",
};

const AUTORIZACIONES_STOCK: HomeTask = {
  id: "autorizaciones-stock",
  title: "Cargar qué insumos tiene autorizados un paciente",
  summary: "Definir lo que Depósito puede entregar sin pedir permiso cada vez.",
  steps: [
    "Entrá a Autorizaciones de stock.",
    "En el paciente, tocá «Cargar autorización».",
    "Elegí producto, cantidad y vigencia, y guardá.",
  ],
  href: "/pacientes",
  cta: "Ir a Autorizaciones",
  doc: "DF-C5 §4",
};

const AUTORIZAR_PEDIDOS: HomeTask = {
  id: "autorizar-pedidos",
  title: "Autorizar un pedido que no está cubierto",
  summary: "Dar el visto bueno a pedidos fuera de la autorización estándar del paciente.",
  steps: [
    "Entrá a Pedidos.",
    "Buscá los pedidos en estado «Borrador» (esperan Administración).",
    "Tocá «Autorizar pedido», o rechazalo indicando el motivo: el coordinador recibe el aviso.",
  ],
  href: "/pedidos",
  cta: "Ir a Pedidos",
  doc: "DF-C5 §4",
};

const CONFIRMAR_EGRESOS: HomeTask = {
  id: "confirmar-egresos",
  title: "Confirmar bajas de pacientes",
  summary: "Cerrar definitivamente los egresos que informó el equipo asistencial.",
  steps: [
    "Entrá a Autorizaciones de stock.",
    "En «Egresos informados — pendientes de confirmar», revisá el motivo.",
    "Tocá «Confirmar baja definitiva»: se dispara el aviso de retiro de equipos a Depósito.",
  ],
  href: "/pacientes",
  cta: "Ir a Autorizaciones",
  doc: "DF-C3 §11",
};

const CIERRE_MENSUAL: HomeTask = {
  id: "cierre-mensual",
  title: "Hacer el cierre mensual de facturación",
  summary: "Revisar el mes de cada obra social y avanzarlo hasta facturarlo y cobrarlo.",
  steps: [
    "Entrá a Facturación y abrí el período del mes de la obra social.",
    "Si todavía no existe el mes, tocá «+ Abrir período» (arriba a la derecha).",
    "Abrí «Pre-validación» y corregí los pacientes en rojo (evoluciones cargadas vs. autorizadas).",
    "Avanzá el período: en revisión → cerrado → presentada.",
    "Cuando paguen, marcalo como cobrada o debitada, o registrá el monto cobrado.",
  ],
  href: "/facturacion",
  cta: "Ir a Facturación",
  doc: "DF-C4 §4 y §11",
};

const OBRAS_SOCIALES: HomeTask = {
  id: "obras-sociales",
  title: "Actualizar el valor del módulo de una obra social",
  summary: "Mantener al día los valores y asignar quién es responsable de cada obra social.",
  steps: [
    "Entrá a Obras sociales.",
    "Para una obra social nueva tocá «+ Nueva obra social» (arriba a la derecha).",
    "Tocá «Actualizar valor» para cargar un valor nuevo sin perder el histórico.",
    "Tocá «Asignar responsable» para elegir quién recibe las alertas de esa obra social.",
  ],
  href: "/obras-sociales",
  cta: "Ir a Obras sociales",
  doc: "DF-C3 §2 y DF-C4",
};

const COMPRAS: HomeTask = {
  id: "compras",
  title: "Pedir cotizaciones y comprar insumos",
  summary: "Anticipar faltantes, cotizar con proveedores y generar la orden de compra.",
  steps: [
    "Entrá a Compras y mirá la proyección: lo autorizado contra lo que hay en depósito.",
    "Generá el pedido de cotización a los proveedores habituales.",
    "Compará precios y armá la orden de compra.",
    "Cuando llega la mercadería, cargá la factura del proveedor: el sistema la compara contra lo pedido.",
  ],
  href: "/compras",
  cta: "Ir a Compras",
  doc: "DF-C5 §5 y §6",
};

const SEGUIMIENTO: HomeTask = {
  id: "seguimiento",
  title: "Seguir dónde está cada equipo",
  summary: "Ver si un equipo está en el domicilio, en tránsito o en depósito.",
  steps: [
    "Entrá a Seguimiento.",
    "Transporte reporta el retiro desde el domicilio.",
    "Depósito toca «Confirmar llegada a depósito»; si tarda, aparece una alerta roja.",
  ],
  href: "/seguimiento",
  cta: "Ir a Seguimiento",
  doc: "DF-C5 §8",
};

const CARGAR_PRODUCTO: HomeTask = {
  id: "cargar-producto",
  title: "Cargar un producto nuevo en el catálogo",
  summary: "Dar de alta un insumo, equipo o alimento y sus proveedores.",
  steps: [
    "Entrá a Catálogo.",
    "Tocá el botón verde «+ Agregar producto» (arriba a la derecha) y completá código, descripción, tipo y proveedor.",
    "Para comparar precios, abrí «comparar precios» en la fila del producto.",
  ],
  href: "/catalogo",
  cta: "Ir a Catálogo",
  doc: "DF-C5 §3",
};

const DESPACHAR_PEDIDOS: HomeTask = {
  id: "despachar-pedidos",
  title: "Armar y despachar un pedido a un domicilio",
  summary: "Preparar lo que necesita un paciente y mandarlo con remito digital.",
  steps: [
    "Entrá a Pedidos y tocá «+ Iniciar pedido» (arriba a la derecha) para un paciente nuevo, o «Agregar ítem a este pedido» si ya tiene uno.",
    "Si el paciente tiene el ítem autorizado, se aprueba solo; si no, espera a Administración («Autorizar pedido»).",
    "Una vez autorizado, tocá «Despachar (generar remito)»: queda el remito digital.",
    "Se entrega y el familiar firma la recepción.",
  ],
  href: "/pedidos",
  cta: "Ir a Pedidos",
  doc: "DF-C5 §4",
};

const ENTREGAR_PEDIDOS: HomeTask = {
  id: "entregar-pedidos",
  title: "Entregar un pedido en el domicilio",
  summary: "Llevar los insumos o equipos y registrar quién los recibió.",
  steps: [
    "Entrá a Pedidos y buscá los pedidos despachados.",
    "Al entregar, tocá «Confirmar entrega y firma» (o «Confirmar retiro y firma» si lo retira el familiar en el local).",
  ],
  href: "/pedidos",
  cta: "Ir a Pedidos",
  doc: "DF-C5 §4",
};

const DASHBOARD: HomeTask = {
  id: "dashboard",
  title: "Ver el tablero de dirección",
  summary: "Ver en un vistazo pacientes, stock, facturación y alertas.",
  steps: [
    "Entrá al Dashboard ejecutivo.",
    "Cada indicador es un enlace: tocalo para ir al módulo que lo explica.",
    "Mirá altas y bajas del día y del mes, y el histórico de 12 meses.",
  ],
  href: "/dashboard",
  cta: "Ir al Dashboard",
  doc: "DF-C3 §13 y DF-C5 §7",
};

export const TASKS_BY_ROLE: Record<AppRole, HomeTask[]> = {
  coordinador_internacion: [
    ALTA_PACIENTE,
    CONSENTIMIENTOS,
    AUTORIZAR_PRACTICAS,
    CONFIRMAR_LLEGADA,
    ARMAR_AGENDA,
    INFORMAR_EGRESO,
  ],
  medico_coordinador: [
    ALTA_PACIENTE,
    CONSENTIMIENTOS,
    AUTORIZAR_PRACTICAS,
    CONFIRMAR_LLEGADA,
    ARMAR_AGENDA,
    CARGAR_EVOLUCION,
    INFORMAR_EGRESO,
  ],
  profesional_asistencial: [MI_AGENDA, CARGAR_EVOLUCION, INFORMAR_EGRESO],
  administracion: [
    CONFIRMAR_EGRESOS,
    AUTORIZACIONES_STOCK,
    AUTORIZAR_PEDIDOS,
    CIERRE_MENSUAL,
    OBRAS_SOCIALES,
    COMPRAS,
    SEGUIMIENTO,
  ],
  deposito: [DESPACHAR_PEDIDOS, SEGUIMIENTO, CARGAR_PRODUCTO, COMPRAS],
  transporte: [ENTREGAR_PEDIDOS, SEGUIMIENTO],
  direccion: [DASHBOARD],
};

export const ROLE_WELCOME: Record<AppRole, string> = {
  coordinador_internacion: "Desde acá das de alta pacientes, armás su equipo y organizás las visitas.",
  medico_coordinador: "Desde acá admitís pacientes, armás el equipo asistencial y seguís la historia clínica.",
  profesional_asistencial: "Desde acá ves tus visitas, cargás la historia clínica e informás egresos.",
  administracion: "Desde acá controlás autorizaciones, pedidos, compras y la facturación a obras sociales.",
  deposito: "Desde acá gestionás el catálogo, armás pedidos y seguís los equipos.",
  transporte: "Desde acá ves las entregas y retiros que tenés que hacer.",
  direccion: "Desde acá ves el estado general de la operación.",
};
