import {
  STATUS_TO_API,
  mapContact,
  mapJob,
  mergeJobDetail,
  splitExtraLinks,
  toCreateCompanyResearch,
  toCreateGeneratedContent,
  toCreateJob,
  toFindContacts,
  toJobDetailPatch,
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
  buildApiMissingKeyword,
} from "../../mock/api.mock";
import { buildJob } from "../../mock/jobs.mock";
import { buildHomeForm } from "../../mock/home-form.mock";

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
        companyPageUrl: "https://willowoak.co",
        jobPostingUrl: "https://boards.greenhouse.io/willowoak/jobs/1",
        companyLinkedInUrl: "https://www.linkedin.com/company/willowoak",
        extraUrls: "https://crunchbase.com/willowoak",
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

  it("coalesces a null extraUrls to an empty string", () => {
    expect(mapJob(buildApiJob({ extraUrls: null })).extraLinks).toBe("");
  });

  it("leaves the by-job fields empty — they aren't part of GET /jobs", () => {
    const job = mapJob(buildApiJob());
    expect(job.contacts).toEqual([]);
    expect(job.notes).toBe("");
    expect(job.recruiterMessage).toBe("");
    expect(job.followupMessage).toBe("");
    expect(job.jdMatchPercent).toBeNull();
    expect(job.missingKeywords).toEqual([]);
  });

  it("carries the job description through, coalescing null to empty", () => {
    expect(mapJob(buildApiJob({ jobDescription: "We need a backend engineer…" })).jobDescription).toBe(
      "We need a backend engineer…",
    );
    expect(mapJob(buildApiJob({ jobDescription: null })).jobDescription).toBe("");
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

  it("carries the match percentage and missing keywords onto the job", () => {
    const job = mergeJobDetail({
      job: buildApiJob(),
      contacts: [],
      research: null,
      content: buildApiGeneratedContent({
        jdMatchPercent: 72,
        missingKeywords: [buildApiMissingKeyword({ keyword: "Kubernetes", include: true })],
      }),
    });

    expect(job.jdMatchPercent).toBe(72);
    expect(job.missingKeywords).toEqual([{ keyword: "Kubernetes", include: true }]);
  });

  it("keeps jdMatchPercent null rather than coalescing it to 0 when unscored", () => {
    const job = mergeJobDetail({
      job: buildApiJob(),
      contacts: [],
      research: null,
      content: buildApiGeneratedContent({ jdMatchPercent: null }),
    });

    expect(job.jdMatchPercent).toBeNull();
  });

  it("defaults jdMatchPercent to null and missingKeywords to empty with no content at all", () => {
    const job = mergeJobDetail({
      job: buildApiJob(),
      contacts: [],
      research: null,
      content: null,
    });

    expect(job.jdMatchPercent).toBeNull();
    expect(job.missingKeywords).toEqual([]);
  });
});

describe("toJobDetailPatch", () => {
  it("sends every field for a fully-populated draft, in the API's spelling", () => {
    const draft = buildJob({
      companyName: "Willow & Oak",
      status: "Applied",
      dateApplied: "2026-07-03",
      dateLastContacted: "2026-07-09",
      jobPostingUrl: "https://boards.greenhouse.io/willowoak/jobs/1",
      companyUrl: "https://willowoak.co",
      notes: "Founded 2011.",
      recruiterMessage: "Hi Dana",
      followupMessage: "Checking in",
    });

    expect(toJobDetailPatch(draft, ["Kubernetes"])).toEqual({
      companyName: "Willow & Oak",
      status: "applied",
      dateApplied: "2026-07-03",
      dateLastContacted: "2026-07-09",
      jobPostingUrl: "https://boards.greenhouse.io/willowoak/jobs/1",
      companyPageUrl: "https://willowoak.co",
      notes: "Founded 2011.",
      outreachMessage: "Hi Dana",
      followupMessage: "Checking in",
      includedKeywords: ["Kubernetes"],
    });
  });

  it("omits companyName, both dates and both URLs when blank, but still sends the rest", () => {
    const draft = buildJob({
      companyName: "   ",
      dateApplied: "",
      dateLastContacted: "",
      jobPostingUrl: "  ",
      companyUrl: "",
      notes: "",
      recruiterMessage: "",
      followupMessage: "",
    });

    const patch = toJobDetailPatch(draft, []);

    expect(patch).not.toHaveProperty("companyName");
    expect(patch).not.toHaveProperty("dateApplied");
    expect(patch).not.toHaveProperty("dateLastContacted");
    expect(patch).not.toHaveProperty("jobPostingUrl");
    expect(patch).not.toHaveProperty("companyPageUrl");
    expect(patch).toMatchObject({ notes: "", outreachMessage: "", followupMessage: "" });
  });

  it("passes includedKeywords through as-is, including an empty array", () => {
    const draft = buildJob();

    expect(toJobDetailPatch(draft, []).includedKeywords).toEqual([]);
    expect(toJobDetailPatch(draft, ["Kubernetes", "Terraform"]).includedKeywords).toEqual([
      "Kubernetes",
      "Terraform",
    ]);
  });
});

