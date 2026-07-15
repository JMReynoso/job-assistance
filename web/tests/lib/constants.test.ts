import { MESSAGE_STYLE_OPTIONS, STATUS_OPTIONS, STATUS_STYLES } from "@/lib/job-assistance/constants";

describe("constants", () => {
  it("defines a status style for every status option", () => {
    STATUS_OPTIONS.forEach((status) => {
      expect(STATUS_STYLES[status]).toBeDefined();
      expect(STATUS_STYLES[status].bg).toMatch(/^#[0-9a-f]{6}$/i);
      expect(STATUS_STYLES[status].color).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });

  it("has no duplicate status or message style options", () => {
    expect(new Set(STATUS_OPTIONS).size).toBe(STATUS_OPTIONS.length);
    expect(new Set(MESSAGE_STYLE_OPTIONS).size).toBe(MESSAGE_STYLE_OPTIONS.length);
  });
});
