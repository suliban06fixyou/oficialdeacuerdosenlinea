import { createServerFn } from "@tanstack/react-start";
import { EntradaRevision, SISTEMA } from "./revision.prompt";

export const revisarNarrativa = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => EntradaRevision.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Falta la configuración del servicio de IA.");

    const contexto = [
      `Horas capturadas: ${JSON.stringify(data.horas)}`,
      data.faltaAdministrativa || data.delito
        ? `Ilícito reportado: ${[data.faltaAdministrativa, data.delito].filter(Boolean).join(" / ")}`
        : "Ilícito reportado: no especificado.",
      data.hallazgosLocales.length
        ? `Hallazgos del validador automático:\n- ${data.hallazgosLocales.join("\n-")}`
        : "El validador automático no detectó incidencias.",
      `Narrativa del oficial:\n"""${data.narrativa}"""`,
      data.pregunta ? `Pregunta adicional del oficial: ${data.pregunta}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.6-sol",
        input: [
          { role: "system", content: SISTEMA },
          { role: "user", content: contexto },
        ],
        stream: true,
        reasoning: { effort: "low", summary: "auto" },
      }),
    });

    if (!res.ok || !res.body) {
      const detalle = await res.text();
      if (res.status === 429)
        throw new Error("Límite de solicitudes alcanzado. Intente de nuevo en un momento.");
      if (res.status === 402) throw new Error("Créditos de IA agotados en el espacio de trabajo.");
      throw new Error(`Error del servicio de IA [${res.status}]: ${detalle}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let texto = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lineas = buffer.split("\n");
      buffer = lineas.pop() ?? "";
      for (const linea of lineas) {
        if (!linea.startsWith("data:")) continue;
        const payload = linea.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const evento = JSON.parse(payload) as {
            type?: string;
            delta?: string;
            response?: { output_text?: string };
          };
          if (evento.type === "response.output_text.delta" && typeof evento.delta === "string") {
            texto += evento.delta;
          } else if (evento.type === "response.completed" && evento.response?.output_text && !texto) {
            texto = evento.response.output_text;
          }
        } catch {
          // fragmento incompleto
        }
      }
    }

    return {
      texto:
        texto.trim() ||
        "No fue posible generar la revisión con IA en este momento. Revise los hallazgos automáticos y vuelva a intentarlo.",
    };
  });
