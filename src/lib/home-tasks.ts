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
  summary: "Abrir el legajo de un paciente que ingresa a internación domiciliaria. Son 6 pasos: los 3 primeros se hacen en el alta y los otros 3 en la ficha.",
  steps: [
    "Entrá a Pacientes y tocá el botón verde «+ Nuevo paciente» (arriba a la derecha).",
    "Paso 1: poné el DNI (el sistema avisa si el paciente ya existe) y completá datos personales, domicilio y familiar.",
    "Paso 2: elegí la obra social, el N° de afiliado y el médico derivante.",
    "Paso 3: cargá el diagnóstico y, para cada disciplina, cuántas visitas necesita y con qué profesional.",
    "Tocá «Admitir paciente»: te llevamos a la ficha, solapa «Ingreso y egreso», para los pasos 4 a 6: medicación, información al paciente con consentimientos, y documentación de la obra social.",
    "En «Ingresos en curso» (pantalla Pacientes) ves qué le falta a cada paciente; podés retomar el ingreso cuando quieras.",
  ],
  href: "/internacion?nuevo=1",
  cta: "Dar de alta",
  doc: "DF-C3 §3",
};

const PLAN_TRATAMIENTO: HomeTask = {
  id: "plan-tratamiento",
  title: "Definir o cambiar el plan de tratamiento",
  summary: "Indicar cuántas visitas por semana necesita cada disciplina. El sistema avisa cuando falta programar alguna.",
  steps: [
    "Abrí la ficha del paciente (desde Pacientes o con el buscador de arriba) y entrá a la solapa «Plan de tratamiento».",
    "Elegí la disciplina, la cantidad y si es «por semana» o «por día» (con los días marcados).",
    "Tocá «Guardar plan». Si ya había uno para esa disciplina, queda en el historial y el nuevo pasa a regir.",
    "En Agenda, Coordinación ve «Faltan programar visitas esta semana» con un botón «Programar» ya completado.",
  ],
  href: "/internacion",
  cta: "Ir a Pacientes",
  doc: "DF-C3 §4",
};

const MENSAJES_EQUIPO: HomeTask = {
  id: "mensajes-equipo",
  title: "Dejar un mensaje al equipo del paciente",
  summary: "Avisar algo sobre un paciente (un cambio, un pedido) sin salir de su ficha.",
  steps: [
    "Abrí la ficha del paciente y entrá a la solapa «Mensajes del equipo».",
    "Escribí el mensaje y tocá «Enviar»: queda guardado con tu nombre y la fecha para todo el equipo.",
  ],
  href: "/internacion",
  cta: "Ir a Pacientes",
  doc: "DF-C3 §4",
};

const RECORDATORIOS: HomeTask = {
  id: "recordatorios",
  title: "Avisar por WhatsApp las visitas de mañana",
  summary: "Mandar un recordatorio a cada familiar. La app no envía nada sola: abre WhatsApp con el mensaje escrito.",
  steps: [
    "Entrá a Agenda: arriba aparece «Recordatorios para mañana».",
    "Tocá «Avisar por WhatsApp» en cada visita, revisá el número y el texto, y tocá «Enviar» en WhatsApp.",
    "Después tocá «Ya lo mandé»: la visita queda marcada como avisada y no se te pasa ninguna.",
    "Si dice «Sin teléfono cargado», completá el contacto del familiar en la ficha del paciente.",
  ],
  href: "/agenda",
  cta: "Ir a Agenda",
  doc: "DF-C2 §4",
};

const ACCESO_FAMILIA: HomeTask = {
  id: "acceso-familia",
  title: "Darle a la familia acceso a las visitas",
  summary: "Imprimir una tarjeta con código QR y PIN para que la familia vea las fechas de las visitas y confirme las realizadas. Solo disponible cuando el portal está habilitado.",
  steps: [
    "Abrí la ficha del paciente y entrá a la solapa «Familia».",
    "Tocá «Generar tarjeta de acceso» e imprimila: el PIN se muestra una sola vez.",
    "Entregásela al familiar. Si se pierde, generá una tarjeta nueva (la anterior deja de funcionar) o dala de baja.",
    "En la misma solapa ves cuándo se usó y qué visitas confirmó la familia.",
  ],
  href: "/internacion",
  cta: "Ir a Pacientes",
  doc: "DF-C2 §6",
};

