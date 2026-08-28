import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  cerrarSesionAdmin,
  iniciarSesionAdmin,
  obtenerEstadisticasUso,
  verificarSesionAdmin,
} from "@/lib/revision.functions";

type Estadisticas = {
  fecha: string;
  hoy: number;
  limiteDiario: number;
  disponible: number;
  porcentaje: number;
  totalSemana: number;
  dispositivosHoy: number;
  semana: { fecha: string; revisiones: number }[];
};

function PanelAdministrativo() {
  const iniciar = useServerFn(iniciarSesionAdmin);
  const cerrar = useServerFn(cerrarSesionAdmin);
  const verificar = useServerFn(verificarSesionAdmin);
  const obtener = useServerFn(obtenerEstadisticasUso);

  const [autenticado, setAutenticado] = useState(false);
  const [verificando, setVerificando] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [datos, setDatos] = useState<Estadisticas | null>(null);

  const cargar = async () => {
    const resultado = await obtener({ data: undefined });
    setDatos(resultado);
  };

  useEffect(() => {
    void verificar({ data: undefined })
      .then(async (r) => {
        setAutenticado(r.autenticado);
        if (r.autenticado) await cargar();
      })
      .catch(() => setAutenticado(false))
      .finally(() => setVerificando(false));
  }, []);

  const entrar = async () => {
    setError("");
    try {
      await iniciar({ data: { password } });
      setPassword("");
      setAutenticado(true);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No fue posible iniciar sesión.");
    }
  };

  const salir = async () => {
    await cerrar({ data: undefined });
    setDatos(null);
    setAutenticado(false);
  };

  if (verificando) {
    return <div className="min-h-screen bg-background p-6 text-center text-muted-foreground">Verificando acceso...</div>;
  }

  if (!autenticado) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-4">
        <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-placa)]">
          <p className="texto-institucional text-xs text-accent">ACCESO RESTRINGIDO</p>
          <h1 className="mt-1 text-2xl font-bold">Panel administrativo</h1>
          <p className="mt-2 text-sm text-muted-foreground">Ingrese la contraseña administrativa para consultar el uso de la plataforma.</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void entrar(); }}
            placeholder="Contraseña administrativa"
            className="mt-5 w-full rounded-xl border border-input bg-secondary/30 px-3 py-3 outline-none focus:ring-2 focus:ring-ring"
          />
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          <button onClick={() => void entrar()} className="mt-4 w-full rounded-xl px-4 py-3 font-semibold text-accent-foreground" style={{ backgroundImage: "var(--gradient-dorado)" }}>
            Ingresar
          </button>
          <a href="/" className="mt-4 block text-center text-sm text-muted-foreground underline">Volver a la aplicación</a>
        </section>
      </main>
    );
  }

  const porcentaje = Math.min(datos?.porcentaje ?? 0, 100);
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5">
          <div>
            <p className="texto-institucional text-xs text-accent">USO INTERNO · ACCESO PRIVADO</p>
            <h1 className="text-2xl font-bold">Panel administrativo</h1>
            <p className="text-sm text-muted-foreground">Monitoreo de revisiones y capacidad diaria.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => void cargar()} className="rounded-xl border border-border px-3 py-2 text-sm font-semibold">Actualizar</button>
            <button onClick={() => void salir()} className="rounded-xl border border-border px-3 py-2 text-sm font-semibold">Cerrar sesión</button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-2xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">Revisiones hoy</p><p className="mt-2 text-3xl font-bold">{datos?.hoy ?? "—"}</p><p className="mt-1 text-xs text-muted-foreground">Límite: {datos?.limiteDiario ?? 1300}</p></article>
          <article className="rounded-2xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">Disponibles hoy</p><p className="mt-2 text-3xl font-bold">{datos?.disponible ?? "—"}</p><p className="mt-1 text-xs text-muted-foreground">Capacidad restante</p></article>
          <article className="rounded-2xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">Dispositivos activos hoy</p><p className="mt-2 text-3xl font-bold">{datos?.dispositivosHoy ?? "—"}</p><p className="mt-1 text-xs text-muted-foreground">Con al menos una revisión</p></article>
          <article className="rounded-2xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">Últimos 7 días</p><p className="mt-2 text-3xl font-bold">{datos?.totalSemana ?? "—"}</p><p className="mt-1 text-xs text-muted-foreground">Total acumulado</p></article>
        </div>

        <section className="mt-5 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-end justify-between gap-4"><div><h2 className="text-lg font-bold">Capacidad diaria</h2><p className="text-sm text-muted-foreground">{datos?.fecha ?? ""}</p></div><p className="text-2xl font-bold">{datos?.porcentaje ?? 0}%</p></div>
          <div className="mt-4 h-4 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-accent transition-all" style={{ width: porcentaje + "%" }} /></div>
        </section>

        <section className="mt-5 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-bold">Actividad de los últimos 7 días</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-7">
            {(datos?.semana ?? []).map((dia) => <div key={dia.fecha} className="rounded-xl border border-border bg-secondary/30 p-3 text-center"><p className="text-xs text-muted-foreground">{dia.fecha.slice(5)}</p><p className="mt-1 text-xl font-bold">{dia.revisiones}</p></div>)}
          </div>
        </section>
      </section>
    </main>
  );
}

export const Route = createFileRoute("/admin")({
  component: PanelAdministrativo,
});
