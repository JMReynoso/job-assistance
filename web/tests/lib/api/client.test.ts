import { ApiError, apiGet, apiPost } from "@/lib/api/client";

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

describe("apiPost", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("sends the body as JSON and returns the parsed response", async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => ({ id: 1, jdMatchPercent: 88 }),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(apiPost("/generated-content/regenerate", { jobId: 1, keywords: ["Kubernetes"] })).resolves.toEqual({
      id: 1,
      jdMatchPercent: 88,
    });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/generated-content/regenerate");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ jobId: 1, keywords: ["Kubernetes"] });
  });

  it("throws an ApiError carrying the status for a non-ok response", async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    await expect(apiPost("/generated-content/regenerate", {})).rejects.toMatchObject({
      name: "ApiError",
      status: 400,
    });
  });

  it("reports status 0 when the request never reached the server", async () => {
    global.fetch = jest.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;

    const error = await apiPost("/generated-content/regenerate", {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(0);
  });

  it("rethrows an AbortError unchanged rather than wrapping it in an ApiError", async () => {
    const abortError = new DOMException("Aborted", "AbortError");
    global.fetch = jest.fn(async () => {
      throw abortError;
    }) as unknown as typeof fetch;

    await expect(apiPost("/generated-content/regenerate", {})).rejects.toBe(abortError);
  });
});