const AUDITORIA: HomeTask = {
  id: "auditoria",
  title: "Ver quién cambió qué",
  summary: "Consultar el registro automático de cambios: altas, planes, medicación, consentimientos, pedidos y evoluciones.",
  steps: [
    "Entrá a Auditoría.",
    "Filtrá por qué se tocó, por persona, por tipo de acción o por fechas.",
    "El registro no se puede editar. Las evoluciones figuran sin su contenido clínico.",
  ],
  href: "/auditoria",
  cta: "Ir a Auditoría",
  doc: "DF-C1 §4.1",
};

const CONTROL_EVOLUCIONES: HomeTask = {
  id: "control-evoluciones",
  title: "Controlar que cada visita tenga su evolución",
  summary: "Ver qué visitas realizadas todavía no tienen la historia clínica cargada.",
  steps: [
    "Entrá a Control de evoluciones.",
    "En el recuadro rojo aparecen las visitas realizadas sin evolución.",
    "Reclamale la carga al profesional correspondiente.",
  ],
  href: "/evoluciones",
  cta: "Ir a Control de evoluciones",
  doc: "DF-C2 §8",
};

const CONSENTIMIENTOS: HomeTask = {
  id: "consentimientos",
  title: "Firmar los consentimientos de ingreso",
  summary: "Registrar, documento por documento, la firma del familiar y del profesional.",
  steps: [
    "Abrí la ficha del paciente recién admitido (te llevamos ahí al terminar el alta) y entrá a la solapa «Ingreso y egreso».",
    "En el paso 5 hay una fila por documento: primero se tilda el checklist de información al paciente y se firman los consentimientos.",
    "En cada fila completá quién firma, tocá «Capturar ubicación» y después «Acepto».",
  ],
  href: "/internacion#ingresos",
  cta: "Ver ingresos en curso",
  doc: "DF-C2 §6",
};

