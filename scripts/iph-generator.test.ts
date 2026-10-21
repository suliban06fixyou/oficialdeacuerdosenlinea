import { describe, expect, test } from "bun:test";
import { extraerDatosUsoFuerza } from "../src/components/IphPdfGenerator";

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
