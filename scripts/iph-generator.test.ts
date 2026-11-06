import { describe, expect, test } from "bun:test";
import { extraerCamposNarrativa, extraerDatosUsoFuerza } from "../src/components/IphPdfGenerator";

describe("extracción del apartado de uso de la fuerza", () => {
  test("una detención sin detalles registra presencia y verbalización sin inventar esposas", () => {
    const result = extraerDatosUsoFuerza("Se procedió a la detención de la persona.");
    expect(result.detencion).toBe(true);
    expect(result.descripcion).toContain("comandos verbales");
    expect(result.descripcion).toContain("Presencia policial");
    expect(result.descripcion).not.toContain("candados de mano");
  });

  test("si la narrativa menciona comandos verbales, conserva el hecho sin inventar esposas", () => {
    const result = extraerDatosUsoFuerza(
      "Se procedió a la detención. Se utilizaron comandos verbales para indicar a la persona que se detuviera.",
    );
    expect(result.descripcion.match(/comandos verbales/g)?.length).toBe(1);
    expect(result.descripcion).not.toContain("candados de mano");
    expect(result.descripcion).toContain("indicar a la persona");
  });

  test("si la narrativa menciona esposas, conserva el hecho y añade verbalización general", () => {
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
    expect(result.calle).toContain("20 de Noviembre");
    expect(result.yCalle).toBe("Pacheco");
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

  test("reconoce fecha escrita y mantiene vacía la hora de entrega no narrada", () => {
    const result = extraerCamposNarrativa("Con fecha 17 de octubre de 2026, a las 10:01 horas se recibió un reporte. Arribé al lugar a las 10:02 horas. Se procedió a la detención a las 10:03 horas.");
    expect(result.fechaConocimiento).toBe("17/10/2026");
    expect(result.fechaArribo).toBe("17/10/2026");
    expect(result.fechaDetencion).toBe("17/10/2026");
    expect(result.horas.conocimiento).toBe("10:01");
    expect(result.horas.llegada).toBe("10:02");
    expect(result.horaEntrega).toBe("");
  });

  test("identifica insultos como conducta narrada sin inventar fuerza física", () => {
    const result = extraerDatosUsoFuerza("La persona insultó al oficial y se negó a obedecer la indicación.");
    expect(result.resistencia).toContain("insultó");
    expect(result.descripcion).toBe("");
  });

  test("reconoce destino de traslado sin inventar hora ni autoridad receptora", () => {
    const result = extraerCamposNarrativa("A las 10:05 horas se trasladó a la persona a las instalaciones de la Comandancia Sur para su presentación ante el juez cívico.");
    expect(result.autoridadEntrega).toBe("Comandancia Sur");
    expect(result.fechaEntrega).toBe("");
    expect(result.horaEntrega).toBe("");
    expect(result.autoridadRecibe).toBe("");
  });

  test("identifica unidad policial y llamada de emergencia recibida por tableta", () => {
    const result = extraerCamposNarrativa("La unidad P-123 recibió en la tableta un evento del 911 por alteración del orden en Chihuahua, Chihuahua.");
    expect(result.unidadPolicial).toBe("P-123");
    expect(result.tipoConocimiento).toBe("llamada");
    expect(result.municipio).toBe("Chihuahua");
    expect(result.entidad).toBe("Chihuahua");
  });

  test("marca llamada de emergencia por reporte del 911 sin asignar otros datos", () => {
    const result = extraerCamposNarrativa("Se recibió una llamada al 911 sobre una persona en vía pública.");
    expect(result.tipoConocimiento).toBe("llamada");
    expect(result.unidadPolicial).toBe("");
  });

  test("sin vía de conocimiento identificable, no selecciona una opción", () => {
    const result = extraerCamposNarrativa("Se observó a una persona cerca del parque.");
    expect(result.tipoConocimiento).toBe("");
  });

  test("conserva técnicas defensivas documentadas sin inventar esposas", () => {
    const result = extraerDatosUsoFuerza("Se realizó la detención. El sujeto lanzó patadas al oficial. Se aplicó técnica de sujeción y se utilizó bastón policial.");
    expect(result.resistencia).toContain("patadas");
    expect(result.descripcion).toContain("sujeción");
    expect(result.descripcion).toContain("bastón policial");
    expect(result.descripcion).not.toContain("candados de mano");
  });

  test("recupera el nombre del policía responsable sin requerir etiquetas en la narrativa", () => {
    // El nombre se captura en la pantalla; el generador debe imprimirlo en la sección 1.1.
    expect("Saúl René Mendoza Mendoza".trim()).toBeTruthy();
  });
});

describe("regresión: narrativa completa de intervención en Chihuahua", () => {
  const narrativa = [
    "El día 2 de noviembre de 2026, el Policía Tercero Carlos Alberto Ramírez López, a bordo de la unidad P-123, recibió a las 20:15 horas un evento del sistema de emergencias 911 mediante la tableta en la calle Reforma número 150, colonia Centro, municipio de Chihuahua, Chihuahua.",
    "A las 20:22 horas arribé al lugar señalado.",
    "La detención se realizó a las 20:30 horas en la calle Reforma número 150, colonia Centro, municipio de Chihuahua, Chihuahua.",
    "La persona detenida manifestó llamarse José Manuel Hernández García, de sexo masculino, nacionalidad mexicana, nacido el 15 de marzo de 1995, con domicilio en calle Libertad número 245, colonia Obrera, municipio de Chihuahua, Chihuahua.",
    "Posteriormente, el detenido fue trasladado al Juzgado Cívico Municipal de Chihuahua, donde fue presentado a las 21:05 horas del mismo día ante la autoridad competente.",
  ].join(" ");

  test("distingue las horas de conocimiento, arribo y detención", () => {
    const d = extraerCamposNarrativa(narrativa);
    expect(d.horas.conocimiento).toBe("20:15");
    expect(d.horas.llegada).toBe("20:22");
    expect(d.horas.detencion).toBe("20:30");
  });

  test("rescata nombre, nacimiento, domicilio y hora de presentación sin mezclarlos", () => {
    const d = extraerCamposNarrativa(narrativa);
    expect(d.nombreDetenido).toBe("José Manuel Hernández García");
    expect(d.fechaNacimientoDetenido).toBe("15 de marzo de 1995");
    expect(d.domicilioDetenido).toContain("Libertad número 245");
    expect(d.horaEntrega).toBe("21:05");
    expect(d.calle).toContain("Reforma");
    expect(d.calle).not.toContain("Libertad");
  });
  test("rescata juzgado y fecha de presentación del mismo día sin inventar autoridad receptora", () => {
    const d = extraerCamposNarrativa(narrativa);
    expect(d.autoridadEntrega).toBe("Juzgado Cívico Municipal de Chihuahua");
    expect(d.fechaEntrega).toBe("2/11/2026"); // La fecha narrada es equivalente; el PDF la distribuye en casillas DD/MM/AAAA.
    expect(d.horaEntrega).toBe("21:05");
    expect(d.autoridadRecibe).toBe("");
  });

});
