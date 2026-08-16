import { createServerFn } from "@tanstack/react-start";
import { EntradaRevision, SISTEMA } from "./revision.prompt";

const MAX_NARRATIVA = 40_000;
const MAX_CAMPO = 2_000;
const OPENAI_MODEL = "gpt-5.4-mini";

function limitarCampo(valor: string | undefined, maximo = MAX_CAMPO) {
  if (!valor) return valor;
  return valor.length > maximo ? valor.slice(0, maximo) + " [contenido recortado]" : valor;
}

/**
 * Minimiza datos que no son necesarios para el análisis lingüístico.
 * No intenta anonimizar nombres, lugares o hechos porque son parte del contexto
 * necesario para revisar la narrativa policial y una sustitución automática
 * podría alterar el sentido jurídico del IPH.
 */
function minimizarDatosParaIA(data: EntradaRevision) {
  const narrativa = data.narrativa.trim();
  if (narrativa.length > MAX_NARRATIVA) {
    throw new Error(`La narrativa supera el máximo permitido de ${MAX_NARRATIVA.toLocaleString()} caracteres.`);
  }

  return {
    ...data,
    narrativa,
    faltaODelito: limitarCampo(data.faltaODelito),
    lugar: limitarCampo(data.lugar),
    pregunta: limitarCampo(data.pregunta),
    hallazgosLocales: data.hallazgosLocales.slice(0, 30).map((hallazgo) => limitarCampo(hallazgo, 500) ?? ""),
  };
}

export const revisarNarrativa = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => EntradaRevision.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("Falta la configuración segura del servicio de IA.");

    const segura = minimizarDatosParaIA(data);

    const contexto = [
      `Horas capturadas: ${JSON.stringify(segura.horas)}`,
      segura.faltaODelito
        ? `Falta administrativa y/o delito: ${segura.faltaODelito}`
        : "Falta administrativa y/o delito: no especificado.",
      segura.lugar ? `Lugar del evento: ${segura.lugar}` : "Lugar del evento: no especificado.",
      segura.hallazgosLocales.length
        ? `Hallazgos del validador automático:\n- ${segura.hallazgosLocales.join("\n-")}`
        : "El validador automático no detectó incidencias.",
      `Narrativa del oficial:\n"""${segura.narrativa}"""`,
      segura.pregunta ? `Pregunta adicional del oficial: ${segura.pregunta}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: [
          { role: "system", content: SISTEMA },
          { role: "user", content: contexto },
        ],
        stream: true,
        store: false,
        reasoning: { effort: "low" },
      }),
    });

    if (!res.ok || !res.body) {
      const detalle = await res.text();
      if (res.status === 429)
        throw new Error("Límite de solicitudes alcanzado. Intente de nuevo en un momento.");
      if (res.status === 401)
        throw new Error("La configuración del servicio de IA no es válida.");
      if (res.status === 402)
        throw new Error("La cuenta de IA no tiene saldo disponible.");
      throw new Error(`Error del servicio de IA [${res.status}]: ${detalle.slice(0, 300)}`);
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
          // Fragmento SSE incompleto; se procesa con el siguiente bloque.
        }
      }
    }

    return {
      texto:
        texto.trim() ||
        "No fue posible generar la revisión con IA en este momento. Revise los hallazgos automáticos y vuelva a intentarlo.",
    };
  });
