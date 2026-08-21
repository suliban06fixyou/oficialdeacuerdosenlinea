import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type CloudflareRuntimeEnv = {
  OPENAI_API_KEY?: string;
  IPH_RATE_LIMITER?: {
    limit: (options: { key: string }) => Promise<{ success: boolean }>;
  };
};

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

function getClientKey(request: Request) {
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

async function enforceRateLimit(request: Request, env: CloudflareRuntimeEnv) {
  // Server functions that send the IPH to OpenAI use POST. Limiting POSTs here
  // protects the AI endpoint before the request reaches the application logic.
  if (request.method !== "POST" || !env.IPH_RATE_LIMITER) return;

  const { success } = await env.IPH_RATE_LIMITER.limit({
    key: `revision:${getClientKey(request)}`,
  });

  if (!success) {
    return new Response(
      JSON.stringify({ error: "Límite temporal de revisiones alcanzado. Espere un minuto antes de volver a intentarlo." }),
      {
        status: 429,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        },
      },
    );
  }

  return undefined;
}

// TanStack Start server functions in this deployment read server-only secrets
// from process.env at request time. Cloudflare provides the real secret through
// the Worker env binding, so bridge that binding into process.env before Start
// handles the request. The secret never enters the client bundle or response.
function exposeRuntimeSecrets(env: unknown) {
  const runtimeEnv = env as CloudflareRuntimeEnv;
  if (runtimeEnv.OPENAI_API_KEY) {
    process.env.OPENAI_API_KEY = runtimeEnv.OPENAI_API_KEY;
  }
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const rateLimitResponse = await enforceRateLimit(request, env as CloudflareRuntimeEnv);
      if (rateLimitResponse) return rateLimitResponse;

      exposeRuntimeSecrets(env);
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
