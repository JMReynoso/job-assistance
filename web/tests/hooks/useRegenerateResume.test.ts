import { act, renderHook } from "@testing-library/react";
import { useRegenerateResume } from "@/hooks/useRegenerateResume";
import { buildApiGeneratedContent } from "../mock/api.mock";

/** Flushes pending microtasks so an awaited fetch's continuation can run. */
async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("useRegenerateResume", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  function deferredFetch() {
    let resolve!: (value: Response) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<Response>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    global.fetch = jest.fn(() => promise) as unknown as typeof fetch;
    return { resolve, reject };
  }

  it("paces through the stages, holds the last one, then resolves everything to done", async () => {
    const { resolve } = deferredFetch();
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useRegenerateResume(onSuccess));

    act(() => {
      result.current.start(1, ["Kubernetes"]);
    });
    expect(result.current.stages.map((s) => s.status)).toEqual(["pending", "pending", "pending", "pending"]);

    act(() => {
      jest.advanceTimersByTime(150);
    });
    expect(result.current.stages[0].status).toBe("running");

    // Past every paced transition — the last stage stays "running" on a
    // timer alone; it never flips to "done" without a real response.
    act(() => {
      jest.advanceTimersByTime(4300);
    });
    expect(result.current.stages.map((s) => s.status)).toEqual(["done", "done", "done", "running"]);

    const content = buildApiGeneratedContent({ jdMatchPercent: 91 });
    await act(async () => {
      resolve({ ok: true, status: 201, json: async () => content } as Response);
      await flushMicrotasks();
    });

    expect(result.current.stages.every((s) => s.status === "done")).toBe(true);
    expect(result.current.matchPercent).toBe(91);
    expect(onSuccess).toHaveBeenCalledWith(content);
  });

  it("marks the in-flight stage failed when the request rejects", async () => {
    const { reject } = deferredFetch();
    const { result } = renderHook(() => useRegenerateResume(jest.fn()));

    act(() => {
      result.current.start(1, ["Kubernetes"]);
    });
    act(() => {
      jest.advanceTimersByTime(150); // stage 0 now "running"
    });

    await act(async () => {
      reject(new Error("network down"));
      await flushMicrotasks();
    });

    expect(result.current.stages[0].status).toBe("failed");
  });

  it("resets to empty, without a failure state, when cancelled", async () => {
    global.fetch = jest.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      });
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useRegenerateResume(jest.fn()));

    act(() => {
      result.current.start(1, ["Kubernetes"]);
    });
    act(() => {
      jest.advanceTimersByTime(150);
    });
    expect(result.current.stages[0].status).toBe("running");

    await act(async () => {
      result.current.cancel();
      await flushMicrotasks();
    });

    expect(result.current.stages).toEqual([]);
    expect(result.current.active).toBe(false);
    expect(result.current.matchPercent).toBeNull();
  });

  it("retry() re-issues the call with the same jobId and keywords", async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => buildApiGeneratedContent({ jdMatchPercent: 95 }),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useRegenerateResume(jest.fn()));

    await act(async () => {
      result.current.start(7, ["Kubernetes", "gRPC"]);
      jest.advanceTimersByTime(4450);
      await flushMicrotasks();
    });
    expect(result.current.stages.every((s) => s.status === "done")).toBe(true);
    fetchMock.mockClear();

    await act(async () => {
      result.current.retry();
      jest.advanceTimersByTime(4450);
      await flushMicrotasks();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ jobId: 7, keywords: ["Kubernetes", "gRPC"] });
  });
});
