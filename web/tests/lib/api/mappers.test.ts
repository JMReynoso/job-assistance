import {
  STATUS_TO_API,
  mapContact,
  mapJob,
  mergeJobDetail,
  toJobId,
  toJobStatus,
} from "@/lib/api/mappers";
import { STATUS_OPTIONS } from "@/lib/job-assistance/constants";
import type { ApiStatus } from "@/lib/api/types";
import {
  buildApiCompanyResearch,
  buildApiContact,
  buildApiGeneratedContent,
  buildApiJob,
} from "../../mock/api.mock";
import { buildJob } from "../../mock/jobs.mock";

const ALL_API_STATUSES: ApiStatus[] = [
  "not_applied",
  "applied",
  "phone_screening",
  "interviewing",
  "offer",
  "rejected",
  "ghosted",
];

describe("toJobStatus / STATUS_TO_API", () => {
  it("maps every backend status to a UI status", () => {
    ALL_API_STATUSES.forEach((status) => {
      expect(STATUS_OPTIONS).toContain(toJobStatus(status));
    });
  });

  it("round-trips every UI status back to the backend", () => {
    STATUS_OPTIONS.forEach((status) => {
      expect(toJobStatus(STATUS_TO_API[status])).toBe(status);
    });
  });

  it("falls back rather than returning undefined for an unknown status", () => {
    // status is an unconstrained text column, and JobTableRow indexes
    // STATUS_STYLES with the result — undefined there unmounts the table.
    expect(toJobStatus("something_new")).toBe("Interested");
  });
});

describe("toJobId", () => {
  it("reads a persisted row's id", () => {
    expect(toJobId("3")).toBe(3);
  });

  it.each(["local-abc", "3.5", "0", "-1", "", "a3f2b1c8-0000"])(
    "treats %p as not persisted",
    (id) => {
      expect(toJobId(id)).toBeNull();
    },
  );
});

describe("mapContact", () => {
  it("joins the name and carries role, linkedin and confidence", () => {
    const contact = mapContact(buildApiContact());
    expect(contact).toEqual({
      id: "11",
      name: "Dana Reyes",
      role: "Recruiter",
      email: "dana@willowoak.co",
      linkedin: "linkedin.com/in/danareyes",
      confidence: 94,
    });
  });

  it.each([
    [{ firstName: "Dana", lastName: null }, "Dana"],
    [{ firstName: null, lastName: "Reyes" }, "Reyes"],
    [{ firstName: null, lastName: null }, ""],
  ])("builds a name from %p", (names, expected) => {
    expect(mapContact(buildApiContact(names)).name).toBe(expected);
  });

  it("coalesces null position and linkedin to empty strings", () => {
    // These bind to controlled inputs — a null would make them uncontrolled.
    const contact = mapContact(buildApiContact({ position: null, linkedin: null }));
    expect(contact.role).toBe("");
    expect(contact.linkedin).toBe("");
  });
});

describe("mapJob", () => {
  it("renames every field the two schemas disagree on", () => {
    const job = mapJob(
      buildApiJob({
        companyPage: "https://willowoak.co",
        jobPostingURL: "https://boards.greenhouse.io/willowoak/jobs/1",
        companyLinkedIn: "https://www.linkedin.com/company/willowoak",
        extraURLs: "https://crunchbase.com/willowoak",
      }),
    );

    expect(job.companyUrl).toBe("https://willowoak.co");
    expect(job.jobPostingUrl).toBe("https://boards.greenhouse.io/willowoak/jobs/1");
    expect(job.companyLinkedInUrl).toBe("https://www.linkedin.com/company/willowoak");
    expect(job.extraLinks).toBe("https://crunchbase.com/willowoak");
    expect(job.id).toBe("1");
  });

  it("carries both dates through verbatim", () => {
    const job = mapJob(buildApiJob({ dateApplied: "2026-07-03", dateLastContacted: "2026-07-09" }));
    expect(job.dateApplied).toBe("2026-07-03");
    expect(job.dateLastContacted).toBe("2026-07-09");
  });

  it("coalesces a null extraURLs to an empty string", () => {
    expect(mapJob(buildApiJob({ extraURLs: null })).extraLinks).toBe("");
  });

  it("leaves the by-job fields empty — they aren't part of GET /jobs", () => {
    const job = mapJob(buildApiJob());
    expect(job.contacts).toEqual([]);
    expect(job.notes).toBe("");
    expect(job.recruiterMessage).toBe("");
    expect(job.followupMessage).toBe("");
  });

  it("produces the same overlapping fields the UI fixture declares", () => {
    // Ties the two builders together: a rename in either shape fails here.
    const mapped = mapJob(buildApiJob());
    const fixture = buildJob();
    expect(mapped.id).toBe(fixture.id);
    expect(mapped.companyName).toBe(fixture.companyName);
    expect(mapped.status).toBe(fixture.status);
    expect(mapped.companyUrl).toBe(fixture.companyUrl);
  });
});

describe("mergeJobDetail", () => {
  it("folds research and generated content onto the job", () => {
    const job = mergeJobDetail({
      job: buildApiJob(),
      contacts: [buildApiContact()],
      research: buildApiCompanyResearch({ summary: "Founded 2011." }),
      content: buildApiGeneratedContent({
        outreachMessage: "Hi Dana",
        followupMessage: "Checking in",
      }),
    });

    expect(job.notes).toBe("Founded 2011.");
    expect(job.recruiterMessage).toBe("Hi Dana");
    expect(job.followupMessage).toBe("Checking in");
    expect(job.contacts).toHaveLength(1);
    expect(job.contacts[0].name).toBe("Dana Reyes");
  });

  it("leaves those fields blank when the job has no research or content", () => {
    const job = mergeJobDetail({
      job: buildApiJob(),
      contacts: [],
      research: null,
      content: null,
    });

    expect(job.notes).toBe("");
    expect(job.recruiterMessage).toBe("");
    expect(job.followupMessage).toBe("");
    expect(job.contacts).toEqual([]);
  });

  it("blanks messages that exist as a row but with null columns", () => {
    const job = mergeJobDetail({
      job: buildApiJob(),
      contacts: [],
      research: null,
      content: buildApiGeneratedContent({ outreachMessage: null, followupMessage: null }),
    });

    expect(job.recruiterMessage).toBe("");
    expect(job.followupMessage).toBe("");
  });
});
