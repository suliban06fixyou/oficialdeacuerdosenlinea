import { useEffect, useMemo, useState } from "react";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

interface Props {
  oficial: string;
  folio: string;
  falta: string;
  lugar: string;
  horas: Record<string, string>;
  narrativa: string;
}

const TEMPLATE_ENDPOINT = "/iph-infracciones-administrativas.pdf";

function normalizarTexto(value: string): string {
  return value
    .normalize("NFC")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/[•·]/g, "-")
    .replace(/\r\n?/g, "\n");
}

function splitTime(value?: string): { hours: string; minutes: string } | null {
  if (!value) return null;
  const match = value.trim().match(/(?:^|\D)([01]?\d|2[0-3]):([0-5]\d)(?:\D|$)/);
  return match ? { hours: match[1].padStart(2, "0"), minutes: match[2] } : null;
}

function wordWrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const output: string[] = [];
  for (const paragraph of normalizarTexto(text).split("\n")) {
    if (!paragraph.trim()) {
      output.push("");
      continue;
    }

    let line = "";
    for (const word of paragraph.trim().split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) {
        line = candidate;
        continue;
      }

      if (line) output.push(line);
      if (font.widthOfTextAtSize(word, size) <= width) {
        line = word;
        continue;
      }

      // Split unusually long tokens rather than clipping them at the right edge.
      let fragment = "";
      for (const char of word) {
        if (fragment && font.widthOfTextAtSize(fragment + char, size) > width) {
          output.push(fragment);
          fragment = char;
        } else {
          fragment += char;
        }
      }
      line = fragment;
    }
    if (line) output.push(line);
  }
  return output;
}

function drawTime(
  page: PDFPage,
  value: string | undefined,
  xHours: number,
  xMinutes: number,
  y: number,
  font: PDFFont,
) {
  const time = splitTime(value);
  if (!time) return;
  const options = { y, size: 7.3, font, color: rgb(0.05, 0.05, 0.05) };
  page.drawText(time.hours, { ...options, x: xHours });
  page.drawText(time.minutes, { ...options, x: xMinutes });
}

function splitDate(value?: string): string | null {
  if (!value) return null;
  const match = value.match(/(?:^|\\D)(\\d{1,2})[\\/-](\\d{1,2})[\\/-](\\d{4})(?:\\D|$)/);
  if (!match) return null;
  const day = match[1].padStart(2, "0");
  const month = match[2].padStart(2, "0");
  const year = match[3];
  const d = Number(day), m = Number(month), y = Number(year);
  const parsed = new Date(y, m - 1, d);
  if (parsed.getFullYear() !== y || parsed.getMonth() !== m - 1 || parsed.getDate() !== d) return null;
  return day + month + year;
}

function drawDate(
  page: PDFPage,
  value: string | undefined,
  x: number,
  y: number,
  spacing: number,
  font: PDFFont,
) {
  const digits = splitDate(value);
  if (!digits) return;
  [...digits].forEach((digit, index) => {
    page.drawText(digit, {
      x: x + index * spacing, y, size: 6.8, font,
      color: rgb(0.05, 0.05, 0.05),
    });
  });
}

function marcar(page: PDFPage, x: number, y: number, font: PDFFont) {
  page.drawText("X", { x, y, size: 7.2, font, color: rgb(0.05, 0.05, 0.05) });
}

function drawWrappedValue(
  page: PDFPage,
  value: string,
  font: PDFFont,
  options: { x: number; y: number; width: number; maxLines: number; fontSize: number; lineHeight: number },
) {
  if (!value.trim()) return;
  const lines = wordWrap(value, font, options.fontSize, options.width);
  if (lines.length > options.maxLines) {
    throw new Error(
      "Uno de los datos no cabe en el espacio disponible del formato IPH. Revise la longitud del lugar o de la probable infracción antes de generar el PDF.",
    );
  }
  lines.forEach((line, index) => {
    if (!line) return;
    page.drawText(line, {
      x: options.x,
      y: options.y - index * options.lineHeight,
      size: options.fontSize,
      font,
      color: rgb(0.05, 0.05, 0.05),
    });
  });
}

