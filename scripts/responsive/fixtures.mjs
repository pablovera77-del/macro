/**
 * Datos de prueba para el stub de Supabase (ver stub-supabase.mjs).
 * Todo es inventado. Las fechas son relativas a "hoy" en hora de San Juan, así que
 * la semana, los atrasos y los vencimientos se ven siempre como en un día real.
 */
import crypto from "node:crypto";

export const JWT_SECRET = "secreto-de-prueba-solo-para-el-stub";

export function makeJwt(sub, email) {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const head = b({ alg: "HS256", typ: "JWT" });
  const pay = b({ sub, email, role: "authenticated", aud: "authenticated", iat: now, exp: now + 31536000 });
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(`${head}.${pay}`).digest("base64url");
  return `${head}.${pay}.${sig}`;
}

const uid = (ns, n) => `00000000-0000-4000-8${String(ns).padStart(3, "0")}-${String(n).padStart(12, "0")}`;

// ---- Usuarios (un perfil por rol; el de profesional es el que tiene la agenda armada) ----
export const DEMO_USERS = [
  { key: "profesional_asistencial", id: uid(1, 1), email: "profesional.demo@profesionales-srl.test", full_name: "Carolina Páez", role: "profesional_asistencial" },
  { key: "coordinador_internacion", id: uid(1, 2), email: "coordinador.demo@profesionales-srl.test", full_name: "Laura Giménez", role: "coordinador_internacion" },
  { key: "administracion", id: uid(1, 3), email: "administracion.demo@profesionales-srl.test", full_name: "Marcela Ríos", role: "administracion" },
  { key: "deposito", id: uid(1, 4), email: "deposito.demo@profesionales-srl.test", full_name: "Raúl Aguirre", role: "deposito" },
  { key: "transporte", id: uid(1, 5), email: "transporte.demo@profesionales-srl.test", full_name: "Diego Molina", role: "transporte" },
  { key: "direccion", id: uid(1, 6), email: "direccion.demo@profesionales-srl.test", full_name: "Patricia Lucero", role: "direccion" },
];
const PROF2 = { id: uid(1, 7), full_name: "Sandra Quiroga (enfermería)", role: "profesional_asistencial" };
const PROF3 = { id: uid(1, 8), full_name: "Dr. Gustavo Herrera", role: "profesional_asistencial" };
const PROF4 = { id: uid(1, 9), full_name: "Julieta Ferrer (fonoaudiología)", role: "profesional_asistencial" };
const P = { carolina: uid(1, 1), laura: uid(1, 2), marcela: uid(1, 3), raul: uid(1, 4), diego: uid(1, 5), patricia: uid(1, 6), sandra: PROF2.id, gustavo: PROF3.id, julieta: PROF4.id };

// "relaciones" que PostgREST deduce de las claves foráneas: tabla.embebido -> columna
export const FK_MAP = {
  "visits.profiles": "profesional_id", "evolutions.profiles": "profesional_id", "audit_log.profiles": "user_id",
  "patient_care_team.profiles": "profesional_id", "patient_messages.profiles": "autor_id",
  "obras_sociales.profiles": "responsable_id", "patients.profiles": "egreso_informado_por",
  "retrieval_checklist.equipment_assets": "asset_id", "retrieval_checklist.products": "product_id",
  "retrieval_checklist.discharge_alerts": "discharge_alert_id", "equipment_assets.products": "product_id",
  "purchase_order_invoice_items.purchase_order_invoices": "invoice_id", "purchase_order_items.purchase_orders": "purchase_order_id",
  "billing_periods.obras_sociales": "obra_social_id", "patients.obras_sociales": "obra_social_id",
  "discharge_alerts.patients": "patient_id", "patient_authorizations.products": "product_id",
};

// ---- Fechas relativas a hoy (San Juan, UTC-3) ----
function sanJuanToday() {
  const t = new Date(Date.now() - 3 * 3600 * 1000);
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
}
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

