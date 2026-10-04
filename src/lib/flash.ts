import { cookies } from "next/headers";

/**
 * Mensaje de confirmación para el usuario tras una acción (ej. "Pedido
 * autorizado. Siguiente paso: Depósito lo despacha"). Se guarda en una cookie
 * de vida corta que <FlashToast /> lee, muestra y borra.
 */
export async function flash(message: string) {
  const store = await cookies();
  store.set("flash", encodeURIComponent(message), { path: "/", maxAge: 30, sameSite: "lax" });
}
