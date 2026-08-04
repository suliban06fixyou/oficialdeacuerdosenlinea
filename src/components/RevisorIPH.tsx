import { useMemo, useRef, useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  HORAS_VACIAS,
  PASOS_CRONOLOGICOS,
  PREGUNTAS_ESENCIALES,
  revisionLocal,
  type DatosHecho,
  type Hallazgo,
  type Horas,
} from "@/lib/validacion";
import { revisarNarrativa } from "@/lib/revision.functions";
import logoDspm from "@/assets/logo-dspm-oficial.png.asset.json";
import oficialAcuerdos from "@/assets/oficial-acuerdos.jpeg.asset.json";
const fondoChat = "/fondo-chat.jpg";

type Paso = "cronologia" | "narrativa" | "revision" | "envio";

interface Mensaje {
  id: string;
  autor: "asesor" | "oficial";
  texto: string;
}

const PASOS_MENU: { id: Paso; num: string; titulo: string; ayuda: string }[] = [
  { id: "cronologia", num: "1", titulo: "Cronología", ayuda: "Horas de la intervención" },
  { id: "narrativa", num: "2", titulo: "Narrativa", ayuda: "Redacción de los hechos" },
  { id: "revision", num: "3", titulo: "Revisión", ayuda: "Hallazgos y consejos" },
  { id: "envio", num: "4", titulo: "Envío", ayuda: "Comandancia Sur o Norte" },
];

const COLOR_SEVERIDAD: Record<string, string> = {
  critico: "border-destructive/60 bg-destructive/10 text-destructive-foreground",
  advertencia: "border-warning/50 bg-warning/10 text-foreground",
  ok: "border-success/50 bg-success/10 text-foreground",
};

