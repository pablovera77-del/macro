import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, ROLE_LABELS } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import ActionDisclosure from "@/components/ActionDisclosure";
import { IconUsers } from "@/components/icons";
import { CrearUsuarioForm, CambiarRolForm, ActivarForm, LegajoForm } from "@/components/usuarios/UsuarioForms";
import { puedeCrearUsuarios } from "@/lib/supabase/admin";
import { SPECIALTY_LABELS } from "@/lib/roles";
import type { AppRole } from "@/lib/roles";

function fechaCorta(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Argentina/San_Juan" }).format(new Date(iso));
}

export default async function UsuariosPage({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const { profile } = await requireProfile();
  // DF-C1 §3: solo Administración gestiona el personal.
  if (profile.role !== "administracion") redirect("/inicio");

  const { ver } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, role, active, last_login_at, especialidad, dni, matricula, telefono, email_contacto, fecha_ingreso, fecha_baja")
    .neq("role", "medico_coordinador")
    .order("active", { ascending: false })
    .order("full_name");

  const todos = data ?? [];
  const verInactivos = ver === "todos";
  const lista = verInactivos ? todos : todos.filter((u) => u.active);
  const inactivos = todos.filter((u) => !u.active).length;

  return (
    <div className="space-y-6">
      <PageHeader
        action={{ label: "+ Nuevo usuario", href: "#nuevo-usuario" }}
        icon={<IconUsers className="w-5 h-5" />}
        title="Usuarios y equipo"
        section="DF-C1 §3 (R17, R21, R23-R28)"
        purpose="Acá das de alta al personal, le asignás el rol (qué pantallas ve y qué puede hacer), completás su legajo y desactivás cuentas cuando alguien se va. Una cuenta desactivada no puede ingresar, pero su historial queda."
        description="Gestión de cuentas, roles y legajo del personal. Las bajas son lógicas: nunca se borra una cuenta con historial."
      />

      <div className="flex items-center justify-between gap-3 flex-wrap text-sm text-slate-600">
        <span>
          {lista.length} {verInactivos ? "personas" : "personas activas"}
          {!verInactivos && inactivos > 0 ? ` · ${inactivos} desactivadas` : ""}
        </span>
        {inactivos > 0 && (
          <a href={verInactivos ? "/usuarios" : "/usuarios?ver=todos"} className="text-teal-700 font-medium hover:underline">
            {verInactivos ? "Ocultar desactivadas" : "Mostrar también las desactivadas"}
          </a>
        )}
      </div>

      <section className="space-y-3">
        {lista.map((u, i) => {
          const esYo = u.id === profile.id;
          const rol = u.role as AppRole;
          return (
            <div key={u.id} className={`bg-white rounded-2xl border p-4 sm:p-5 animate-fade-slide-up stagger-${Math.min(i + 1, 8)} ${u.active ? "border-slate-200" : "border-slate-200 opacity-75"}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="font-medium text-slate-900 flex items-center gap-2 flex-wrap">
                    {u.full_name}
                    {esYo && <span className="text-[11px] rounded-full bg-slate-100 text-slate-600 px-2 py-0.5">Sos vos</span>}
                    {!u.active && <span className="text-[11px] rounded-full bg-red-50 text-red-700 border border-red-200 px-2 py-0.5">Desactivada</span>}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {ROLE_LABELS[rol] ?? u.role}
                    {u.especialidad ? ` · ${SPECIALTY_LABELS[u.especialidad] ?? u.especialidad}` : ""}
                    {u.matricula ? ` · Mat. ${u.matricula}` : ""}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {u.email_contacto ?? "Sin email cargado"}
                    {u.telefono ? ` · ${u.telefono}` : ""}
                  </div>
                </div>
                <div className="text-xs text-slate-500 text-right">
                  <div>Último ingreso: {u.last_login_at ? fechaCorta(u.last_login_at) : "nunca"}</div>
                  {u.fecha_baja && <div>Baja: {fechaCorta(u.fecha_baja)}</div>}
                </div>
              </div>

              <ActionDisclosure label="Editar" tone="subtle">
                <div className="space-y-4 rounded-xl bg-slate-50 border border-slate-200 p-4">
                  <LegajoForm p={u} />
                  <hr className="border-slate-200" />
                  <CambiarRolForm id={u.id} rol={u.role} esYo={esYo} />
                  <hr className="border-slate-200" />
                  <ActivarForm id={u.id} activo={u.active} esYo={esYo} />
                </div>
              </ActionDisclosure>
            </div>
          );
        })}
        {lista.length === 0 && <p className="text-sm text-slate-500">Todavía no hay personas cargadas.</p>}
      </section>

      <section id="nuevo-usuario" className="scroll-mt-20 bg-white rounded-2xl border border-slate-200 p-5 max-w-xl">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Nuevo usuario</h2>
        <CrearUsuarioForm habilitado={puedeCrearUsuarios()} />
      </section>
    </div>
  );
}
