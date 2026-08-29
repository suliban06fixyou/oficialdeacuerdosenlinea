import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { obtenerEstadisticasUso } from "@/lib/usage.functions";

export const Route = createFileRoute("/admin-uso")({
  component: AdminUso,
});

function AdminUso() {
  const [token, setToken] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [datos, setDatos] = useState<{
    fecha: string;
    revisionesUsadas: number;
    limiteDiario: number;
    disponibles: number;
    dispositivosActivos: number;
  } | null>(null);

  async function consultar() {
    if (cargando) return;
    setError("");
    setDatos(null);

    if (!token.trim()) {
      setError("Ingresa la clave administrativa.");
      return;
    }

    setCargando(true);
    try {
      const resultado = await obtenerEstadisticasUso({ data: { token } });
      setDatos(resultado);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible consultar las estadísticas.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <section className="mx-auto max-w-2xl rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-foreground">Panel privado de uso</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Consulta administrativa del consumo diario. Las narrativas de IPH no se almacenan aquí.
        </p>

        {!datos ? (
          <div className="mt-6 space-y-3">
            <label className="block text-sm font-medium text-foreground" htmlFor="admin-token">
              Clave administrativa
            </label>
            <input
              id="admin-token"
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") consultar();
              }}
              className="w-full rounded-md border bg-background px-3 py-2 text-foreground"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={consultar}
              disabled={cargando}
              className="w-full rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-60"
            >
              {cargando ? "Consultando..." : "Consultar estadísticas"}
            </button>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-muted-foreground">Fecha UTC del contador: {datos.fecha}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Tarjeta titulo="Revisiones utilizadas" valor={`${datos.revisionesUsadas} / ${datos.limiteDiario}`} />
              <Tarjeta titulo="Revisiones disponibles" valor={String(datos.disponibles)} />
              <Tarjeta titulo="Dispositivos activos" valor={String(datos.dispositivosActivos)} />
              <Tarjeta
                titulo="Promedio por dispositivo"
                valor={datos.dispositivosActivos > 0 ? (datos.revisionesUsadas / datos.dispositivosActivos).toFixed(1) : "0"}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setDatos(null);
                setToken("");
              }}
              className="rounded-md border px-4 py-2 text-sm font-medium"
            >
              Cerrar consulta
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

function Tarjeta({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">{titulo}</p>
      <p className="mt-1 text-2xl font-bold text-foreground">{valor}</p>
    </div>
  );
}
