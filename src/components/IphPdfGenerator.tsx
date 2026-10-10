import { useState } from "react";

type ReportData = Record<string, string>;

interface Props {
  oficial: string;
  folio: string;
  falta: string;
  lugar: string;
  horas: Record<string, string>;
  narrativa: string;
}

const CAMPOS: { key: string; label: string; multiline?: boolean; page: number }[] = [
  { key: "apellido1", label: "Primer apellido del policía", page: 1 },
  { key: "apellido2", label: "Segundo apellido del policía", page: 1 },
  { key: "nombres", label: "Nombre(s) del policía", page: 1 },
  { key: "grado", label: "Grado o cargo policial", page: 1 },
  { key: "unidad", label: "Número de unidad", page: 1 },
  { key: "institucion", label: "Institución policial", page: 1 },
  { key: "adscripcion", label: "Destacamento o adscripción", page: 1 },
  { key: "entidadAdscripcion", label: "Entidad federativa de adscripción", page: 1 },
  { key: "municipioAdscripcion", label: "Municipio de adscripción", page: 1 },
  { key: "medioConocimiento", label: "Medio de conocimiento (llamada, presencia directa, queja u otro)", page: 1 },
  { key: "fechaConocimiento", label: "Fecha de conocimiento", page: 1 },
  { key: "fechaArribo", label: "Fecha de arribo", page: 1 },
  { key: "tipoLugar", label: "Tipo de lugar (hogar, vía pública, transporte u otro)", page: 1 },
  { key: "descripcionLugar", label: "Descripción del lugar", page: 1 },
  { key: "calle", label: "Calle y tipo de vialidad", page: 1 },
  { key: "colonia", label: "Colonia o localidad", page: 1 },
  { key: "numeroExterior", label: "Número exterior", page: 1 },
  { key: "numeroInterior", label: "Número interior", page: 1 },
  { key: "entreCalles", label: "Entre calles", page: 1 },
  { key: "cp", label: "Código postal", page: 1 },
  { key: "entidadHechos", label: "Entidad federativa de los hechos", page: 1 },
  { key: "municipioHechos", label: "Municipio de los hechos", page: 1 },
  { key: "latitud", label: "Latitud (si se cuenta con ella)", page: 1 },
  { key: "longitud", label: "Longitud (si se cuenta con ella)", page: 1 },
  { key: "huboQuejoso", label: "¿Existió quejoso? (Sí/No)", page: 1 },
  { key: "quejosoNombre", label: "Nombre completo del quejoso (si aplica)", page: 1 },
  { key: "quejosoSexo", label: "Sexo del quejoso (si se conoce)", page: 1 },
  { key: "quejosoEdad", label: "Edad referida del quejoso (si se conoce)", page: 1 },
  { key: "quejosoIdentificacion", label: "Documento de identificación del quejoso (si aplica)", page: 1 },
  { key: "quejosoNacionalidad", label: "Nacionalidad del quejoso (si se conoce)", page: 1 },
  { key: "quejosoCURP", label: "CURP del quejoso (si aplica)", page: 1 },
  { key: "narrativa", label: "Narración cronológica de los hechos y motivo de detención, si aplica", multiline: true, page: 2 },
  { key: "usoFuerza", label: "¿Se utilizó fuerza? (Sí/No)", page: 3 },
  { key: "resistencia", label: "Resistencia o agresión encontrada", multiline: true, page: 3 },
  { key: "fuerzaDescripcion", label: "Fuerza utilizada, motivos y consecuencias", multiline: true, page: 3 },
  { key: "fuerzaCircunstancias", label: "Circunstancias del uso de fuerza (detención u otro)", page: 3 },
  { key: "lesionesAutoridades", label: "¿Autoridades lesionadas o fallecidas? (detalle o No)", page: 3 },
  { key: "lesionesPersonas", label: "¿Personas lesionadas o fallecidas? (detalle o No)", page: 3 },
  { key: "asistenciaMedica", label: "¿Se brindó o solicitó asistencia médica? (Sí/No y detalle)", page: 3 },
  { key: "personaFuerzaNoDetenida", label: "Persona a quien se aplicó fuerza sin ser detenida (si aplica)", page: 3 },
  { key: "huboDetenidos", label: "¿Hubo personas detenidas? (Sí/No)", page: 3 },
  { key: "detenidoNombre", label: "Nombre completo de la persona detenida", page: 3 },
  { key: "detenidoAlias", label: "Apodo o alias (si se conoce)", page: 3 },
  { key: "detenidoIdentificacion", label: "Documento de identificación (si aplica)", page: 3 },
  { key: "detenidoSexoEdad", label: "Sexo, fecha de nacimiento y edad referida", page: 3 },
  { key: "detenidoNacionalidadCURP", label: "Nacionalidad y CURP (si se conocen)", page: 3 },
  { key: "detenidoDomicilio", label: "Domicilio de la persona detenida", multiline: true, page: 3 },
  { key: "fechaDetencion", label: "Fecha y hora de detención", page: 3 },
  { key: "lugarDetencion", label: "Lugar de detención (si es distinto al lugar de los hechos)", multiline: true, page: 3 },
  { key: "autoridadDestino", label: "Nombre del juzgado o institución que recibe", page: 4 },
  { key: "fechaEntrega", label: "Fecha y hora de entrega", page: 4 },
  { key: "policiaEntrega", label: "Policía que entrega: nombre, adscripción y grado/cargo", page: 4 },
  { key: "autoridadRecibe", label: "Autoridad que recibe: nombre, adscripción y cargo", page: 4 },
  { key: "firmaEntrega", label: "Firma del policía que entrega (espacio para firma)", page: 4 },
  { key: "firmaRecibe", label: "Firma de la autoridad que recibe (espacio para firma)", page: 4 },
  { key: "sello", label: "Sello del juzgado o institución receptora (espacio)", page: 4 },
];

