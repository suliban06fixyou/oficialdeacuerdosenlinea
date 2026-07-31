export type Severidad = "critico" | "advertencia" | "ok";

export interface Hallazgo {
  id: string;
  categoria: "Cronología" | "7 Preguntas" | "Estilo" | "Formato";
  severidad: Severidad;
  titulo: string;
  detalle: string;
  sugerencia?: string;
}

export const PASOS_CRONOLOGICOS = [
  { key: "conocimiento", label: "Conocimiento del hecho" },
  { key: "llegada", label: "Llegada al lugar" },
  { key: "entrevista", label: "Entrevista" },
  { key: "derechos", label: "Lectura de derechos" },
  { key: "detencion", label: "Detención" },
  { key: "traslado", label: "Traslado a comandancia" },
  { key: "remision", label: "Remisión" },
] as const;

export type ClaveHora = (typeof PASOS_CRONOLOGICOS)[number]["key"];
export type Horas = Record<ClaveHora, string>;

export const HORAS_VACIAS: Horas = {
  conocimiento: "",
  llegada: "",
  entrevista: "",
  derechos: "",
  detencion: "",
  traslado: "",
  remision: "",
};

const FORMATO_24H = /^([01]\d|2[0-3]):([0-5]\d)$/;

function aMinutos(hhmm: string): number | null {
  if (!FORMATO_24H.test(hhmm)) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Minutos transcurridos entre dos marcas, tolerando el cruce de medianoche. */
function delta(inicio: number, fin: number): number {
  const d = fin - inicio;
  return d < 0 ? d + 24 * 60 : d;
}

export function validarCronologia(horas: Horas): Hallazgo[] {
  const hallazgos: Hallazgo[] = [];

  for (const paso of PASOS_CRONOLOGICOS) {
    const valor = horas[paso.key];
    if (!valor) {
      hallazgos.push({
        id: `falta-${paso.key}`,
        categoria: "Cronología",
        severidad: "critico",
        titulo: `Falta la hora de ${paso.label.toLowerCase()}`,
        detalle:
          "La secuencia cronológica del IPH debe estar completa para acreditar la legalidad de la actuación.",
        sugerencia: "Registre la marca de tiempo en formato de 24 horas (00:00 a 23:59).",
      });
      continue;
    }
    if (aMinutos(valor) === null) {
      hallazgos.push({
        id: `formato-${paso.key}`,
        categoria: "Formato",
        severidad: "critico",
        titulo: `Formato inválido en ${paso.label.toLowerCase()}`,
        detalle: `El valor "${valor}" no cumple el estándar de 24 horas con dos dígitos.`,
        sugerencia: "Utilice el formato HH:MM, por ejemplo 09:05 o 21:40.",
      });
    }
  }

  const pares = PASOS_CRONOLOGICOS.map((p) => ({ ...p, min: aMinutos(horas[p.key]) })).filter(
    (p) => p.min !== null,
  ) as { key: ClaveHora; label: string; min: number }[];

  for (let i = 0; i < pares.length - 1; i++) {
    const actual = pares[i];
    const siguiente = pares[i + 1];
    const transcurrido = delta(actual.min, siguiente.min);

    if (transcurrido > 12 * 60) {
      hallazgos.push({
        id: `orden-${actual.key}-${siguiente.key}`,
        categoria: "Cronología",
        severidad: "critico",
        titulo: `Secuencia invertida: ${siguiente.label} ocurre antes que ${actual.label}`,
        detalle: `${actual.label} (${horas[actual.key]}) debe preceder a ${siguiente.label} (${horas[siguiente.key]}). El orden es unidireccional.`,
        sugerencia: "Corrija las marcas de tiempo para respetar el orden lógico de la intervención.",
      });
      continue;
    }

    if (actual.key === "conocimiento" && siguiente.key === "llegada" && transcurrido > 60) {
      hallazgos.push({
        id: "arribo-tardio",
        categoria: "Cronología",
        severidad: "advertencia",
        titulo: "Intervalo de arribo poco realista",
        detalle: `Transcurrieron ${transcurrido} minutos entre el conocimiento del hecho y el arribo.`,
        sugerencia:
          "Justifique en la narrativa la distancia recorrida, el tráfico o la atención de otro servicio.",
      });
    }
  }

  const derechos = aMinutos(horas.derechos);
  const detencion = aMinutos(horas.detencion);
  if (derechos !== null && detencion !== null && delta(derechos, detencion) > 12 * 60) {
    hallazgos.push({
      id: "derechos-posteriores",
      categoria: "Cronología",
      severidad: "critico",
      titulo: "La lectura de derechos es posterior a la detención",
      detalle:
        "La lectura de derechos debe preceder o coincidir exactamente con el momento formal de la detención.",
      sugerencia: "Ajuste la hora de lectura de derechos o precise el momento formal de la detención.",
    });
  }

  const traslado = aMinutos(horas.traslado);
  const remision = aMinutos(horas.remision);
  if (traslado !== null && remision !== null) {
    const t = delta(traslado, remision);
    if (t <= 12 * 60 && t > 180) {
      hallazgos.push({
        id: "traslado-prolongado",
        categoria: "Cronología",
        severidad: "advertencia",
        titulo: "Traslado prolongado sin justificación",
        detalle: `Entre el traslado y la remisión transcurrieron ${t} minutos.`,
        sugerencia: "Explique la causa de la demora (atención médica, tráfico, apoyo a otra unidad).",
      });
    }
  }

  return hallazgos;
}

export const PREGUNTAS_ESENCIALES = [
  {
    id: "que",
    titulo: "¿Qué pasó?",
    ayuda: "Descripción clara del hecho presuntamente delictivo o falta administrativa.",
    claves: ["delito", "falta", "hecho", "reporte", "denuncia", "riña", "robo", "portación"],
  },
  {
    id: "como",
    titulo: "¿Cómo ocurrió?",
    ayuda: "Dinámica de los sucesos y uso de la fuerza si aplica.",
    claves: ["al momento", "posteriormente", "acto seguido", "uso de la fuerza", "sometimiento", "forcejeo"],
  },
  {
    id: "cuando-donde",
    titulo: "¿Cuándo y dónde?",
    ayuda: "Temporalidad exacta y ubicación georreferenciada del sitio de intervención.",
    claves: ["calle", "avenida", "colonia", "cruce", "número", "coordenada", "sector", "horas"],
  },
  {
    id: "quienes",
    titulo: "¿Quiénes intervinieron?",
    ayuda: "Identificación de víctimas, testigos y probables responsables.",
    claves: ["testigo", "víctima", "probable responsable", "detenido", "denunciante", "unidad", "elemento"],
  },
  {
    id: "con-que",
    titulo: "¿Con qué y para qué?",
    ayuda: "Objetos, armas o vehículos asegurados y la finalidad de la acción policial.",
    claves: ["aseguramiento", "asegurado", "indicio", "arma", "vehículo", "objeto", "cadena de custodia"],
  },
] as const;

export function validarPreguntas(narrativa: string): Hallazgo[] {
  const texto = narrativa.toLowerCase();
  return PREGUNTAS_ESENCIALES.filter((p) => !p.claves.some((c) => texto.includes(c))).map((p) => ({
    id: `pregunta-${p.id}`,
    categoria: "7 Preguntas" as const,
    severidad: "advertencia" as const,
    titulo: `Posible omisión: ${p.titulo}`,
    detalle: p.ayuda,
    sugerencia: "Agregue un párrafo que responda expresamente a esta pregunta esencial.",
  }));
}

const SUBJETIVAS = [
  "creo",
  "considero",
  "me pareció",
  "aparentemente",
  "sospechoso",
  "nervioso",
  "actitud extraña",
  "obviamente",
  "sin duda",
  "malencarado",
];

const TERMINOS = [
  { informal: "policía que llegó primero", tecnico: "primer respondiente" },
  { informal: "agarramos", tecnico: "se realizó el aseguramiento" },
  { informal: "agarré", tecnico: "se realizó el aseguramiento" },
  { informal: "cosas", tecnico: "indicios o evidencias" },
  { informal: "tipo", tecnico: "persona / probable responsable" },
  { informal: "chavo", tecnico: "persona del sexo masculino" },
  { informal: "se lo llevamos", tecnico: "se puso a disposición" },
  { informal: "lo detuvimos", tecnico: "se llevó a cabo la detención en flagrancia" },
];

export function validarEstilo(narrativa: string): Hallazgo[] {
  const hallazgos: Hallazgo[] = [];
  const texto = narrativa.toLowerCase();

  const subjetivas = SUBJETIVAS.filter((s) => texto.includes(s));
  if (subjetivas.length) {
    hallazgos.push({
      id: "subjetividad",
      categoria: "Estilo",
      severidad: "advertencia",
      titulo: "Juicios de valor detectados",
      detalle: `Expresiones subjetivas encontradas: ${subjetivas.join(", ")}.`,
      sugerencia:
        "Sustituya la apreciación por el hecho observable (qué vio, escuchó o percibió con sus sentidos).",
    });
  }

  const informales = TERMINOS.filter((t) => texto.includes(t.informal));
  if (informales.length) {
    hallazgos.push({
      id: "lenguaje-tecnico",
      categoria: "Estilo",
      severidad: "advertencia",
      titulo: "Lenguaje coloquial en documento legal",
      detalle: informales.map((t) => `"${t.informal}" → "${t.tecnico}"`).join("; "),
      sugerencia: "Utilice terminología jurídica adecuada al Informe Policial Homologado.",
    });
  }

  if (narrativa.trim().length > 0 && narrativa.trim().length < 400) {
    hallazgos.push({
      id: "extension",
      categoria: "Estilo",
      severidad: "advertencia",
      titulo: "Narrativa demasiado breve",
      detalle: `La narrativa tiene ${narrativa.trim().length} caracteres.`,
      sugerencia:
        "Detalle la dinámica completa de los hechos; una narrativa escueta se presta a impugnación.",
    });
  }

  const oraciones = narrativa.split(/[.!?]+/).filter((o) => o.trim().length > 0);
  const largas = oraciones.filter((o) => o.trim().split(/\s+/).length > 60);
  if (largas.length) {
    hallazgos.push({
      id: "sintaxis",
      categoria: "Estilo",
      severidad: "advertencia",
      titulo: `${largas.length} oración(es) excesivamente larga(s)`,
      detalle: "Las oraciones de más de 60 palabras dificultan la comprensión del juzgador.",
      sugerencia: "Divida en oraciones cortas y cronológicas.",
    });
  }

  return hallazgos;
}

export function revisionLocal(horas: Horas, narrativa: string): Hallazgo[] {
  return [...validarCronologia(horas), ...validarPreguntas(narrativa), ...validarEstilo(narrativa)];
}
