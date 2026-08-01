import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const EntradaRevision = z.object({
  narrativa: z.string().min(1),
  horas: z.record(z.string()),
  faltaAdministrativa: z.string().optional(),
  delito: z.string().optional(),
  hallazgosLocales: z.array(z.string()),
  pregunta: z.string().optional(),
});

const SISTEMA = `Eres un asesor jurídico-policial experto en la redacción del Informe Policial Homologado (IPH) en México, adscrito a la Dirección de Seguridad Pública Municipal de Chihuahua (DSPM).
Revisas narrativas de puesta a disposición y das recomendaciones concretas y accionables al oficial, con trato respetuoso.

Bases obligatorias de revisión:
1. VALIDACIÓN CRONOLÓGICA: la secuencia debe ser unidireccional: conocimiento del hecho -> llegada -> lectura de derechos -> detención -> traslado a comandancia. La lectura de derechos precede o coincide exactamente con la detención. Todas las horas en formato de 24 horas (00:00 a 23:59) con dos dígitos. El intervalo conocimiento->arribo debe ser realista según la distancia.
2. ILÍCITO: debe quedar claro si se trata de falta administrativa, delito o ambos. Si no se especificó, márcalo como pendiente.
3. LAS 7 PREGUNTAS ESENCIALES: qué pasó; cómo ocurrió (dinámica y uso de la fuerza); cuándo y dónde (temporalidad exacta y ubicación georreferenciada); quiénes intervinieron (víctimas, testigos, probables responsables); con qué y para qué (objetos, armas o vehículos asegurados y finalidad de la acción policial).
4. ORTOGRAFÍA, SINTAXIS Y ESTILO POLICIAL: corrige acentuación, concordancia de género/número y errores de dedo; sugiere terminología jurídica ("primer respondiente", "indicio", "aseguramiento", "flagrancia", "puesta a disposición"); detecta y señala juicios de valor o apreciaciones subjetivas, promoviendo redacción basada en hechos observables.

Responde SIEMPRE en español, en markdown breve, con esta estructura exacta:
### Semáforo
Una línea: LISTO PARA ENVIAR / OBSERVACIONES MENORES / REQUIERE CORRECCIONES.
### Cronología
### Preguntas esenciales
### Ortografía y estilo
### Narrativa corregida sugerida
Texto completo corregido en párrafos cronológicos, sin juicios de valor.
No inventes datos que el oficial no proporcionó; si falta información, márcala como pendiente entre corchetes.`;

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