function TextoAsesor({ texto }: { texto: string }) {
  const lineas = texto.split("\n");
  return (
    <div className="space-y-1">
      {lineas.map((linea, i) => {
        const limpia = linea.replace(/\*\*/g, "");
        if (/^#{2,4}\s/.test(linea)) {
          return (
            <p key={i} className="texto-institucional pt-2 text-xs font-bold text-accent">
              {limpia.replace(/^#{2,4}\s/, "")}
            </p>
          );
        }
        if (/^[-*]\s/.test(limpia)) {
          return (
            <p key={i} className="pl-3 -indent-3">
              • {limpia.replace(/^[-*]\s/, "")}
            </p>
          );
        }
        if (!limpia.trim()) return <div key={i} className="h-1" />;
        return <p key={i}>{limpia}</p>;
      })}
    </div>
  );
}

function extraerNarrativaSugerida(texto: string): string {
  const lineas = texto.split("\n");
  const inicio = lineas.findIndex(
    (l) =>
      /^#{1,4}\s/.test(l) &&
      /narrativa\s+(sugerida|corregida|propuesta|mejorada|reescrita|final)/i.test(l),
  );
  if (inicio === -1) return "";
  const resto = lineas.slice(inicio + 1);
  const fin = resto.findIndex((l) => /^#{1,4}\s/.test(l));
  const cuerpo = (fin === -1 ? resto : resto.slice(0, fin)).join("\n");
  return cuerpo.replace(/```/g, "").replace(/\*\*/g, "").trim();
}


function BloqueHallazgo({ h }: { h: Hallazgo }) {
  return (
    <div className={`rounded-xl border p-3 ${COLOR_SEVERIDAD[h.severidad]}`}>
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-background/40 px-2 py-0.5 text-[10px] tracking-wide uppercase">
          {h.categoria}
        </span>
        <span className="text-sm font-semibold">{h.titulo}</span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{h.detalle}</p>
      {h.sugerencia && (
        <p className="mt-1 text-sm">
          <span className="font-semibold text-accent">Recomendación: </span>
          {h.sugerencia}
        </p>
      )}
    </div>
  );
}

export default function RevisorIPH() {
  const [paso, setPaso] = useState<Paso>("cronologia");
  const [horas, setHoras] = useState<Horas>(HORAS_VACIAS);
  const [narrativa, setNarrativa] = useState("");
  const [oficial, setOficial] = useState("");
  const [folio, setFolio] = useState("");
  const [faltaAdministrativa, setFaltaAdministrativa] = useState("");
  const [delito, setDelito] = useState("");
  const [pregunta, setPregunta] = useState("");
  const [cargando, setCargando] = useState(false);
  const [narrativaFinal, setNarrativaFinal] = useState("");
  const [editadaPorUsuario, setEditadaPorUsuario] = useState(false);
  const [avisoEnvio, setAvisoEnvio] = useState("");

  const datosHecho: DatosHecho = useMemo(
    () => ({ faltaAdministrativa, delito }),
    [faltaAdministrativa, delito],
  );
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    {
      id: "bienvenida",
      autor: "asesor",
      texto:
        "Buen día, oficial. Soy su asesor de revisión de narrativas IPH. Capture las horas de la intervención y su narrativa; después le indicaré los hallazgos cronológicos, las preguntas esenciales faltantes y las correcciones de estilo policial.",
    },
  ]);
  const finChat = useRef<HTMLDivElement>(null);
  const revisar = useServerFn(revisarNarrativa);

  const hallazgos = useMemo(() => revisionLocal(horas, narrativa, datosHecho), [horas, narrativa, datosHecho]);
  const criticos = hallazgos.filter((h) => h.severidad === "critico");
  const resumen = useMemo(() => {
    const items: { etiqueta: string; valor: string }[] = [];
    if (oficial.trim()) items.push({ etiqueta: "Oficial", valor: oficial.trim() });
    if (folio.trim()) items.push({ etiqueta: "Folio", valor: folio.trim() });
    if (faltaAdministrativa.trim()) items.push({ etiqueta: "Falta adm.", valor: faltaAdministrativa.trim() });
    if (delito.trim()) items.push({ etiqueta: "Delito", valor: delito.trim() });
    PASOS_CRONOLOGICOS.forEach((p) => {
      const v = horas[p.key];
      if (v) items.push({ etiqueta: p.label, valor: v });
    });
    return items;
  }, [oficial, folio, faltaAdministrativa, delito, horas]);
  const ultimaRevisionIA = [...mensajes].reverse().find((m) => m.autor === "asesor" && m.id.startsWith("ia-"));

  useEffect(() => {
    finChat.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  useEffect(() => {
    if (editadaPorUsuario) return;
    const sugerida = ultimaRevisionIA ? extraerNarrativaSugerida(ultimaRevisionIA.texto) : "";
    setNarrativaFinal(sugerida || narrativa);
  }, [ultimaRevisionIA, narrativa, editadaPorUsuario]);

  async function enviarNarrativaLista() {
    const texto = narrativaFinal.trim();
    if (!texto) {
      setAvisoEnvio("No hay narrativa para enviar.");
      return;
    }
    try {
      await navigator.clipboard.writeText(texto);
      setAvisoEnvio("Narrativa copiada al portapapeles.");
    } catch {
      setAvisoEnvio("No fue posible copiar automáticamente; copie el texto manualmente.");
    }
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ text: texto });
        setAvisoEnvio("Narrativa copiada y compartida.");
      } catch {
        // el usuario canceló el menú de compartir
      }
    } else {
      setAvisoEnvio(
        "Narrativa copiada. Este dispositivo no ofrece el menú de mensajería; péguela en la aplicación que desee.",
      );
    }
  }

  function agregar(autor: Mensaje["autor"], texto: string, id?: string) {
    setMensajes((prev) => [...prev, { id: id ?? `${Date.now()}-${prev.length}`, autor, texto }]);
  }

  async function pedirRevision() {
    if (!narrativa.trim()) {
      agregar("asesor", "Primero capture la narrativa en el paso 2 para poder revisarla.");
      setPaso("narrativa");
      return;
    }
    setPaso("revision");
    setCargando(true);
    if (pregunta.trim()) agregar("oficial", pregunta.trim());
    try {
      const resultado = await revisar({
        data: {
          narrativa,
          horas,
          faltaAdministrativa: faltaAdministrativa.trim() || undefined,
          delito: delito.trim() || undefined,
          hallazgosLocales: hallazgos.map((h) => `${h.categoria}: ${h.titulo} — ${h.detalle}`),
          pregunta: pregunta.trim() || undefined,
        },
      });
      agregar("asesor", resultado.texto, `ia-${Date.now()}`);
      setPregunta("");
    } catch (error) {
      agregar("asesor", `No fue posible completar la revisión: ${(error as Error).message}`);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header
        className="border-b border-border/70 shadow-[var(--shadow-placa)]"
        style={{ backgroundImage: "var(--gradient-marino)" }}
      >
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-5">
          <img
            src={logoDspm.url}
            alt="Gobierno Municipal de Chihuahua · Dirección de Seguridad Pública Municipal"
            width={1320}
            height={460}
            className="h-12 w-auto rounded-lg bg-white p-1.5 sm:h-14"
          />
          <div className="flex-1">
            <h1 className="texto-institucional text-xl leading-tight font-bold sm:text-2xl">
              REVISOR DE NARRATIVAS IPH OFICIAL DE ACUERDOS EN LINEA
            </h1>
            <p className="text-sm text-muted-foreground">
              Dirección de Seguridad Pública Municipal Chihuahua, Cordinacion Juridica de la Subdireccion Tactica
            </p>
          </div>
          <img
            src={oficialAcuerdos.url}
            alt="Oficial de Acuerdos de la Policía Municipal de Chihuahua"
            width={56}
            height={56}
            loading="lazy"
            className="hidden h-14 w-14 rounded-full border border-accent/50 object-cover object-top sm:block"
          />
        </div>
      </header>

      <nav className="border-b border-border/60 bg-card/60">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-2 px-4 py-3 sm:grid-cols-4">
          {PASOS_MENU.map((p) => (
            <button
              key={p.id}
              onClick={() => setPaso(p.id)}
              className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                paso === p.id
                  ? "border-accent bg-accent/15"
                  : "border-border bg-secondary/40 hover:bg-secondary/70"
              }`}
            >
              <span className="texto-institucional text-xs text-accent">Paso {p.num}</span>
              <span className="block text-sm font-semibold">{p.titulo}</span>
              <span className="block text-xs text-muted-foreground">{p.ayuda}</span>
            </button>
          ))}
        </div>
      </nav>

      {paso !== "cronologia" && resumen.length > 0 && (
        <div className="border-b border-border/60 bg-secondary/25">
          <div className="mx-auto max-w-6xl px-4 py-2">
            <p className="texto-institucional mb-1 text-[10px] tracking-wide text-accent uppercase">
              Datos capturados (solo referencia)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {resumen.map((r) => (
                <span
                  key={r.etiqueta}
                  className="rounded-md border border-border bg-card/60 px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  <span className="font-semibold text-foreground">{r.etiqueta}:</span> {r.valor}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto grid max-w-6xl gap-5 px-4 py-6 lg:grid-cols-[1.05fr_1fr]">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-placa)]">
          {paso === "cronologia" && (
            <div className="space-y-4">
              <div>
                <h2 className="texto-institucional text-lg font-bold">Secuencia cronológica</h2>
                <p className="text-sm text-muted-foreground">
                  Orden unidireccional obligatorio, formato de 24 horas (00:00 a 23:59).
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">Oficial primer respondiente</span>
                  <input
                    value={oficial}
                    onChange={(e) => setOficial(e.target.value)}
                    maxLength={120}
                    placeholder="Nombre y número de placa"
                    className="w-full rounded-lg border border-input bg-secondary/40 px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">Folio llamada / Flagrancia (observacion directa)</span>
                  <input
                    value={folio}
                    onChange={(e) => setFolio(e.target.value)}
                    maxLength={60}
                    placeholder="Ej. IPH-2026-00123"
                    className="w-full rounded-lg border border-input bg-secondary/40 px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">Falta administrativa</span>
                  <input
                    value={faltaAdministrativa}
                    onChange={(e) => setFaltaAdministrativa(e.target.value)}
                    maxLength={200}
                    placeholder="Ej. 38 CFF, 40 CFF, consumir bebidas alcohólicas..."
                    className="w-full rounded-lg border border-input bg-secondary/40 px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">Delito</span>
                  <input
                    value={delito}
                    onChange={(e) => setDelito(e.target.value)}
                    maxLength={200}
                    placeholder="Ej. Robo calificado, lesiones, portación de arma..."
                    className="w-full rounded-lg border border-input bg-secondary/40 px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
                {PASOS_CRONOLOGICOS.map((p, i) => (
                  <label key={p.key} className="text-sm">
                    <span className="mb-1 block text-muted-foreground">
                      {i + 1}. {p.label}
                    </span>
                    <input
                      type="time"
                      value={horas[p.key]}
                      onChange={(e) => setHoras({ ...horas, [p.key]: e.target.value })}
                      className="w-full rounded-lg border border-input bg-secondary/40 px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
                    />
                  </label>
                ))}
              </div>
              <button
                onClick={() => setPaso("narrativa")}
                className="w-full rounded-xl px-4 py-3 font-semibold text-accent-foreground"
                style={{ backgroundImage: "var(--gradient-dorado)" }}
              >
                Continuar a la narrativa
              </button>
            </div>
          )}

          {paso === "narrativa" && (
            <div className="space-y-4">
              <div>
                <h2 className="texto-institucional text-lg font-bold">Narrativa de los hechos</h2>
                <p className="text-sm text-muted-foreground">
                  Responda las preguntas esenciales con hechos observables, sin juicios de valor.
                </p>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {PREGUNTAS_ESENCIALES.map((p) => (
                  <li key={p.id} className="rounded-lg border border-border bg-secondary/30 p-2 text-xs">
                    <span className="font-semibold text-accent">{p.titulo}</span>
                    <span className="block text-muted-foreground">{p.ayuda}</span>
                  </li>
                ))}
              </ul>
              <textarea
                value={narrativa}
                onChange={(e) => setNarrativa(e.target.value)}
                rows={14}
                maxLength={20000}
                placeholder="Siendo las 21:40 horas del día... el suscrito, en calidad de primer respondiente, tuvo conocimiento..."
                className="w-full rounded-xl border border-input bg-secondary/30 p-3 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{narrativa.trim().length} caracteres</span>
                <span>
                  {criticos.length} hallazgo(s) crítico(s) · {hallazgos.length} en total
                </span>
              </div>
              <button
                onClick={pedirRevision}
                disabled={cargando}
                className="w-full rounded-xl px-4 py-3 font-semibold text-accent-foreground disabled:opacity-60"
                style={{ backgroundImage: "var(--gradient-dorado)" }}
              >
                {cargando ? "Revisando..." : "Revisar narrativa"}
              </button>
            </div>
          )}

          {paso === "revision" && (
            <div className="space-y-3">
              <div>
                <h2 className="texto-institucional text-lg font-bold">Hallazgos automáticos</h2>
                <p className="text-sm text-muted-foreground">
                  Validación cronológica, preguntas esenciales y estilo policial.
                </p>
              </div>
              {hallazgos.length === 0 ? (
                <div className="rounded-xl border border-success/50 bg-success/10 p-3 text-sm">
                  Sin incidencias detectadas por el validador automático.
                </div>
              ) : (
                <div className="space-y-2">
                  {hallazgos.map((h) => (
                    <BloqueHallazgo key={h.id} h={h} />
                  ))}
                </div>
              )}
              <button
                onClick={pedirRevision}
                disabled={cargando}
                className="w-full rounded-xl border border-accent/60 bg-accent/10 px-4 py-3 font-semibold disabled:opacity-60"
              >
                {cargando ? "Consultando al asesor..." : "Volver a revisar con el asesor"}
              </button>
              <button
                onClick={() => setPaso("envio")}
                className="w-full rounded-xl border border-border bg-secondary/50 px-4 py-3 font-semibold"
              >
                Continuar al envío
              </button>
            </div>
          )}

          {paso === "envio" && (
            <div className="space-y-4">
              <div>
                <h2 className="texto-institucional text-lg font-bold">Envío de la narrativa</h2>
                <p className="text-sm text-muted-foreground">
                  La narrativa revisada queda lista para su envío conforme a los protocolos institucionales.
                </p>
              </div>
              {criticos.length > 0 && (
                <div className="rounded-xl border border-destructive/60 bg-destructive/10 p-3 text-sm">
                  Existen {criticos.length} hallazgo(s) crítico(s) sin corregir. Se recomienda subsanarlos
                  antes de enviar.
                </div>
              )}
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">
                  Narrativa sugerida (editable)
                </span>
                <textarea
                  value={narrativaFinal}
                  onChange={(e) => {
                    setNarrativaFinal(e.target.value);
                    setEditadaPorUsuario(true);
                  }}
                  rows={14}
                  maxLength={20000}
                  placeholder="Aquí aparecerá la narrativa sugerida por el asesor para su edición."
                  className="w-full rounded-xl border border-input bg-secondary/30 p-3 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <button
                onClick={enviarNarrativaLista}
                className="w-full rounded-xl px-4 py-3 font-semibold text-accent-foreground"
                style={{ backgroundImage: "var(--gradient-dorado)" }}
              >
                Enviar narrativa lista
              </button>
              {avisoEnvio && <p className="text-xs text-muted-foreground">{avisoEnvio}</p>}
            </div>
          )}
        </section>

        <section
          className="flex max-h-[70vh] min-h-[480px] flex-col overflow-hidden rounded-2xl border border-border shadow-[var(--shadow-placa)]"
          style={{
            backgroundImage: `linear-gradient(oklch(0.16 0.05 258 / 0.86), oklch(0.16 0.05 258 / 0.94)), url(${fondoChat})`,
            backgroundSize: "cover",
          }}
        >
          <div className="flex items-center gap-3 border-b border-border/60 bg-card/70 px-4 py-3">
            <img
              src={oficialAcuerdos.url}
              alt=""
              width={36}
              height={36}
              loading="lazy"
              className="h-9 w-9 rounded-full object-cover object-top"
            />
            <div>
              <p className="texto-institucional text-sm font-bold">Asesor IPH</p>
              <p className="text-xs text-muted-foreground">
                {cargando ? "Analizando la narrativa..." : "En línea"}
              </p>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {mensajes.map((m) => (
              <div
                key={m.id}
                className={`max-w-[92%] rounded-2xl border px-3 py-2 text-sm whitespace-pre-wrap ${
                  m.autor === "asesor"
                    ? "border-border bg-card/85"
                    : "ml-auto border-accent/50 bg-accent/15"
                }`}
              >
                {m.autor === "asesor" ? <TextoAsesor texto={m.texto} /> : m.texto}
              </div>
            ))}
            {cargando && (
              <div className="max-w-[60%] rounded-2xl border border-border bg-card/85 px-3 py-2 text-sm text-muted-foreground">
                Revisando cronología, preguntas esenciales y estilo...
              </div>
            )}
            <div ref={finChat} />
          </div>

          <div className="flex gap-2 border-t border-border/60 bg-card/70 p-3">
            <input
              value={pregunta}
              onChange={(e) => setPregunta(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") pedirRevision();
              }}
              maxLength={500}
              placeholder="Pregunte al asesor: ¿cómo redacto el aseguramiento?"
              className="flex-1 rounded-xl border border-input bg-secondary/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        Uso interno · Dirección de Seguridad Pública Municipal de Chihuahua
      </footer>
    </div>
  );
}
