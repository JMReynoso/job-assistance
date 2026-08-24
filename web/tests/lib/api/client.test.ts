import { ApiError, apiGet } from "@/lib/api/client";

describe("apiGet", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns the parsed body on success", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ id: 1 }),
    })) as unknown as typeof fetch;

    await expect(apiGet<{ id: number }>("/jobs/1")).resolves.toEqual({ id: 1 });
  });

  it("passes a null body straight through", async () => {
    // The by-job endpoints answer 200 + null for "this job has none yet".
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => null,
    })) as unknown as typeof fetch;

    await expect(apiGet("/company-research/by-job/1")).resolves.toBeNull();
  });

  it("throws an ApiError carrying the status for a non-ok response", async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    await expect(apiGet("/jobs")).rejects.toMatchObject({
      name: "ApiError",
      status: 500,
      path: "/jobs",
    });
  });

  it("reports status 0 when the request never reached the server", async () => {
    // fetch rejects on network/CORS failure; HTTP errors resolve.
    global.fetch = jest.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;

    const error = await apiGet("/jobs").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(0);
  });
});
