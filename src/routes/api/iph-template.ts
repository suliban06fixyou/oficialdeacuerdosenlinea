import { createFileRoute } from "@tanstack/react-router";

const IPH_TEMPLATE_URL =
  "https://www.gob.mx/cms/uploads/attachment/file/394022/IPH_INFRACCIONES_ADMINISTRATIVAS.PDF";

export const Route = createFileRoute("/api/iph-template")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const upstream = await fetch(IPH_TEMPLATE_URL, {
            headers: {
              Accept: "application/pdf,*/*;q=0.8",
              Referer: "https://www.gob.mx/",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
              "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
              "Sec-Fetch-Dest": "document",
              "Sec-Fetch-Mode": "navigate",
              "Sec-Fetch-Site": "same-origin",
            },
          });

          if (!upstream.ok) {
            console.error(`No se pudo obtener la plantilla IPH oficial [${upstream.status}].`);
            return Response.json(
              {
                ok: false,
                error: "No se pudo obtener el formato oficial IPH. Intente nuevamente más tarde.",
              },
              { status: 502 },
            );
          }

          const bytes = await upstream.arrayBuffer();
          const signature = new TextDecoder().decode(bytes.slice(0, 5));

          if (signature !== "%PDF-" || bytes.byteLength < 10_000) {
            console.error("La fuente oficial no devolvió un PDF válido.");
            return Response.json(
              { ok: false, error: "La fuente del formato oficial devolvió un archivo no válido." },
              { status: 502 },
            );
          }

          return new Response(bytes, {
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": 'inline; filename="IPH_INFRACCIONES_ADMINISTRATIVAS.pdf"',
              "Cache-Control": "public, max-age=3600, s-maxage=86400",
              "X-Content-Type-Options": "nosniff",
            },
          });
        } catch (error) {
          console.error("Error al recuperar la plantilla IPH oficial:", error);
          return Response.json(
            {
              ok: false,
              error: "No se pudo conectar con la fuente oficial del formato IPH.",
            },
            { status: 502 },
          );
        }
      },
    },
  },
});
