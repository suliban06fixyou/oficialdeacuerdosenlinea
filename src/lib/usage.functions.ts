import { createServerFn } from "@tanstack/react-start";
import { env as cloudflareEnv } from "cloudflare:workers";

type D1Statement = {
  bind: (...values: unknown[]) => D1Statement;
  first: <T = unknown>() => Promise<T | null>;
};

type D1DatabaseLike = {
  prepare: (query: string) => D1Statement;
};

type CloudflareBindings = {
  DB?: D1DatabaseLike;
  ADMIN_USAGE_TOKEN?: string;
};

function getEnv(): CloudflareBindings {
  return cloudflareEnv as unknown as CloudflareBindings;
}

function getDb(): D1DatabaseLike {
  const db = getEnv().DB;
  if (!db || typeof db.prepare !== "function") {
    throw new Error("No está disponible el contador de uso.");
  }
  return db;
}

function fechaUTC() {
  return new Date().toISOString().slice(0, 10);
}

export const obtenerEstadisticasUso = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    if (!data || typeof data !== "object" || typeof (data as { token?: unknown }).token !== "string") {
      throw new Error("Solicitud administrativa no válida.");
    }
    return data as { token: string };
  })
  .handler(async ({ data }) => {
    const tokenConfigurado = getEnv().ADMIN_USAGE_TOKEN;

    if (!tokenConfigurado) {
      throw new Error("El acceso administrativo no está configurado.");
    }

    if (data.token !== tokenConfigurado) {
      throw new Error("Acceso no autorizado.");
    }

    const db = getDb();
    const fecha = fechaUTC();

    const global = await db
      .prepare("SELECT review_count FROM daily_usage WHERE usage_date = ?")
      .bind(fecha)
      .first<{ review_count: number }>();

    const dispositivos = await db
      .prepare("SELECT COUNT(*) AS total FROM device_usage WHERE usage_date = ?")
      .bind(fecha)
      .first<{ total: number }>();

    const usadas = Math.max(0, Number(global?.review_count ?? 0));
    const activas = Math.max(0, Number(dispositivos?.total ?? 0));

    return {
      fecha,
      revisionesUsadas: usadas,
      limiteDiario: 1300,
      disponibles: Math.max(0, 1300 - usadas),
      dispositivosActivos: activas,
    };
  });
