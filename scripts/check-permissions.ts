// Chequeo automático de la matriz de permisos (F2). Ejecutar: npm run check:permissions
import { readFileSync } from "node:fs";
import { PERMISOS } from "../src/lib/permissions";
import { NAV_BY_ROLE } from "../src/lib/auth";

// Cómo nombra cada rol el mensaje de rechazo del servidor (sin tildes ni mayúsculas).
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const NOMBRE_EN_MENSAJE: Record<string, string> = {
  administracion: "administracion",
  coordinador_internacion: "coordinacion",
  profesional_asistencial: "profesional asistencial",
  deposito: "deposito",
  transporte: "transporte",
  direccion: "direccion",
};

const errores: string[] = [];
for (const p of PERMISOS) {
  let src = "";
  try {
    src = readFileSync(p.guard.file, "utf8");
  } catch {
    errores.push(`[${p.accion}] no existe el archivo ${p.guard.file}`);
    continue;
  }
  if (!src.includes(p.guard.message)) {
    errores.push(`[${p.accion}] el código ya no contiene el mensaje de rechazo «${p.guard.message}» (¿cambió el permiso?)`);
    continue;
  }
  // Los mensajes en lenguaje natural deben nombrar exactamente los roles de la matriz.
  if (!p.guard.message.includes("role")) {
    const msg = norm(p.guard.message.replace(/^Solo (el |un )?/i, ""));
    const head = msg.split(/ (da|carga|registra|arman|confirman|confirma|pueden|modifican|completa|programa|reprograma|cancela|gestiona|arma|autoriza|rechaza|despacha|genera|marca|reporta|configura)\b/)[0];
    const nombrados = Object.entries(NOMBRE_EN_MENSAJE).filter(([, n]) => head.includes(n)).map(([r]) => r);
    const esperados = [...p.roles].sort().join(",");
    if (nombrados.sort().join(",") !== esperados) {
      errores.push(`[${p.accion}] el mensaje nombra {${nombrados.join(", ")}} pero la matriz dice {${p.roles.join(", ")}}`);
    }
  }
}

// Cada rol tiene al menos una pantalla y nadie ve la Auditoría salvo Dirección.
for (const [rol, items] of Object.entries(NAV_BY_ROLE)) {
  if (!items.some((i) => i.href === "/inicio")) errores.push(`El rol ${rol} no tiene «Inicio» en el menú`);
  const ve = items.some((i) => i.href === "/auditoria");
  if (ve && rol !== "direccion") errores.push(`El rol ${rol} ve «Auditoría» en el menú y no debería`);
  if (rol === "direccion" && !ve) errores.push("Dirección no ve «Auditoría» en el menú");
}
// Roles que el menú muestra para crear cosas deben figurar en la matriz.
const rolesEnMatriz = new Set(PERMISOS.flatMap((p) => p.roles));
for (const rol of Object.keys(NAV_BY_ROLE)) {
  if (!rolesEnMatriz.has(rol as never)) errores.push(`El rol ${rol} no tiene ninguna acción en la matriz`);
}

if (errores.length) {
  console.error(`✗ ${errores.length} problema(s) en los permisos:\n- ${errores.join("\n- ")}`);
  process.exit(1);
}
console.log(`✓ Permisos consistentes: ${PERMISOS.length} acciones revisadas contra el código y el menú.`);
