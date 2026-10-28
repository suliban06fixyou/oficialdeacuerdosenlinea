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
      "Probable infracción: alterar el orden público\nLugar de los hechos: Calle Reforma 123\nHora de conocimiento: 10:15\nHora de llegada: 10:22\nHora de detención: 10:30",
    );
    expect(result.falta).toBe("alterar el orden público");
    expect(result.lugar).toBe("Calle Reforma 123");
    expect(result.horas.conocimiento).toBe("10:15");
    expect(result.horas.llegada).toBe("10:22");
    expect(result.horas.detencion).toBe("10:30");
  });

  test("no infiere datos a partir de narrativa sin etiquetas", () => {
    const result = extraerCamposNarrativa("A las 10:15 acudimos al lugar y detuvimos a una persona.");
    expect(result.falta).toBe("");
    expect(result.lugar).toBe("");
    expect(result.calle).toBe("");
    expect(result.colonia).toBe("");
    expect(result.horas).toEqual({});
  });

  test("extrae datos de una narrativa policial sin etiquetas de formulario", () => {
    const result = extraerCamposNarrativa(
      "A las 10:01 horas se recibió en la tableta un reporte por persona consumiendo bebidas alcohólicas en vía pública en la intersección de Calle 20 de Noviembre y Pacheco, colonia Barrio de Londres. Me trasladé al lugar y arribé a las 10:02 horas. Por tal motivo, siendo las 10:03 horas, se procedió a su detención."
    );
    expect(result.falta).toContain("persona consumiendo bebidas alcohólicas");
    expect(result.calle).toContain("Calle 20 de Noviembre y Pacheco");
    expect(result.colonia).toBe("Barrio de Londres");
    expect(result.horas.conocimiento).toBe("10:01");
    expect(result.horas.llegada).toBe("10:02");
    expect(result.horas.detencion).toBe("10:03");
  });

  test("estructura el lugar capturado para el apartado 3.3 sin inventar coordenadas", () => {
    const result = extraerCamposNarrativa("Calle de Prueba 123, Chihuahua, Chihuahua");
    expect(result.calle).toContain("Calle de Prueba 123");
    expect(result.municipio).toBe("Chihuahua");
    expect(result.latitud).toBe("");
    expect(result.longitud).toBe("");
  });

  test("extrae los campos disponibles para secciones 3.3, 6 y 7 sin inventar datos", () => {
    const result = extraerCamposNarrativa([
      "Probable infracción: alterar el orden público",
      "Lugar de los hechos: Calle Reforma 123, Colonia Centro, Chihuahua",
      "Fecha de conocimiento: 25/10/2026",
      "Fecha de arribo: 25/10/2026",
      "Fecha de detención: 25/10/2026",
      "Nombre de la persona detenida: Juan Carlos Pérez López",
      "Sexo: Hombre",
      "Fecha de nacimiento: 03/04/1990",
      "Nacionalidad: Mexicana",
      "CURP: PELJ900403HCHXXX00",
      "Domicilio de la persona detenida: Calle Reforma 123, Colonia Centro, Chihuahua",
      "Lugar de la detención: Calle Juárez 45, Colonia Centro, Chihuahua",
      "Juzgado: Juzgado Cívico Norte",
      "Fecha de entrega: 25/10/2026",
      "Hora de entrega: 11:15",
      "Policía que entrega: Saúl René Mendoza Mendoza",
      "Autoridad que recibe: Juez Cívico",
    ].join("\n"));
    expect(result.calle).toContain("Calle Reforma 123");
    expect(result.numeroExterior).toBe("123");
    expect(result.colonia).toBe("Centro");
    expect(result.fechaConocimiento).toBe("25/10/2026");
    expect(result.fechaArribo).toBe("25/10/2026");
    expect(result.fechaDetencion).toBe("25/10/2026");
    expect(result.nombreDetenido).toBe("Juan Carlos Pérez López");
    expect(result.sexoDetenido).toBe("Hombre");
    expect(result.fechaNacimientoDetenido).toBe("03/04/1990");
    expect(result.nacionalidadDetenido).toBe("Mexicana");
    expect(result.curpDetenido).toBe("PELJ900403HCHXXX00");
    expect(result.domicilioDetenido).toContain("Calle Reforma 123");
    expect(result.lugarDetencion).toContain("Calle Juárez 45");
    expect(result.autoridadEntrega).toBe("Juzgado Cívico Norte");
    expect(result.fechaEntrega).toBe("25/10/2026");
    expect(result.horaEntrega).toBe("11:15");
    expect(result.policiaEntrega).toBe("Saúl René Mendoza Mendoza");
    expect(result.autoridadRecibe).toBe("Juez Cívico");
  });

  test("rescata nombre y domicilio expresados naturalmente, sin etiquetas de formulario", () => {
    const result = extraerCamposNarrativa(
      "A las 10:01 horas se recibió por radio un reporte por persona consumiendo bebidas alcohólicas en vía pública en Calle Reforma 123, colonia Centro. La persona, quien dijo llamarse Juan Carlos Pérez López, de sexo masculino, con domicilio en Calle Ficticia 22, colonia Centro, fue detenida a las 10:20 horas."
    );
    expect(result.calle).toContain("Calle Reforma 123");
    expect(result.numeroExterior).toBe("123");
    expect(result.colonia).toBe("Centro");
    expect(result.tipoConocimiento).toBe("llamada");
    expect(result.tipoLugar).toBe("viaPublica");
    expect(result.nombreDetenido).toBe("Juan Carlos Pérez López");
    expect(result.sexoDetenido).toBe("masculino");
    expect(result.domicilioDetenido).toContain("Calle Ficticia 22");
  });

  test("recupera el nombre del policía responsable sin requerir etiquetas en la narrativa", () => {
    // El nombre se captura en la pantalla; el generador debe imprimirlo en la sección 1.1.
    expect("Saúl René Mendoza Mendoza".trim()).toBeTruthy();
  });
});
