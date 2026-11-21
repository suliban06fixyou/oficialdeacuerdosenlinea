import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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
  // Caso de referencia aprobado: todos los datos son ficticios.
  const narrativa = [
    "El día 2 de noviembre de 2026, el suscrito Policía Tercero Carlos Alberto Ramírez López, adscrito a la Dirección de Seguridad Pública Municipal de Chihuahua, Chihuahua, a bordo de la unidad P-123, recibió a las 20:15 horas un evento del sistema de emergencias 911 mediante la tableta electrónica de la unidad, en el que se reportaba a una persona del sexo masculino alterando el orden público en la calle Reforma número 150, colonia Centro, municipio de Chihuahua, Chihuahua.",
    "A las 20:22 horas arribé al lugar señalado, ubicado en la vía pública, donde observé a un masculino que gritaba palabras ofensivas a los transeúntes. Me identifiqué como policía municipal y le indiqué mediante comandos verbales que cesara su conducta.",
    "La persona comenzó a insultarme, se negó a obedecer las indicaciones e intentó retirarse del lugar. Al aproximarme para realizar la intervención, el masculino me empujó con ambas manos e intentó lanzar una patada, por lo que apliqué una técnica de sujeción y control físico para impedir que continuara la agresión.",
    "Una vez controlada la situación, procedí a colocarle los candados de mano, verificando su correcta colocación. La detención se realizó a las 20:30 horas en la calle Reforma número 150, colonia Centro, municipio de Chihuahua, Chihuahua.",
    "La persona detenida manifestó llamarse José Manuel Hernández García, de sexo masculino, nacionalidad mexicana, nacido el 15 de marzo de 1995, con domicilio en calle Libertad número 245, colonia Obrera, municipio de Chihuahua, Chihuahua. Manifestó no contar en ese momento con documento de identificación.",
    "Posteriormente, el detenido fue trasladado al Juzgado Cívico Municipal de Chihuahua, donde fue presentado a las 21:05 horas del mismo día ante la autoridad competente.",
    "No se observaron lesiones visibles en la persona detenida ni en el oficial interviniente. No fue necesaria asistencia médica.",
  ].join("\n\n");

  const { extraerCamposNarrativa } = await import("../src/components/IphPdfGenerator.tsx");
  const datos = extraerCamposNarrativa(narrativa);
  assert.equal(datos.unidadPolicial, "P-123", "Debe recuperar la unidad P-123.");
  assert.equal(datos.tipoConocimiento, "llamada", "El aviso 911 debe marcar llamada de emergencia.");
  assert.equal(datos.horas.conocimiento, "20:15");
  assert.equal(datos.horas.llegada, "20:22");
  assert.equal(datos.horas.detencion, "20:30");
  assert.equal(datos.nombreDetenido, "José Manuel Hernández García");
  assert.equal(datos.horaEntrega, "21:05");
  assert.match(datos.calle, /Reforma/i, "No debe confundir el lugar de hechos con el domicilio del detenido.");
  assert.doesNotMatch(datos.calle, /Libertad/i);

  const bytes = await generarPdf({
    oficial: "Carlos Alberto Ramírez López",
    folio: "TEST-IPH-2026-001",
    falta: "Alteración del orden público reportada al 911",
    lugar: "Calle Reforma número 150, colonia Centro, municipio de Chihuahua, Chihuahua",
    horas: { conocimiento: "20:15", llegada: "20:22", detencion: "20:30" },
    narrativa,
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

  await mkdir("test-output", { recursive: true });
  await writeFile("test-output/iph-pdf-preview.pdf", bytes);

  // Segundo escenario independiente: observación directa, sin llamada al 911.
  // No se deben trasladar al segundo caso los datos del primer detenido.
  const narrativaDirecta = [
    "El día 4 de noviembre de 2026, el suscrito Policía Segundo Luis Fernando Ortega Ruiz, adscrito a la Dirección de Seguridad Pública Municipal de Chihuahua, a bordo de la unidad P-456, durante un recorrido de vigilancia observé directamente a las 18:10 horas a una persona alterando el orden en la vía pública, sobre la calle Independencia número 80, colonia Centro, municipio de Chihuahua, Chihuahua.",
    "A las 18:12 horas arribé al lugar e indiqué mediante comandos verbales que cesara la conducta. La persona obedeció las indicaciones y no opuso resistencia física.",
    "A las 18:18 horas se realizó la detención en la calle Independencia número 80, colonia Centro, municipio de Chihuahua, Chihuahua. La persona manifestó llamarse Pedro Antonio Silva Torres, de sexo masculino, nacionalidad mexicana, nacido el 10 de abril de 1998, con domicilio en calle Morelos número 320, colonia Santo Niño, Chihuahua, Chihuahua.",
    "Fue presentado a las 18:45 horas del mismo día en el Juzgado Cívico Municipal de Chihuahua. No se observaron lesiones y no fue necesaria asistencia médica.",
  ].join("\n\n");
  const directos = extraerCamposNarrativa(narrativaDirecta);
  assert.equal(directos.tipoConocimiento, "presencia", "La observación directa no debe marcarse como llamada de emergencia.");
  assert.equal(directos.unidadPolicial, "P-456");
  assert.equal(directos.nombreDetenido, "Pedro Antonio Silva Torres");
  assert.match(directos.calle, /Independencia/i);
  assert.doesNotMatch(directos.calle, /Morelos/i);
  const pdfDirecto = await generarPdf({
    oficial: "Luis Fernando Ortega Ruiz",
    folio: "TEST-IPH-2026-002",
    falta: "Alteración del orden observada directamente",
    lugar: "Calle Independencia número 80, colonia Centro, Chihuahua",
    horas: { conocimiento: "18:10", llegada: "18:12", detencion: "18:18" },
    narrativa: narrativaDirecta,
  });
  assert.equal((await PDFDocument.load(pdfDirecto)).getPageCount(), 4);
  await writeFile("test-output/iph-pdf-observacion-directa.pdf", pdfDirecto);

  // Confirmar que la extracción usada por el generador respeta la regla acordada
  // sin deducir resistencia física, lesiones o atención médica.
  const { extraerDatosUsoFuerza } = await import("../src/components/IphPdfGenerator.tsx");
  const usoFuerza = extraerDatosUsoFuerza("Se procedió a la detención de la persona.");
  assert.equal(usoFuerza.detencion, true);
  assert.match(usoFuerza.descripcion, /comandos verbales/i);
  assert.match(usoFuerza.descripcion, /presencia policial/i);
  assert.doesNotMatch(usoFuerza.descripcion, /candados de mano/i);
  assert.equal(usoFuerza.resistencia, "");

  console.log("Prueba de generación IPH PDF completada: plantilla oficial, firma, cuatro páginas y dimensiones verificadas.");
} finally {
  globalThis.fetch = originalFetch;
}