const TITULOS: Record<number, string> = {
  1: "SECCIONES 1, 2 Y 3. IDENTIFICACIÓN, CONOCIMIENTO Y LUGAR",
  2: "SECCIÓN 4. NARRACIÓN DE LOS HECHOS",
  3: "SECCIONES 5 Y 6. USO DE LA FUERZA Y DETENCIÓN(ES)",
  4: "SECCIÓN 7. PRESENTACIÓN ANTE JUZGADO O AUTORIDAD COMPETENTE",
};

function valorInicial(props: Props): ReportData {
  return {
    oficial: props.oficial,
    folio: props.folio,
    falta: props.falta,
    lugar: props.lugar,
    horaConocimiento: props.horas.conocimiento ?? "",
    horaArribo: props.horas.llegada ?? "",
    horaDetencion: props.horas.detencion ?? "",
    horaDerechos: props.horas.derechos ?? "",
    horaTraslado: props.horas.traslado ?? "",
    narrativa: props.narrativa,
    usoFuerza: "No",
    huboDetenidos: "No",
    huboQuejoso: "No",
  };
}

export default function IphPdfGenerator(props: Props) {
  const [abierto, setAbierto] = useState(false);
  const [data, setData] = useState<ReportData>(() => valorInicial(props));
  const [aviso, setAviso] = useState("");

  function cambiar(key: string, value: string) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  function imprimir() {
    setAviso("");
    window.print();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setData(valorInicial(props));
          setAbierto(true);
        }}
        className="w-full rounded-xl px-4 py-3 font-semibold text-accent-foreground"
        style={{ backgroundImage: "var(--gradient-dorado)" }}
      >
        Generar reporte en PDF
      </button>
      {abierto && (
        <div className="iph-modal fixed inset-0 z-[100] overflow-y-auto bg-black/70 p-3 sm:p-6">
          <div className="mx-auto max-w-5xl rounded-2xl bg-card p-4 shadow-2xl sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="texto-institucional text-xl font-bold">Completar datos del IPH</h2>
                <p className="text-sm text-muted-foreground">Los datos faltantes quedan en blanco; no se inventa información.</p>
              </div>
              <button type="button" onClick={() => setAbierto(false)} className="rounded-lg border px-3 py-2 text-sm">Cerrar</button>
            </div>
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm">Folio / número de referencia
                <input value={data.folio ?? ""} onChange={(e) => cambiar("folio", e.target.value)} className="mt-1 w-full rounded-lg border bg-background px-3 py-2" />
              </label>
              <label className="text-sm">Probable infracción administrativa
                <input value={data.falta ?? ""} onChange={(e) => cambiar("falta", e.target.value)} className="mt-1 w-full rounded-lg border bg-background px-3 py-2" />
              </label>
              <label className="text-sm">Nombre del policía (captura actual)
                <input value={data.oficial ?? ""} onChange={(e) => cambiar("oficial", e.target.value)} className="mt-1 w-full rounded-lg border bg-background px-3 py-2" />
              </label>
              <label className="text-sm">Lugar del evento (captura actual)
                <input value={data.lugar ?? ""} onChange={(e) => cambiar("lugar", e.target.value)} className="mt-1 w-full rounded-lg border bg-background px-3 py-2" />
              </label>
              <label className="text-sm">Hora de conocimiento
                <input value={data.horaConocimiento ?? ""} onChange={(e) => cambiar("horaConocimiento", e.target.value)} placeholder="HH:MM" className="mt-1 w-full rounded-lg border bg-background px-3 py-2" />
              </label>
              <label className="text-sm">Hora de arribo
                <input value={data.horaArribo ?? ""} onChange={(e) => cambiar("horaArribo", e.target.value)} placeholder="HH:MM" className="mt-1 w-full rounded-lg border bg-background px-3 py-2" />
              </label>
              <label className="text-sm">Hora de detención
                <input value={data.horaDetencion ?? ""} onChange={(e) => cambiar("horaDetencion", e.target.value)} placeholder="HH:MM" className="mt-1 w-full rounded-lg border bg-background px-3 py-2" />
              </label>
              <label className="text-sm">Hora de lectura de derechos
                <input value={data.horaDerechos ?? ""} onChange={(e) => cambiar("horaDerechos", e.target.value)} placeholder="HH:MM" className="mt-1 w-full rounded-lg border bg-background px-3 py-2" />
              </label>
              <label className="text-sm">Hora de traslado a comandancia
                <input value={data.horaTraslado ?? ""} onChange={(e) => cambiar("horaTraslado", e.target.value)} placeholder="HH:MM" className="mt-1 w-full rounded-lg border bg-background px-3 py-2" />
              </label>
            </div>

            {([1, 2, 3, 4] as const).map((page) => (
              <section key={page} className="mb-5 rounded-xl border p-3 sm:p-4">
                <h3 className="mb-3 text-sm font-bold">{TITULOS[page]}</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {CAMPOS.filter((campo) => campo.page === page && !["narrativa", "oficial", "folio", "falta", "lugar"].includes(campo.key)).map((campo) => (
                    <label key={campo.key} className={`text-sm ${campo.multiline ? "sm:col-span-2" : ""}`}>
                      {campo.label}
                      {campo.multiline ? (
                        <textarea value={data[campo.key] ?? ""} onChange={(e) => cambiar(campo.key, e.target.value)} rows={page === 2 ? 8 : 3} className="mt-1 w-full rounded-lg border bg-background px-3 py-2" />
                      ) : (
                        <input value={data[campo.key] ?? ""} onChange={(e) => cambiar(campo.key, e.target.value)} className="mt-1 w-full rounded-lg border bg-background px-3 py-2" />
                      )}
                    </label>
                  ))}
                  {page === 2 && (
                    <label className="sm:col-span-2 text-sm">Narrativa revisada (editable)
                      <textarea value={data.narrativa ?? ""} onChange={(e) => cambiar("narrativa", e.target.value)} rows={10} className="mt-1 w-full rounded-lg border bg-background px-3 py-2" />
                    </label>
                  )}
                </div>
              </section>
            ))}

            <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              Antes de imprimir, verifique personalmente la exactitud de todos los datos y la narrativa. La herramienta no sustituye el formato oficial ni la revisión del primer respondiente. La opción de impresión permite elegir “Guardar como PDF”.
            </div>
            {aviso && <p className="mb-3 text-sm text-destructive">{aviso}</p>}
            <button type="button" onClick={imprimir} className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground">
              Imprimir / Guardar como PDF
            </button>
          </div>

          <div id="iph-print-root" className="iph-print-root">
            {[1, 2, 3, 4].map((page) => (
              <article key={page} className="iph-print-page">
                <header className="iph-print-header">
                  <strong>CONSEJO NACIONAL DE SEGURIDAD PÚBLICA</strong>
                  <div className="iph-reference">NÚMERO DE REFERENCIA: {data.folio || "________________"}</div>
                  <h1>INFORME POLICIAL HOMOLOGADO (IPH)</h1>
                  <h2>INFRACCIONES ADMINISTRATIVAS</h2>
                </header>
                <h3>{TITULOS[page]}</h3>
                {page === 1 && (
                  <>
                    <div className="iph-print-grid">
                      <PrintField label="Policía responsable" value={data.oficial} />
                      <PrintField label="Grado/cargo" value={data.grado} />
                      <PrintField label="Unidad" value={data.unidad} />
                      <PrintField label="Institución" value={data.institucion} />
                      <PrintField label="Adscripción" value={data.adscripcion} />
                      <PrintField label="Entidad / municipio de adscripción" value={[data.entidadAdscripcion, data.municipioAdscripcion].filter(Boolean).join(" / ")} />
                      <PrintField label="Probable infracción reportada" value={data.falta} />
                      <PrintField label="Medio de conocimiento" value={data.medioConocimiento} />
                      <PrintField label="Fecha / hora de conocimiento" value={[data.fechaConocimiento, data.horaConocimiento].filter(Boolean).join(" ")} />
                      <PrintField label="Fecha / hora de arribo" value={[data.fechaArribo, data.horaArribo].filter(Boolean).join(" ")} />
                      <PrintField label="Tipo de lugar" value={data.tipoLugar} />
                      <PrintField label="Descripción del lugar" value={data.descripcionLugar} />
                      <PrintField label="Calle" value={data.calle || data.lugar} />
                      <PrintField label="Colonia/localidad" value={data.colonia} />
                      <PrintField label="Número exterior/interior" value={[data.numeroExterior, data.numeroInterior].filter(Boolean).join(" / ")} />
                      <PrintField label="Entre calles" value={data.entreCalles} />
                      <PrintField label="Código postal" value={data.cp} />
                      <PrintField label="Entidad / municipio de los hechos" value={[data.entidadHechos, data.municipioHechos].filter(Boolean).join(" / ")} />
                      <PrintField label="Coordenadas" value={[data.latitud, data.longitud].filter(Boolean).join(", ")} />
                      <PrintField label="¿Existió quejoso?" value={data.huboQuejoso} />
                      <PrintField label="Datos del quejoso" value={data.quejosoNombre} />
                      <PrintField label="Sexo / edad" value={[data.quejosoSexo, data.quejosoEdad].filter(Boolean).join(" / ")} />
                      <PrintField label="Identificación / nacionalidad / CURP" value={[data.quejosoIdentificacion, data.quejosoNacionalidad, data.quejosoCURP].filter(Boolean).join(" / ")} />
                    </div>
                    <div className="iph-print-note">Cronología registrada en la aplicación: conocimiento {data.horaConocimiento || "____"} · arribo {data.horaArribo || "____"} · detención {data.horaDetencion || "____"} · lectura de derechos {data.horaDerechos || "____"} · traslado {data.horaTraslado || "____"}.</div>
                  </>
                )}
                {page === 2 && (
                  <div className="iph-print-narrative">
                    <p><strong>Probable infracción:</strong> {data.falta || "No proporcionada"}</p>
                    <p><strong>Lugar:</strong> {data.lugar || data.calle || "No proporcionado"}</p>
                    <p><strong>Narración de los hechos por el policía y, en su caso, motivo de la detención:</strong></p>
                    <div className="iph-narrative-text">{data.narrativa || "No se capturó narrativa."}</div>
                    <div className="iph-print-lines">Observaciones complementarias:<br /><br /><br /><br /></div>
                  </div>
                )}
                {page === 3 && (
                  <div className="iph-print-grid">
                    {CAMPOS.filter((campo) => campo.page === 3).map((campo) => <PrintField key={campo.key} label={campo.label} value={data[campo.key]} />)}
                    <PrintField label="Hora de detención (cronología)" value={data.horaDetencion} />
                    <PrintField label="Hora de lectura de derechos (cronología)" value={data.horaDerechos} />
                    <PrintField label="Hora de traslado (cronología)" value={data.horaTraslado} />
                  </div>
                )}
                {page === 4 && (
                  <>
                    <div className="iph-print-grid">
                      {CAMPOS.filter((campo) => campo.page === 4).map((campo) => <PrintField key={campo.key} label={campo.label} value={data[campo.key]} />)}
                    </div>
                    <div className="iph-signatures">
                      <div>Firma de quien entrega</div><div>Firma de quien recibe</div><div>Sello de la institución receptora</div>
                    </div>
                  </>
                )}
                <footer className="iph-print-footer">IPH · Infracciones administrativas · Página {page} de 4</footer>
              </article>
            ))}
          </div>
        </div>
      )}
      <style>{`
        .iph-print-root { display: none; }
        .iph-print-page { display: none; }
        @media print {
          @page { size: letter; margin: 10mm; }
          body * { visibility: hidden !important; }
          #iph-print-root, #iph-print-root * { visibility: visible !important; }
          #iph-print-root { display: block !important; position: absolute; left: 0; top: 0; width: 100%; color: #111; font-family: Arial, sans-serif; }
          .iph-print-page { display: block !important; position: relative; height: 255mm; overflow: hidden; page-break-after: always; break-after: page; font-size: 8pt; }
          .iph-print-page:last-child { page-break-after: auto; break-after: auto; }
          .iph-print-header { text-align: center; border-bottom: 1px solid #222; padding-bottom: 4mm; margin-bottom: 4mm; }
          .iph-print-header h1 { font-size: 13pt; margin: 2mm 0; }
          .iph-print-header h2 { font-size: 10pt; margin: 1mm 0; }
          .iph-reference { text-align: right; margin-top: 2mm; }
          .iph-print-page h3 { font-size: 9pt; margin: 2mm 0 3mm; background: #eee; padding: 2mm; }
          .iph-print-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2mm; }
          .iph-print-field { border: 1px solid #999; min-height: 10mm; padding: 1.5mm; overflow-wrap: anywhere; }
          .iph-print-field strong { display: block; font-size: 7pt; margin-bottom: 1mm; }
          .iph-print-field span { white-space: pre-wrap; }
          .iph-print-narrative { font-size: 9pt; line-height: 1.35; }
          .iph-narrative-text { border: 1px solid #777; min-height: 135mm; padding: 4mm; white-space: pre-wrap; overflow-wrap: anywhere; }
          .iph-print-lines { margin-top: 5mm; border-bottom: 1px solid #999; }
          .iph-print-note { margin-top: 3mm; border: 1px solid #999; padding: 2mm; }
          .iph-signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 5mm; margin-top: 20mm; text-align: center; }
          .iph-signatures div { border-top: 1px solid #333; padding-top: 2mm; min-height: 15mm; }
          .iph-print-footer { position: absolute; bottom: 0; width: 100%; text-align: right; font-size: 7pt; border-top: 1px solid #aaa; padding-top: 2mm; }
        }
      `}</style>
    </>
  );
}

function PrintField({ label, value }: { label: string; value?: string }) {
  return <div className="iph-print-field"><strong>{label}</strong><span>{value?.trim() || " "}</span></div>;
}