function drawNarrativa(page: PDFPage, narrativa: string, font: PDFFont) {
  if (!narrativa.trim()) return;

  const x = 32;
  const maxWidth = page.getWidth() - 70;
  // En la sección 4, los renglones impresos del formato municipal están separados aproximadamente 16.2 puntos.
  // El texto se alinea con esos renglones y jamás se recorta silenciosamente.
  const topBaseline = 490;
  const bottomBaseline = 72;
  const lineHeight = 16.2;
  let chosen:
    | { size: number; lineHeight: number; lines: string[] }
    | undefined;

  for (let size = 8.1; size >= 6.1; size -= 0.4) {
    const lines = wordWrap(narrativa, font, size, maxWidth);
    const capacity = Math.floor((topBaseline - bottomBaseline) / lineHeight) + 1;
    if (lines.length <= capacity) {
      chosen = { size, lineHeight, lines };
      break;
    }
  }

  if (!chosen) {
    throw new Error(
      "La narrativa es demasiado extensa para el apartado 4 del formato original. Ajuste la redacción para que pueda imprimirse completa, sin recortarla.",
    );
  }

  chosen.lines.forEach((line, index) => {
    if (!line) return;
    page.drawText(line, {
      x,
      y: topBaseline - index * chosen!.lineHeight,
      size: chosen!.size,
      font,
      color: rgb(0.05, 0.05, 0.05),
    });
  });
}


/**
 * Extrae únicamente frases expresamente presentes en la narrativa.
 * No determina lesiones, atención médica ni otros hechos que no estén escritos.
 */
export function extraerDatosUsoFuerza(narrativa: string): { resistencia: string; descripcion: string; detencion: boolean } {
  const frases = normalizarTexto(narrativa)
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((frase) => frase.trim())
    .filter(Boolean);

  const detencion = /\bdetenci[oó]n\b|\bdetenido\b|\bdetenida\b|\bse procedi[oó] a detener\b/i.test(narrativa);

  // Rescata únicamente hechos relacionados con resistencia o conducta de la persona
  // que estén expresamente narrados; una agresión verbal no se convierte por sí sola
  // en resistencia física ni justifica inferir un nivel de fuerza.
  const resistencia = frases
    .filter((frase) => /resisten|se neg[oó] a obedecer|agresi[oó]n|conductas? verbales? agresivas?|palabras ofensivas|se opuso|forceje|intent[oó] evadir/i.test(frase))
    .join(" ");

  // Se conserva lo que la narrativa diga expresamente sobre técnicas/medios empleados.
  const descripcionExpresa = frases
    .filter((frase) => /comandos? verbales?|instrucciones? verbales?|uso de la fuerza|utilizando la fuerza|fuerza estrictamente necesaria|candados? de mano|esposas|control(?:ar)? f[ií]sic|t[eé]cnica de control/i.test(frase))
    .join(" ");

  // Regla general solicitada: cuando la narrativa refiere una detención, consignar
  // comandos verbales y candados de mano. Si la narrativa ya menciona uno de ellos,
  // completar sólo el elemento general que falte y conservar los detalles expresos.
  // No se infieren lesiones, atención médica, resistencia física ni niveles de fuerza.
  const mediosGenerales = "Se utilizaron comandos verbales y candados de mano (esposas) durante la detención.";
  const descripcion = detencion
    ? [
        /comandos? verbales?|instrucciones? verbales?/i.test(descripcionExpresa)
          ? ""
          : "Se utilizaron comandos verbales.",
        /candados? de mano|esposas/i.test(descripcionExpresa)
          ? ""
          : "Se utilizaron candados de mano (esposas).",
        descripcionExpresa,
      ]
        .filter(Boolean)
        .join(" ")
        .trim() || mediosGenerales
    : descripcionExpresa;

  return { resistencia, descripcion, detencion };
}

function dibujarTextoAjustado(
  page: PDFPage,
  value: string,
  font: PDFFont,
  area: { x: number; topY: number; width: number; bottomY: number; maxSize: number; minSize: number },
) {
  if (!value.trim()) return;
  const availableHeight = area.topY - area.bottomY;
  for (let size = area.maxSize; size >= area.minSize; size -= 0.25) {
    const lineHeight = size * 1.35;
    const lines = wordWrap(value, font, size, area.width);
    if (lines.length * lineHeight <= availableHeight) {
      lines.forEach((line, index) => {
        if (!line) return;
        page.drawText(line, {
          x: area.x,
          y: area.topY - size - index * lineHeight,
          size,
          font,
          color: rgb(0.05, 0.05, 0.05),
        });
      });
      return;
    }
  }
  throw new Error("La información del apartado de uso de la fuerza no cabe completa en el espacio disponible. Revise la narrativa; no se omitió texto deliberadamente.");
}

