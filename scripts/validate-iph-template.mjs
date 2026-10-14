import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";

const path = new URL("../public/iph-infracciones-administrativas.pdf", import.meta.url);
const bytes = await readFile(path);

if (bytes.byteLength < 10_000 || new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-") {
  throw new Error("La plantilla municipal del IPH no es un PDF válido o está incompleta.");
}

const pdf = await PDFDocument.load(bytes);
const expected = [
  [612, 792],
  [595.6, 842],
  [612, 792],
  [595.6, 842],
];

if (pdf.getPageCount() !== expected.length) {
  throw new Error(
    `La plantilla municipal debe tener ${expected.length} páginas; se encontraron ${pdf.getPageCount()}.`,
  );
}

pdf.getPages().forEach((page, index) => {
  const [width, height] = expected[index];
  if (Math.abs(page.getWidth() - width) > 1 || Math.abs(page.getHeight() - height) > 1) {
    throw new Error(
      `La página ${index + 1} tiene dimensiones distintas a las revisadas: ${page.getWidth()} x ${page.getHeight()} puntos.`,
    );
  }
});

console.log(
  `Plantilla IPH municipal validada: ${pdf.getPageCount()} páginas, ${bytes.byteLength} bytes; el archivo se lee desde public/ sin conexión a páginas externas.`,
);
