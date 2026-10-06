// Lectura del código PDF417 del dorso del DNI argentino (DF-C3 §3.1).
// El texto del código separa los datos con «@»: trámite@APELLIDO@NOMBRE@SEXO@DNI@ejemplar@nacimiento@emisión@...
export type DatosDni = { apellido: string; nombre: string; sexo: "femenino" | "masculino" | "otro" | ""; dni: string; fecha_nacimiento: string };

const cap = (s: string) =>
  s.trim().toLowerCase().replace(/(^|\s|-)(\p{L})/gu, (_m, sep: string, c: string) => sep + c.toUpperCase());

export function parseDniPdf417(raw: string): DatosDni | null {
  const p = String(raw || "").split("@").map((x) => x.trim());
  if (p.length < 7) return null;
  const dni = (p[4] || "").replace(/\D/g, "");
  if (dni.length < 6 || dni.length > 9) return null;
  const sx = (p[3] || "").toUpperCase();
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(p[6] || "");
  return {
    apellido: cap(p[1] || ""),
    nombre: cap(p[2] || ""),
    sexo: sx === "F" ? "femenino" : sx === "M" ? "masculino" : sx ? "otro" : "",
    dni,
    fecha_nacimiento: m ? `${m[3]}-${m[2]}-${m[1]}` : "",
  };
}