function dibujarUsoFuerza(page: PDFPage, narrativa: string, font: PDFFont) {
  const datos = extraerDatosUsoFuerza(narrativa);
  // Apartado 5.1: cada texto se limita al recuadro impreso del formato oficial.
  dibujarTextoAjustado(page, datos.resistencia, font, {
    x: 32, topY: 710, bottomY: 680, width: page.getWidth() - 66, maxSize: 7.2, minSize: 5.8,
  });
  dibujarTextoAjustado(page, datos.descripcion, font, {
    x: 32, topY: 650, bottomY: 570, width: page.getWidth() - 66, maxSize: 7.2, minSize: 5.8,
  });

  // Marcar "Detención(es)" cuando la narrativa menciona expresamente una detención.
  // La descripción general consigna comandos verbales y candados de mano conforme a la regla acordada;
  // no se marcan lesiones ni atención médica sin datos expresos.
  if (datos.detencion) {
    page.drawText("X", {
      x: 247,
      y: 555,
      size: 7.2,
      font,
      color: rgb(0.05, 0.05, 0.05),
    });
  }
}

/**
 * Recupera datos sólo cuando la narrativa los identifica de forma explícita.
 * Evita inferir domicilios, infracciones u horarios a partir de frases ambiguas.
 */
export function extraerCamposNarrativa(narrativa: string): {
  falta: string;
  lugar: string;
  conocimientoReporte: string;
  calle: string;
  cruce: string;
  colonia: string;
  municipio: string;
  entidad: string;
  latitud: string;
  longitud: string;
  numeroExterior: string;
  numeroInterior: string;
  codigoPostal: string;
  entreCalle: string;
  yCalle: string;
  fechaConocimiento: string;
  fechaArribo: string;
  fechaDetencion: string;
  tipoConocimiento: "llamada" | "presencia" | "queja" | "otro" | "";
  tipoLugar: "hogar" | "viaPublica" | "transporte" | "taxi" | "metro" | "otro" | "";
  nombreDetenido: string;
  aliasDetenido: string;
  sexoDetenido: string;
  fechaNacimientoDetenido: string;
  nacionalidadDetenido: string;
  curpDetenido: string;
  domicilioDetenido: string;
  lugarDetencion: string;
  documentoDetenido: string;
  autoridadEntrega: string;
  fechaEntrega: string;
  horaEntrega: string;
  policiaEntrega: string;
  autoridadRecibe: string;
  horas: Record<string, string>;
} {
  const texto = normalizarTexto(narrativa);
  const plano = texto.replace(/\s+/g, " ").trim();
  const obtener = (etiquetas: string): string => {
    const re = new RegExp("(?:^|[\\n;|])\\s*(?:" + etiquetas + ")\\s*[:=—-]\\s*([^\\n;|]+)", "i");
    return texto.match(re)?.[1]?.trim() ?? "";
  };
  const grupo = (re: RegExp): string => plano.match(re)?.[1]?.trim() ?? "";
  const horas: Record<string, string> = {};
  const conocimiento = obtener("hora(?: de)? conocimiento|conocimiento") || grupo(/(?:a las|siendo las)\s+([0-2]?\d:[0-5]\d)\s+horas?[^.]{0,100}(?:reporte|llamada|tableta|radio)/i);
  const llegada = obtener("hora(?: de)? llegada|llegada al lugar") || grupo(/(?:arrib[eé]|lleg[uó]|arribo)\s+(?:al lugar )?(?:a las )([0-2]?\d:[0-5]\d)\s+horas?/i);
  const detencion = obtener("hora(?: de)? detenci[oó]n|detenci[oó]n") || grupo(/(?:siendo las|a las)\s+([0-2]?\d:[0-5]\d)\s+horas?[^.]{0,120}(?:detenci[oó]n|detuvo|detener)/i);
  if (splitTime(conocimiento)) horas.conocimiento = conocimiento;
  if (splitTime(llegada)) horas.llegada = llegada;
  if (splitTime(detencion)) horas.detencion = detencion;

  const reporte = grupo(/(?:se recibi[oó]|recibimos|recib[ií])[^.]{0,180}?(?:reporte|llamada|aviso)\s+(?:por|de)\s+([^.;]+)/i);
  const consumo = grupo(/(?:observ[eé]|observamos|se detect[oó])[^.]{0,100}?(persona[^.]{0,160}?(?:consumiendo|ingiriendo)[^.]+)/i);
  const falta = obtener("probable infracci[oó]n|falta administrativa|infracci[oó]n") || reporte || consumo;

  const lugarEtiquetado = obtener("lugar de los hechos|ubicaci[oó]n|domicilio de los hechos");
  const cruce = grupo(/(?:intersecci[oó]n|cruce) de?\s*([^.;]+?)(?:,\s*colonia|,\s*col\.?|\s+colonia|\s+col\.|[.;]|$)/i);
  const colonia = grupo(/\bcol(?:onia)?\.?\s+([^,.;]+?)(?=,|\s+(?:municipio|Chihuahua)|[.;]|$)/i);
  const calle = cruce || grupo(/(?:^|,\s*)((?:calle|avenida|av\.?|boulevard|blvd\.?|carretera)\s+[^,.;]{3,100})/i) || grupo(/(?:en|sobre|ubicado en)\s+(?:la intersecci[oó]n de )?((?:calle|avenida|av\.?|boulevard|blvd\.?|carretera)\s+[^,.;]{3,100})/i);
  const municipio = grupo(/\bmunicipio de\s+([^,.;]+)/i) || (/\bChihuahua\b/i.test(plano) ? "Chihuahua" : "");
  const entidad = /\bChihuahua\b/i.test(plano) ? "Chihuahua" : "";
  const latitud = grupo(/latitud\s*[:=]?\s*(-?\d{1,2}\.\d+)/i);
  const longitud = grupo(/longitud\s*[:=]?\s*(-?\d{1,3}\.\d+)/i);
  const numeroExterior = obtener("n[uú]mero exterior|no\\.? exterior") || grupo(/(?:n[uú]mero|no\.?)\s+ext\.?\s*[:#-]?\s*(\d+[a-zA-Z]?)/i);
  const numeroInterior = obtener("n[uú]mero interior|no\\.? interior") || grupo(/(?:n[uú]mero|no\.?)\s+int\.?\s*[:#-]?\s*([a-zA-Z0-9-]+)/i);
  const codigoPostal = obtener("c[oó]digo postal|C\\.?P\\.?") || grupo(/(?:c[oó]digo postal|C\.?P\.?)[\s:#-]*(\d{5})/i);
  const entreCalle = obtener("entre calle|entre calles") || grupo(/entre calles?\s+([^,.;]+?)(?=\s+y calle|,|[.;]|$)/i);
  const yCalle = obtener("y calle") || grupo(/\by calle\s+([^,.;]+)/i);
  const fechaGeneral = grupo(/(?:fecha(?: de los hechos)?|el d[ií]a|d[ií]a)\s*[:,-]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{4})/i);
  const fechaConocimiento = obtener("fecha de conocimiento|fecha del reporte") || fechaGeneral;
  const fechaArribo = obtener("fecha de arribo|fecha de llegada") || fechaGeneral;
  const fechaDetencion = obtener("fecha de detenci[oó]n") || fechaGeneral;
  const tipoConocimiento: "llamada" | "presencia" | "queja" | "otro" | "" =
    /(?:llamada|reporte por (?:radio|tableta|tel[eé]fono)|cabina|911)/i.test(plano) ? "llamada" :
    /(?:presencia directa|observaci[oó]n directa|observ[eé] directamente|se percat[oó] directamente)/i.test(plano) ? "presencia" :
    /(?:queja|denuncia de una persona|se acerc[oó] un ciudadano)/i.test(plano) ? "queja" : "";
  const tipoLugar: "hogar" | "viaPublica" | "transporte" | "taxi" | "metro" | "otro" | "" =
    /\b(?:v[ií]a p[uú]blica|calle p[uú]blica)\b/i.test(plano) ? "viaPublica" :
    /\btaxi\b/i.test(plano) ? "taxi" :
    /\bmetro\b/i.test(plano) ? "metro" :
    /\b(?:transporte p[uú]blico|cami[oó]n|microb[uú]s|combi)\b/i.test(plano) ? "transporte" :
    /\b(?:domicilio particular|casa habitaci[oó]n|hogar)\b/i.test(plano) ? "hogar" : "";
  const nombreDetenido = obtener("nombre de la persona detenida|nombre completo del detenido|nombre del detenido|persona detenida");
  const aliasDetenido = obtener("alias|apodo");
  const sexoDetenido = obtener("sexo de la persona detenida|sexo");
  const fechaNacimientoDetenido = obtener("fecha de nacimiento");
  const nacionalidadDetenido = obtener("nacionalidad");
  const curpDetenido = obtener("CURP");
  const domicilioDetenido = obtener("domicilio de la persona detenida|domicilio del detenido|domicilio particular");
  const lugarDetencion = obtener("lugar de la detenci[oó]n|domicilio de la detenci[oó]n|ubicaci[oó]n de la detenci[oó]n");
  const documentoDetenido = obtener("documento de identificaci[oó]n|identificaci[oó]n presentada|credencial INE|licencia|pasaporte");
  const autoridadEntrega = obtener("juzgado o instituci[oó]n correspondiente|juzgado|instituci[oó]n correspondiente|autoridad competente");
  const fechaEntrega = obtener("fecha de entrega|fecha de presentaci[oó]n");
  const horaEntrega = obtener("hora de entrega|hora de presentaci[oó]n");
  const policiaEntrega = obtener("polic[ií]a que entrega|elemento que entrega|oficial que entrega");
  const autoridadRecibe = obtener("juez o autoridad competente que recibe|autoridad que recibe|persona que recibe");
  const lugar = lugarEtiquetado || [calle, numeroExterior, colonia && \`colonia \${colonia}\`, municipio].filter(Boolean).join(", ");
  return {
    falta, lugar, conocimientoReporte: reporte, calle, cruce, colonia, municipio, entidad,
    latitud, longitud, numeroExterior, numeroInterior, codigoPostal, entreCalle, yCalle,
    fechaConocimiento, fechaArribo, fechaDetencion, tipoConocimiento, tipoLugar, horas,
    nombreDetenido, aliasDetenido, sexoDetenido, fechaNacimientoDetenido, nacionalidadDetenido,
    curpDetenido, domicilioDetenido, lugarDetencion, documentoDetenido, autoridadEntrega, fechaEntrega, horaEntrega,
    policiaEntrega, autoridadRecibe,
  };
}

function nombreArchivo(folio: string) {
  const seguro = normalizarTexto(folio)
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return seguro ? `IPH-infracciones-${seguro}.pdf` : "IPH-infracciones-administrativas.pdf";
}

export async function generarPdf(props: Props): Promise<Uint8Array> {
  const response = await fetch(TEMPLATE_ENDPOINT, { headers: { Accept: "application/pdf" } });
  if (!response.ok) {
    let message =
      response.status === 404
        ? "Falta instalar en la aplicación el PDF original de infracciones administrativas de la Policía Municipal de Chihuahua. No se generó ningún archivo."
        : "No se pudo leer el PDF original de infracciones administrativas de la Policía Municipal de Chihuahua.";
    try {
      const details = (await response.json()) as { error?: string };
      if (details.error) message = details.error;
    } catch {
      // Keep the user-facing fallback message if the endpoint did not return JSON.
    }
    throw new Error(message);
  }

  const templateBytes = await response.arrayBuffer();
  const signature = new TextDecoder().decode(templateBytes.slice(0, 5));
  if (signature !== "%PDF-") {
    throw new Error("La fuente del formato oficial no devolvió un PDF válido.");
  }

  const extraidos = extraerCamposNarrativa(props.narrativa);
  const falta = props.falta.trim() || extraidos.falta;
  const lugar = props.lugar.trim() || extraidos.lugar;
  const horas = { ...extraidos.horas, ...Object.fromEntries(Object.entries(props.horas).filter(([, value]) => Boolean(value?.trim()))) };
  const textos = [props.oficial, falta, lugar, props.narrativa].map(normalizarTexto);
  if (textos.some((texto) => /[^\u0000-\u00FF]/u.test(texto))) {
    throw new Error(
      "El texto contiene algún símbolo o carácter que la fuente del formato oficial no puede representar. Sustituya ese símbolo por texto sencillo; la narrativa no se recortará ni se eliminarán caracteres automáticamente.",
    );
  }

  const pdf = await PDFDocument.load(templateBytes);
  // Se validó visualmente el PDF municipal que usa esta aplicación: cuatro páginas,
  // con páginas 1 y 3 tamaño carta y páginas 2 y 4 tamaño A4.
  if (
    pdf.getPageCount() !== 4 ||
    Math.round(pdf.getPages()[0].getWidth()) !== 612 ||
    Math.round(pdf.getPages()[1].getHeight()) !== 842 ||
    Math.round(pdf.getPages()[2].getWidth()) !== 612 ||
    Math.round(pdf.getPages()[3].getHeight()) !== 842
  ) {
    throw new Error(
      "El archivo local no coincide con la versión del IPH municipal validada. No se generó el PDF para evitar colocar datos en apartados incorrectos.",
    );
  }

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();
  const page1 = pages[0];
  const page2Narrativa = pages[1];
  const page3Detencion = pages[2];

  // SECCIÓN 1.1: la pantalla solicita nombre y placa. Cuando hay cuatro o más
  // palabras, se usa la convención mexicana: dos apellidos al final y nombres al inicio.
  // Si el formato es ambiguo, se conserva completo en Nombre(s), sin adivinar.
  const oficialCapturado = normalizarTexto(props.oficial).trim();
  const placaMatch = oficialCapturado.match(/(?:n[uú]mero de placa|no\.?\s*de placa|placa)\s*[:#-]?\s*([A-Za-z0-9-]+)/i);
  const nombreOficial = oficialCapturado.replace(/[,;]?\s*(?:n[uú]mero de placa|no\.?\s*de placa|placa)\s*[:#-]?\s*[A-Za-z0-9-]+/i, "").trim();
  const tokensOficial = nombreOficial.split(/\s+/).filter(Boolean);
  if (tokensOficial.length >= 4) {
    drawWrappedValue(page1, tokensOficial[tokensOficial.length - 2], font, {
      x: 43, y: 594, width: 145, maxLines: 1, fontSize: 7.0, lineHeight: 8,
    });
    drawWrappedValue(page1, tokensOficial[tokensOficial.length - 1], font, {
      x: 213, y: 594, width: 145, maxLines: 1, fontSize: 7.0, lineHeight: 8,
    });
    drawWrappedValue(page1, tokensOficial.slice(0, -2).join(" "), font, {
      x: 379, y: 594, width: 165, maxLines: 1, fontSize: 7.0, lineHeight: 8,
    });
  } else if (nombreOficial) {
    drawWrappedValue(page1, nombreOficial, font, {
      x: 379, y: 594, width: 165, maxLines: 1, fontSize: 6.8, lineHeight: 8,
    });
  }
  if (placaMatch?.[1]) {
    page1.drawText(\`Placa \${placaMatch[1]}\`, {
      x: 40, y: 568, size: 7.0, font, color: rgb(0.05, 0.05, 0.05),
    });
  }
  marcar(page1, 506, 535, font);



  // SECCIÓN 2.2: descripción breve del reporte o hecho extraído de la narrativa.
  drawWrappedValue(page1, falta, font, {
    x: 31, y: 330, width: page1.getWidth() - 62, maxLines: 2, fontSize: 7.0, lineHeight: 8.2,
  });

  // SECCIÓN 3.2: ubicación en el recuadro descriptivo del lugar.
  drawWrappedValue(page1, lugar, font, {
    x: 31, y: 54, width: page1.getWidth() - 62, maxLines: 2, fontSize: 7.0, lineHeight: 8.2,
  });

  // SECCIÓN 3.3: las etiquetas impresas quedan a la izquierda; los valores
  // se escriben sobre las líneas de captura, no encima de las etiquetas.
  const extraidosLugar = extraerCamposNarrativa(props.lugar);
  const geo = {
    calle: extraidos.calle || extraidosLugar.calle,
    cruce: extraidos.cruce || extraidosLugar.cruce,
    colonia: extraidos.colonia || extraidosLugar.colonia,
    municipio: extraidos.municipio || extraidosLugar.municipio,
    entidad: extraidos.entidad || extraidosLugar.entidad,
    latitud: extraidos.latitud || extraidosLugar.latitud,
    longitud: extraidos.longitud || extraidosLugar.longitud,
    numeroExterior: extraidos.numeroExterior || extraidosLugar.numeroExterior,
    numeroInterior: extraidos.numeroInterior || extraidosLugar.numeroInterior,
    codigoPostal: extraidos.codigoPostal || extraidosLugar.codigoPostal,
    entreCalle: extraidos.entreCalle || extraidosLugar.entreCalle,
    yCalle: extraidos.yCalle || extraidosLugar.yCalle,
  };
  drawWrappedValue(page2Narrativa, geo.calle || geo.cruce, font, {
    x: 151, y: 753, width: 400, maxLines: 1, fontSize: 6.8, lineHeight: 8,
  });
  drawWrappedValue(page2Narrativa, geo.colonia, font, {
    x: 151, y: 735, width: 400, maxLines: 1, fontSize: 6.8, lineHeight: 8,
  });
  drawWrappedValue(page2Narrativa, geo.numeroExterior, font, {
    x: 111, y: 727, width: 42, maxLines: 1, fontSize: 6.8, lineHeight: 8,
  });
  drawWrappedValue(page2Narrativa, geo.numeroInterior, font, {
    x: 111, y: 711, width: 42, maxLines: 1, fontSize: 6.8, lineHeight: 8,
  });
  drawWrappedValue(page2Narrativa, geo.codigoPostal, font, {
    x: 111, y: 695, width: 45, maxLines: 1, fontSize: 6.8, lineHeight: 8,
  });
  drawWrappedValue(page2Narrativa, geo.entreCalle, font, {
    x: 252, y: 727, width: 300, maxLines: 1, fontSize: 6.8, lineHeight: 8,
  });
  drawWrappedValue(page2Narrativa, geo.yCalle, font, {
    x: 252, y: 695, width: 300, maxLines: 1, fontSize: 6.8, lineHeight: 8,
  });
  drawWrappedValue(page2Narrativa, geo.entidad, font, {
    x: 204, y: 681, width: 348, maxLines: 1, fontSize: 6.8, lineHeight: 8,
  });
  drawWrappedValue(page2Narrativa, geo.municipio, font, {
    x: 204, y: 664, width: 348, maxLines: 1, fontSize: 6.8, lineHeight: 8,
  });
  drawWrappedValue(page2Narrativa, geo.latitud, font, {
    x: 205, y: 592, width: 75, maxLines: 1, fontSize: 6.5, lineHeight: 7,
  });
  drawWrappedValue(page2Narrativa, geo.longitud, font, {
    x: 405, y: 592, width: 75, maxLines: 1, fontSize: 6.5, lineHeight: 7,
  });

  // SECCIÓN 2.1: marcar la vía de conocimiento sólo cuando la narrativa la identifica.
  if (extraidos.tipoConocimiento === "llamada") marcar(page1, 87, 419, font);
  if (extraidos.tipoConocimiento === "presencia") marcar(page1, 87, 405, font);
  if (extraidos.tipoConocimiento === "queja") marcar(page1, 87, 391, font);
  if (extraidos.tipoConocimiento === "otro") marcar(page1, 87, 377, font);
  drawDate(page1, extraidos.fechaConocimiento, 457, 420, 11.8, font);
  drawTime(page1, horas.conocimiento, 457, 482, 379, font);

  // SECCIÓN 3.1: las horas de arribo van en las casillas de la izquierda,
  // no en las coordenadas de la hora de conocimiento de la sección 2.
  drawDate(page1, extraidos.fechaArribo, 133, 134, 8.0, font);
  drawTime(page1, horas.llegada, 163, 186, 134, font);
  drawDate(page3Detencion, extraidos.fechaDetencion, 145, 104, 8.5, font);
  drawTime(page3Detencion, horas.detencion, 357, 395, 104, font);

  // SECCIÓN 3.2: marcar únicamente el tipo de lugar expresamente identificable.
  if (extraidos.tipoLugar === "hogar") marcar(page1, 157, 83, font);
  if (extraidos.tipoLugar === "viaPublica") marcar(page1, 242, 83, font);
  if (extraidos.tipoLugar === "transporte") marcar(page1, 328, 83, font);
  if (extraidos.tipoLugar === "taxi") marcar(page1, 472, 83, font);
  if (extraidos.tipoLugar === "metro") marcar(page1, 509, 83, font);
  if (extraidos.tipoLugar === "otro") marcar(page1, 536, 83, font);
  if (extraidos.tipoLugar === "transporte" && /cam[ií]on|microb[uú]s|combi/i.test(props.narrativa)) {
    marcar(page1, 408, 83, font);
  }

  drawNarrativa(page2Narrativa, props.narrativa, font);

  // Apartado 5.1: extraer sólo frases explícitas sobre resistencia y uso de la fuerza.
  dibujarUsoFuerza(page3Detencion, props.narrativa, font);

  return pdf.save();
}

export default function IphPdfGenerator(props: Props) {
  const [generando, setGenerando] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [filename, setFilename] = useState("IPH-infracciones-administrativas.pdf");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const listo = useMemo(() => Boolean(pdfUrl && pdfBlob), [pdfUrl, pdfBlob]);

  async function generar() {
    setGenerando(true);
    setError("");
    setAviso("");
    try {
      const bytes = await generarPdf(props);
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      const blob = new Blob([buffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setPdfBlob(blob);
      setPdfUrl(url);
      setFilename(nombreArchivo(props.folio));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No fue posible generar el PDF del formato oficial.",
      );
    } finally {
      setGenerando(false);
    }
  }

  function abrirPdf() {
    if (!pdfBlob) {
      setError("Primero genere el PDF para poder abrirlo.");
      return;
    }

    // Abrir directamente desde un gesto del usuario suele ser más compatible
    // con los visores móviles que depender únicamente del iframe incrustado.
    const url = pdfUrl || URL.createObjectURL(pdfBlob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noopener";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setAviso("Se solicitó abrir el PDF en una pestaña o visor nuevo. Si el navegador lo bloquea, use Guardar PDF.");
  }

  function descargar() {
    if (!pdfBlob) return;
    // Crear una URL desde el Blob vigente evita depender de una URL temporal
    // que el navegador haya dejado de resolver al mostrar la vista previa.
    const url = URL.createObjectURL(pdfBlob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    setAviso("Se solicitó guardar el PDF en el dispositivo.");
  }

  async function compartir() {
    if (!pdfBlob) return;
    setError("");
    setAviso("");
    const file = new File([pdfBlob], filename, { type: "application/pdf" });
    const shareData: ShareData = {
      files: [file],
      title: "Informe Policial Homologado",
      text: props.folio ? `IPH - folio ${props.folio}` : "Informe Policial Homologado de infracciones administrativas",
    };

    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share(shareData);
        setAviso("Se abrió el menú de compartir del dispositivo.");
        return;
      }
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      // If native sharing fails, allow the officer to keep the actual PDF locally.
    }

    descargar();
    setAviso("Este dispositivo no permite compartir el PDF directamente; se descargó una copia para adjuntarla en la aplicación deseada.");
  }

  return (
    <section className="w-full space-y-3">
      <button
        type="button"
        onClick={generar}
        disabled={generando}
        className="w-full rounded-xl px-4 py-3 font-semibold text-accent-foreground disabled:cursor-wait disabled:opacity-70"
        style={{ backgroundImage: "var(--gradient-dorado)" }}
      >
        {generando ? "Generando PDF oficial..." : "Generar PDF oficial"}
      </button>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Se utiliza la plantilla oficial del IPH. Se integran únicamente el lugar, la probable infracción, las horas disponibles y la narrativa; los campos sin datos comprobables quedan en blanco.
      </p>

      {error && (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {aviso && <p role="status" className="text-sm text-muted-foreground">{aviso}</p>}

      {listo && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-background">
          <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <div className="min-w-0">
              <h2 className="text-base font-bold">Vista previa del IPH</h2>
              <p className="truncate text-xs text-muted-foreground">{filename}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setPdfUrl("");
                setPdfBlob(null);
              }}
              className="rounded-lg border px-3 py-2 text-sm"
            >
              Cerrar
            </button>
          </header>

          <div className="min-h-0 flex-1 bg-muted">
            <iframe
              title="Vista previa del Informe Policial Homologado"
              src={pdfUrl}
              className="h-full w-full border-0"
            />
          </div>

          <footer className="grid grid-cols-1 gap-3 border-t bg-background p-3 sm:grid-cols-3 sm:p-4">
            <button
              type="button"
              onClick={abrirPdf}
              className="rounded-xl border px-4 py-3 text-sm font-semibold"
            >
              Abrir PDF
            </button>
            <button
              type="button"
              onClick={descargar}
              className="rounded-xl border px-4 py-3 text-sm font-semibold"
            >
              Guardar PDF
            </button>
            <button
              type="button"
              onClick={compartir}
              className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
            >
              Compartir PDF
            </button>
          </footer>
        </div>
      )}
    </section>
  );
}
