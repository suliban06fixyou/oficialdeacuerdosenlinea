import { describe, expect, test } from "bun:test";
import { extraerCamposNarrativa, extraerDatosUsoFuerza } from "../src/components/IphPdfGenerator";

describe("extracción del apartado de uso de la fuerza", () => {
  test("una detención sin detalles conserva los dos medios generales acordados", () => {
    const result = extraerDatosUsoFuerza("Se procedió a la detención de la persona.");
    expect(result.detencion).toBe(true);
    expect(result.descripcion).toContain("comandos verbales");
    expect(result.descripcion).toContain("candados de mano");
  });

  test("si la narrativa ya menciona comandos verbales, agrega sólo candados de mano", () => {
    const result = extraerDatosUsoFuerza(
      "Se procedió a la detención. Se utilizaron comandos verbales para indicar a la persona que se detuviera.",
    );
    expect(result.descripcion.match(/comandos verbales/g)?.length).toBe(1);
    expect(result.descripcion).toContain("candados de mano");
    expect(result.descripcion).toContain("indicar a la persona");
  });

  test("si la narrativa ya menciona esposas, agrega sólo comandos verbales", () => {
    const result = extraerDatosUsoFuerza(
      "Se realizó la detención y se colocaron esposas a la persona.",
    );
    expect(result.descripcion.match(/comandos verbales/g)?.length).toBe(1);
    expect(result.descripcion).toContain("esposas");
  });

  test("rescata agresión verbal narrada sin convertirla en resistencia física", () => {
    const result = extraerDatosUsoFuerza(
      "La persona profirió palabras ofensivas y conductas verbales agresivas.",
    );
    expect(result.resistencia).toContain("palabras ofensivas");
    expect(result.resistencia).toContain("conductas verbales agresivas");
    expect(result.detencion).toBe(false);
    expect(result.descripcion).toBe("");
  });

  test("no inventa medios de fuerza si no se menciona una detención", () => {
    const result = extraerDatosUsoFuerza("La persona se encontraba en el lugar.");
    expect(result.detencion).toBe(false);
    expect(result.descripcion).toBe("");
    expect(result.resistencia).toBe("");
  });

  test("tolera narrativa vacía sin inventar información", () => {
    expect(extraerDatosUsoFuerza("")).toEqual({
      resistencia: "",
      descripcion: "",
      detencion: false,
    });
  });
});

describe("extracción de campos etiquetados de la narrativa", () => {
  test("rescata falta, lugar y horas cuando aparecen con etiqueta explícita", () => {
    const result = extraerCamposNarrativa(
      "Probable infracción: alterar el orden público\\nLugar de los hechos: Calle Reforma 123\\nHora de conocimiento: 10:15\\nHora de llegada: 10:22\\nHora de detención: 10:30",
    );
    expect(result.falta).toBe("alterar el orden público");
    expect(result.lugar).toBe("Calle Reforma 123");
    expect(result.horas.conocimiento).toBe("10:15");
    expect(result.horas.llegada).toBe("10:22");
    expect(result.horas.detencion).toBe("10:30");
  });

  test("no infiere datos a partir de narrativa sin etiquetas", () => {
    expect(extraerCamposNarrativa("A las 10:15 acudimos a la calle Reforma y detuvimos a una persona.")).toEqual({
      falta: "",
      lugar: "",
      horas: {},
    });
  });
});
