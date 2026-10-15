import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { generarPdf } from "../src/components/IphPdfGenerator.tsx";

// Datos completamente ficticios para inspeccionar la salida del generador;
// no corresponden a una intervención real ni a una persona identificable.
const templateBytes = new Uint8Array(
  await readFile(new URL("../public/iph-infracciones-administrativas.pdf", import.meta.url)),
);
const originalFetch = globalThis.fetch;

globalThis.fetch = async (input) => {
  const requested = typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url;
  if (requested !== "/iph-infracciones-administrativas.pdf") {
    throw new Error(`Solicitud inesperada durante la prueba del PDF: ${requested}`);
  }
  return new Response(templateBytes, {
    status: 200,
    headers: { "content-type": "application/pdf" },
  });
};

try {
  const bytes = await generarPdf({
    primerApellido: "ApellidoPrueba",
    segundoApellido: "ApellidoDemo",
    nombres: "Nombre de Prueba",
    grado: "Policía Municipal",
    unidad: "UM-TEST",
    folio: "TEST-IPH-2026-001",
    falta: "Ejemplo de falta administrativa para validar el formato",
    ubicacion: {
      calle: "Calle de Prueba",
      numeroExterior: "120",
      coloniaLocalidad: "Centro",
      entreCalle: "Avenida Demostración",
      yCalle: "Calle de Ejemplo",
      entidadFederativa: "Chihuahua",
      municipio: "Chihuahua",
    },
    horas: {
      conocimiento: "21:00",
      llegada: "21:10",
      detencion: "21:20",
      derechos: "21:25",
      traslado: "21:40",
    },
    fechas: {
      conocimiento: "2026-10-14",
      llegada: "2026-10-14",
      detencion: "2026-10-14",
    },
    narrativa:
      "Siendo las 21:00 horas del 14 de octubre de 2026, el suscrito tuvo conocimiento del reporte. " +
      "Arribó al lugar a las 21:10 horas. Se le indicó a la persona que se detuviera; la persona se negó " +
      "a obedecer la indicación e intentó huir. Fue necesario neutralizarla mediante una técnica de control. " +
      "A las 21:20 horas se llevó a cabo la detención y posteriormente se le leyeron sus derechos. " +
      "A las 21:40 horas se realizó el traslado a comandancia.",
  });

  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 4, "La salida debe preservar las cuatro páginas de la plantilla.");
  const expected = [
    [612, 792],
    [595.6, 842],
    [612, 792],
    [595.6, 842],
  ];
  pdf.getPages().forEach((page, index) => {
    assert.ok(Math.abs(page.getWidth() - expected[index][0]) < 1, `Ancho inesperado en página ${index + 1}`);
    assert.ok(Math.abs(page.getHeight() - expected[index][1]) < 1, `Alto inesperado en página ${index + 1}`);
  });

  await writeFile("/tmp/iph-pdf-preview.pdf", bytes);
  console.log("Generador IPH validado; vista previa ficticia guardada en /tmp/iph-pdf-preview.pdf.");
} finally {
  globalThis.fetch = originalFetch;
}
