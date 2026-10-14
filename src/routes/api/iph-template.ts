import { createFileRoute } from "@tanstack/react-router";

/**
 * Compatibilidad para clientes que aún consulten esta ruta.
 * La única plantilla permitida es el PDF local proporcionado por el usuario.
 * No se consulta ni sustituye por documentos externos.
 */
export const Route = createFileRoute("/api/iph-template")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const localTemplate = new URL("/iph-infracciones-administrativas.pdf", request.url);
        return Response.redirect(localTemplate, 307);
      },
    },
  },
});
