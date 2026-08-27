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
