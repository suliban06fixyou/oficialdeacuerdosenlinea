import { PDFDocument } from "pdf-lib";

const url =
  "https://www.gob.mx/cms/uploads/attachment/file/394022/IPH_INFRACCIONES_ADMINISTRATIVAS.PDF";

const response = await fetch(url, {
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

if (!response.ok) {
  throw new Error(`No se pudo consultar la plantilla IPH oficial: HTTP ${response.status}`);
}

const bytes = await response.arrayBuffer();
const signature = new TextDecoder().decode(bytes.slice(0, 5));
if (signature !== "%PDF-" || bytes.byteLength < 10_000) {
  throw new Error("La URL del SESNSP no devolvió un PDF válido.");
}

const pdf = await PDFDocument.load(bytes);
const expectedPages = 4;
if (pdf.getPageCount() !== expectedPages) {
  throw new Error(
    `Cambió la paginación de la plantilla IPH: esperadas ${expectedPages} páginas, recibidas ${pdf.getPageCount()}.`,
  );
}

console.log(
  `Plantilla IPH oficial validada: ${pdf.getPageCount()} páginas, ${bytes.byteLength} bytes.`,
);