describe("splitExtraLinks", () => {
  it("trims each line and drops blank ones", () => {
    expect(splitExtraLinks(" https://a.com \n\n https://b.com\n  \n")).toEqual([
      "https://a.com",
      "https://b.com",
    ]);
  });

  it("returns an empty array for a blank textarea", () => {
    expect(splitExtraLinks("   \n  ")).toEqual([]);
  });
});

describe("toCreateJob", () => {
  const home = buildHomeForm({
    companyName: "  Acme Robotics  ",
    jobPosting: " https://acme.example/careers/1 ",
    companyPage: " https://acme.example ",
    companyLinkedIn: " https://linkedin.com/company/acme ",
    jobDescription: "We are looking for...",
  });

  it("trims fields and uses the API's field names", () => {
    const body = toCreateJob(buildHomeForm({ ...home, extraLinks: "" }));

    expect(body).toEqual({
      companyName: "Acme Robotics",
      jobPostingUrl: "https://acme.example/careers/1",
      companyPageUrl: "https://acme.example",
      companyLinkedInUrl: "https://linkedin.com/company/acme",
      jobDescription: "We are looking for...",
    });
  });

  it("sends extraUrls as a single string only when the textarea has exactly one line", () => {
    expect(toCreateJob(buildHomeForm({ ...home, extraLinks: "https://glassdoor.com/acme" })).extraUrls).toBe(
      "https://glassdoor.com/acme",
    );
  });

  it("omits extraUrls when the textarea is empty or has more than one line", () => {
    expect(toCreateJob(buildHomeForm({ ...home, extraLinks: "" })).extraUrls).toBeUndefined();
    expect(
      toCreateJob(buildHomeForm({ ...home, extraLinks: "https://a.com\nhttps://b.com" })).extraUrls,
    ).toBeUndefined();
  });
});

describe("toCreateCompanyResearch", () => {
  const home = buildHomeForm({
    companyName: "  Acme Robotics  ",
    jobPosting: " https://acme.example/careers/1 ",
    companyPage: " https://acme.example ",
    companyLinkedIn: " https://linkedin.com/company/acme ",
  });

  it("trims fields and uses the API's field names, carrying the jobId", () => {
    const body = toCreateCompanyResearch(7, buildHomeForm({ ...home, extraLinks: "" }));

    expect(body).toEqual({
      jobId: 7,
      companyName: "Acme Robotics",
      jobPostingUrl: "https://acme.example/careers/1",
      companyPageUrl: "https://acme.example",
      companyLinkedInUrl: "https://linkedin.com/company/acme",
    });
  });

  it("sends extraUrls as an array of every line", () => {
    const body = toCreateCompanyResearch(
      7,
      buildHomeForm({ ...home, extraLinks: "https://a.com\nhttps://b.com" }),
    );

    expect(body.extraUrls).toEqual(["https://a.com", "https://b.com"]);
  });

  it("omits extraUrls when the textarea is empty", () => {
    expect(toCreateCompanyResearch(7, buildHomeForm({ ...home, extraLinks: "" })).extraUrls).toBeUndefined();
  });
});

describe("toCreateGeneratedContent", () => {
  it("sends the job description as jobPosting and the company page as companyWebsite", () => {
    const home = buildHomeForm({
      companyName: "Acme Robotics",
      companyPage: " https://acme.example ",
      jobDescription: "We are looking for...",
    });

    expect(toCreateGeneratedContent(7, home)).toEqual({
      jobId: 7,
      jobPosting: "We are looking for...",
      companyWebsite: "https://acme.example",
      companyName: "Acme Robotics",
    });
  });
});

describe("toFindContacts", () => {
  it("sends jobId and companyPageUrl, with no limit", () => {
    const home = buildHomeForm({ companyPage: " https://acme.example " });

    expect(toFindContacts(7, home)).toEqual({
      jobId: 7,
      companyPageUrl: "https://acme.example",
    });
  });
});
