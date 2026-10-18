import { act, renderHook, waitFor } from "@testing-library/react";
import { useCreateJob } from "@/hooks/useCreateJob";
import { buildApiJob, mockApi } from "../mock/api.mock";
import { buildHomeForm } from "../mock/home-form.mock";

/** A fully-filled quick-add form — everything the pipeline needs to run end to end. */
const FULL_HOME = buildHomeForm({
  companyName: "Acme Robotics",
  jobPosting: "https://acme.example/careers/1",
  companyPage: "https://acme.example",
  companyLinkedIn: "https://linkedin.com/company/acme",
  extraLinks: "https://glassdoor.com/acme",
  jobDescription: "We are looking for a backend engineer...",
});

/** The job POST /jobs answers with — id 99, so DELETE assertions read cleanly. */
const CREATED_JOB = buildApiJob({ id: 99, companyName: "Acme Robotics" });

function noopCallbacks() {
  return { onCreated: jest.fn(), onFinished: jest.fn(), onDiscarded: jest.fn() };
}

function methodCalls(fetchMock: jest.Mock, method: string): string[] {
  return fetchMock.mock.calls
    .filter(([, init]) => (init as RequestInit | undefined)?.method === method)
    .map(([url]) => String(url));
}

describe("useCreateJob", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("runs the four writes in order, then reads the finished job back", async () => {
    const fetchMock = mockApi({ jobs: [CREATED_JOB], createdJob: CREATED_JOB });
    const callbacks = noopCallbacks();
    const { result } = renderHook(() => useCreateJob(callbacks));

    act(() => {
      result.current.start(FULL_HOME, "ollama");
    });

    await waitFor(() => expect(result.current.stages.every((s) => s.status === "done")).toBe(true));

    const postUrls = methodCalls(fetchMock, "POST");
    expect(postUrls).toEqual([
      expect.stringMatching(/\/jobs$/),
      expect.stringMatching(/\/company-research$/),
      expect.stringMatching(/\/generated-content$/),
      expect.stringMatching(/\/contacts$/),
    ]);

    expect(callbacks.onCreated).toHaveBeenCalledTimes(1);
    expect(callbacks.onCreated.mock.calls[0][0]).toMatchObject({ id: 99 });
    expect(callbacks.onFinished).toHaveBeenCalledTimes(1);
  });

  it("posts the API's field names, with extraUrls a string for /jobs and an array for /company-research", async () => {
    const fetchMock = mockApi({ jobs: [CREATED_JOB], createdJob: CREATED_JOB });
    const { result } = renderHook(() => useCreateJob(noopCallbacks()));

    act(() => {
      result.current.start(FULL_HOME, "ollama");
    });
    await waitFor(() => expect(result.current.stages.every((s) => s.status === "done")).toBe(true));

    const [, jobInit] = fetchMock.mock.calls.find(
      ([url, init]) => String(url).match(/\/jobs$/) && (init as RequestInit)?.method === "POST",
    ) as [unknown, RequestInit];
    const jobBody = JSON.parse(String(jobInit.body));
    expect(jobBody).toMatchObject({
      jobPostingUrl: "https://acme.example/careers/1",
      companyPageUrl: "https://acme.example",
      companyLinkedInUrl: "https://linkedin.com/company/acme",
      extraUrls: "https://glassdoor.com/acme",
    });

    const [, researchInit] = fetchMock.mock.calls.find(
      ([url, init]) => String(url).match(/\/company-research$/) && (init as RequestInit)?.method === "POST",
    ) as [unknown, RequestInit];
    const researchBody = JSON.parse(String(researchInit.body));
    expect(researchBody).toMatchObject({
      jobPostingUrl: "https://acme.example/careers/1",
      companyPageUrl: "https://acme.example",
      companyLinkedInUrl: "https://linkedin.com/company/acme",
      extraUrls: ["https://glassdoor.com/acme"],
    });
  });

  it("never calls /generated-content before /company-research resolves", async () => {
    const fetchMock = mockApi({ jobs: [CREATED_JOB], createdJob: CREATED_JOB, hangOn: "/company-research" });
    const { result } = renderHook(() => useCreateJob(noopCallbacks()));

    act(() => {
      result.current.start(FULL_HOME, "ollama");
    });

    await waitFor(() => expect(result.current.stages[1]?.status).toBe("running"));
    // Let any pending microtasks run — there should be nothing left to do.
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.stages[1].status).toBe("running");
    expect(methodCalls(fetchMock, "POST").some((url) => url.endsWith("/generated-content"))).toBe(false);
  });

  it("fails the research stage and stops the pipeline, leaving later stages pending", async () => {
    const fetchMock = mockApi({ jobs: [CREATED_JOB], createdJob: CREATED_JOB, failOn: "/company-research" });
    const { result } = renderHook(() => useCreateJob(noopCallbacks()));

    act(() => {
      result.current.start(FULL_HOME, "ollama");
    });

    await waitFor(() => expect(result.current.stages[1]?.status).toBe("failed"));

    expect(result.current.error).toBeTruthy();
    expect(result.current.stages.slice(2).every((s) => s.status === "pending")).toBe(true);
    expect(methodCalls(fetchMock, "POST").some((url) => url.endsWith("/generated-content"))).toBe(false);
  });

  it("retry() resumes at the failed stage without re-creating the job", async () => {
    mockApi({ jobs: [CREATED_JOB], createdJob: CREATED_JOB, failOn: "/company-research" });
    const { result } = renderHook(() => useCreateJob(noopCallbacks()));

    act(() => {
      result.current.start(FULL_HOME, "ollama");
    });
    await waitFor(() => expect(result.current.stages[1]?.status).toBe("failed"));

    const fetchMock = mockApi({ jobs: [CREATED_JOB], createdJob: CREATED_JOB });
    act(() => {
      result.current.retry();
    });

    await waitFor(() => expect(result.current.stages.every((s) => s.status === "done")).toBe(true));

    expect(methodCalls(fetchMock, "POST").some((url) => url.endsWith("/jobs"))).toBe(false);
  });

  it("cancel() right after creation deletes only the job and reports it discarded", async () => {
    const fetchMock = mockApi({ jobs: [CREATED_JOB], createdJob: CREATED_JOB, hangOn: "/company-research" });
    const callbacks = noopCallbacks();
    const { result } = renderHook(() => useCreateJob(callbacks));

    act(() => {
      result.current.start(FULL_HOME, "ollama");
    });
    await waitFor(() => expect(result.current.stages[1]?.status).toBe("running"));

    await act(async () => {
      await result.current.cancel();
    });

    expect(callbacks.onDiscarded).toHaveBeenCalledWith(99);
    const deletes = methodCalls(fetchMock, "DELETE");
    expect(deletes).toEqual([expect.stringContaining("/jobs/99")]);
  });

  it("cancel() after tailoring also deletes the generated content and research rows", async () => {
    const fetchMock = mockApi({ jobs: [CREATED_JOB], createdJob: CREATED_JOB, hangOn: "/contacts" });
    const callbacks = noopCallbacks();
    const { result } = renderHook(() => useCreateJob(callbacks));

    act(() => {
      result.current.start(FULL_HOME, "ollama");
    });
    await waitFor(() => expect(result.current.stages[3]?.status).toBe("running"));

    await act(async () => {
      await result.current.cancel();
    });

    expect(callbacks.onDiscarded).toHaveBeenCalledWith(99);
    const deletes = methodCalls(fetchMock, "DELETE");
    expect(deletes).toHaveLength(3);
    expect(deletes).toEqual(
      expect.arrayContaining([
        expect.stringContaining("/generated-content/"),
        expect.stringContaining("/company-research/"),
        expect.stringContaining("/jobs/99"),
      ]),
    );
  });

  it("reset() clears the stages and flips active back to false", async () => {
    mockApi({ jobs: [CREATED_JOB], createdJob: CREATED_JOB });
    const { result } = renderHook(() => useCreateJob(noopCallbacks()));

    act(() => {
      result.current.start(FULL_HOME, "ollama");
    });
    await waitFor(() => expect(result.current.active).toBe(true));

    act(() => {
      result.current.reset();
    });

    expect(result.current.stages).toEqual([]);
    expect(result.current.active).toBe(false);
  });
});
