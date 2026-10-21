import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { generarPdf } from "../src/components/IphPdfGenerator.tsx";

// Datos ficticios exclusivamente para comprobar el generador; no representan un caso real.
const templateBytes = new Uint8Array(
  await readFile(new URL("../public/iph-infracciones-administrativas.pdf", import.meta.url)),
);
const originalFetch = globalThis.fetch;
let requestedTemplate = false;

globalThis.fetch = async (input) => {
  const requested = typeof input === "string"
    ? input
    : input instanceof URL
      ? input.pathname
      : input.url;
  assert.equal(requested, "/iph-infracciones-administrativas.pdf", "Debe usar la plantilla municipal oficial local.");
  requestedTemplate = true;
  return new Response(templateBytes, {
    status: 200,
    headers: { "content-type": "application/pdf" },
  });
};

try {
  const bytes = await generarPdf({
    oficial: "Oficial de prueba",
    folio: "TEST-IPH-2026-001",
    falta: "Ejemplo ficticio de falta administrativa",
    lugar: "Calle de Prueba 123, Chihuahua, Chihuahua",
    horas: {
      conocimiento: "21:00",
      llegada: "21:10",
      detencion: "21:20",
    },
    narrativa:
      "Siendo las 21:00 horas se tuvo conocimiento del reporte. " +
      "Al arribar, se indicó a la persona que se detuviera. " +
      "La persona se negó a obedecer la indicación e intentó evadir al oficial. " +
      "Se procedió a la detención y traslado a comandancia.",
  });

  assert.equal(requestedTemplate, true, "Debe solicitar la plantilla oficial.");
  assert.ok(bytes.byteLength > 10_000, "El PDF generado debe tener contenido suficiente.");
  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-", "La salida debe tener firma PDF.");

  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 4, "La salida debe preservar las cuatro páginas del formato oficial.");
  const expected = [[612, 792], [595.6, 842], [612, 792], [595.6, 842]];
  pdf.getPages().forEach((page, index) => {
    assert.ok(Math.abs(page.getWidth() - expected[index][0]) < 1, `Ancho inesperado en página ${index + 1}`);
    assert.ok(Math.abs(page.getHeight() - expected[index][1]) < 1, `Alto inesperado en página ${index + 1}`);
  });

  // Confirmar que la extracción usada por el generador respeta la regla acordada
  // sin deducir resistencia física, lesiones o atención médica.
  const { extraerDatosUsoFuerza } = await import("../src/components/IphPdfGenerator.tsx");
  const usoFuerza = extraerDatosUsoFuerza("Se procedió a la detención de la persona.");
  assert.equal(usoFuerza.detencion, true);
  assert.match(usoFuerza.descripcion, /comandos verbales/i);
  assert.match(usoFuerza.descripcion, /candados de mano/i);
  assert.equal(usoFuerza.resistencia, "");

  console.log("Prueba de generación IPH PDF completada: plantilla oficial, firma, cuatro páginas y dimensiones verificadas.");
} finally {
  globalThis.fetch = originalFetch;
}
