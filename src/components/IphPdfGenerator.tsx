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

function nombreArchivo(folio: string) {
  const seguro = normalizarTexto(folio)
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return seguro ? `IPH-infracciones-${seguro}.pdf` : "IPH-infracciones-administrativas.pdf";
}

interface UsoFuerzaExtraido {
  resistencia: string;
  descripcion: string;
}

/**
 * Identifica solo hechos descritos expresamente en la narrativa.
 * No convierte automáticamente insultos en resistencia, ni una detención
 * en uso de fuerza física. Los campos sin respaldo narrativo quedan vacíos.
 */
function extraerUsoFuerza(narrativa: string): UsoFuerzaExtraido {
  const texto = normalizarTexto(narrativa).trim();
  if (!texto) return { resistencia: "", descripcion: "" };

  const oraciones = texto
    .split(/(?<=[.!?])\\s+|\\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const resistenciaRx =
    /se negó a (?:obedecer|acatar|seguir|cumplir)|se negó a (?:ser )?(?:detenido|asegurado)|no acató|no obedeció|desobedeció|ignoró (?:las )?(?:indicaciones|instrucciones|órdenes|comandos)|hizo caso omiso|se resistió|resistencia (?:activa|pasiva|verbal)|forceje(?:ó|o|aron|ando)|intentó huir|intentó darse a la fuga|trató de escapar|intentó escapar|se dio a la fuga|emprendió la huida|se abalanzó|agredió|golpe(?:ó|o|ando|aron)|pate(?:ó|o|ando|aron)/i;
  const insultosRx = /insult(?:ó|o|os|ando)|ofend(?:ió|io|ió|ió|ió|ió|e|ió|ieron)|profirió (?:insultos|ofensas)|amenaz(?:ó|o|as|ando)/i;
  const presenciaRx = /presencia policial|presencia de (?:los )?(?:elementos|agentes|policías|policias)|arrib(?:ó|o|aron) (?:al lugar )?(?:el suscrito|los elementos|los agentes|la unidad|la policía|la policia)|se hizo presente/i;
  const verbalizacionRx = /verbaliz(?:ó|o|ación|aron)|comando(?:s)? verbales|instrucciones verbales|indicaciones verbales|órdenes verbales|orden(?:ó|o|aron) (?:que )?(?:se detuviera|se calmara|soltara|se colocara|descendiera|mostrara)|le indiqué|le indique|se le indicó|se le indico|se le ordenó|se le ordeno|se le solicitó|se le solicito|se le pidió|se le pidio/i;
  const fuerzaFisicaRx = /uso de la fuerza física|uso de fuerza física|técnica(?:s)? de (?:control|sometimiento|inmovilización)|somet(?:ió|io|imiento)|inmoviliz(?:ó|o|ación)|control(?:ó|o) físicamente|espos(?:ó|o|amiento)|candados de mano|redu(?:jo|cción) física|neutraliz(?:ó|o)|sujet(?:ó|o) físicamente|derrib(?:ó|o)|aplic(?:ó|o) fuerza física/i;

  const resistencia = oraciones.filter((s) => resistenciaRx.test(s) || insultosRx.test(s)).join(" ");
  const detalles = oraciones.filter((s) =>
    resistenciaRx.test(s) || insultosRx.test(s) || presenciaRx.test(s) ||
    verbalizacionRx.test(s) || fuerzaFisicaRx.test(s)
  ).join(" ");

  // Si la narrativa menciona presencia o verbalización, esas frases se conservan
  // en la descripción; nunca se agregan como hechos si no están documentadas.
  return {
    resistencia: resistencia ? normalizarTexto(resistencia) : "",
    descripcion: detalles ? normalizarTexto(detalles) : "",
  };
}

async function generarPdf(props: Props): Promise<Uint8Array> {
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

  const textos = [props.falta, props.lugar, props.narrativa].map(normalizarTexto);
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

  // Sólo se imprimen datos que ya existen en la app y que tienen un campo claro.
  // Nombre completo, fechas, casillas y datos personales no capturados permanecen vacíos.
  drawWrappedValue(page1, props.falta, font, {
    x: 30,
    y: 331,
    width: page1.getWidth() - 60,
    maxLines: 2,
    fontSize: 7.2,
    lineHeight: 8.5,
  });

  drawWrappedValue(page1, props.lugar, font, {
    x: 30,
    y: 54,
    width: page1.getWidth() - 60,
    maxLines: 2,
    fontSize: 7.3,
    lineHeight: 9.1,
  });

  // Coordenadas calibradas sobre el PDF municipal proporcionado por el usuario (origen inferior izquierdo).
  // Se rellenan únicamente las horas capturadas; las fechas y las demás casillas quedan sin tocar.
  drawTime(page1, props.horas.conocimiento, 457, 482, 379, font);
  drawTime(page1, props.horas.llegada, 426, 455, 127, font);
  drawTime(page3Detencion, props.horas.detencion, 357, 395, 107, font);

  drawNarrativa(page2Narrativa, props.narrativa, font);

  // Sección 5 del PDF original: solo se completa si la narrativa describe
  // explícitamente resistencia/agresión o uso de fuerza. Los campos de lesiones,
  // atención médica y circunstancias permanecen intactos si no están confirmados.
  const usoFuerza = extraerUsoFuerza(props.narrativa);
  if (usoFuerza.resistencia || usoFuerza.descripcion) {
    // Apartado 5.1: descripción breve de la resistencia o agresión encontrada.
    drawWrappedValue(page3Detencion, usoFuerza.resistencia, font, {
      x: 32,
      y: 678,
      width: page3Detencion.getWidth() - 64,
      maxLines: 3,
      fontSize: 7.1,
      lineHeight: 8.2,
    });

    // Campo narrativo de uso de la fuerza: se usan solo frases literales de la
    // narrativa fuente, sin crear justificaciones ni agregar hechos no capturados.
    drawWrappedValue(page3Detencion, usoFuerza.descripcion, font, {
      x: 32,
      y: 565,
      width: page3Detencion.getWidth() - 64,
      maxLines: 7,
      fontSize: 7.1,
      lineHeight: 8.2,
    });
  }

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

  function descargar() {
    if (!pdfUrl) return;
    const anchor = document.createElement("a");
    anchor.href = pdfUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setAviso("PDF listo para guardarse en el dispositivo.");
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
        Se utiliza la plantilla oficial del IPH. Se integran los datos capturados y los pasajes que la narrativa describa expresamente sobre resistencia, presencia policial, verbalización o fuerza física. No se infieren hechos: los campos sin información suficiente quedan en blanco.
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

          <footer className="grid grid-cols-2 gap-3 border-t bg-background p-3 sm:p-4">
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
