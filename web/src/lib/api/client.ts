import { API_BASE_URL } from "./config";

/**
 * A request that reached the API and came back not-ok, or never reached it at
 * all. `status` is the HTTP status, or 0 when the request failed before a
 * response existed (server down, DNS, CORS refusal).
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * GETs JSON from the API.
 *
 * Every non-ok response is a real error: the by-job endpoints return `[]` or
 * `null` for "this job has none yet" rather than 404ing, so callers never have
 * to treat a status code as an absence signal.
 */
export async function apiGet<T>(path: string): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    // fetch only rejects on network/CORS failure — HTTP errors resolve, so
    // this branch means we never got a response at all.
    throw new ApiError(0, path, "Couldn't reach the server.");
  }

  if (!response.ok) {
    throw new ApiError(response.status, path, `GET ${path} failed (${response.status})`);
  }

  return (await response.json()) as T;
}

/**
 * Shared implementation for the JSON-body verbs. The AbortSignal is what lets
 * the regenerate progress modal cancel an in-flight call.
 */
async function sendJson<T>(
  method: "POST" | "PATCH",
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, path, "Couldn't reach the server.");
  }

  if (!response.ok) {
    throw new ApiError(response.status, path, `${method} ${path} failed (${response.status})`);
  }

  return (await response.json()) as T;
}

/**
 * POSTs JSON to the API. Accepts an optional AbortSignal so long-running
 * calls (resume regeneration) can be cancelled from the UI — an aborted
 * fetch rejects with a DOMException named "AbortError", which is rethrown
 * as-is so callers can tell "user cancelled" from "server down".
 */
export function apiPost<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  return sendJson<T>("POST", path, body, signal);
}

/** PATCHes JSON to the API. Same error contract as apiPost. */
export function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return sendJson<T>("PATCH", path, body);
}
