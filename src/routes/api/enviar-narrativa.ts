import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Cuerpo = z.object({
  comandancia: z.enum(["sur", "norte"]),
  oficial: z.string().trim().max(120),
  folio: z.string().trim().max(60),
  narrativa: z.string().trim().min(1).max(20000),
  horas: z.record(z.string().max(10)),
  resumenRevision: z.string().max(20000).optional(),
});

const DESTINATARIO = "dspmoficialesacuerdo@gmail.com";

function escapar(texto: string) {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export const Route = createFileRoute("/api/enviar-narrativa")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = Cuerpo.safeParse(await request.json());
        if (!parsed.success) {
          return Response.json({ ok: false, error: "Datos inválidos." }, { status: 400 });
        }
        const { comandancia, oficial, folio, narrativa, horas, resumenRevision } = parsed.data;
        const apiKey = process.env.RESEND_API_KEY;
        const remitente = process.env.EMAIL_FROM ?? "IPH DSPM <onboarding@resend.dev>";

        if (!apiKey) {
          return Response.json(
            {
              ok: false,
              error: "correo_no_configurado",
              mensaje:
                "El envío automático de correo aún no está configurado en el servidor. Use la opción de envío manual.",
            },
            { status: 503 },
          );
        }

        const etiqueta = comandancia === "sur" ? "COMANDANCIA SUR" : "COMANDANCIA NORTE";
        const color = comandancia === "sur" ? "#facc15" : "#22c55e";
        const nombreOficial = oficial || "Oficial no especificado";
        const filasHoras = Object.entries(horas)
          .map(([k, v]) => `<tr><td style="padding:4px 10px;">${escapar(k)}</td><td style="padding:4px 10px;"><b>${escapar(v || "—")}</b></td></tr>`)
          .join("");

        const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#0b1a3a;">
  <h2 style="color:#0b1a3a;margin-bottom:6px;">
    <span style="background-color:${color};padding:4px 10px;border-bottom:5px solid ${color};font-weight:bold;">${escapar(etiqueta)}</span>
  </h2>
  <p style="font-size:18px;margin:10px 0;">
    <b>Oficial que redacta:</b>
    <span style="border-bottom:5px solid ${color};background-color:${color}33;padding:2px 6px;font-weight:bold;">${escapar(nombreOficial)}</span>
  </p>
  <p><b>Folio / IPH:</b> ${escapar(folio || "No especificado")}</p>
  <h3>Cronología</h3>
  <table style="border-collapse:collapse;">${filasHoras}</table>
  <h3>Narrativa</h3>
  <p style="white-space:pre-wrap;">${escapar(narrativa)}</p>
  ${resumenRevision ? `<h3>Resultado de la revisión</h3><p style="white-space:pre-wrap;">${escapar(resumenRevision)}</p>` : ""}
  <hr/>
  <p style="font-size:12px;color:#5b6b8c;">Enviado desde el Revisor de Narrativas IPH — DSPM Chihuahua.</p>
</div>`;

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            from: remitente,
            to: [DESTINATARIO],
            subject: `[${etiqueta}] Narrativa IPH ${folio || ""} — ${nombreOficial}`.trim(),
            html,
          }),
        });

        if (!res.ok) {
          const detalle = await res.text();
          console.error(`Fallo de envío de correo [${res.status}]: ${detalle}`);
          return Response.json(
            { ok: false, error: "envio_fallido", mensaje: `No se pudo enviar el correo [${res.status}].` },
            { status: 502 },
          );
        }

        return Response.json({ ok: true, destinatario: DESTINATARIO, comandancia: etiqueta });
      },
    },
  },
});
