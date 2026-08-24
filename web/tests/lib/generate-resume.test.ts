import { downloadTailoredResume } from "@/lib/job-assistance/generate-resume";
import { buildJob } from "../mock/jobs.mock";

describe("downloadTailoredResume", () => {
  let createObjectURL: jest.Mock;
  let revokeObjectURL: jest.Mock;
  let clickSpy: jest.SpyInstance;
  let createElementSpy: jest.SpyInstance;
  let capturedBlobText: string | undefined;
  let OriginalBlob: typeof Blob;

  beforeEach(() => {
    jest.useFakeTimers();
    capturedBlobText = undefined;

    // jsdom's Blob doesn't reliably support reading its contents back out
    // (no .text()), so we capture the raw parts at construction time instead
    // of trying to read them off the resulting Blob. A plain reassignment
    // (restored manually below) sidesteps jest.spyOn's stricter typing for
    // constructable globals.
    OriginalBlob = global.Blob;
    global.Blob = function (parts?: BlobPart[]) {
      capturedBlobText = (parts ?? []).join("");
      return { size: 0, type: "text/plain" } as Blob;
    } as unknown as typeof Blob;

    createObjectURL = jest.fn(() => "blob:mock-url");
    revokeObjectURL = jest.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;

    clickSpy = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    createElementSpy = jest.spyOn(document, "createElement");
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    global.Blob = OriginalBlob;
  });

  function lastCreatedAnchor(): HTMLAnchorElement {
    const anchorCall = createElementSpy.mock.results.find((result) => result.value.tagName === "A");
    return anchorCall!.value as HTMLAnchorElement;
  }

  it("triggers exactly one download", () => {
    downloadTailoredResume(buildJob());

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("names the file after a slugified company name", () => {
    downloadTailoredResume(buildJob({ companyName: "Willow & Oak" }));

    expect(lastCreatedAnchor().getAttribute("download")).toBe("resume-willow-oak.txt");
  });

  it("falls back to a generic filename when the company name has no usable characters", () => {
    downloadTailoredResume(buildJob({ companyName: "!!!" }));

    expect(lastCreatedAnchor().getAttribute("download")).toBe("resume-job.txt");
  });

  it("includes the target role, job posting, contact, and notes in the file contents", () => {
    downloadTailoredResume(
      buildJob({
        companyName: "Willow & Oak",
        jobPostingUrl: "https://boards.greenhouse.io/willowoak/jobs/1",
        contacts: [
          { id: "c1", name: "Dana Reyes", role: "Recruiter", email: "dana@willowoak.co", linkedin: "" },
        ],
        notes: "Waiting on a phone screen.",
      }),
    );

    expect(capturedBlobText).toContain("Target role: Willow & Oak");
    expect(capturedBlobText).toContain("Job posting: https://boards.greenhouse.io/willowoak/jobs/1");
    expect(capturedBlobText).toContain("Contact: Dana Reyes <dana@willowoak.co>");
    expect(capturedBlobText).toContain("Waiting on a phone screen.");
  });

  it("falls back to placeholders when contact and notes are blank", () => {
    downloadTailoredResume(buildJob({ contacts: [], notes: "" }));

    expect(capturedBlobText).toContain("Contact: —");
    expect(capturedBlobText).toContain("(none)");
  });

  it("revokes the object URL shortly after triggering the download", () => {
    downloadTailoredResume(buildJob());

    expect(revokeObjectURL).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });
});