export function buildFixtures() {
  const today = sanJuanToday();
  const day = (off) => { const d = new Date(today); d.setUTCDate(d.getUTCDate() + off); return d; };
  const D = (off) => ymd(day(off));
  const at = (off, h = 9, m = 0) => `${D(off)}T${pad(h)}:${pad(m)}:00-03:00`;
  const dow = ((today.getUTCDay() + 6) % 7); // 0 = lunes
  const mon = -dow; // offset del lunes de esta semana
  const ago = (off) => at(off, 11, 15);
  const T = {};

  // Obras sociales
  const OS = [
    { id: uid(2, 1), nombre: "OSDE", cuit: "30-54698765-5", dias_para_facturar: 30, valor_modulo: 184500, activa: true, responsable_id: P.marcela },
    { id: uid(2, 2), nombre: "PAMI", cuit: "30-63090123-7", dias_para_facturar: 45, valor_modulo: 121300, activa: true, responsable_id: P.marcela },
    { id: uid(2, 3), nombre: "Swiss Medical", cuit: "30-50000781-4", dias_para_facturar: 30, valor_modulo: 176900, activa: true, responsable_id: P.marcela },
    { id: uid(2, 4), nombre: "Obra Social Provincia de San Juan", cuit: "30-67654321-9", dias_para_facturar: 60, valor_modulo: 98700, activa: true, responsable_id: P.marcela },
    { id: uid(2, 5), nombre: "Galeno", cuit: "30-57654398-1", dias_para_facturar: 30, valor_modulo: 169000, activa: true, responsable_id: null },
  ].map((o) => ({ created_at: at(-200), ...o }));
  T.obras_sociales = OS;
  T.obra_social_value_history = OS.flatMap((o, i) => [
    { id: i * 2 + 1, obra_social_id: o.id, valor: Math.round(o.valor_modulo * 0.85), vigente_desde: D(-180), cargado_por: P.marcela, created_at: at(-180) },
    { id: i * 2 + 2, obra_social_id: o.id, valor: o.valor_modulo, vigente_desde: D(-30), cargado_por: P.marcela, created_at: at(-30) },
  ]);
  T.os_required_documents = OS.flatMap((o, i) => [
    { id: uid(3, i * 3 + 1), obra_social_id: o.id, nombre: "Orden médica vigente", obligatorio: true, orden: 1, activo: true },
    { id: uid(3, i * 3 + 2), obra_social_id: o.id, nombre: "Fotocopia del DNI y credencial", obligatorio: true, orden: 2, activo: true },
    { id: uid(3, i * 3 + 3), obra_social_id: o.id, nombre: "Resumen de historia clínica", obligatorio: false, orden: 3, activo: true },
  ]);

  // Perfiles
  T.profiles = [
    ...DEMO_USERS.map((u) => ({ id: u.id, full_name: u.full_name, role: u.role, active: true, created_at: at(-300), last_login_at: at(-1) })),
    ...[PROF2, PROF3, PROF4].map((u) => ({ ...u, active: true, created_at: at(-300), last_login_at: at(-2) })),
  ];

  // Pacientes
  const pat = (n, o) => ({
    id: uid(4, n), created_at: at(-120), coordinador_id: P.laura, telefono_contacto: `264 4${pad(n)}-${1000 + n * 37}`, contacto_familiar_nombre: null, contacto_familiar_telefono: null,
    fecha_nacimiento: `19${40 + n}-0${(n % 9) + 1}-1${n % 9}`, medico_derivante: "Dr. Alberto Sosa", numero_afiliado: `0${n}5522${n}7/01`, frecuencia_reposicion: "mensualizado",
    llegada_confirmada_at: at(-60), medicacion_confirmada_at: at(-58), egreso_informado_at: null, egreso_informado_por: null, egreso_motivo_informado: null, fecha_egreso: null, motivo_egreso: null,
    estado: "activo", ...o,
  });
  T.patients = [
    pat(1, { nombre_completo: "Rosa Elena Fernández de Albornoz Quiroga", dni: "10234567", domicilio: "Barrio Rawson, Manzana F casa 12, calle Los Plátanos 1450, Rawson", obra_social: "OSDE", obra_social_id: OS[0].id, diagnostico_principal: "Insuficiencia respiratoria crónica con oxigenoterapia domiciliaria y EPOC", contacto_familiar_nombre: "Gabriela Albornoz (hija)", contacto_familiar_telefono: "264 455-1234", fecha_ingreso: D(-75) }),
    pat(2, { nombre_completo: "Héctor Domingo Videla", dni: "8123456", domicilio: "Av. Libertador Gral. San Martín 2210 Oeste, Rivadavia", obra_social: "PAMI", obra_social_id: OS[1].id, diagnostico_principal: "Secuelas de ACV isquémico, disfagia", contacto_familiar_nombre: "Mónica Videla", contacto_familiar_telefono: "264 466-9087", fecha_ingreso: D(-50), frecuencia_reposicion: "quincenal" }),
    pat(3, { nombre_completo: "Marta Beatriz Olivares", dni: "11456789", domicilio: "Calle Tucumán 345 Norte, Capital", obra_social: "Swiss Medical", obra_social_id: OS[2].id, diagnostico_principal: "Úlceras por presión grado III", contacto_familiar_nombre: "Jorge Olivares", contacto_familiar_telefono: "264 477-3321", fecha_ingreso: D(-33) }),
    pat(4, { nombre_completo: "José Luis Carrizo", dni: "7345678", domicilio: "Barrio Conjunto 5, Manzana B casa 22, Chimbas", obra_social: "Obra Social Provincia de San Juan", obra_social_id: OS[3].id, diagnostico_principal: "Postoperatorio de cadera, rehabilitación motora", contacto_familiar_nombre: "Elsa Carrizo", contacto_familiar_telefono: "264 488-1100", fecha_ingreso: D(-21), frecuencia_reposicion: "semanal" }),
    pat(5, { nombre_completo: "Ana Paula Sánchez Montenegro", dni: "30456123", domicilio: "Villa Krause, calle Mendoza 1980 Sur, Rawson", obra_social: "OSDE", obra_social_id: OS[0].id, diagnostico_principal: "Neumonía bilateral, requiere oxígeno y kinesiología respiratoria", contacto_familiar_nombre: "Lucas Montenegro", contacto_familiar_telefono: "264 499-6677", estado: "admitido_pendiente_llegada", fecha_ingreso: D(0), llegada_confirmada_at: null, medicacion_confirmada_at: null }),
    pat(6, { nombre_completo: "Ramón Ceferino Tapia", dni: "6543210", domicilio: "Ruta 40 km 3, finca La Esperanza, Pocito", obra_social: "PAMI", obra_social_id: OS[1].id, diagnostico_principal: "Enfermedad de Parkinson avanzada", contacto_familiar_nombre: "Nélida Tapia", contacto_familiar_telefono: "264 412-3456", fecha_ingreso: D(-95), frecuencia_reposicion: "a_demanda" }),
    pat(7, { nombre_completo: "Elvira del Valle Castro", dni: "9876543", domicilio: "Barrio Municipal, Manzana 4 casa 8, Santa Lucía", obra_social: "Galeno", obra_social_id: OS[4].id, diagnostico_principal: "Insuficiencia cardíaca, cuidados paliativos", contacto_familiar_nombre: "Rubén Castro", contacto_familiar_telefono: "264 433-7788", fecha_ingreso: D(-110), egreso_informado_at: at(-1, 16, 30), egreso_informado_por: P.sandra, egreso_motivo_informado: "alta" }),
    pat(8, { nombre_completo: "Néstor Fabián Guzmán", dni: "12345098", domicilio: "Calle Salta 765 Sur, Capital", obra_social: "OSDE", obra_social_id: OS[0].id, diagnostico_principal: "Rehabilitación post-fractura de fémur", estado: "dado_de_baja", fecha_ingreso: D(-140), fecha_egreso: D(-20), motivo_egreso: "fin_internacion" }),
    pat(9, { nombre_completo: "Lidia Mabel Rodríguez", dni: "13567890", domicilio: "Barrio Las Lomas, lote 45, Pocito", obra_social: "OSDE", obra_social_id: OS[0].id, diagnostico_principal: "Diabetes con pie diabético, curaciones diarias", contacto_familiar_nombre: "Pablo Rodríguez", contacto_familiar_telefono: "264 444-0099", fecha_ingreso: D(-40) }),
  ];
  const PT = T.patients;
  const activos = PT.filter((p) => p.estado === "activo");

  // Equipo, planes y autorizaciones
  const team = []; const plans = []; const authz = [];
  const teamDef = [[P.carolina, "kinesiologia"], [P.sandra, "enfermeria"], [P.gustavo, "medicina"], [P.julieta, "fonoaudiologia"]];
  PT.filter((p) => p.estado !== "dado_de_baja").forEach((p, i) => {
    teamDef.forEach(([prof, esp], j) => {
      if ((i + j) % 4 === 3 && esp === "fonoaudiologia" && i % 2) return;
      team.push({ id: team.length + 1, patient_id: p.id, profesional_id: prof, especialidad: esp, created_at: at(-60) });
    });
  });
  T.patient_care_team = team;
  PT.filter((p) => p.estado !== "dado_de_baja").forEach((p, i) => {
    const defs = [["kinesiologia", 3, "semana", [1, 3, 5]], ["enfermeria", 1, "dia", null], ["medicina", 1, "semana", null]];
    if (i % 2 === 0) defs.push(["fonoaudiologia", 2, "semana", [2, 4]]);
    defs.forEach(([esp, cant, unidad, dias], k) => {
      plans.push({ id: uid(5, plans.length + 1), patient_id: p.id, especialidad: esp, cantidad: cant, unidad, dias_semana: dias, desde: D(-30), hasta: null, activo: true, reemplaza_id: null, nota: k === 0 && i === 0 ? "Priorizar ejercicios respiratorios. Avisar si baja la saturación." : null, creado_por: P.laura, created_at: at(-30) });
      authz.push({ id: authz.length + 1, patient_id: p.id, especialidad: esp, practica: esp === "enfermeria" ? "Enfermería domiciliaria" : esp === "medicina" ? "Visita médica" : esp === "kinesiologia" ? "Kinesiología motora" : "Fonoaudiología", cantidad_autorizada: unidad === "dia" ? 30 : cant * 4, periodo_desde: D(-20), periodo_hasta: D(i % 3 === 0 ? 6 : i % 3 === 1 ? -3 : 40), autorizado_por: P.marcela, created_at: at(-20) });
    });
  });
  T.treatment_plans = plans;
  T.treatment_authorizations = authz;
  T.v_treatment_authorization_status = authz.map((a) => ({ ...a, estado_semaforo: a.periodo_hasta < D(0) ? "vencida" : a.periodo_hasta < D(8) ? "por_vencer" : "vigente" }));

  // Visitas: la semana actual (lun-sáb) + la anterior, con atrasos y pendientes de evolución
  const visits = []; let vn = 0;
  const addV = (patient, prof, esp, off, h, estado, extra = {}) => {
    vn++;
    visits.push({ id: uid(6, vn), patient_id: patient.id, profesional_id: prof, especialidad: esp, fecha_programada: at(off, h, 0), fecha_realizada: estado === "realizada" ? at(off, h + 1, 5) : null, estado, observacion_agenda: null, creado_por: P.laura, created_at: at(off - 5), ...extra });
  };
  // Carolina (profesional del usuario demo): ayer 2 atrasadas, hoy 4, mañana 2
  addV(PT[0], P.carolina, "kinesiologia", -1, 15, "programada", { observacion_agenda: "Llevar bandas elásticas" });
  addV(PT[3], P.carolina, "kinesiologia", -1, 17, "programada");
  addV(PT[0], P.carolina, "kinesiologia", 0, 8, "realizada");
  addV(PT[1], P.carolina, "kinesiologia", 0, 10, "confirmada");
  addV(PT[2], P.carolina, "kinesiologia", 0, 12, "programada", { observacion_agenda: "Familiar pide llamar 10 min antes de llegar" });
  addV(PT[8], P.carolina, "kinesiologia", 0, 17, "programada");
  addV(PT[3], P.carolina, "kinesiologia", 1, 9, "programada");
  addV(PT[5], P.carolina, "kinesiologia", 1, 11, "confirmada");
  // Resto del equipo y semana
  activos.forEach((p, i) => {
    for (let d = 0; d < 6; d++) {
      const off = mon + d;
      if (off === 0 || off === 1 || off === -1) continue; // ya cubiertos arriba para Carolina; el resto se arma abajo
      if ((i + d) % 3 !== 0) continue;
      const estado = off < 0 ? ((i + d) % 7 === 0 ? "no_realizada" : "realizada") : "programada";
      addV(p, i % 2 ? P.sandra : P.gustavo, i % 2 ? "enfermeria" : "medicina", off, 9 + ((i + d) % 6), estado);
    }
    addV(p, P.sandra, "enfermeria", 0, 9 + (i % 5), i % 3 === 0 ? "realizada" : "programada");
    addV(p, P.julieta, "fonoaudiologia", 1, 10 + (i % 4), "programada");
    addV(p, P.gustavo, "medicina", mon - 3, 10, "realizada");
    addV(p, P.carolina, "kinesiologia", mon - 2, 14, "realizada");
  });
  T.visits = visits;

  // Evoluciones: algunas visitas realizadas quedan sin evolución a propósito
  const evols = [];
  visits.filter((v) => v.estado === "realizada").forEach((v, i) => {
    if (i % 3 === 2) return;
    evols.push({ id: uid(7, evols.length + 1), patient_id: v.patient_id, profesional_id: v.profesional_id, visit_id: v.id, especialidad: v.especialidad, template_id: uid(8, 1), respuestas: { "Estado general": "Paciente lúcida, colaboradora, sin dolor referido.", "Signos vitales": "TA 130/80, FC 76, SatO2 94%", "Indicaciones": "Continuar con plan. Reevaluar en 48 hs." }, upp_escala_nova5: null, firma_profesional_at: i % 2 ? v.fecha_realizada : null, conformidad_familiar: i % 2 ? true : null, conformidad_familiar_at: null, created_at: v.fecha_realizada });
  });
  T.evolutions = evols;
  T.v_visit_evolution_discrepancies = visits.filter((v) => v.estado === "realizada" && !evols.some((e) => e.visit_id === v.id)).map((v) => ({ visit_id: v.id, patient_id: v.patient_id, profesional_id: v.profesional_id, especialidad: v.especialidad, estado: v.estado, fecha_programada: v.fecha_programada, evolution_id: null }));
  T.discipline_form_templates = [
    { id: uid(8, 1), especialidad: "kinesiologia", titulo: "Evolución de kinesiología", activo: true, created_at: at(-200), campos: [{ label: "Estado general", tipo: "Texto largo", obligatorio: true }, { label: "Signos vitales", tipo: "Texto", obligatorio: false }, { label: "Cantidad de sesiones esta semana", tipo: "Número" }, { label: "Fecha del próximo control", tipo: "Fecha" }, { label: "Indicaciones", tipo: "Texto largo" }] },
    { id: uid(8, 2), especialidad: "enfermeria", titulo: "Evolución de enfermería", activo: true, created_at: at(-200), campos: [{ label: "Estado general", tipo: "Texto largo", obligatorio: true }, { label: "Signos vitales", tipo: "Texto" }, { label: "Curaciones realizadas", tipo: "Texto largo" }] },
    { id: uid(8, 3), especialidad: "medicina", titulo: "Evolución médica", activo: true, created_at: at(-200), campos: [{ label: "Motivo de la visita", tipo: "Texto" }, { label: "Examen físico", tipo: "Texto largo", obligatorio: true }, { label: "Indicaciones", tipo: "Texto largo" }] },
    { id: uid(8, 4), especialidad: "fonoaudiologia", titulo: "Evolución de fonoaudiología", activo: true, created_at: at(-200), campos: [{ label: "Deglución", tipo: "Texto largo" }, { label: "Observaciones", tipo: "Texto largo" }] },
  ];

  // Ingreso: medicación, checklist, documentos, firmas, mensajes
  T.patient_medications = activos.flatMap((p, i) => [
    { id: uid(9, i * 2 + 1), patient_id: p.id, medicamento: "Enalapril", dosis: "10 mg", via: "oral", frecuencia: "cada 12 hs", activo: true, creado_por: P.laura, created_at: at(-40) },
    { id: uid(9, i * 2 + 2), patient_id: p.id, medicamento: "Salbutamol", dosis: "2 puff", via: "inhalatoria", frecuencia: "cada 8 hs", activo: true, creado_por: P.laura, created_at: at(-40) },
  ]);
  T.info_checklist_items = ["Se explicó el plan de tratamiento y los horarios de visita", "Se informó cómo comunicarse con la guardia", "Se explicó el cuidado de los equipos en el domicilio", "Se entregó el listado de insumos y la frecuencia de reposición"].map((texto, i) => ({ id: uid(10, i + 1), orden: i + 1, texto, activo: true }));
  T.patient_info_checklist = activos.flatMap((p, i) => T.info_checklist_items.slice(0, 2 + (i % 3)).map((it) => ({ patient_id: p.id, item_id: it.id, confirmado_at: at(-50), confirmado_por: P.laura })));
  T.patient_required_documents = activos.flatMap((p) => T.os_required_documents.filter((d) => d.obra_social_id === p.obra_social_id && d.obligatorio).slice(0, 1).map((d) => ({ patient_id: p.id, doc_id: d.id, recibido_at: at(-50), recibido_por: P.marcela })));
  T.legal_documents = [
    { id: uid(11, 1), codigo: "CONSENTIMIENTO", titulo: "Consentimiento informado de internación domiciliaria", resumen: "Autorizás la atención en tu domicilio por el equipo de la clínica.", requiere_firma_profesional: true, activo: true, orden: 1, created_at: at(-200) },
    { id: uid(11, 2), codigo: "DATOS", titulo: "Autorización de uso de datos personales y de salud", resumen: "Para armar la historia clínica y facturar a la obra social.", requiere_firma_profesional: false, activo: true, orden: 2, created_at: at(-200) },
  ];
  T.patient_document_signatures = activos.slice(0, 6).flatMap((p) => T.legal_documents.map((d) => ({ id: uid(12, T.legal_documents.indexOf(d) * 10 + PT.indexOf(p)), patient_id: p.id, legal_document_id: d.id, firmante_nombre: p.contacto_familiar_nombre ?? p.nombre_completo, firmado_at: at(-55), geolocalizacion_lat: null, geolocalizacion_lng: null, profesional_id: d.requiere_firma_profesional ? P.sandra : null, profesional_firmado_at: d.requiere_firma_profesional ? at(-55) : null })));
  T.patient_messages = [
    { id: uid(13, 1), patient_id: PT[0].id, autor_id: P.sandra, mensaje: "La familia consulta si pueden sumar una segunda visita de kinesiología los sábados. Lo hablo con Coordinación.", created_at: at(-1, 18, 2) },
    { id: uid(13, 2), patient_id: PT[0].id, autor_id: P.laura, mensaje: "Recibido. Sábado queda sujeto a disponibilidad; confirmo mañana.", created_at: at(0, 9, 30) },
  ];
  T.family_visit_confirmations = [];

  // Catálogo de productos
  const prod = (n, o) => ({ id: uid(14, n), created_at: at(-300), active: true, categoria_iva: "21%", ean: null, existencia_actual: 40, fecha_ultimo_service: null, fecha_vencimiento: null, frecuencia_service: null, n_lote: null, observacion: null, precio_alquiler_mensual: null, proveedor: null, se_factura_aparte: false, stock_maximo: 100, stock_minimo: 20, supplier_id: uid(15, 1), tipo: "descartable", vida_util_estimada: null, ...o });
  T.products = [
    prod(1, { codigo: "DES-0001", descripcion: "Guantes de látex descartables talle M (caja x100)", existencia_actual: 12, stock_minimo: 30 }),
    prod(2, { codigo: "DES-0002", descripcion: "Gasas estériles 10x10 (paquete x50)", existencia_actual: 64, fecha_vencimiento: D(120), n_lote: "L2409-A" }),
    prod(3, { codigo: "DES-0003", descripcion: "Jeringa descartable 10 ml con aguja", existencia_actual: 5, stock_minimo: 25, fecha_vencimiento: D(20), n_lote: "L2403-C" }),
    prod(4, { codigo: "DES-0004", descripcion: "Apósito hidrocoloide extrafino 10x10", existencia_actual: 38, categoria_iva: "10.5%" }),
    prod(5, { codigo: "DES-0005", descripcion: "Sonda nasogástrica K 108 número 14", existencia_actual: 22, stock_minimo: 10 }),
    prod(6, { codigo: "ALI-0001", descripcion: "Fórmula enteral hipercalórica 1 L", tipo: "alimento", existencia_actual: 18, stock_minimo: 24, fecha_vencimiento: D(75), n_lote: "A8821", categoria_iva: "10.5%" }),
    prod(7, { codigo: "ALI-0002", descripcion: "Espesante para líquidos 225 g", tipo: "alimento", existencia_actual: 31, stock_minimo: 12 }),
    prod(8, { codigo: "EQU-0001", descripcion: "Concentrador de oxígeno 5 L", tipo: "equipo", existencia_actual: 6, stock_minimo: 2, precio_alquiler_mensual: 85000, frecuencia_service: "6 meses", vida_util_estimada: "8 años", fecha_ultimo_service: D(-150) }),
    prod(9, { codigo: "EQU-0002", descripcion: "Cama ortopédica eléctrica con barandas", tipo: "equipo", existencia_actual: 4, stock_minimo: 1, precio_alquiler_mensual: 62000, frecuencia_service: "12 meses" }),
    prod(10, { codigo: "EQU-0003", descripcion: "Aspirador de secreciones portátil", tipo: "equipo", existencia_actual: 3, stock_minimo: 1, precio_alquiler_mensual: 28000 }),
    prod(11, { codigo: "EQU-0004", descripcion: "Colchón antiescaras de aire alternante", tipo: "equipo", existencia_actual: 2, stock_minimo: 2, precio_alquiler_mensual: 31000, se_factura_aparte: true }),
    prod(12, { codigo: "DES-0006", descripcion: "Cánula nasal de oxígeno adulto", existencia_actual: 90, stock_maximo: 120 }),
  ];
  const stockEstado = (p) => (p.existencia_actual <= (p.stock_minimo ?? 0) * 0.5 ? "critico" : p.existencia_actual < (p.stock_minimo ?? 0) ? "bajo" : "normal");
  const vencEstado = (p) => (!p.fecha_vencimiento ? null : p.fecha_vencimiento < D(0) ? "vencida" : p.fecha_vencimiento < D(45) ? "por_vencer" : "vigente");
  T.v_products_status = T.products.map((p) => ({ ...p, estado_stock: stockEstado(p), estado_vencimiento: vencEstado(p) }));
  T.v_disponibilidad_deposito = T.products.map((p) => ({ product_id: p.id, codigo: p.codigo, descripcion: p.descripcion, tipo: p.tipo, existencia_actual: p.existencia_actual, unidades_disponibles: Math.max(0, p.existencia_actual - (p.tipo === "equipo" ? 1 : 3)) }));
  T.suppliers = [
    { id: uid(15, 1), nombre: "Droguería del Cuyo SA", cuit: "30-70123456-8", email: "ventas@drogueriacuyo.test", telefono: "264 420-1111", activo: true, created_at: at(-300) },
    { id: uid(15, 2), nombre: "Ortopedia Sanjuanina", cuit: "30-70987654-3", email: "pedidos@ortosj.test", telefono: "264 421-2222", activo: true, created_at: at(-300) },
  ];
  T.product_suppliers = T.products.map((p, i) => ({ product_id: p.id, supplier_id: uid(15, p.tipo === "equipo" ? 2 : 1), preferido: true, precio_referencia: 1500 + i * 730, created_at: at(-200) }));
  T.product_price_history = T.products.map((p, i) => ({ id: i + 1, product_id: p.id, precio_compra: 1400 + i * 700, vigente_desde: D(-90) }));
  T.supplier_price_quotes = []; T.quote_requests = [{ id: uid(16, 1), estado: "enviada", notas: null, creado_por: P.raul, created_at: at(-4) }]; T.quote_request_items = T.products.slice(0, 3).map((p, i) => ({ id: i + 1, quote_request_id: uid(16, 1), product_id: p.id, cantidad: 50 + i * 10, created_at: at(-4) }));
  T.purchase_orders = [{ id: uid(17, 1), supplier_id: uid(15, 1), estado: "enviada", created_at: at(-3), fecha_recepcion: null, creado_por: P.raul }, { id: uid(17, 2), supplier_id: uid(15, 2), estado: "recibida", created_at: at(-12), fecha_recepcion: at(-8), creado_por: P.raul }, { id: uid(17, 3), supplier_id: uid(15, 1), estado: "borrador", created_at: at(-1), fecha_recepcion: null, creado_por: P.raul }];
  T.purchase_order_items = [[1, 1, 60, 1800], [1, 3, 80, 950], [2, 8, 2, 420000], [3, 6, 40, 5200]].map(([po, pr, c, pu], i) => ({ id: i + 1, purchase_order_id: uid(17, po), product_id: T.products[pr - 1].id, cantidad: c, precio_unitario: pu, created_at: at(-3) }));
  T.purchase_order_invoices = []; T.purchase_order_invoice_items = [];
  T.patient_authorizations = [];
  activos.forEach((p, i) => {
    [[0, 4], [1, 6], [11, 30], [5, 2]].forEach(([pi, c], k) => { if ((i + k) % 4 !== 3) T.patient_authorizations.push({ id: T.patient_authorizations.length + 1, patient_id: p.id, product_id: T.products[pi].id, cantidad_autorizada: c, vigente_desde: D(-30), vigente_hasta: D(i % 3 === 0 ? 5 : 60), cargado_por: P.marcela, created_at: at(-30) });});
  });
  T.stock_movements = [{ id: 1, product_id: T.products[0].id, tipo: "egreso_entrega", cantidad: -4, fecha: at(-2), motivo: null, order_id: null, confirmado_por: P.raul, purchase_order_item_id: null }];

  // Pedidos en varios estados + remitos
  const mkOrder = (n, patient, estado, off, extra = {}) => ({ id: uid(18, n), patient_id: patient.id, estado, created_at: at(off, 10, 0), creado_por: P.laura, canal_entrega: "domicilio", prioridad: "normal", autorizacion_automatica: false, autorizado_por: estado === "borrador" ? null : P.marcela, fecha_autorizacion: estado === "borrador" ? null : at(off, 12, 0), rechazado_por: null, motivo_rechazo: null, ...extra });
  T.orders = [
    mkOrder(1, PT[0], "borrador", 0, { prioridad: "urgente" }), mkOrder(2, PT[1], "borrador", -1), mkOrder(3, PT[2], "autorizado", -1, { autorizacion_automatica: true }),
    mkOrder(4, PT[3], "autorizado", 0, { canal_entrega: "retiro_local" }), mkOrder(5, PT[5], "despachado", -1, { prioridad: "urgente" }), mkOrder(6, PT[8], "despachado", -2),
    mkOrder(7, PT[0], "entregado", -5), mkOrder(8, PT[1], "entregado", -7), mkOrder(9, PT[3], "cancelado", -3, { motivo_rechazo: "La cantidad pedida supera lo autorizado para el período." }),
  ];
  T.order_items = [];
  T.orders.forEach((o, i) => { [[0, 2], [1, 1 + (i % 3)], [i % 2 ? 7 : 5, 1]].forEach(([pi, c], k) => T.order_items.push({ id: T.order_items.length + 1, order_id: o.id, product_id: T.products[pi].id, cantidad: c * (pi === 7 ? 1 : 3), equipment_asset_id: pi === 7 ? uid(19, 1 + (i % 3)) : null })); });
  T.remitos = T.orders.filter((o) => ["despachado", "entregado"].includes(o.estado)).map((o, i) => ({ id: uid(20, i + 1), order_id: o.id, transportista_id: P.diego, fecha_despacho: o.fecha_autorizacion, fecha_entrega: o.estado === "entregado" ? at(-4, 15, 0) : null, firma_familiar_url: o.estado === "entregado" ? "https://example.test/firma.png" : null, firmado_at: o.estado === "entregado" ? at(-4, 15, 0) : null, notificacion_enviada_at: i % 2 ? at(-1, 11, 0) : null, notificacion_canal: i % 2 ? "whatsapp" : null }));

  // Equipos y retiros
  T.equipment_assets = [[1, 8, "CO-2201", "asignado", PT[0]], [2, 8, "CO-2202", "asignado", PT[5]], [3, 9, "CO-2203", "disponible", null], [4, 10, "AS-0041", "asignado", PT[1]], [5, 11, "CA-0102", "mantenimiento", null]].map(([n, pi, ns, estado]) => ({ id: uid(19, n), product_id: T.products[pi].id, numero_serie: ns, estado, propiedad: n % 2 ? "propio" : "alquilado", notas_condicion: null, created_at: at(-250) }));
  T.equipment_asset_movements = [[1, PT[0], "entrega_domicilio"], [2, PT[5], "entrega_domicilio"], [4, PT[1], "entrega_domicilio"]].map(([a, p, tipo], i) => ({ id: i + 1, asset_id: uid(19, a), patient_id: p.id, tipo, fecha: at(-40 + i), domicilio_origen: "Depósito central", domicilio_destino: p.domicilio, confirmado_por: P.diego, notas: null }));
  T.equipment_asset_photos = [];
  T.v_equipos_en_domicilio = [[1, PT[0], 0], [2, PT[5], 1], [4, PT[1], 2]].map(([a, p, i]) => { const ea = T.equipment_assets.find((x) => x.id === uid(19, a)); const pr = T.products.find((x) => x.id === ea.product_id); return { asset_id: ea.id, descripcion: pr.descripcion, numero_serie: ea.numero_serie, estado: ea.estado, patient_id: p.id, nombre_completo: p.nombre_completo, domicilio_destino: p.domicilio, desde: at(-40 + i) }; });
  T.discharge_alerts = [
    { id: uid(21, 1), patient_id: PT[6].id, motivo: "alta", estado: "pendiente_retiro", fecha: at(-1, 16, 30), generado_por: P.sandra },
    { id: uid(21, 2), patient_id: PT[7].id, motivo: "fin_internacion", estado: "retiro_informado", fecha: at(-20), generado_por: P.sandra },
  ];
  T.retrieval_checklist = [
    { id: 1, discharge_alert_id: uid(21, 1), asset_id: uid(19, 1), product_id: null, cantidad: null, retirado_at: null, retirado_por: null, llego_deposito_at: null, llego_deposito_confirmado_por: null, foto_url: null },
    { id: 2, discharge_alert_id: uid(21, 1), asset_id: null, product_id: T.products[5].id, cantidad: 6, retirado_at: null, retirado_por: null, llego_deposito_at: null, llego_deposito_confirmado_por: null, foto_url: null },
    { id: 3, discharge_alert_id: uid(21, 2), asset_id: uid(19, 4), product_id: null, cantidad: null, retirado_at: at(-18), retirado_por: P.diego, llego_deposito_at: null, llego_deposito_confirmado_por: null, foto_url: null },
  ];
  T.v_equipos_retirados_sin_confirmar = [{ checklist_id: 3, descripcion: T.products[9].descripcion, numero_serie: "AS-0041", retirado_at: at(-18), retirado_por: P.diego, egreso_notificado_at: at(-20), vencido_48h: true }];

  // Facturación
  const per = D(0).slice(0, 7) + "-01";
  T.billing_periods = [
    { id: uid(22, 1), obra_social_id: OS[0].id, periodo: per, estado: "abierto", total_facturado: null, fecha_cierre: null, monto_cobrado: null, fecha_cobro: null, cerrado_por: null, cobro_actualizado_por: null, created_at: at(-4) },
    { id: uid(22, 2), obra_social_id: OS[1].id, periodo: per, estado: "en_revision", total_facturado: null, fecha_cierre: null, monto_cobrado: null, fecha_cobro: null, cerrado_por: null, cobro_actualizado_por: null, created_at: at(-4) },
    { id: uid(22, 3), obra_social_id: OS[2].id, periodo: "2026-09-01", estado: "facturado", total_facturado: 1425000, fecha_cierre: at(-6), monto_cobrado: null, fecha_cobro: null, cerrado_por: P.marcela, cobro_actualizado_por: null, created_at: at(-35) },
    { id: uid(22, 4), obra_social_id: OS[0].id, periodo: "2026-08-01", estado: "cobrada", total_facturado: 2310000, fecha_cierre: at(-36), monto_cobrado: 2180000, fecha_cobro: at(-12), cerrado_por: P.marcela, cobro_actualizado_por: P.marcela, created_at: at(-65) },
  ];
  T.billing_debits = [{ id: 1, billing_period_id: uid(22, 4), patient_id: PT[0].id, motivo: "Visita sin evolución firmada del 14/08", monto: 130000, estado: "pendiente", gestionado_por: null, created_at: at(-10) }, { id: 2, billing_period_id: uid(22, 4), patient_id: PT[8].id, motivo: "Falta autorización vigente en kinesiología", monto: 98500, estado: "en_gestion", gestionado_por: P.marcela, created_at: at(-9) }];
  T.v_prevalidacion_facturacion = [0, 1, 2, 3, 5, 8].flatMap((i, k) => [{ billing_period_id: uid(22, PT[i].obra_social_id === OS[0].id ? 1 : 2), obra_social_id: PT[i].obra_social_id, patient_id: PT[i].id, nombre_completo: PT[i].nombre_completo, especialidad: "kinesiologia", practica: "Kinesiología motora", periodo: per, periodo_desde: D(-20), periodo_hasta: D(10), overlap_desde: D(-4), overlap_hasta: D(10), treatment_authorization_id: k + 1, cantidad_autorizada: 12, evoluciones_esperadas_mes: 12, evoluciones_cargadas_mes: k % 3 === 0 ? 12 : k % 3 === 1 ? 9 : 4, estado_prevalidacion: k % 3 === 0 ? "verde" : k % 3 === 1 ? "amarillo" : "rojo" }]);
  T.v_prevalidacion_resumen = [{ billing_period_id: uid(22, 1), verdes: 2, amarillos: 1, rojos: 1, bloqueado: true }, { billing_period_id: uid(22, 2), verdes: 1, amarillos: 1, rojos: 0, bloqueado: false }];
  T.v_costos_por_paciente = PT.filter((p) => p.estado === "activo").map((p, i) => ({ patient_id: p.id, nombre_completo: p.nombre_completo, obra_social: p.obra_social, costo_estimado: 210000 + i * 34500 }));
  T.v_historial_precios_proveedor_resumen = T.products.slice(0, 6).map((p, i) => ({ product_id: p.id, supplier_id: p.supplier_id, cantidad_registros: 3 + i, precio_minimo: 1200 + i * 50, ultimo_precio: 1500 + i * 70, ultima_fecha: D(-10 - i) }));
  T.v_historial_precios_proveedor = [];

  // Auditoría
  const acciones = ["INSERT", "UPDATE", "UPDATE", "DELETE"]; const ents = ["patients", "orders", "evolutions", "visits", "products"];
  T.audit_log = Array.from({ length: 14 }, (_, i) => ({ id: i + 1, created_at: at(-Math.floor(i / 3), 9 + (i % 8), 12), accion: acciones[i % 4], entidad: ents[i % 5], entidad_id: uid(4, (i % 9) + 1), user_id: [P.marcela, P.laura, P.sandra, P.raul][i % 4], payload_antes: i % 4 === 0 ? null : { estado: "borrador", updated_at: "x" }, payload_despues: i % 4 === 3 ? null : { estado: "autorizado", prioridad: "urgente", observaciones: "Se modificó el domicilio de entrega por pedido de la familia" } }));

  // Configuración y avisos
  T.app_settings = [
    { clave: "dias_aviso_autorizacion", valor: 7, descripcion: "Días de anticipación con los que una autorización de práctica pasa a «por vencer».", updated_at: at(-5) },
    { clave: "horas_ubicacion_no_confirmada", valor: 48, descripcion: "Horas desde el aviso de egreso después de las cuales un equipo sin confirmar llegada se marca en rojo.", updated_at: at(-5) },
    { clave: "umbral_visitas_dia", valor: 6, descripcion: "Promedio diario esperado de visitas realizadas.", updated_at: at(-5) },
  ];
  T.catalog_items = [
    ["motivos_reprogramacion", "nadie_en_domicilio", "No había nadie en el domicilio"],
    ["motivos_reprogramacion", "pedido_familia", "Lo pidió la familia"],
    ["motivos_reprogramacion", "imprevisto", "Imprevisto (clima, tránsito, otro)"],
    ["motivos_baja", "alta", "Alta médica"],
    ["motivos_baja", "fallecimiento", "Fallecimiento"],
    ["especialidades", "enfermeria", "Enfermería"],
    ["categorias_iva", "21%", "21 %"],
  ].map(([catalogo, codigo, nombre], i) => ({ id: uid(30, i + 1), catalogo, codigo, nombre, activo: true, orden: i + 1 }));
  T.alert_types = [
    { codigo: "egreso_informado", nombre: "Egreso informado sin confirmar", descripcion: "Falta la baja definitiva.", urgencia: "inmediata", mensaje: "Se informó el egreso de {paciente} ({motivo}). Falta confirmar la baja definitiva.", canal_app: true, canal_email: false, canal_whatsapp: false, activo: true },
    { codigo: "autorizacion_por_vencer", nombre: "Autorización por vencer", descripcion: "Una autorización entra en el plazo de aviso.", urgencia: "digest", mensaje: "La autorización de {paciente} vence el {fecha}.", canal_app: true, canal_email: false, canal_whatsapp: false, activo: true },
  ];
  T.alert_type_recipients = [{ id: uid(31, 1), alert_type: "egreso_informado", role: "administracion", user_id: null }, { id: uid(31, 2), alert_type: "autorizacion_por_vencer", role: "administracion", user_id: null }];
  T.notifications = [
    { id: uid(32, 1), user_id: P.marcela, alert_type: "egreso_informado", mensaje: "Se informó el egreso de un paciente (Alta médica). Falta confirmar la baja definitiva.", href: "/pacientes", entidad: "patients", entidad_id: "x", created_at: at(-1), read_at: null },
    { id: uid(32, 2), user_id: P.marcela, alert_type: "autorizacion_por_vencer", mensaje: "La autorización de un paciente vence pronto.", href: "/internacion", entidad: null, entidad_id: null, created_at: at(-3), read_at: at(-2) },
  ];

  // RPC
  const accesos = [{ id: uid(23, 1), created_at: at(-3), expires_at: at(27), revoked_at: null, last_access_at: at(-1), locked_until: null, creado_por: P.laura }];
  const portal = (tokenOk) => tokenOk ? { ok: true, paciente: PT[0].nombre_completo, vence: at(27), proximas: [{ id: uid(6, 1), especialidad: "kinesiologia", fecha: at(1, 9, 0), estado: "confirmada", profesional: "Carolina Páez" }, { id: uid(6, 2), especialidad: "enfermeria", fecha: at(1, 14, 30), estado: "programada", profesional: "Sandra Quiroga" }], recientes: [{ id: uid(6, 3), especialidad: "medicina", fecha: at(-2, 10, 0), estado: "realizada", profesional: "Dr. Gustavo Herrera", confirmada_at: null, confirmada_por: null }, { id: uid(6, 4), especialidad: "kinesiologia", fecha: at(-4, 9, 0), estado: "realizada", profesional: "Carolina Páez", confirmada_at: at(-3), confirmada_por: "Gabriela Albornoz" }] } : { ok: false, error: "invalido" };
  const rpc = {
    fn_family_access_list: () => accesos,
    fn_family_portal_view: (b) => portal(/^\d{6}$/.test(b.p_pin || "")),
    fn_family_confirm_visit: () => ({ ok: true }),
    fn_family_access_create: () => ({ ok: true, token: "a".repeat(32), pin: "123456", expires_at: at(30) }),
    fn_family_access_revoke: () => ({ ok: true }),
  };
  return { tables: T, rpc, today: D(0) };
}
