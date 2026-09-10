import { missingAddFields } from "@/lib/job-assistance/new-job";
import { buildHomeForm } from "../../mock/home-form.mock";

describe("missingAddFields", () => {
  it("returns an empty array for a fully-filled form", () => {
    const home = buildHomeForm({
      companyName: "Acme Robotics",
      jobPosting: "https://acme.example/careers/1",
      companyPage: "https://acme.example",
      companyLinkedIn: "https://linkedin.com/company/acme",
      jobDescription: "We are looking for...",
    });

    expect(missingAddFields(home)).toEqual([]);
  });

  it("lists every required field's label for an empty form", () => {
    expect(missingAddFields(buildHomeForm())).toEqual([
      "Company name",
      "Job posting link",
      "Company page",
      "Company LinkedIn",
      "Job description",
    ]);
  });

  it("treats whitespace-only values as blank", () => {
    const home = buildHomeForm({
      companyName: "   ",
      jobPosting: "https://acme.example/careers/1",
      companyPage: "https://acme.example",
      companyLinkedIn: "https://linkedin.com/company/acme",
      jobDescription: "  \n  ",
    });

    expect(missingAddFields(home)).toEqual(["Company name", "Job description"]);
  });

  it("never lists extra links — it isn't required", () => {
    const home = buildHomeForm({
      companyName: "Acme Robotics",
      jobPosting: "https://acme.example/careers/1",
      companyPage: "https://acme.example",
      companyLinkedIn: "https://linkedin.com/company/acme",
      jobDescription: "We are looking for...",
      extraLinks: "",
    });

    expect(missingAddFields(home)).toEqual([]);
  });
});
