// Estado que devuelven las acciones de Stock a los formularios (useActionState).
// Los errores de negocio se DEVUELVEN (no se lanzan): en producción Next.js oculta
// el texto de los errores lanzados desde una acción y el usuario vería una pantalla genérica.
export type ActionState = { error: string | null };