const AUTORIZAR_PRACTICAS: HomeTask = {
  id: "autorizar-practicas",
  title: "Autorizar prácticas y armar el equipo tratante",
  summary: "Cargar lo que la obra social autorizó y asignar quién atiende al paciente.",
  steps: [
    "En Pacientes, abrí la tarjeta del paciente y tocá «Gestionar».",
    "Para autorizar: escribí la práctica, elegí la especialidad, la cantidad y hasta cuándo vale, y tocá «Autorizar».",
    "Para el equipo asistencial: elegí el profesional y su especialidad, y tocá «Asignar al equipo».",
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
    "Elegí paciente, profesional y día. El horario puede ser una hora exacta, mañana/tarde/noche, un rango o «sin hora definida».",
    "Tocá «Programar». Si el profesional ya tiene otra visita a esa hora, te avisamos.",
    "Para armar la semana de un solo paso, tocá «Generar visitas de la semana»: revisás la vista previa y confirmás.",
    "Cuando el profesional marca la visita como «Realizada», el sistema lo lleva solo a cargar la evolución.",
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
    "Al llegar, tocá «Iniciar visita» (queda registrada la hora; si el celular lo permite, también la ubicación).",
    "Al terminar la visita, tocá «Realizada»: te llevamos a cargar la evolución (o «No realizada» si no se pudo).",
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
    "En Mi agenda, tocá «Realizada» al terminar la visita: el sistema te lleva solo al formulario.",
    "Completá el formulario de tu disciplina y tocá «Guardar evolución».",
    "Si te olvidás, en Mi agenda aparece el aviso «Te falta cargar una evolución» con el botón «Cargar evolución».",
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
    "Cuando el equipo llega, Transporte toca «Confirmar llegada a depósito»; Depósito ve lo que está en camino y, si tarda, aparece una alerta roja.",
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

const PRODUCTIVIDAD: HomeTask = {
  id: "productividad",
  title: "Ver productividad y cupos de la semana",
  summary: "Saber cuántas visitas del plan de cada paciente se hicieron, cuáles faltan o sobran, y cuántas visitas por día hace cada profesional.",
  steps: [
    "Entrá a Productividad y cupos.",
    "En «Cupos de la semana» ves cada paciente con visitas hechas, programadas, faltantes y de más. Los cupos completos quedan aparte.",
    "En «Visitas por día de cada profesional» ves el promedio de los últimos 30 días y se marca a quien está por debajo de lo esperado.",
    "Podés filtrar por disciplina.",
  ],
  href: "/productividad",
  cta: "Ir a Productividad y cupos",
  doc: "DF-C2 §7",
};

const DASHBOARD: HomeTask = {
  id: "dashboard",
  title: "Ver el tablero de dirección",
  summary: "Ver en un vistazo pacientes, stock, facturación y alertas.",
  steps: [
    "Entrá al Dashboard ejecutivo.",
    "Cada indicador es un enlace: tocalo para ir al módulo que lo explica.",
    "Al tocar un número se abre la lista que lo explica, ya filtrada (por ejemplo los pacientes con autorizaciones por vencer).",
    "Mirá altas y bajas del día y del mes, y el histórico de 12 meses.",
  ],
  href: "/dashboard",
  cta: "Ir al Dashboard",
  doc: "DF-C3 §13 y DF-C5 §7",
};

export const TASKS_BY_ROLE: Record<AppRole, HomeTask[]> = {
  coordinador_internacion: [CONFIRMAR_LLEGADA, PLAN_TRATAMIENTO, ARMAR_AGENDA, RECORDATORIOS, ACCESO_FAMILIA, MENSAJES_EQUIPO, CONTROL_EVOLUCIONES, PRODUCTIVIDAD, INFORMAR_EGRESO],
  profesional_asistencial: [MI_AGENDA, CARGAR_EVOLUCION, MENSAJES_EQUIPO, INFORMAR_EGRESO],
  administracion: [
    ALTA_PACIENTE,
    PLAN_TRATAMIENTO,
    ACCESO_FAMILIA,
    CONSENTIMIENTOS,
    AUTORIZAR_PRACTICAS,
    CONFIRMAR_LLEGADA,
    CONFIRMAR_EGRESOS,
    AUTORIZACIONES_STOCK,
    AUTORIZAR_PEDIDOS,
    CIERRE_MENSUAL,
    OBRAS_SOCIALES,
    COMPRAS,
    SEGUIMIENTO,
    MENSAJES_EQUIPO,
    PRODUCTIVIDAD,
  ],
  deposito: [DESPACHAR_PEDIDOS, SEGUIMIENTO, CARGAR_PRODUCTO, COMPRAS],
  transporte: [ENTREGAR_PEDIDOS, SEGUIMIENTO],
  direccion: [DASHBOARD, PRODUCTIVIDAD, AUDITORIA],
};

export const ROLE_WELCOME: Record<AppRole, string> = {
  coordinador_internacion: "Desde acá armás la agenda de visitas, confirmás cuándo llega cada paciente y controlás las evoluciones.",
  profesional_asistencial: "Desde acá ves tus visitas, cargás la historia clínica e informás egresos.",
  administracion: "Desde acá das de alta a los pacientes, controlás autorizaciones, pedidos, compras y la facturación.",
  deposito: "Desde acá gestionás el catálogo, armás pedidos y seguís los equipos.",
  transporte: "Desde acá ves las entregas y retiros que tenés que hacer.",
  direccion: "Desde acá ves el estado general de la operación y quién cambió qué.",
};
